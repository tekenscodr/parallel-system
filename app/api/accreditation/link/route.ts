import { NextRequest, NextResponse } from "next/server";
import { mediaAccreditationService } from "@/lib/media-accreditation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const { idNumber, idType, voterId } = body as {
      idNumber?: unknown;
      idType?: unknown;
      voterId?: unknown;
    };

    if (typeof idNumber !== "string" || !idNumber.trim()) {
      return NextResponse.json(
        { success: false, message: "Identification number (idNumber) is required." },
        { status: 400 }
      );
    }

    if (typeof voterId !== "string" || !voterId.trim()) {
      return NextResponse.json(
        { success: false, message: "Voter ID (voterId) is required to link accreditation." },
        { status: 400 }
      );
    }

    const updated = await mediaAccreditationService.linkVoterToAccreditation({
      idNumber: idNumber.trim(),
      idType: typeof idType === "string" ? idType.trim() : undefined,
      voterId: voterId.trim(),
    });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message: "Could not find a media accreditation record matching the provided ID number.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Voter record successfully linked to media accreditation.",
        accreditation: updated,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[ACCREDITATION LINK API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while linking voter to accreditation.",
      },
      { status: 500 }
    );
  }
}
