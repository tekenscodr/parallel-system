import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { withEcSql } from "@/lib/db-ec";
import { logAuditEvent, getClientIp, diffExecutiveRecords } from "@/lib/audit-logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid executive ID" }, { status: 400 });
    }

    const row = await withEcSql(async (sql) => {
      const res = await sql`
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
          is_youth_organiser as "isYouthOrganiser",
          is_age_adjusted as "isAgeAdjusted",
          status,
          record_entered_by as "recordEnteredBy",
          image_url as "imageUrl"
        FROM executives_all
        WHERE id = ${id}
        LIMIT 1
      `;
      return res[0] || null;
    });

    if (!row) {
      return NextResponse.json({ error: "Executive record not found" }, { status: 404 });
    }

    return NextResponse.json({ executive: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading executive";
    console.error("Executive detail fetch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid executive ID" }, { status: 400 });
    }

    const body = await req.json();

    const {
      executiveName,
      executiveLevel,
      slotStatus,
      region,
      constituency,
      electoralArea,
      pollingStation,
      position,
      gender,
      phone,
      email,
      ghanaCard,
      voterId,
      membershipId,
      dateOfBirth,
      status,
    } = body;

    // Optional age calculation if DOB changed
    let calculatedAge: number | null = null;
    if (dateOfBirth && typeof dateOfBirth === "string") {
      const parts = dateOfBirth.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        if (!isNaN(year) && year > 1920 && year <= 2026) {
          calculatedAge = 2024 - year;
        }
      }
    }

    const isYouth = position && typeof position === "string" 
      ? /youth\s*organi[sz]er/i.test(position) 
      : false;

    // 1. Fetch previous state before updating
    const previousRow = await withEcSql(async (sql) => {
      const res = await sql`
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
        WHERE id = ${id}
        LIMIT 1
      `;
      return res[0] || null;
    });

    if (!previousRow) {
      return NextResponse.json({ error: "Executive record not found" }, { status: 404 });
    }

    // 2. Perform update
    const updatedRow = await withEcSql(async (sql) => {
      const res = await sql`
        UPDATE executives_all
        SET 
          executive_name = COALESCE(${executiveName ?? null}, executive_name),
          executive_level = COALESCE(${executiveLevel ?? null}, executive_level),
          slot_status = COALESCE(${slotStatus ?? null}, slot_status),
          region = COALESCE(${region ?? null}, region),
          constituency = COALESCE(${constituency ?? null}, constituency),
          electoral_area = COALESCE(${electoralArea ?? null}, electoral_area),
          polling_station = COALESCE(${pollingStation ?? null}, polling_station),
          position = COALESCE(${position ?? null}, position),
          gender = COALESCE(${gender ?? null}, gender),
          phone = COALESCE(${phone ?? null}, phone),
          email = COALESCE(${email ?? null}, email),
          ghana_card = COALESCE(${ghanaCard ?? null}, ghana_card),
          voter_id = COALESCE(${voterId ?? null}, voter_id),
          membership_id = COALESCE(${membershipId ?? null}, membership_id),
          date_of_birth = COALESCE(${dateOfBirth ?? null}, date_of_birth),
          age = COALESCE(${calculatedAge ?? null}, age),
          is_youth_organiser = ${isYouth},
          status = COALESCE(${status ?? null}, status)
        WHERE id = ${id}
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
          is_youth_organiser as "isYouthOrganiser",
          is_age_adjusted as "isAgeAdjusted",
          status
      `;
      return res[0] || null;
    });

    if (!updatedRow) {
      return NextResponse.json({ error: "Executive record not found" }, { status: 404 });
    }

    // 3. Compute field-level change diff
    const diff = diffExecutiveRecords(previousRow, updatedRow);

    // 4. Log AuditEvent with IP Sync
    const clientIp = getClientIp(req);
    await logAuditEvent({
      actorId: session.user.id,
      action: "EXECUTIVE_UPDATE",
      resource: "executives_all",
      resourceId: String(id),
      ipAddress: clientIp,
      userAgent: req.headers.get("user-agent"),
      metadata: {
        executiveName: updatedRow.executiveName,
        position: updatedRow.position,
        region: updatedRow.region,
        constituency: updatedRow.constituency,
        userEmail: session.user.email,
        userName: session.user.name,
        userRole: session.user.role,
        changedFields: Object.keys(diff),
        diff,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Executive details updated successfully.",
      executive: updatedRow,
      diff,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error updating executive";
    console.error("Executive update error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
