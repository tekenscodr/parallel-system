import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";
import { normalizeConstituency } from "@/lib/constituency-normalizer";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const url = new URL(req.url);
    const level = url.searchParams.get("level")?.trim() || "";
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const slot = url.searchParams.get("slot")?.trim() || "";

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const result = await withEcSql(async (sql) => {
      const conditions = [];

      if (level) {
        conditions.push(sql`executive_level = ${level}`);
      }
      if (region) {
        conditions.push(sql`region ILIKE ${region}`);
      }
      if (constituency) {
        const norm = normalizeConstituency(constituency);
        if (norm && norm !== constituency) {
          conditions.push(sql`(constituency ILIKE ${constituency} OR constituency ILIKE ${norm})`);
        } else {
          conditions.push(sql`constituency ILIKE ${constituency}`);
        }
      }
      if (search) {
        const s = `%${search}%`;
        conditions.push(
          sql`(executive_name ILIKE ${s} OR voter_id ILIKE ${s} OR position ILIKE ${s} OR constituency ILIKE ${s})`
        );
      }
      if (slot === "elected") {
        conditions.push(sql`slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%'`);
      } else if (slot === "appointed") {
        conditions.push(sql`(slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%')`);
      }

      if (cohort === "women") {
        conditions.push(sql`gender = 'Female'`);
      } else if (cohort === "nasara") {
        conditions.push(sql`position ILIKE '%nasara%'`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      // Position hierarchy ranking based on the official 19-position executive slots
      const positionRankSql = sql`
        CASE 
          WHEN position ILIKE '%1st Vice%' OR position ILIKE '%First Vice%' THEN 2
          WHEN position ILIKE '%2nd Vice%' OR position ILIKE '%Second Vice%' THEN 3
          WHEN position ILIKE '%3rd Vice%' OR position ILIKE '%Third Vice%' THEN 4
          WHEN position ILIKE '%Vice%' THEN 3
          WHEN position ILIKE '%Chair%' THEN 1
          WHEN position ILIKE '%Deputy Secretary%' OR position ILIKE '%Assistant Secretary%' THEN 5
          WHEN position ILIKE '%Financial Secretary%' THEN 12
          WHEN position ILIKE '%General Secretary%' OR position ILIKE '%Secretary%' THEN 4
          WHEN position ILIKE '%Treasurer%' THEN 6
          WHEN position ILIKE '%Deputy Women%' OR position ILIKE '%Assistant Women%' THEN 17
          WHEN position ILIKE '%Deputy Youth%' OR position ILIKE '%Assistant Youth%' THEN 18
          WHEN position ILIKE '%Deputy Nasara%' OR position ILIKE '%Assistant Nasara%' THEN 19
          WHEN position ILIKE '%Deputy Organi%' OR position ILIKE '%Assistant Organi%' THEN 16
          WHEN position ILIKE '%Women Organi%' OR position ILIKE '%Women%' THEN 8
          WHEN position ILIKE '%Youth Organi%' OR position ILIKE '%Youth%' THEN 9
          WHEN position ILIKE '%Nasara%' THEN 10
          WHEN position ILIKE '%Communication%' THEN 11
          WHEN position ILIKE '%Electoral%' THEN 13
          WHEN position ILIKE '%Research%' THEN 14
          WHEN position ILIKE '%PWD%' OR position ILIKE '%Disabil%' THEN 15
          WHEN position ILIKE '%Organi%' THEN 7
          WHEN position ILIKE '%Coordinator%' THEN 20
          WHEN position ILIKE '%Officer%' THEN 21
          ELSE 30
        END
      `;

      const levelRankSql = sql`
        CASE
          WHEN executive_level ILIKE '%National%' THEN 1
          WHEN executive_level ILIKE '%Region%' THEN 2
          WHEN executive_level ILIKE '%Constituency%' THEN 3
          WHEN executive_level ILIKE '%Electoral Area%' THEN 4
          WHEN executive_level ILIKE '%Polling Station%' THEN 5
          WHEN executive_level ILIKE '%TESCON%' THEN 6
          ELSE 7
        END
      `;

      let orderBySql;
      const lowerLevel = level.toLowerCase();
      if (lowerLevel === "constituency") {
        orderBySql = sql`ORDER BY region ASC, constituency ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "region" || lowerLevel === "regional") {
        orderBySql = sql`ORDER BY region ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "national") {
        orderBySql = sql`ORDER BY ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "electoral area") {
        orderBySql = sql`ORDER BY region ASC, constituency ASC, electoral_area ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "polling station") {
        orderBySql = sql`ORDER BY region ASC, constituency ASC, electoral_area ASC, polling_station ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else {
        orderBySql = sql`ORDER BY ${levelRankSql} ASC, region ASC, constituency ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      }

      const [countRes, rowsRes] = await Promise.all([
        sql`SELECT COUNT(*)::int as total FROM executives_all ${whereClause}`,
        sql`
          SELECT 
            id,
            executive_level as "executiveLevel",
            slot_status as "slotStatus",
            region,
            constituency,
            electoral_area as "electoralArea",
            polling_station as "pollingStation",
            position,
            executive_name as "executiveName",
            membership_id as "membershipId",
            phone,
            email,
            ghana_card as "ghanaCard",
            voter_id as "voterId",
            gender,
            date_of_birth as "dateOfBirth",
            age,
            status
          FROM executives_all
          ${whereClause}
          ${orderBySql}
          LIMIT ${limit} OFFSET ${offset}
        `
      ]);

      const total = countRes[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: rowsRes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages
        }
      };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Executives query failed";
    console.error("Executives API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const {
      executiveName,
      executiveLevel,
      slotStatus = "Elected",
      region,
      constituency = "",
      electoralArea = "",
      pollingStation = "",
      position,
      gender = "Male",
      phone = "",
      email = "",
      ghanaCard = "",
      voterId = "",
      membershipId = "",
      dateOfBirth = "",
      age,
      status = "Active",
    } = body;

    if (!executiveName || !executiveName.trim()) {
      return NextResponse.json({ error: "Executive Name is required." }, { status: 400 });
    }
    if (!position || !position.trim()) {
      return NextResponse.json({ error: "Position is required." }, { status: 400 });
    }
    if (!executiveLevel || !executiveLevel.trim()) {
      return NextResponse.json({ error: "Executive Level is required." }, { status: 400 });
    }
    if (!region || !region.trim()) {
      return NextResponse.json({ error: "Region is required." }, { status: 400 });
    }

    // Calculate age if dateOfBirth provided or age passed
    let parsedAge: number | null = null;
    if (age !== undefined && age !== null && age !== "") {
      parsedAge = parseInt(String(age), 10);
      if (isNaN(parsedAge)) parsedAge = null;
    } else if (dateOfBirth && dateOfBirth.trim()) {
      const yearMatch = dateOfBirth.match(/(\d{4})/);
      if (yearMatch) {
        parsedAge = new Date().getFullYear() - parseInt(yearMatch[1], 10);
      }
    }

    const isYouth = position.toLowerCase().includes("youth");
    let isAgeAdjusted = false;
    if (isYouth && parsedAge !== null && parsedAge > 40) {
      parsedAge = 39;
      isAgeAdjusted = true;
    }

    const newExecutive = await withEcSql(async (sql) => {
      const rows = await sql`
        INSERT INTO executives_all (
          executive_name,
          executive_level,
          slot_status,
          region,
          constituency,
          electoral_area,
          polling_station,
          position,
          gender,
          phone,
          email,
          ghana_card,
          voter_id,
          membership_id,
          date_of_birth,
          age,
          is_youth_organiser,
          is_age_adjusted,
          record_entered_by,
          status
        ) VALUES (
          ${executiveName.trim()},
          ${executiveLevel.trim()},
          ${slotStatus.trim()},
          ${region.trim()},
          ${normalizeConstituency(constituency) || null},
          ${electoralArea.trim() || null},
          ${pollingStation.trim() || null},
          ${position.trim()},
          ${gender.trim() || null},
          ${phone.trim() || null},
          ${email.trim() || null},
          ${ghanaCard.trim() || null},
          ${voterId.trim() || null},
          ${membershipId.trim() || null},
          ${dateOfBirth.trim() || null},
          ${parsedAge},
          ${isYouth},
          ${isAgeAdjusted},
          ${session.user.name || session.user.email},
          ${status.trim()}
        )
        RETURNING 
          id,
          executive_level as "executiveLevel",
          slot_status as "slotStatus",
          region,
          constituency,
          electoral_area as "electoralArea",
          polling_station as "pollingStation",
          position,
          executive_name as "executiveName",
          membership_id as "membershipId",
          phone,
          email,
          ghana_card as "ghanaCard",
          voter_id as "voterId",
          gender,
          date_of_birth as "dateOfBirth",
          age,
          status
      `;
      return rows[0] || null;
    });

    if (!newExecutive) {
      return NextResponse.json({ error: "Failed to insert executive record." }, { status: 500 });
    }

    // Log AuditEvent
    const clientIp = getClientIp(req);
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "EXECUTIVE_CREATE",
      resource: "executives_all",
      resourceId: String(newExecutive.id),
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        executiveName: newExecutive.executiveName,
        position: newExecutive.position,
        executiveLevel: newExecutive.executiveLevel,
        region: newExecutive.region,
        constituency: newExecutive.constituency,
        voterId: newExecutive.voterId,
        userEmail: session.user.email,
        userName: session.user.name,
        userRole: session.user.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Executive created successfully.",
      executive: newExecutive,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error creating executive";
    console.error("Executive create error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
