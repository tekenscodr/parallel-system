import { NextResponse } from "next/server";
import { getDelegateSession, verifyDelegateSession } from "@/lib/delegate-auth";

export async function GET(req: Request) {
  try {
    const session = getDelegateSession(req);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Session expired or invalid. Please sign in with your Voter ID or Phone number.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        delegate: {
          id: session.delegateId,
          name: session.name,
          voterId: session.voterId,
          phone: session.phone,
          level: session.level,
          region: session.region,
          constituency: session.constituency,
          position: session.position,
          gender: session.gender,
          age: session.age,
        },
        entitledPositions: session.entitledPositions,
        verifiedAt: session.verifiedAt,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err: any) {
    console.error("[ELECTION CONFIRMATION API] Error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to load election confirmation." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const session = token ? verifyDelegateSession(token) : getDelegateSession(req);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Session expired or invalid. Please sign in with your Voter ID or Phone number.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        delegate: {
          id: session.delegateId,
          name: session.name,
          voterId: session.voterId,
          phone: session.phone,
          level: session.level,
          region: session.region,
          constituency: session.constituency,
          position: session.position,
          gender: session.gender,
          age: session.age,
        },
        entitledPositions: session.entitledPositions,
        verifiedAt: session.verifiedAt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Unable to load election confirmation." },
      { status: 500 }
    );
  }
}
