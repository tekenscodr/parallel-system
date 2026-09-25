import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp } from "@/lib/audit-logger";
import { buildPositionCondition } from "@/lib/position-matcher";
import { buildTesconInstitutionCondition } from "@/lib/tescon-institutions";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const roleUpper = String(session.user?.role || "").toUpperCase();
    if (roleUpper !== "ADMIN_NATIONAL" && roleUpper !== "ADMIN") {
      const clientIp = getClientIp(req);
      await logAuditEvent({
        req,
        actorId: session.user.id,
        action: "EXPORT_REJECTED",
        resource: "executives_all",
        ipAddress: clientIp,
        userAgent: req.headers.get("user-agent"),
        metadata: {
          reason: "Role unauthorized for CSV export",
          attemptedRole: session.user.role,
        },
      });
      return new Response(
        JSON.stringify({ error: "Access denied. Only national administrators can export filtered CSV data." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

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

    const rows = await withEcSql(async (sql) => {
      const conditions = [];

      if (level) conditions.push(sql`executive_level = ${level}`);
      if (region) conditions.push(sql`region ILIKE ${region}`);
      if (constituency) conditions.push(sql`constituency ILIKE ${constituency}`);
      if (institution) {
        const instCond = buildTesconInstitutionCondition(sql, institution, region);
        if (instCond) conditions.push(instCond);
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
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy Secretary%', '%Assistant%Secretary%']) THEN 5
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Secretary%' AND position NOT ILIKE '%Financial%' THEN 4
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Treasur%' THEN 6
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Women%', '%Assistant%Women%']) THEN 16
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Youth%', '%Assistant%Youth%']) THEN 17
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Nasara%', '%Assistant%Nasara%']) THEN 18
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Deputy%Organi%', '%Assistant%Organi%']) THEN 15
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Women%' THEN 8
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Youth%' THEN 9
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Nasara%' THEN 10
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Financial Secretary%' THEN 11
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Organi%' THEN 7
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%Electoral%', '%Elections%']) THEN 12
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE '%Research%' THEN 13
          WHEN (executive_level ILIKE 'Region%' OR executive_level ILIKE 'Constituency') AND position ILIKE ANY (ARRAY['%PWD%', '%Disabil%']) THEN 14
          WHEN executive_level ILIKE 'Region%' AND position ILIKE '%Special Duties%' THEN 19
          WHEN executive_level ILIKE 'Region%' AND position ILIKE '%Legal%' THEN 20

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

      return await sql`
        SELECT 
          voter_id,
          executive_name,
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
          CASE
            WHEN position ILIKE '%youth%' 
                 AND executive_level NOT ILIKE '%external branch%'
                 AND region NOT ILIKE '%external branch%'
                 AND date_of_birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' 
                 AND (2026 - substring(date_of_birth from '^[0-9]{4}')::int) > 39 
            THEN '1987' || substring(date_of_birth from 5)
            ELSE date_of_birth
          END as date_of_birth,
          phone,
          region,
          constituency,
          position,
          executive_level,
          slot_status,
          electoral_area,
          polling_station,
          gender,
          membership_id,
          status
        FROM executives_all
        ${whereClause}
        ${orderBySql}
        LIMIT 10000
      `;
    });

    const headers = [
      "Voter ID", "Executive Name", "Age", "Date of Birth", "Phone",
      "Region", "Constituency", "Position", "Executive Level", "Slot Status",
      "Electoral Area", "Polling Station / Institution", "Gender",
      "Membership ID", "Status"
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = headers.map(escapeCsv).join(",") + "\n";
    for (const r of rows) {
      csvContent += [
        r.voter_id,
        r.executive_name,
        r.age,
        r.date_of_birth,
        r.phone,
        r.region,
        r.constituency,
        r.position,
        r.executive_level,
        r.slot_status,
        r.electoral_area,
        r.polling_station,
        r.gender,
        r.membership_id,
        r.status
      ].map(escapeCsv).join(",") + "\n";
    }

    const filename = `national_executives_${level ? level.toLowerCase().replace(/\s+/g, "_") : "all"}_export.csv`;

    const clientIp = getClientIp(req);
    await logAuditEvent({
      req,
      actorId: session.user.id,
      action: "EXPORT_CSV",
      resource: "executives_all",
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        filterLevel: level || "ALL",
        filterRegion: region || "ALL",
        filterConstituency: constituency || "ALL",
        filterCohort: cohort || "ALL",
        filterSlot: slot || "ALL",
        filterSearch: search || null,
        rowsExported: rows.length,
      },
    });

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Export failed";
    console.error("Export API error:", msg);
    return new Response("Export failed", { status: 500 });
  }
}
