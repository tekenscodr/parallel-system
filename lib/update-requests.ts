import crypto from "node:crypto";
import { withEcSql } from "./db-ec";

export interface UpdateRequestInput {
  executiveId: number;
  requesterName: string;
  requesterPhone: string;
  requesterRole: string;
  requesterEmail?: string | null;
  proposedChanges: Record<string, unknown>;
  reason?: string | null;
  supportingDocUrl?: string | null;
}

export interface UpdateRequestRecord {
  id: string;
  executive_id: number;
  executive_name: string;
  executive_level: string;
  region: string;
  constituency: string | null;
  position: string;
  requester_name: string;
  requester_phone: string;
  requester_role: string;
  requester_email: string | null;
  proposed_changes: Record<string, unknown>;
  current_values: Record<string, unknown>;
  reason: string | null;
  supporting_doc_url: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  tracking_code: string;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  review_notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

let tableInitialized = false;

export async function ensureUpdateRequestsTableExists(): Promise<void> {
  if (tableInitialized) return;
  try {
    await withEcSql(async (sql) => {
      await sql`
        CREATE TABLE IF NOT EXISTS executive_update_requests (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          executive_id INTEGER NOT NULL REFERENCES executives_all(id) ON DELETE CASCADE,
          executive_name VARCHAR(255) NOT NULL,
          executive_level VARCHAR(100) NOT NULL,
          region VARCHAR(100) NOT NULL,
          constituency VARCHAR(100),
          position VARCHAR(255) NOT NULL,
          requester_name VARCHAR(255) NOT NULL,
          requester_phone VARCHAR(50) NOT NULL,
          requester_role VARCHAR(100) NOT NULL,
          requester_email VARCHAR(255),
          proposed_changes JSONB NOT NULL,
          current_values JSONB NOT NULL,
          reason TEXT,
          supporting_doc_url TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          tracking_code VARCHAR(50) UNIQUE NOT NULL,
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMP WITH TIME ZONE,
          review_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_exec_update_req_status ON executive_update_requests(status);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_exec_update_req_exec_id ON executive_update_requests(executive_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_exec_update_req_tracking ON executive_update_requests(tracking_code);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_exec_update_req_created ON executive_update_requests(created_at DESC);`;
    });
    tableInitialized = true;
  } catch (err: any) {
    console.warn("[UPDATE REQUESTS] Table init notice:", err.message);
  }
}

export class UpdateRequestsService {
  public generateTrackingCode(): string {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `REQ-2026-${randomHex}`;
  }

  async submitUpdateRequest(input: UpdateRequestInput): Promise<UpdateRequestRecord> {
    await ensureUpdateRequestsTableExists();

    return await withEcSql(async (sql) => {
      // 1. Fetch current executive details
      const execRows = await sql`
        SELECT 
          id, executive_name, executive_level, region, constituency, position,
          phone, email, ghana_card, voter_id, gender, date_of_birth, age,
          image_url, status
        FROM executives_all
        WHERE id = ${input.executiveId}
        LIMIT 1
      `;

      if (!execRows || execRows.length === 0) {
        throw new Error(`Executive record with ID #${input.executiveId} not found.`);
      }

      const exec = execRows[0];
      const trackingCode = this.generateTrackingCode();
      const currentValues: Record<string, unknown> = {
        executive_name: exec.executive_name,
        phone: exec.phone,
        email: exec.email,
        ghana_card: exec.ghana_card,
        voter_id: exec.voter_id,
        gender: exec.gender,
        date_of_birth: exec.date_of_birth,
        age: exec.age,
        image_url: exec.image_url,
      };

      const inserted = await sql<UpdateRequestRecord[]>`
        INSERT INTO executive_update_requests (
          executive_id,
          executive_name,
          executive_level,
          region,
          constituency,
          position,
          requester_name,
          requester_phone,
          requester_role,
          requester_email,
          proposed_changes,
          current_values,
          reason,
          supporting_doc_url,
          status,
          tracking_code,
          created_at,
          updated_at
        ) VALUES (
          ${input.executiveId},
          ${exec.executive_name},
          ${exec.executive_level},
          ${exec.region},
          ${exec.constituency || null},
          ${exec.position},
          ${input.requesterName.trim()},
          ${input.requesterPhone.trim()},
          ${input.requesterRole.trim()},
          ${input.requesterEmail?.trim() || null},
          ${JSON.stringify(input.proposedChanges)},
          ${JSON.stringify(currentValues)},
          ${input.reason?.trim() || null},
          ${input.supportingDocUrl?.trim() || null},
          'PENDING',
          ${trackingCode},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      return inserted[0];
    });
  }

  async getByTracking(codeOrPhone: string): Promise<UpdateRequestRecord[]> {
    await ensureUpdateRequestsTableExists();
    const clean = codeOrPhone.trim().toUpperCase();

    return await withEcSql(async (sql) => {
      return await sql<UpdateRequestRecord[]>`
        SELECT *
        FROM executive_update_requests
        WHERE UPPER(tracking_code) = ${clean}
           OR requester_phone = ${codeOrPhone.trim()}
        ORDER BY created_at DESC
        LIMIT 20
      `;
    });
  }

  async getById(id: string): Promise<UpdateRequestRecord | null> {
    await ensureUpdateRequestsTableExists();

    return await withEcSql(async (sql) => {
      const rows = await sql<UpdateRequestRecord[]>`
        SELECT *
        FROM executive_update_requests
        WHERE id = ${id}
        LIMIT 1
      `;
      return rows[0] || null;
    });
  }

  async listRequests(filters: {
    status?: string;
    level?: string;
    region?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: UpdateRequestRecord[];
    total: number;
    stats: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
  }> {
    await ensureUpdateRequestsTableExists();

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    return await withEcSql(async (sql) => {
      // 1. Overall stats
      const statsRows = await sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int as pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int as approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int as rejected
        FROM executive_update_requests
      `;
      const stats = {
        total: Number(statsRows[0]?.total || 0),
        pending: Number(statsRows[0]?.pending || 0),
        approved: Number(statsRows[0]?.approved || 0),
        rejected: Number(statsRows[0]?.rejected || 0),
      };

      // 2. Query with filters
      const statusFilter = filters.status && filters.status !== "ALL" ? filters.status : null;
      const levelFilter = filters.level && filters.level !== "ALL" ? filters.level : null;
      const regionFilter = filters.region && filters.region !== "ALL" ? filters.region : null;
      const search = filters.search ? `%${filters.search.trim().toLowerCase()}%` : null;

      const items = await sql<UpdateRequestRecord[]>`
        SELECT *
        FROM executive_update_requests
        WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
          AND (${levelFilter}::text IS NULL OR executive_level = ${levelFilter})
          AND (${regionFilter}::text IS NULL OR region = ${regionFilter})
          AND (${search}::text IS NULL OR (
            LOWER(executive_name) LIKE ${search}
            OR LOWER(tracking_code) LIKE ${search}
            OR LOWER(requester_name) LIKE ${search}
            OR LOWER(requester_phone) LIKE ${search}
            OR LOWER(position) LIKE ${search}
            OR LOWER(COALESCE(constituency, '')) LIKE ${search}
          ))
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countRows = await sql`
        SELECT COUNT(*)::int as count
        FROM executive_update_requests
        WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
          AND (${levelFilter}::text IS NULL OR executive_level = ${levelFilter})
          AND (${regionFilter}::text IS NULL OR region = ${regionFilter})
          AND (${search}::text IS NULL OR (
            LOWER(executive_name) LIKE ${search}
            OR LOWER(tracking_code) LIKE ${search}
            OR LOWER(requester_name) LIKE ${search}
            OR LOWER(requester_phone) LIKE ${search}
            OR LOWER(position) LIKE ${search}
            OR LOWER(COALESCE(constituency, '')) LIKE ${search}
          ))
      `;

      return {
        items,
        total: Number(countRows[0]?.count || 0),
        stats,
      };
    });
  }

  async approveRequest(
    id: string,
    reviewer: string,
    notes?: string
  ): Promise<{
    request: UpdateRequestRecord;
    previousValues: Record<string, unknown>;
  }> {
    await ensureUpdateRequestsTableExists();

    return await withEcSql(async (sql) => {
      // 1. Get request
      const reqRows = await sql<UpdateRequestRecord[]>`
        SELECT * FROM executive_update_requests WHERE id = ${id} FOR UPDATE
      `;
      if (!reqRows || reqRows.length === 0) {
        throw new Error("Update request not found.");
      }
      const request = reqRows[0];
      if (request.status === "APPROVED") {
        throw new Error("This update request has already been approved.");
      }

      // 2. Load current executive row
      const execRows = await sql`
        SELECT * FROM executives_all WHERE id = ${request.executive_id} FOR UPDATE
      `;
      if (!execRows || execRows.length === 0) {
        throw new Error(`Target executive #${request.executive_id} not found in database.`);
      }
      const exec = execRows[0];
      const previousValues: Record<string, unknown> = { ...exec };

      // 3. Allowed columns that can be updated from proposed_changes
      const allowedKeys = [
        "executive_name",
        "phone",
        "email",
        "ghana_card",
        "voter_id",
        "gender",
        "date_of_birth",
        "age",
        "image_url",
        "position",
      ];

      const proposed = request.proposed_changes as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};

      for (const key of allowedKeys) {
        if (key in proposed && proposed[key] !== undefined) {
          updateData[key] = proposed[key];
        }
      }

      if (Object.keys(updateData).length > 0) {
        const uName = (updateData.executive_name as string) ?? null;
        const uPhone = (updateData.phone as string) ?? null;
        const uEmail = (updateData.email as string) ?? null;
        const uGhanaCard = (updateData.ghana_card as string) ?? null;
        const uVoterId = (updateData.voter_id as string) ?? null;
        const uGender = (updateData.gender as string) ?? null;
        const uDob = (updateData.date_of_birth as string) ?? null;
        const uAge = (updateData.age as number) ?? null;
        const uImage = (updateData.image_url as string) ?? null;
        const uPosition = (updateData.position as string) ?? null;

        await sql`
          UPDATE executives_all
          SET 
            executive_name = COALESCE(${uName}, executive_name),
            phone = COALESCE(${uPhone}, phone),
            email = COALESCE(${uEmail}, email),
            ghana_card = COALESCE(${uGhanaCard}, ghana_card),
            voter_id = COALESCE(${uVoterId}, voter_id),
            gender = COALESCE(${uGender}, gender),
            date_of_birth = COALESCE(${uDob}, date_of_birth),
            age = COALESCE(${uAge}, age),
            image_url = COALESCE(${uImage}, image_url),
            position = COALESCE(${uPosition}, position)
          WHERE id = ${request.executive_id}
        `;
      }

      // 4. Update request status to APPROVED
      const updatedReqRows = await sql<UpdateRequestRecord[]>`
        UPDATE executive_update_requests
        SET 
          status = 'APPROVED',
          reviewed_by = ${reviewer},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = ${notes?.trim() || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      return {
        request: updatedReqRows[0],
        previousValues,
      };
    });
  }

  async rejectRequest(
    id: string,
    reviewer: string,
    notes: string
  ): Promise<UpdateRequestRecord> {
    await ensureUpdateRequestsTableExists();

    return await withEcSql(async (sql) => {
      const updatedReqRows = await sql<UpdateRequestRecord[]>`
        UPDATE executive_update_requests
        SET 
          status = 'REJECTED',
          reviewed_by = ${reviewer},
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = ${notes.trim()},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      if (!updatedReqRows || updatedReqRows.length === 0) {
        throw new Error("Update request not found.");
      }
      return updatedReqRows[0];
    });
  }
}

export const updateRequestsService = new UpdateRequestsService();
