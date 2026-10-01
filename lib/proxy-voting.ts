import { withEcSql } from "./db-ec";
import {
  normalizeConstituency,
  normalizeRegionName,
  getConstituencyFilterVariants,
} from "./constituency-normalizer";
import { normalizeTesconInstitution } from "./tescon-institutions";

export interface ProxyAssignmentRecord {
  id: number;
  principalExecutiveId: number;
  principalName: string;
  principalVoterId: string | null;
  principalPhone: string | null;
  principalPosition: string | null;
  principalLevel: string | null;
  principalRegion: string | null;
  principalConstituency: string | null;
  proxyExecutiveId: number;
  proxyName: string;
  proxyVoterId: string | null;
  proxyPhone: string | null;
  proxyPosition: string | null;
  proxyLevel: string | null;
  proxyRegion: string | null;
  proxyConstituency: string | null;
  proxyPollingStation: string | null;
  proxyGender: string | null;
  proxyDateOfBirth: string | null;
  proxyAge: number | null;
  proxyImageUrl: string | null;
  notes: string | null;
  assignedById: string | null;
  assignedByName: string | null;
  assignedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyCandidateRow {
  id: number;
  executiveName: string;
  position: string;
  executiveLevel: string;
  region: string;
  constituency: string;
  pollingStation: string;
  voterId: string;
  phone: string;
  gender: string;
  dateOfBirth: string | null;
  age: number | null;
  imageUrl: string | null;
  alreadyAssignedToPrincipalId: number | null;
  alreadyAssignedToPrincipalName: string | null;
  alreadyAssignedToPrincipalVoterId: string | null;
  hasOwnProxyAssignedToName: string | null;
}

let proxyTableInitialized = false;

export async function ensureProxyAssignmentsTableExists(): Promise<void> {
  if (proxyTableInitialized) return;
  try {
    await withEcSql(async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS proxy_voter_assignments (
          id SERIAL PRIMARY KEY,
          principal_executive_id INTEGER NOT NULL UNIQUE REFERENCES executives_all(id) ON DELETE CASCADE,
          principal_name VARCHAR(255) NOT NULL,
          principal_voter_id VARCHAR(50),
          principal_phone VARCHAR(50),
          principal_position VARCHAR(255),
          principal_level VARCHAR(100),
          principal_region VARCHAR(100),
          principal_constituency VARCHAR(100),
          proxy_executive_id INTEGER NOT NULL UNIQUE REFERENCES executives_all(id) ON DELETE CASCADE,
          proxy_name VARCHAR(255) NOT NULL,
          proxy_voter_id VARCHAR(50),
          proxy_phone VARCHAR(50),
          proxy_position VARCHAR(255),
          proxy_level VARCHAR(100),
          proxy_region VARCHAR(100),
          proxy_constituency VARCHAR(100),
          proxy_polling_station VARCHAR(255),
          proxy_gender VARCHAR(50),
          proxy_date_of_birth VARCHAR(50),
          proxy_age INTEGER,
          proxy_image_url TEXT,
          notes TEXT,
          assigned_by_id VARCHAR(255),
          assigned_by_name VARCHAR(255),
          assigned_by_email VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT chk_no_self_proxy CHECK (principal_executive_id <> proxy_executive_id)
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_proxy_principal_exec_id ON proxy_voter_assignments(principal_executive_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_proxy_holder_exec_id ON proxy_voter_assignments(proxy_executive_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_proxy_principal_voter_id ON proxy_voter_assignments(principal_voter_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_proxy_holder_voter_id ON proxy_voter_assignments(proxy_voter_id);`;
    });
    proxyTableInitialized = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[PROXY VOTING] Table initialization notice:", msg);
  }
}

function mapProxyRow(r: Record<string, any>): ProxyAssignmentRecord {
  const normProxyRegion = r.proxy_region ? normalizeRegionName(String(r.proxy_region)) : null;
  const normProxyConst = r.proxy_constituency ? normalizeConstituency(String(r.proxy_constituency)) : null;
  const isTescon = String(r.proxy_level || "").toUpperCase() === "TESCON";
  const normStation =
    isTescon && r.proxy_polling_station
      ? normalizeTesconInstitution(
          String(r.proxy_polling_station),
          normProxyRegion || "",
          normProxyConst || "",
          Number(r.proxy_executive_id)
        )
      : r.proxy_polling_station || null;

  return {
    id: Number(r.id),
    principalExecutiveId: Number(r.principal_executive_id),
    principalName: String(r.principal_name || ""),
    principalVoterId: r.principal_voter_id ? String(r.principal_voter_id) : null,
    principalPhone: r.principal_phone ? String(r.principal_phone) : null,
    principalPosition: r.principal_position ? String(r.principal_position) : null,
    principalLevel: r.principal_level ? String(r.principal_level) : null,
    principalRegion: r.principal_region ? normalizeRegionName(String(r.principal_region)) : null,
    principalConstituency: r.principal_constituency
      ? normalizeConstituency(String(r.principal_constituency))
      : null,
    proxyExecutiveId: Number(r.proxy_executive_id),
    proxyName: String(r.live_proxy_name || r.proxy_name || ""),
    proxyVoterId: (r.live_proxy_voter_id ?? r.proxy_voter_id)
      ? String(r.live_proxy_voter_id ?? r.proxy_voter_id)
      : null,
    proxyPhone: (r.live_proxy_phone ?? r.proxy_phone)
      ? String(r.live_proxy_phone ?? r.proxy_phone)
      : null,
    proxyPosition: (r.live_proxy_position ?? r.proxy_position)
      ? String(r.live_proxy_position ?? r.proxy_position)
      : null,
    proxyLevel: (r.live_proxy_level ?? r.proxy_level)
      ? String(r.live_proxy_level ?? r.proxy_level)
      : null,
    proxyRegion: normProxyRegion,
    proxyConstituency: normProxyConst,
    proxyPollingStation: normStation,
    proxyGender: (r.live_proxy_gender ?? r.proxy_gender)
      ? String(r.live_proxy_gender ?? r.proxy_gender)
      : null,
    proxyDateOfBirth: (r.live_proxy_dob ?? r.proxy_date_of_birth)
      ? String(r.live_proxy_dob ?? r.proxy_date_of_birth)
      : null,
    proxyAge:
      r.live_proxy_age !== null && r.live_proxy_age !== undefined
        ? Number(r.live_proxy_age)
        : r.proxy_age !== null && r.proxy_age !== undefined
        ? Number(r.proxy_age)
        : null,
    proxyImageUrl: (r.live_proxy_image_url ?? r.proxy_image_url)
      ? String(r.live_proxy_image_url ?? r.proxy_image_url)
      : null,
    notes: r.notes ? String(r.notes) : null,
    assignedById: r.assigned_by_id ? String(r.assigned_by_id) : null,
    assignedByName: r.assigned_by_name ? String(r.assigned_by_name) : null,
    assignedByEmail: r.assigned_by_email ? String(r.assigned_by_email) : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getProxyAssignmentForPrincipal(
  principalExecutiveId: number
): Promise<ProxyAssignmentRecord | null> {
  await ensureProxyAssignmentsTableExists();
  return withEcSql(async (sql) => {
    const rows = await sql`
      SELECT
        p.*,
        e.executive_name AS live_proxy_name,
        e.voter_id AS live_proxy_voter_id,
        e.phone AS live_proxy_phone,
        e.position AS live_proxy_position,
        e.executive_level AS live_proxy_level,
        e.region AS proxy_region,
        e.constituency AS proxy_constituency,
        e.polling_station AS proxy_polling_station,
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
      WHERE p.principal_executive_id = ${principalExecutiveId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return null;
    return mapProxyRow(rows[0]);
  });
}

export async function getProxyHolderStatus(proxyExecutiveId: number): Promise<{
  principalExecutiveId: number;
  principalName: string;
  principalVoterId: string | null;
  principalPosition: string | null;
  principalRegion: string | null;
  principalConstituency: string | null;
} | null> {
  await ensureProxyAssignmentsTableExists();
  return withEcSql(async (sql) => {
    const rows = await sql`
      SELECT
        principal_executive_id,
        principal_name,
        principal_voter_id,
        principal_position,
        principal_region,
        principal_constituency
      FROM proxy_voter_assignments
      WHERE proxy_executive_id = ${proxyExecutiveId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      principalExecutiveId: Number(r.principal_executive_id),
      principalName: String(r.principal_name || ""),
      principalVoterId: r.principal_voter_id ? String(r.principal_voter_id) : null,
      principalPosition: r.principal_position ? String(r.principal_position) : null,
      principalRegion: r.principal_region ? normalizeRegionName(String(r.principal_region)) : null,
      principalConstituency: r.principal_constituency
        ? normalizeConstituency(String(r.principal_constituency))
        : null,
    };
  });
}

export async function searchProxyCandidates(params: {
  search?: string;
  region?: string;
  constituency?: string;
  level?: string;
  excludeExecutiveId?: number | null;
  limit?: number;
}): Promise<ProxyCandidateRow[]> {
  await ensureProxyAssignmentsTableExists();
  const search = (params.search || "").trim();
  const region = (params.region || "").trim();
  const constituency = (params.constituency || "").trim();
  const level = (params.level || "").trim();
  const limit = Math.min(60, Math.max(5, params.limit || 30));

  return withEcSql(async (sql) => {
    const conditions = [
      sql`e.executive_name IS NOT NULL`,
      sql`TRIM(e.executive_name) <> ''`,
      sql`e.executive_name !~* '^(vacant|vacancy|unknown|not available)\\b'`,
    ];

    if (level) {
      if (level.toLowerCase() === "region" || level.toLowerCase() === "regional") {
        conditions.push(sql`LOWER(TRIM(e.executive_level)) IN ('region', 'regional')`);
      } else {
        conditions.push(sql`LOWER(TRIM(e.executive_level)) = LOWER(${level})`);
      }
    }

    if (region) {
      conditions.push(sql`TRIM(e.region) ILIKE ${region}`);
    }

    if (constituency) {
      const variants = getConstituencyFilterVariants(constituency);
      if (variants.length > 0) {
        conditions.push(sql`UPPER(TRIM(e.constituency)) = ANY(${variants})`);
      } else {
        conditions.push(sql`TRIM(e.constituency) ILIKE ${constituency}`);
      }
    }

    if (search) {
      const pattern = `%${search}%`;
      const digitsOnly = search.replace(/\D/g, "");
      const phonePattern = digitsOnly.length >= 4 ? `%${digitsOnly}%` : pattern;
      conditions.push(
        sql`(
          e.executive_name ILIKE ${pattern}
          OR COALESCE(e.voter_id, '') ILIKE ${pattern}
          OR COALESCE(e.phone, '') ILIKE ${pattern}
          OR regexp_replace(COALESCE(e.phone, ''), '[^0-9]', '', 'g') LIKE ${phonePattern}
        )`
      );
    }

    const whereClause =
      conditions.length > 0
        ? sql`WHERE ${conditions.reduce((prev, curr) => sql`${prev} AND ${curr}`)}`
        : sql``;

    const rows = await sql`
      SELECT
        e.id,
        e.executive_name AS "executiveName",
        e.position,
        e.executive_level AS "executiveLevel",
        e.region,
        e.constituency,
        e.polling_station AS "pollingStation",
        e.voter_id AS "voterId",
        e.phone,
        e.gender,
        e.date_of_birth AS "dateOfBirth",
        CASE
          WHEN e.date_of_birth ~ '[0-9]{4}'
          THEN (2026 - substring(e.date_of_birth from '([0-9]{4})')::int)
          WHEN e.age IS NOT NULL
          THEN (e.age + 2)
          ELSE NULL
        END AS age,
        e.image_url AS "imageUrl",
        ph.principal_executive_id AS "alreadyAssignedToPrincipalId",
        ph.principal_name AS "alreadyAssignedToPrincipalName",
        ph.principal_voter_id AS "alreadyAssignedToPrincipalVoterId",
        pp.proxy_name AS "hasOwnProxyAssignedToName"
      FROM executives_all e
      LEFT JOIN proxy_voter_assignments ph
        ON (
          ph.proxy_executive_id = e.id
          OR (
            e.voter_id IS NOT NULL
            AND TRIM(e.voter_id) <> ''
            AND LENGTH(TRIM(e.voter_id)) >= 6
            AND ph.proxy_voter_id = TRIM(e.voter_id)
          )
        )
      LEFT JOIN proxy_voter_assignments pp
        ON pp.principal_executive_id = e.id
      ${whereClause}
      ORDER BY
        CASE WHEN ph.id IS NULL THEN 0 ELSE 1 END ASC,
        e.executive_name ASC,
        e.id ASC
      LIMIT ${limit}
    `;

    return rows.map((r: any) => {
      const normReg = r.region ? normalizeRegionName(String(r.region)) : "";
      const normCon = r.constituency ? normalizeConstituency(String(r.constituency)) : "";
      const isTescon = String(r.executiveLevel || "").toUpperCase() === "TESCON";
      const normStation =
        isTescon && r.pollingStation
          ? normalizeTesconInstitution(String(r.pollingStation), normReg, normCon, Number(r.id))
          : String(r.pollingStation || "");

      return {
        id: Number(r.id),
        executiveName: String(r.executiveName || ""),
        position: String(r.position || ""),
        executiveLevel: String(r.executiveLevel || ""),
        region: normReg,
        constituency: normCon,
        pollingStation: normStation,
        voterId: String(r.voterId || ""),
        phone: String(r.phone || ""),
        gender: String(r.gender || ""),
        dateOfBirth: r.dateOfBirth ? String(r.dateOfBirth) : null,
        age: r.age !== null && r.age !== undefined ? Number(r.age) : null,
        imageUrl: r.imageUrl ? String(r.imageUrl) : null,
        alreadyAssignedToPrincipalId:
          r.alreadyAssignedToPrincipalId !== null && r.alreadyAssignedToPrincipalId !== undefined
            ? Number(r.alreadyAssignedToPrincipalId)
            : null,
        alreadyAssignedToPrincipalName: r.alreadyAssignedToPrincipalName
          ? String(r.alreadyAssignedToPrincipalName)
          : null,
        alreadyAssignedToPrincipalVoterId: r.alreadyAssignedToPrincipalVoterId
          ? String(r.alreadyAssignedToPrincipalVoterId)
          : null,
        hasOwnProxyAssignedToName: r.hasOwnProxyAssignedToName
          ? String(r.hasOwnProxyAssignedToName)
          : null,
      };
    });
  });
}

export async function assignProxyVoter(input: {
  principalExecutiveId: number;
  proxyExecutiveId: number;
  notes?: string | null;
  actor: { id: string; name?: string | null; email?: string | null };
}): Promise<ProxyAssignmentRecord> {
  await ensureProxyAssignmentsTableExists();

  const { principalExecutiveId, proxyExecutiveId, notes, actor } = input;

  if (!principalExecutiveId || !proxyExecutiveId) {
    throw new Error("Both Principal Voter and Proxy Voter must be specified.");
  }

  if (Number(principalExecutiveId) === Number(proxyExecutiveId)) {
    throw new Error("A voter cannot be assigned as their own proxy.");
  }

  return withEcSql(async (sql) => {
    // 1. Fetch both Principal and Proxy records from executives_all
    const execRows = await sql`
      SELECT
        id,
        executive_name,
        voter_id,
        phone,
        position,
        executive_level,
        region,
        constituency,
        polling_station,
        gender,
        date_of_birth,
        CASE
          WHEN date_of_birth ~ '[0-9]{4}'
          THEN (2026 - substring(date_of_birth from '([0-9]{4})')::int)
          WHEN age IS NOT NULL
          THEN (age + 2)
          ELSE NULL
        END AS computed_age,
        image_url
      FROM executives_all
      WHERE id IN (${principalExecutiveId}, ${proxyExecutiveId})
    `;

    const principal = execRows.find((r: any) => Number(r.id) === Number(principalExecutiveId));
    const proxy = execRows.find((r: any) => Number(r.id) === Number(proxyExecutiveId));

    if (!principal) {
      throw new Error(`Principal voter record (#${principalExecutiveId}) was not found.`);
    }
    if (!proxy) {
      throw new Error(`Selected proxy voter record (#${proxyExecutiveId}) was not found.`);
    }

    const principalVid = String(principal.voter_id || "").trim();
    const proxyVid = String(proxy.voter_id || "").trim();

    if (principalVid && proxyVid && principalVid.length >= 6 && principalVid === proxyVid) {
      throw new Error("A voter cannot be assigned as their own proxy (matching Voter ID).");
    }

    // 2. Enforce Rule: One person must NOT get two proxy assignments!
    // Check if proxyExecutiveId (or proxyVoterId) is already assigned as a proxy for any OTHER principal voter.
    const existingProxyCheck = await sql`
      SELECT
        id,
        principal_executive_id,
        principal_name,
        principal_voter_id,
        proxy_name
      FROM proxy_voter_assignments
      WHERE (
        proxy_executive_id = ${proxyExecutiveId}
        OR (
          ${proxyVid} <> ''
          AND LENGTH(${proxyVid}) >= 6
          AND proxy_voter_id = ${proxyVid}
        )
      )
      AND principal_executive_id <> ${principalExecutiveId}
      LIMIT 1
    `;

    if (existingProxyCheck.length > 0) {
      const existing = existingProxyCheck[0];
      throw new Error(
        `${proxy.executive_name} is already assigned as a proxy for ${existing.principal_name}${
          existing.principal_voter_id ? ` (Voter ID: ${existing.principal_voter_id})` : ""
        }. One person cannot receive two proxy assignments.`
      );
    }

    // 3. Upsert proxy assignment for principal_executive_id
    const inserted = await sql`
      INSERT INTO proxy_voter_assignments (
        principal_executive_id,
        principal_name,
        principal_voter_id,
        principal_phone,
        principal_position,
        principal_level,
        principal_region,
        principal_constituency,
        proxy_executive_id,
        proxy_name,
        proxy_voter_id,
        proxy_phone,
        proxy_position,
        proxy_level,
        proxy_region,
        proxy_constituency,
        proxy_polling_station,
        proxy_gender,
        proxy_date_of_birth,
        proxy_age,
        proxy_image_url,
        notes,
        assigned_by_id,
        assigned_by_name,
        assigned_by_email,
        updated_at
      ) VALUES (
        ${Number(principal.id)},
        ${String(principal.executive_name || "").trim()},
        ${principalVid || null},
        ${principal.phone ? String(principal.phone).trim() : null},
        ${principal.position ? String(principal.position).trim() : null},
        ${principal.executive_level ? String(principal.executive_level).trim() : null},
        ${principal.region ? normalizeRegionName(String(principal.region)) : null},
        ${principal.constituency ? normalizeConstituency(String(principal.constituency)) : null},
        ${Number(proxy.id)},
        ${String(proxy.executive_name || "").trim()},
        ${proxyVid || null},
        ${proxy.phone ? String(proxy.phone).trim() : null},
        ${proxy.position ? String(proxy.position).trim() : null},
        ${proxy.executive_level ? String(proxy.executive_level).trim() : null},
        ${proxy.region ? normalizeRegionName(String(proxy.region)) : null},
        ${proxy.constituency ? normalizeConstituency(String(proxy.constituency)) : null},
        ${proxy.polling_station ? String(proxy.polling_station).trim() : null},
        ${proxy.gender ? String(proxy.gender).trim() : null},
        ${proxy.date_of_birth ? String(proxy.date_of_birth).trim() : null},
        ${proxy.computed_age !== null && proxy.computed_age !== undefined ? Number(proxy.computed_age) : null},
        ${proxy.image_url ? String(proxy.image_url).trim() : null},
        ${notes ? String(notes).trim() : null},
        ${actor.id || null},
        ${actor.name || actor.email || "Admin"},
        ${actor.email || null},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (principal_executive_id)
      DO UPDATE SET
        proxy_executive_id = EXCLUDED.proxy_executive_id,
        proxy_name = EXCLUDED.proxy_name,
        proxy_voter_id = EXCLUDED.proxy_voter_id,
        proxy_phone = EXCLUDED.proxy_phone,
        proxy_position = EXCLUDED.proxy_position,
        proxy_level = EXCLUDED.proxy_level,
        proxy_region = EXCLUDED.proxy_region,
        proxy_constituency = EXCLUDED.proxy_constituency,
        proxy_polling_station = EXCLUDED.proxy_polling_station,
        proxy_gender = EXCLUDED.proxy_gender,
        proxy_date_of_birth = EXCLUDED.proxy_date_of_birth,
        proxy_age = EXCLUDED.proxy_age,
        proxy_image_url = EXCLUDED.proxy_image_url,
        notes = EXCLUDED.notes,
        assigned_by_id = EXCLUDED.assigned_by_id,
        assigned_by_name = EXCLUDED.assigned_by_name,
        assigned_by_email = EXCLUDED.assigned_by_email,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return mapProxyRow(inserted[0]);
  });
}

export async function removeProxyAssignment(
  principalExecutiveId: number
): Promise<ProxyAssignmentRecord | null> {
  await ensureProxyAssignmentsTableExists();
  return withEcSql(async (sql) => {
    const deleted = await sql`
      DELETE FROM proxy_voter_assignments
      WHERE principal_executive_id = ${principalExecutiveId}
      RETURNING *
    `;
    if (!deleted || deleted.length === 0) return null;
    return mapProxyRow(deleted[0]);
  });
}

export async function removeAllProxyAssignments(): Promise<number> {
  await ensureProxyAssignmentsTableExists();
  return withEcSql(async (sql) => {
    const deleted = await sql`
      DELETE FROM proxy_voter_assignments
      RETURNING id
    `;
    return deleted.length;
  });
}

