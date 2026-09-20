import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { updateRequestsService } from "@/lib/update-requests";
import { logAuditEvent } from "@/lib/audit-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const reqRecord = await updateRequestsService.getById(id);
    if (!reqRecord) {
      return NextResponse.json({ error: "Update request not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: reqRecord });
  } catch (error: any) {
    console.error("[ADMIN UPDATE REQUEST ID GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve request." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || !body.action) {
      return NextResponse.json({ error: "Action (APPROVE or REJECT) is required." }, { status: 400 });
    }

    const reviewerName = session.user.name || session.user.email;
    const action = String(body.action).toUpperCase();
    const notes = typeof body.notes === "string" ? body.notes : "";

    if (action === "APPROVE") {
      const { request: updatedRequest, previousValues } = await updateRequestsService.approveRequest(
        id,
        reviewerName,
        notes
      );

      await logAuditEvent({
        actorId: session.user.id,
        action: "EXECUTIVE_UPDATE_APPROVED",
        resource: "executives_all",
        resourceId: String(updatedRequest.executive_id),
        metadata: {
          requestId: id,
          trackingCode: updatedRequest.tracking_code,
          executiveName: updatedRequest.executive_name,
          proposedChanges: updatedRequest.proposed_changes,
          previousValues,
          reviewNotes: notes,
        },
        req: request,
      });

      return NextResponse.json({
        success: true,
        message: "Update request approved and applied to database successfully.",
        request: updatedRequest,
      });
    } else if (action === "REJECT") {
      if (!notes.trim()) {
        return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
      }

      const updatedRequest = await updateRequestsService.rejectRequest(
        id,
        reviewerName,
        notes
      );

      await logAuditEvent({
        actorId: session.user.id,
        action: "EXECUTIVE_UPDATE_REJECTED",
        resource: "executive_update_requests",
        resourceId: id,
        metadata: {
          trackingCode: updatedRequest.tracking_code,
          executiveName: updatedRequest.executive_name,
          reviewNotes: notes,
        },
        req: request,
      });

      return NextResponse.json({
        success: true,
        message: "Update request rejected.",
        request: updatedRequest,
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Use APPROVE or REJECT." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[ADMIN UPDATE REQUEST ID PATCH] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process update request." }, { status: 500 });
  }
}
