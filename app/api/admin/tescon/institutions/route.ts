import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import {
  getTesconInstitutionsForRegion,
  getCanonicalTesconQuota,
  CANONICAL_TESCON_INSTITUTIONS_BY_REGION,
} from "@/lib/tescon-institutions";

export async function GET(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.trim() || "";

    const institutions = getTesconInstitutionsForRegion(region);
    const quota = getCanonicalTesconQuota(region);

    return NextResponse.json({
      success: true,
      region: region || "All",
      quota,
      total: institutions.length,
      institutions,
      regions: Object.keys(CANONICAL_TESCON_INSTITUTIONS_BY_REGION),
    });
  } catch (error) {
    console.error("Failed to load TESCON institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch TESCON institutions" },
      { status: 500 }
    );
  }
}
