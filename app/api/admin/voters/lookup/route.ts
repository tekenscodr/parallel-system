import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";

const REGIONS = [
  "ahafo",
  "ashanti",
  "bono",
  "bono_east",
  "central",
  "eastern",
  "greater_accra",
  "north_east",
  "northern",
  "oti",
  "savannah",
  "upper_east",
  "upper_west",
  "volta",
  "western",
  "western_north",
];

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const url = new URL(req.url);
    const voterId = url.searchParams.get("voterId")?.trim();

    if (!voterId) {
      return NextResponse.json(
        { error: "Voter ID parameter is required." },
        { status: 400 }
      );
    }

    const result = await withEcSql(async (sql) => {
      // 1. First check if voter already exists in executives_all
      const execRows = await sql`
        SELECT 
          voter_id as "voterId",
          executive_name as "name",
          gender,
          date_of_birth as "dateOfBirth",
          age,
          ghana_card as "ghanaCard",
          phone,
          region,
          constituency,
          electoral_area as "electoralArea",
          polling_station as "pollingStation"
        FROM executives_all
        WHERE voter_id = ${voterId}
        LIMIT 1
      `;

      if (execRows.length > 0 && execRows[0].name) {
        const v = execRows[0];
        if (v.dateOfBirth) {
          const m = String(v.dateOfBirth).match(/(\d{4})/);
          if (m) v.age = 2026 - parseInt(m[1], 10);
        } else if (v.age != null) {
          v.age = v.age + 2;
        }
        return {
          found: true,
          source: "executives_registry",
          voter: v,
        };
      }

      // 2. Query regional voter tables in parallel
      const searchPromises = REGIONS.map(async (r) => {
        const tbl = `voters_${r}`;
        try {
          const rows = await sql.unsafe(
            `SELECT 
              voter_id as "voterId",
              TRIM(CONCAT(COALESCE(other_names, ''), ' ', COALESCE(last_name, ''))) as "name",
              gender,
              COALESCE(dob_standardized::text, date_of_birth) as "dateOfBirth",
              age,
              id_number as "ghanaCard",
              contact as "phone",
              region,
              constituency,
              electoral_area as "electoralArea",
              polling_station_name as "pollingStation"
            FROM ${tbl}
            WHERE voter_id = $1
            LIMIT 1`,
            [voterId]
          );
          return rows.length > 0 ? rows[0] : null;
        } catch {
          return null;
        }
      });

      const matchedRows = await Promise.all(searchPromises);
      const matched = matchedRows.find((row) => row !== null);

      if (matched) {
        if (matched.dateOfBirth) {
          const m = String(matched.dateOfBirth).match(/(\d{4})/);
          if (m) matched.age = 2026 - parseInt(m[1], 10);
        } else if (matched.age != null) {
          matched.age = matched.age + 2;
        }
        return {
          found: true,
          source: "voter_registry",
          voter: matched,
        };
      }

      return {
        found: false,
        message: `No voter found with Voter ID "${voterId}". You can enter the executive details manually.`,
      };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error looking up voter";
    console.error("Voter lookup error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
