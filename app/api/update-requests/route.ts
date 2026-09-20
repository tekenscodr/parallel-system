import { NextRequest, NextResponse } from "next/server";
import { updateRequestsService } from "@/lib/update-requests";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, message: "Invalid payload." }, { status: 400 });
    }

    const {
      executiveId,
      requesterName,
      requesterPhone,
      requesterRole,
      requesterEmail,
      proposedChanges,
      reason,
      supportingDocUrl,
    } = body;

    if (!executiveId || typeof executiveId !== "number") {
      return NextResponse.json({ success: false, message: "Valid executiveId is required." }, { status: 400 });
    }
    if (!requesterName || !requesterPhone || !requesterRole) {
      return NextResponse.json(
        { success: false, message: "Requester name, phone number, and role are required." },
        { status: 400 }
      );
    }
    if (!proposedChanges || typeof proposedChanges !== "object" || Object.keys(proposedChanges).length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one proposed change must be provided." },
        { status: 400 }
      );
    }

    const created = await updateRequestsService.submitUpdateRequest({
      executiveId,
      requesterName: String(requesterName).trim(),
      requesterPhone: String(requesterPhone).trim(),
      requesterRole: String(requesterRole).trim(),
      requesterEmail: requesterEmail ? String(requesterEmail).trim() : null,
      proposedChanges,
      reason: reason ? String(reason).trim() : null,
      supportingDocUrl: supportingDocUrl ? String(supportingDocUrl).trim() : null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Update request submitted successfully. You can track this request using your tracking code.",
        trackingCode: created.tracking_code,
        request: created,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[PUBLIC UPDATE REQUESTS POST] Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit update request." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code")?.trim() || "";
    const phone = searchParams.get("phone")?.trim() || "";

    const query = code || phone;
    if (!query) {
      return NextResponse.json(
        { success: false, message: "Please provide a tracking code or phone number." },
        { status: 400 }
      );
    }

    const requests = await updateRequestsService.getByTracking(query);
    if (!requests || requests.length === 0) {
      return NextResponse.json(
        { success: false, message: "No update request found for the provided details." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error: any) {
    console.error("[PUBLIC UPDATE REQUESTS GET] Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to look up update request." },
      { status: 500 }
    );
  }
}
