import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isC1User } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";
import {
  normalizeConstituency,
  normalizeRegionName,
  getConstituencyFilterVariants,
} from "@/lib/constituency-normalizer";
import { getVoterPhotoUrl } from "@/lib/voter-photo";
import { buildPositionCondition } from "@/lib/position-matcher";
import { saveUploadedExecutiveImage } from "@/lib/image-upload";
import { getC1SqlCondition, isC1FemaleElectoralDelegate } from "@/lib/c1-electoral-college";
import { buildTesconInstitutionCondition, normalizeTesconInstitution } from "@/lib/tescon-institutions";
import { ensureProxyAssignmentsTableExists } from "@/lib/proxy-voting";

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
    const institution = url.searchParams.get("institution")?.trim() || "";
    const position = url.searchParams.get("position")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const slot = url.searchParams.get("slot")?.trim() || "";
    const under40 = url.searchParams.get("under40")?.trim() || "";
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
        conditions.push(sql`TRIM(region) ILIKE ${region}`);
      }
      if (constituency) {
        const variants = getConstituencyFilterVariants(constituency);
        if (variants.length > 0) {
          conditions.push(sql`UPPER(TRIM(constituency)) = ANY(${variants})`);
        } else {
          conditions.push(sql`TRIM(constituency) ILIKE ${constituency}`);
        }
      }
      if (institution) {
        const instCond = buildTesconInstitutionCondition(sql, institution, region);
        if (instCond) conditions.push(instCond);
      }
      if (search) {
        const s = `%${search}%`;
        const normSearchConst = normalizeConstituency(search);
        if (normSearchConst && normSearchConst.toUpperCase() !== search.toUpperCase()) {
          const normPattern = `%${normSearchConst}%`;
          conditions.push(
            sql`(executive_name ILIKE ${s} OR voter_id ILIKE ${s} OR phone ILIKE ${s} OR position ILIKE ${s} OR constituency ILIKE ${s} OR constituency ILIKE ${normPattern} OR polling_station ILIKE ${s})`
          );
        } else {
          conditions.push(
            sql`(executive_name ILIKE ${s} OR voter_id ILIKE ${s} OR phone ILIKE ${s} OR position ILIKE ${s} OR constituency ILIKE ${s} OR polling_station ILIKE ${s})`
          );
        }
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
      } else if (cohort === "under_40" || cohort === "youth") {
        conditions.push(sql`
          (
            (date_of_birth ~ '^[0-9]{4}' AND substring(date_of_birth from '^([0-9]{4})')::int > 1986)
            OR (date_of_birth ~ '^[0-9]{4}' AND substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
              substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
              OR (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
              )
            ))
            OR (date_of_birth ~ '[0-9]{4}$' AND substring(date_of_birth from '([0-9]{4})$')::int > 1986)
            OR ((date_of_birth IS NULL OR trim(date_of_birth) = '' OR NOT (date_of_birth ~ '[0-9]{4}')) AND age IS NOT NULL AND (age + 2) < 40)
          )
        `);
      }

      if (under40 === "true" || under40 === "1" || under40 === "under_40") {
        if (cohort !== "under_40" && cohort !== "youth") {
          conditions.push(sql`
            (
              (date_of_birth ~ '^[0-9]{4}' AND substring(date_of_birth from '^([0-9]{4})')::int > 1986)
              OR (date_of_birth ~ '^[0-9]{4}' AND substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ))
              OR (date_of_birth ~ '[0-9]{4}$' AND substring(date_of_birth from '([0-9]{4})$')::int > 1986)
              OR ((date_of_birth IS NULL OR trim(date_of_birth) = '' OR NOT (date_of_birth ~ '[0-9]{4}')) AND age IS NOT NULL AND (age + 2) < 40)
            )
          `);
        }
      }

      if (position) {
        const pCond = buildPositionCondition(sql, position);
        if (pCond) conditions.push(pCond);
      }

      if (missingImages) {
        conditions.push(sql`(image_url IS NULL OR trim(image_url) = '' OR image_url ILIKE 'https://app.newpatrioticparty.org%' OR (image_url NOT ILIKE 'https://%' AND image_url NOT ILIKE '/cdn/%' AND image_url NOT ILIKE 'data:image/%'))`);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      // Position hierarchy ranking based on official constitutional hierarchy
      const positionRankSql = sql`
        CASE 
          /* 0. Member of Parliament */
          WHEN position ILIKE '%Member of Parliament%' OR position ILIKE '%MP%' OR position ILIKE '%Parliamentarian%' THEN 0

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
        orderBySql = sql`ORDER BY LOWER(TRIM(region)) ASC, UPPER(TRIM(constituency)) ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "region" || lowerLevel === "regional") {
        orderBySql = sql`ORDER BY LOWER(TRIM(region)) ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "national") {
        orderBySql = sql`ORDER BY ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "electoral area") {
        orderBySql = sql`ORDER BY LOWER(TRIM(region)) ASC, UPPER(TRIM(constituency)) ASC, electoral_area ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "polling station") {
        orderBySql = sql`ORDER BY LOWER(TRIM(region)) ASC, UPPER(TRIM(constituency)) ASC, electoral_area ASC, polling_station ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else if (lowerLevel === "tescon") {
        orderBySql = sql`ORDER BY LOWER(TRIM(region)) ASC, polling_station ASC, UPPER(TRIM(constituency)) ASC, ${positionRankSql} ASC, position ASC, id ASC`;
      } else {
        orderBySql = sql`ORDER BY ${levelRankSql} ASC, LOWER(TRIM(region)) ASC, UPPER(TRIM(constituency)) ASC, polling_station ASC, ${positionRankSql} ASC, position ASC, id ASC`;
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

      await ensureProxyAssignmentsTableExists();
      const rowIds = rowsRes.map((r: any) => Number(r.id)).filter((id: number) => Number.isFinite(id));
      const proxyByPrincipalId = new Map<number, any>();
      const actingForByProxyId = new Map<number, any>();

      if (rowIds.length > 0) {
        try {
          const proxyRows = await sql`
            SELECT
              p.*,
              e.executive_name AS live_proxy_name,
              e.voter_id AS live_proxy_voter_id,
              e.phone AS live_proxy_phone,
              e.position AS live_proxy_position,
              e.executive_level AS live_proxy_level,
              e.region AS live_proxy_region,
              e.constituency AS live_proxy_constituency,
              e.polling_station AS live_proxy_polling_station,
              e.gender AS live_proxy_gender,
              e.date_of_birth AS live_proxy_dob,
              CASE
                WHEN e.date_of_birth ~ '[0-9]{4}'
                THEN (2026 - substring(e.date_of_birth from '([0-9]{4})')::int)
                WHEN e.age IS NOT NULL
                THEN (e.age + 2)
                ELSE p.proxy_age
              END AS live_proxy_age,
              e.image_url AS live_proxy_image_url
            FROM proxy_voter_assignments p
            LEFT JOIN executives_all e ON e.id = p.proxy_executive_id
            WHERE p.principal_executive_id = ANY(${rowIds})
               OR p.proxy_executive_id = ANY(${rowIds})
          `;

          for (const pr of proxyRows) {
            const pExecId = Number(pr.principal_executive_id);
            const hExecId = Number(pr.proxy_executive_id);
            const normPReg = (pr.live_proxy_region || pr.proxy_region)
              ? normalizeRegionName(String(pr.live_proxy_region || pr.proxy_region))
              : null;
            const normPCon = (pr.live_proxy_constituency || pr.proxy_constituency)
              ? normalizeConstituency(String(pr.live_proxy_constituency || pr.proxy_constituency))
              : null;

            proxyByPrincipalId.set(pExecId, {
              id: Number(pr.id),
              principalExecutiveId: pExecId,
              principalName: String(pr.principal_name || ""),
              principalVoterId: pr.principal_voter_id ? String(pr.principal_voter_id) : null,
              proxyExecutiveId: hExecId,
              proxyName: String(pr.live_proxy_name || pr.proxy_name || ""),
              proxyVoterId: (pr.live_proxy_voter_id ?? pr.proxy_voter_id)
                ? String(pr.live_proxy_voter_id ?? pr.proxy_voter_id)
                : null,
              proxyPhone: (pr.live_proxy_phone ?? pr.proxy_phone)
                ? String(pr.live_proxy_phone ?? pr.proxy_phone)
                : null,
              proxyPosition: (pr.live_proxy_position ?? pr.proxy_position)
                ? String(pr.live_proxy_position ?? pr.proxy_position)
                : null,
              proxyLevel: (pr.live_proxy_level ?? pr.proxy_level)
                ? String(pr.live_proxy_level ?? pr.proxy_level)
                : null,
              proxyRegion: normPReg,
              proxyConstituency: normPCon,
              proxyPollingStation: (pr.live_proxy_polling_station ?? pr.proxy_polling_station)
                ? String(pr.live_proxy_polling_station ?? pr.proxy_polling_station)
                : null,
              proxyGender: (pr.live_proxy_gender ?? pr.proxy_gender)
                ? String(pr.live_proxy_gender ?? pr.proxy_gender)
                : null,
              proxyDateOfBirth: (pr.live_proxy_dob ?? pr.proxy_date_of_birth)
                ? String(pr.live_proxy_dob ?? pr.proxy_date_of_birth)
                : null,
              proxyAge:
                pr.live_proxy_age !== null && pr.live_proxy_age !== undefined
                  ? Number(pr.live_proxy_age)
                  : pr.proxy_age !== null && pr.proxy_age !== undefined
                  ? Number(pr.proxy_age)
                  : null,
              proxyImageUrl: (pr.live_proxy_image_url ?? pr.proxy_image_url)
                ? String(pr.live_proxy_image_url ?? pr.proxy_image_url)
                : null,
              notes: pr.notes ? String(pr.notes) : null,
              assignedByName: pr.assigned_by_name ? String(pr.assigned_by_name) : null,
              createdAt: pr.created_at ? new Date(pr.created_at).toISOString() : null,
            });

            actingForByProxyId.set(hExecId, {
              principalExecutiveId: pExecId,
              principalName: String(pr.principal_name || ""),
              principalVoterId: pr.principal_voter_id ? String(pr.principal_voter_id) : null,
              principalPosition: pr.principal_position ? String(pr.principal_position) : null,
              principalRegion: pr.principal_region ? normalizeRegionName(String(pr.principal_region)) : null,
              principalConstituency: pr.principal_constituency
                ? normalizeConstituency(String(pr.principal_constituency))
                : null,
            });
          }
        } catch (proxyErr) {
          console.warn("[EXECUTIVES GET] Proxy lookup skipped:", proxyErr);
        }
      }

      const normalizedRows = rowsRes.map((r: any) => {
        const normRegion = r.region ? normalizeRegionName(r.region) : r.region;
        const normConst = r.constituency ? normalizeConstituency(r.constituency) : r.constituency;
        const isTescon = String(r.executiveLevel || "").toUpperCase() === "TESCON";
        return {
          ...r,
          region: normRegion,
          constituency: normConst,
          pollingStation: isTescon && r.pollingStation
            ? normalizeTesconInstitution(r.pollingStation, normRegion, normConst, r.id)
            : r.pollingStation,
          proxyAssignment: proxyByPrincipalId.get(Number(r.id)) || null,
          actingAsProxyFor: actingForByProxyId.get(Number(r.id)) || null,
        };
      });

      return {
        data: normalizedRows,
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
          ${normalizeRegionName(region) || region.trim()},
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
