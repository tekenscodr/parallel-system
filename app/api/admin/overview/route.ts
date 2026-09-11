import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { normalizeConstituency } from "@/lib/constituency-normalizer";
import { getVotingReport } from '@/lib/voting-data';
import { buildPositionCondition } from "@/lib/position-matcher";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.trim() || "";
    const constituency = url.searchParams.get("constituency")?.trim() || "";
    const level = url.searchParams.get("level")?.trim() || "";
    const position = url.searchParams.get("position")?.trim() || "";

    // Run parallel queries on ec-data in scoped connection
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
      if (position) {
        const pCond = buildPositionCondition(sql, position);
        if (pCond) conditions.push(pCond);
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

      // Electoral College Conditions (for National Elections)
      const ecConditions = [
        sql`(
          executive_level IN ('Constituency', 'National', 'External Branch')
          OR (executive_level = 'TESCON' AND (
            (position ILIKE '%President%' AND position NOT ILIKE '%Patron%')
            OR position IN ('WOCOM', 'Women Commissioner')
            OR position IN ('Tescon Nasara', 'Nasara Coordinator')
          ))
        )`
      ];
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
              WHEN position ILIKE '%youth%' AND (date_of_birth IS NOT NULL OR age IS NOT NULL) THEN 1
              WHEN date_of_birth ~ '^[0-9]{4}' AND (2026 - substring(date_of_birth from '^([0-9]{4})')::int) < 40 THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND (age + 2) < 40 THEN 1
            END)::int as under_40,
            COUNT(CASE 
              WHEN position ILIKE '%youth%' THEN NULL
              WHEN date_of_birth ~ '^[0-9]{4}' AND (2026 - substring(date_of_birth from '^([0-9]{4})')::int) = 40 THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND (age + 2) = 40 THEN 1
            END)::int as equal_40,
            COUNT(CASE 
              WHEN position ILIKE '%youth%' AND (
                (date_of_birth ~ '^[0-9]{4}' AND (2026 - substring(date_of_birth from '^([0-9]{4})')::int) > 39)
                OR (age IS NOT NULL AND (age + 2) > 39)
              ) THEN 1 
            END)::int as youth_adjusted,
            COUNT(CASE WHEN gender = 'Female' THEN 1 END)::int as women,
            COUNT(CASE WHEN position ILIKE '%nasara%' THEN 1 END)::int as nasara,
            COUNT(CASE WHEN slot_status ILIKE '%Appointed%' OR status ILIKE '%Appointed%' THEN 1 END)::int as appointed,
            COUNT(CASE WHEN slot_status NOT ILIKE '%Appointed%' AND status NOT ILIKE '%Appointed%' THEN 1 END)::int as elected
          FROM executives_all
          ${whereClause}
        `,
        sql`
          SELECT 
            executive_level as level,
            COUNT(*)::int as count,
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40,
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
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40
          FROM executives_all
          ${whereClause}
          GROUP BY constituency
          ORDER BY count DESC
          LIMIT 25
        ` : sql`
          SELECT 
            COALESCE(NULLIF(region, ''), 'National/Unassigned') as region,
            COUNT(*)::int as count,
            COUNT(CASE WHEN age < 40 THEN 1 END)::int as under_40
          FROM executives_all
          ${whereClause}
          GROUP BY region
          ORDER BY count DESC
        `,
        sql`
          SELECT 
            COUNT(*)::int as total_delegates,
            COUNT(CASE WHEN executive_level IN ('Constituency', 'National', 'External Branch') THEN 1 END)::int as general_voters,
            COUNT(CASE 
              WHEN executive_level = 'TESCON' THEN 1
              WHEN position ILIKE '%youth%' THEN 1
              WHEN date_of_birth ~ '^[0-9]{4}' AND (2026 - substring(date_of_birth from '^([0-9]{4})')::int) < 40 THEN 1
              WHEN (date_of_birth IS NULL OR date_of_birth = '' OR NOT (date_of_birth ~ '^[0-9]{4}')) AND age IS NOT NULL AND age < 40 THEN 1
            END)::int as youth_voters,
            COUNT(CASE 
              WHEN executive_level = 'TESCON' AND (position IN ('WOCOM', 'Women Commissioner') OR (position ILIKE '%President%' AND gender = 'Female')) THEN 1
              WHEN executive_level != 'TESCON' AND gender = 'Female' THEN 1
            END)::int as women_voters,
            COUNT(CASE 
              WHEN executive_level = 'TESCON' AND position IN ('Tescon Nasara', 'Nasara Coordinator') THEN 1
              WHEN executive_level != 'TESCON' AND position ILIKE '%Nasara%' THEN 1
            END)::int as nasara_voters,
            COUNT(CASE WHEN executive_level = 'TESCON' AND position ILIKE '%President%' AND position NOT ILIKE '%Patron%' THEN 1 END)::int as tescon_presidents,
            COUNT(CASE WHEN executive_level = 'TESCON' AND position IN ('WOCOM', 'Women Commissioner') THEN 1 END)::int as tescon_wocom,
            COUNT(CASE WHEN executive_level = 'TESCON' AND position IN ('Tescon Nasara', 'Nasara Coordinator') THEN 1 END)::int as tescon_nasara,
            COUNT(CASE WHEN executive_level = 'Constituency' THEN 1 END)::int as constituency_execs,
            COUNT(CASE WHEN executive_level = 'External Branch' THEN 1 END)::int as external_branch_execs
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
          position: position || null
        }
      };
    });

    const voting = await getVotingReport();
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
