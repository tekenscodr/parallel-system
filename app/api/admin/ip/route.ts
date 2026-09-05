import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit-logger";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  return NextResponse.json({ ip });
}
