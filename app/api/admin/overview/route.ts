import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, isC1User } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { normalizeConstituency } from "@/lib/constituency-normalizer";
import { getVotingReport } from '@/lib/voting-data';
import { buildPositionCondition } from "@/lib/position-matcher";
import { getC1SqlCondition } from "@/lib/c1-electoral-college";
import { buildTesconInstitutionCondition } from "@/lib/tescon-institutions";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const isC1 = isC1User(session.user);

    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const institution = url.searchParams.get("institution")?.trim() || "";
    const level = url.searchParams.get("level")?.trim() || "";
    const position = url.searchParams.get("position")?.trim() || "";
    const cohort = url.searchParams.get("cohort")?.trim() || "";
    const under40 = url.searchParams.get("under40")?.trim() || "";

    // Run parallel queries on ec-data in scoped connection
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
      if (institution) {
        const instCond = buildTesconInstitutionCondition(sql, institution, region);
        if (instCond) conditions.push(instCond);
      }
      if (position) {
        const pCond = buildPositionCondition(sql, position);
        if (pCond) conditions.push(pCond);
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

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      // Electoral College Conditions (for National Elections)
      const ecConditions = [
        sql`(
          executive_name IS NOT NULL 
          AND trim(executive_name) != '' 
          AND lower(executive_name) !~ '^(vacant|vacancy|unknown|not available|n/a)'
          AND (
            executive_level IN ('Constituency', 'National', 'External Branch', 'Region')
            OR (executive_level = 'TESCON' AND position NOT ILIKE '%patron%')
          )
        )`
      ];
      if (isC1) {
        ecConditions.push(getC1SqlCondition(sql));
      }
      if (region) {
        ecConditions.push(sql`region ILIKE ${region}`);
      }
      if (constituency) {
        const norm = normalizeConstituency(constituency);
        if (norm && norm !== constituency) {
          ecConditions.push(sql`(constituency ILIKE ${constituency} OR constituency ILIKE ${norm})`);
        } else {
          ecConditions.push(sql`constituency ILIKE ${constituency}`);
        }
      }
      const ecWhereClause = sql`WHERE ${ecConditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`;

      const [totalsRes, tiersRes, demographicsRes, regionsRes, ecRes] = await Promise.all([
        sql`
          SELECT 
            COUNT(*)::int as total,
            COUNT(CASE WHEN date_of_birth IS NOT NULL AND date_of_birth != '' THEN 1 END)::int as with_dob,
            COUNT(CASE 
              WHEN position ILIKE '%youth%' 
                AND executive_level NOT ILIKE '%external branch%' 
                AND region NOT ILIKE '%external branch%' 
                AND (date_of_birth IS NOT NULL OR age IS NOT NULL) THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int > 1986 THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND (age + 2) < 40 THEN 1
            END)::int as under_40,
            COUNT(CASE 
              WHEN position ILIKE '%youth%' 
                AND executive_level NOT ILIKE '%external branch%' 
                AND region NOT ILIKE '%external branch%' THEN NULL
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int < 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int < 22
                )
              ) THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1985 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND (age + 2) = 40 THEN 1
            END)::int as equal_40,
            COUNT(CASE 
              WHEN position ILIKE '%youth%' 
                AND executive_level NOT ILIKE '%external branch%' 
                AND region NOT ILIKE '%external branch%' 
                AND (
                  (date_of_birth ~ '^[0-9]{4}' AND (2026 - substring(date_of_birth from '^([0-9]{4})')::int) > 39)
                  OR (age IS NOT NULL AND (age + 2) > 39)
                ) THEN 1 
            END)::int as youth_adjusted,
            COUNT(CASE WHEN gender = 'Female' THEN 1 END)::int as women,
            COUNT(CASE WHEN position ILIKE '%nasara%' THEN 1 END)::int as nasara,
            COUNT(CASE WHEN slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%' THEN 1 END)::int as appointed,
            COUNT(CASE WHEN slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%' THEN 1 END)::int as elected,
            COUNT(CASE WHEN image_url IS NULL OR trim(image_url) = '' OR image_url ILIKE 'https://app.newpatrioticparty.org%' OR image_url NOT ILIKE 'https://%' THEN 1 END)::int as missing_photos,
            COUNT(CASE WHEN image_url ILIKE 'https://cms.newpatrioticparty.org%' THEN 1 END)::int as verified_photos
          FROM executives_all
          ${whereClause}
        `,
        sql`
          SELECT 
            executive_level as level,
            COUNT(*)::int as count,
            COUNT(CASE 
              WHEN substring(date_of_birth from '^([0-9]{4})')::int > 1986 THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND age < 40 THEN 1
            END)::int as under_40,
            COUNT(CASE WHEN gender = 'Female' THEN 1 END)::int as women
          FROM executives_all
          ${whereClause}
          GROUP BY executive_level
          ORDER BY count DESC
        `,
        sql`
          SELECT 
            COALESCE(NULLIF(gender, ''), 'Unspecified') as label,
            COUNT(*)::int as count
          FROM executives_all
          ${whereClause}
          GROUP BY gender
          ORDER BY count DESC
        `,
        region ? sql`
          SELECT 
            COALESCE(NULLIF(constituency, ''), 'Unassigned') as region,
            COUNT(*)::int as count,
            COUNT(CASE 
              WHEN substring(date_of_birth from '^([0-9]{4})')::int > 1986 THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND age < 40 THEN 1
            END)::int as under_40
          FROM executives_all
          ${whereClause}
          GROUP BY constituency
          ORDER BY count DESC
          LIMIT 25
        ` : sql`
          SELECT 
            COALESCE(NULLIF(region, ''), 'National/Unassigned') as region,
            COUNT(*)::int as count,
            COUNT(CASE 
              WHEN substring(date_of_birth from '^([0-9]{4})')::int > 1986 THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND age < 40 THEN 1
            END)::int as under_40
          FROM executives_all
          ${whereClause}
          GROUP BY region
          ORDER BY count DESC
        `,
        sql`
          SELECT 
            COUNT(*)::int as total_delegates,
            COUNT(CASE WHEN executive_level IN ('Constituency', 'National', 'External Branch', 'Region') OR (executive_level = 'TESCON' AND position ILIKE '%President%' AND position NOT ILIKE '%Patron%') THEN 1 END)::int as general_voters,
            COUNT(CASE 
              WHEN position ILIKE '%former%' THEN NULL
              WHEN executive_level = 'TESCON' AND position NOT ILIKE '%patron%' THEN 1
              WHEN position ILIKE '%youth%' THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int > 1986 THEN 1
              WHEN substring(date_of_birth from '^([0-9]{4})')::int = 1986 AND (
                substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int > 8
                OR (
                  substring(date_of_birth from '^[0-9]{4}-([0-9]{1,2})')::int = 8 
                  AND substring(date_of_birth from '^[0-9]{4}-[0-9]{1,2}-([0-9]{1,2})')::int >= 22
                )
              ) THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND age < 40 THEN 1
            END)::int as youth_voters,
            COUNT(CASE 
              WHEN gender = 'Female' AND (
                executive_level != 'TESCON'
                OR (
                  executive_level = 'TESCON' AND (
                    position IN ('WOCOM', 'Women Commissioner') 
                    OR position ILIKE '%wocom%'
                    OR position ILIKE '%women%'
                    OR position ILIKE '%President%'
                    OR position ILIKE '%Nasara%'
                  )
                )
              ) THEN 1
            END)::int as women_voters,
            COUNT(CASE 
              WHEN position NOT ILIKE '%former%' AND position ILIKE '%Nasara%' AND position NOT ILIKE '%patron%' THEN 1
            END)::int as nasara_voters,
            COUNT(CASE WHEN executive_level = 'TESCON' AND position ILIKE '%President%' AND position NOT ILIKE '%Patron%' THEN 1 END)::int as tescon_presidents,
            COUNT(CASE WHEN executive_level = 'TESCON' AND (position IN ('WOCOM', 'Women Commissioner') OR position ILIKE '%wocom%' OR position ILIKE '%women%') THEN 1 END)::int as tescon_wocom,
            COUNT(CASE WHEN executive_level = 'TESCON' AND position ILIKE '%Nasara%' THEN 1 END)::int as tescon_nasara,
            COUNT(CASE WHEN executive_level = 'Constituency' AND region != 'External Branch' THEN 1 END)::int as constituency_execs,
            COUNT(CASE WHEN region = 'External Branch' OR executive_level = 'External Branch' THEN 1 END)::int as external_branch_execs
          FROM executives_all
          ${ecWhereClause}
        `
      ]);

      return {
        totals: totalsRes[0] || {
          total: 0, with_dob: 0, under_40: 0, equal_40: 0, youth_adjusted: 0,
          women: 0, nasara: 0, appointed: 0, elected: 0
        },
        tiers: tiersRes,
        genderDistribution: demographicsRes,
        regionalDistribution: regionsRes,
        electoralCollege: ecRes[0] || {
          total_delegates: 0, general_voters: 0, youth_voters: 0, women_voters: 0, nasara_voters: 0,
          tescon_presidents: 0, tescon_wocom: 0, tescon_nasara: 0, constituency_execs: 0, external_branch_execs: 0
        },
        activeFilter: {
          region: region || null,
          constituency: constituency || null,
          level: level || null,
          position: position || null,
          cohort: cohort || null,
          under40: (under40 === "true" || under40 === "1" || under40 === "under_40" || cohort === "under_40" || cohort === "youth") ? true : null
        }
      };
    });

    const voting = await getVotingReport({ c1Only: isC1 });
    const electorate = voting.people.filter(p =>
      (!region || p.region.toLowerCase() === region.toLowerCase()) &&
      (!constituency || normalizeConstituency(p.constituency).toLowerCase() === normalizeConstituency(constituency).toLowerCase()) &&
      (!level || p.levels.split('; ').some(l => l.toLowerCase() === level.toLowerCase())) &&
      (!position || p.positions.toLowerCase().includes(position.toLowerCase())));
    result.electoralCollege = {...result.electoralCollege,
      total_delegates: electorate.filter(p=>Object.values(p.flags).some(Boolean)).length,
      general_voters: electorate.filter(p=>p.flags.general).length,
      youth_voters: electorate.filter(p=>p.flags.youth).length,
      women_voters: electorate.filter(p=>p.flags.women).length,
      nasara_voters: electorate.filter(p=>p.flags.nasara).length};
    return NextResponse.json({
      ...result,
      user: session.user
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Overview query failed";
    console.error("Overview API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
