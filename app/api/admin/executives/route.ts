import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isC1User } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";
import { normalizeConstituency } from "@/lib/constituency-normalizer";
import { getVoterPhotoUrl } from "@/lib/voter-photo";
import { buildPositionCondition } from "@/lib/position-matcher";
import { saveUploadedExecutiveImage } from "@/lib/image-upload";
import { getC1SqlCondition, isC1FemaleElectoralDelegate } from "@/lib/c1-electoral-college";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const isC1 = isC1User(session.user);

    const url = new URL(req.url);
    const level = url.searchParams.get("level")?.trim() || "";
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const position = url.searchParams.get("position")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const slot = url.searchParams.get("slot")?.trim() || "";
    const missingImages = url.searchParams.get("missingImages") === "true" || url.searchParams.get("missingPhotos") === "true";

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const result = await withEcSql(async (sql) => {
      const conditions = [];

      if (isC1) {
        conditions.push(getC1SqlCondition(sql));
      }

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

      if (position) {
        const pCond = buildPositionCondition(sql, position);
        if (pCond) conditions.push(pCond);
      }

      if (missingImages) {
        conditions.push(sql`(image_url IS NULL OR trim(image_url) = '' OR image_url ILIKE 'https://app.newpatrioticparty.org%' OR image_url NOT ILIKE 'https://%')`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      // Position hierarchy ranking based on official constitutional hierarchy
      const positionRankSql = sql`
        CASE 
          /* Prescribed Region and Constituency table order */
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%1st%Vice%', '%First%Vice%']) THEN 2
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%2nd%Vice%', '%Second%Vice%']) THEN 3
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Chair%' THEN 1
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Secretary%', '%Assistant%Secretary%']) THEN 5
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Secretary%' AND position NOT ILIKE '%Financial%' THEN 4
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Treasur%' AND position NOT ILIKE '%Deputy%' THEN 6
          /* Specific Deputies FIRST before general Organiser */
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Women%', '%Assistant%Women%']) THEN 17
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Youth%', '%Assistant%Youth%']) THEN 18
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND (position ILIKE '%Deputy%Nasara%' OR position ILIKE '%Assistant%Nasara%') THEN 19
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Organi%', '%Assistant%Organi%']) THEN 16

          /* Wings */
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Women%' THEN 8
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Youth%' THEN 9
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Nasara%' THEN 10

          /* Pure Organiser */
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Organi%' THEN 7
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Financial Secretary%' THEN 11
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Electoral%', '%Elections%']) THEN 12
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Communication%' THEN 13
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Research%' THEN 14
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%PWD%', '%Disabil%']) THEN 15
          WHEN executive_level ILIKE 'Region%' AND position ILIKE '%Special Duties%' THEN 20
          WHEN executive_level ILIKE 'Region%' AND position ILIKE '%Legal%' THEN 21

          /* 1. Flagbearer & Running Mate */
          WHEN position ILIKE '%Flagbearer%' OR position ILIKE '%Presidential Candidate%' THEN 1
          WHEN position ILIKE '%Running Mate%' OR position ILIKE '%Vice Presidential%' THEN 2

          /* 2. Chairperson & Vice-Chairpersons */
          WHEN position ILIKE '%1st%Vice%' OR position ILIKE '%First%Vice%' THEN 11
          WHEN position ILIKE '%2nd%Vice%' OR position ILIKE '%Second%Vice%' THEN 12
          WHEN position ILIKE '%3rd%Vice%' OR position ILIKE '%Third%Vice%' THEN 13
          WHEN position ILIKE '%Vice%Chair%' OR position ILIKE '%Vice-Chair%' OR position ILIKE '%Vice Chair%' THEN 14
          WHEN position ILIKE '%Chair%' THEN 10

          /* 3. Secretary & Deputy Secretary */
          WHEN position ILIKE '%Deputy Secretary%' OR position ILIKE '%Assistant%Secretary%' OR position ILIKE '%Deputy General Secretary%' THEN 21
          WHEN position ILIKE '%Financial Secretary%' THEN 32
          WHEN position ILIKE '%General Secretary%' OR position ILIKE '%Secretary%' THEN 20

          /* 4. Treasurer & Financial Secretary */
          WHEN position ILIKE '%Deputy%Treasur%' THEN 31
          WHEN position ILIKE '%Treasur%' THEN 30

          /* 5. Organisers & Deputies */
          WHEN position ILIKE '%Deputy%Organi%' OR position ILIKE '%Assistant%Organi%' THEN 41
          WHEN position ILIKE '%Deputy%Women%' OR position ILIKE '%Assistant%Women%' THEN 51
          WHEN position ILIKE '%Women%Organi%' OR position ILIKE '%Women%' THEN 50
          WHEN position ILIKE '%Deputy%Youth%' OR position ILIKE '%Assistant%Youth%' THEN 61
          WHEN position ILIKE '%Youth%Organi%' OR position ILIKE '%Youth%' THEN 60
          WHEN position ILIKE '%Deputy%Nasara%' OR position ILIKE '%Assistant%Nasara%' THEN 71
          WHEN position ILIKE '%Nasara%' THEN 70
          WHEN position ILIKE '%Organi%' THEN 40

          /* 6. Communication Officers */
          WHEN position ILIKE '%Deputy%Communication%' THEN 81
          WHEN position ILIKE '%Communication%' THEN 80

          /* 7. Electoral Affairs, Research & PWD */
          WHEN position ILIKE '%Electoral%' OR position ILIKE '%Elections%' THEN 90
          WHEN position ILIKE '%Research%' THEN 100
          WHEN position ILIKE '%PWD%' OR position ILIKE '%Disabil%' THEN 110

          /* 8. TESCON & Institutional Roles */
          WHEN position ILIKE '%President%' THEN 120
          WHEN position ILIKE '%WOCOM%' THEN 125

          /* 9. Specialized & Council Roles */
          WHEN position ILIKE '%Special Duties%' THEN 130
          WHEN position ILIKE '%Legal%' THEN 140
          WHEN position ILIKE '%National Council%' THEN 150
          WHEN position ILIKE '%Patron%' THEN 160
          WHEN position ILIKE '%Council of Elders%' OR position ILIKE '%Elders%' THEN 170
          WHEN position ILIKE '%Foundation Member%' THEN 180
          WHEN position ILIKE '%Coordinator%' THEN 190
          WHEN position ILIKE '%Officer%' THEN 200
          ELSE 300
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
            CASE
              WHEN position ILIKE '%youth%' 
                   AND executive_level NOT ILIKE '%external branch%'
                   AND region NOT ILIKE '%external branch%'
                   AND date_of_birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                   AND (2026 - substring(date_of_birth from '^[0-9]{4}')::int) > 39 
              THEN '1987' || substring(date_of_birth from 5)
              ELSE date_of_birth
            END as "dateOfBirth",
            CASE
              WHEN position ILIKE '%youth%' 
                   AND executive_level NOT ILIKE '%external branch%'
                   AND region NOT ILIKE '%external branch%'
                   AND (
                     (date_of_birth ~ '[0-9]{4}' AND (2026 - substring(date_of_birth from '([0-9]{4})')::int) > 39)
                     OR (age IS NOT NULL AND (age + 2) > 39)
                   )
              THEN 39
              WHEN date_of_birth ~ '[0-9]{4}'
              THEN (2026 - substring(date_of_birth from '([0-9]{4})')::int)
              WHEN age IS NOT NULL
              THEN (age + 2)
              ELSE NULL
            END as age,
            status,
            image_url as "imageUrl"
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

    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let uploadedImageUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const voterIdVal = (formData.get("voterId") as string) || (formData.get("voter_id") as string) || null;
      if (file && typeof file !== "string" && file.size > 0) {
        const res = await saveUploadedExecutiveImage(file, voterIdVal);
        uploadedImageUrl = res.imageUrl;
      }
      for (const [key, value] of formData.entries()) {
        if (key !== "file") {
          body[key] = value;
        }
      }
    } else {
      body = await req.json();
    }

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

    if (isC1User(session.user)) {
      if (!isC1FemaleElectoralDelegate({ executive_level: executiveLevel, region, position, gender })) {
        return NextResponse.json(
          { error: "Access denied: Role C1 can only register female executives in the electoral college." },
          { status: 403 }
        );
      }
    }

    // Calculate age using current year 2026 and date of birth
    let parsedAge: number | null = null;
    let finalDob = dateOfBirth ? String(dateOfBirth).trim() : null;

    if (finalDob) {
      const yearMatch = finalDob.match(/(\d{4})/);
      if (yearMatch) {
        parsedAge = 2026 - parseInt(yearMatch[1], 10);
      }
    } else if (age !== undefined && age !== null && age !== "") {
      parsedAge = parseInt(String(age), 10);
      if (isNaN(parsedAge)) parsedAge = null;
    }

    const isYouth = position.toLowerCase().includes("youth");
    const isExternalBranch =
      (executiveLevel && executiveLevel.toLowerCase().includes("external branch")) ||
      (region && region.toLowerCase().includes("external branch"));
    let isAgeAdjusted = false;
    if (isYouth && !isExternalBranch && parsedAge !== null && parsedAge > 39) {
      parsedAge = 39;
      isAgeAdjusted = true;
      if (finalDob) {
        // Change only the year to 1987 (2026 - 39 = 1987), keeping month and day intact
        finalDob = finalDob.replace(/^(\d{4})/, "1987");
      } else {
        finalDob = "1987-01-01";
      }
    }

    const computedImageUrl = uploadedImageUrl || body.imageUrl || body.image_url || getVoterPhotoUrl(region, constituency, voterId);

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
          status,
          image_url
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
          ${finalDob || null},
          ${parsedAge},
          ${isYouth},
          ${isAgeAdjusted},
          ${session.user.name || session.user.email},
          ${status.trim()},
          ${computedImageUrl || null}
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
          status,
          image_url as "imageUrl"
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
    const rawMsg = err instanceof Error ? err.message : "Error creating executive";
    const msg = rawMsg.replace(/wordpress/gi, "Party CDN");
    console.error("Executive create error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
