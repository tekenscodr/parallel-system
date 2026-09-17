import { NextRequest, NextResponse } from "next/server";
import { mediaAccreditationService } from "@/lib/media-accreditation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request payload." },
        { status: 400 }
      );
    }

    const {
      category,
      name,
      gender,
      company,
      roleTitle,
      assignedZone,
      serviceNumber,
      emergencyContact,
      region,
      street,
      ghanaPostAddress,
      idType,
      idNumber,
      profileImage,
      phone,
      email,
      voterId,
    } = body as Record<string, unknown>;

    const activeCategory =
      typeof category === "string" && category.trim()
        ? category.trim().toUpperCase()
        : "MEDIA";

    // Required fields validation
    const missingFields: string[] = [];
    if (!name || typeof name !== "string" || !name.trim()) missingFields.push("name");
    if (!gender || typeof gender !== "string" || !gender.trim()) missingFields.push("gender");
    if (!company || typeof company !== "string" || !company.trim()) {
      if (activeCategory === "SECURITY") {
        missingFields.push("security agency / command unit");
      } else if (activeCategory === "USHER") {
        missingFields.push("protocol team / ushering committee");
      } else {
        missingFields.push("company / media house");
      }
    }
    if (!region || typeof region !== "string" || !region.trim()) missingFields.push("region");
    if (!street || typeof street !== "string" || !street.trim()) missingFields.push("street");
    if (!ghanaPostAddress || typeof ghanaPostAddress !== "string" || !ghanaPostAddress.trim()) {
      missingFields.push("ghanaPostAddress");
    }
    if (!idType || typeof idType !== "string" || !idType.trim()) missingFields.push("idType");
    if (!idNumber || typeof idNumber !== "string" || !idNumber.trim()) missingFields.push("idNumber");

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing required field(s): ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const result = await mediaAccreditationService.submitAccreditation({
      category: activeCategory,
      name: String(name).trim(),
      gender: String(gender).trim(),
      company: String(company).trim(),
      roleTitle: typeof roleTitle === "string" ? roleTitle.trim() : null,
      assignedZone: typeof assignedZone === "string" ? assignedZone.trim() : null,
      serviceNumber: typeof serviceNumber === "string" ? serviceNumber.trim() : null,
      emergencyContact: typeof emergencyContact === "string" ? emergencyContact.trim() : null,
      region: String(region).trim(),
      street: String(street).trim(),
      ghanaPostAddress: String(ghanaPostAddress).trim().toUpperCase(),
      idType: String(idType).trim(),
      idNumber: String(idNumber).trim(),
      profileImage: typeof profileImage === "string" ? profileImage.trim() : null,
      phone: typeof phone === "string" ? phone.trim() : null,
      email: typeof email === "string" ? email.trim() : null,
      voterId: typeof voterId === "string" ? voterId.trim() : null,
    });

    const categoryLabel =
      activeCategory === "SECURITY"
        ? "Security clearance"
        : activeCategory === "USHER"
        ? "Protocol & ushering accreditation"
        : "Media accreditation";

    return NextResponse.json(
      {
        success: true,
        isExisting: result.isExisting,
        message: result.isExisting
          ? `An application has already been submitted for this identification in the ${activeCategory} category.`
          : `${categoryLabel} submitted successfully.`,
        accreditation: result.accreditation,
      },
      { status: result.isExisting ? 200 : 201 }
    );
  } catch (error: unknown) {
    console.error("[ACCREDITATION API] Submit error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while processing accreditation. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idNumber = searchParams.get("idNumber");
    const idType = searchParams.get("idType");
    const code = searchParams.get("code");
    const voterId = searchParams.get("voterId");
    const category = searchParams.get("category");

    if (!idNumber && !code && !voterId) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide an idNumber, accreditation code, or voterId.",
        },
        { status: 400 }
      );
    }

    const accreditation = await mediaAccreditationService.getAccreditation({
      idNumber: idNumber || undefined,
      idType: idType || undefined,
      code: code || undefined,
      voterId: voterId || undefined,
      category: category || undefined,
    });

    if (!accreditation) {
      return NextResponse.json(
        {
          success: false,
          message: "No accreditation record found for the provided details.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        accreditation,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[ACCREDITATION API] Retrieval error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while retrieving accreditation.",
      },
      { status: 500 }
    );
  }
}
