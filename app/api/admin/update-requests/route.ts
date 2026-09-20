import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { updateRequestsService } from "@/lib/update-requests";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const level = searchParams.get("level")?.trim() || "";
    const region = searchParams.get("region")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const result = await updateRequestsService.listRequests({
      search,
      status,
      level,
      region,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("[ADMIN UPDATE REQUESTS GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch update requests." }, { status: 500 });
  }
}
