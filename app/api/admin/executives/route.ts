import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";

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
        conditions.push(sql`constituency ILIKE ${constituency}`);
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
          ORDER BY id ASC
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
          ${constituency.trim() || null},
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
