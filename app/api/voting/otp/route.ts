import { NextResponse } from "next/server";
import { findDelegate, verifyOtp, signDelegateSession, type DelegateSessionData } from "@/lib/delegate-auth";
import { getDelegateEntitledPositions } from "@/lib/voting-entitlement";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentifier = String(body?.identifier || "").trim();
    const rawOtp = String(body?.otp || "").trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { success: false, error: "Identifier (Voter ID or Phone) is required." },
        { status: 400 }
      );
    }

    if (!rawOtp) {
      return NextResponse.json(
        { success: false, error: "Please enter the 6-digit verification code." },
        { status: 400 }
      );
    }

    // Verify OTP against store
    const verifyResult = await verifyOtp(rawIdentifier, rawOtp);
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Find delegate
    const { delegate, error } = await findDelegate(rawIdentifier);
    if (!delegate || error) {
      return NextResponse.json(
        { success: false, error: "Delegate profile could not be retrieved. Please re-authenticate." },
        { status: 404 }
      );
    }

    // Compute all positions the delegate is entitled to vote for
    const entitledPositions = getDelegateEntitledPositions(delegate);

    const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hour voting session
    const sessionData: DelegateSessionData = {
      delegateId: delegate.id || 0,
      name: delegate.executive_name || "",
      voterId: delegate.voter_id || "",
      phone: delegate.phone || "",
      level: delegate.executive_level || "",
      region: delegate.region || "",
      constituency: delegate.constituency || delegate.polling_station || "",
      position: delegate.position || "",
      gender: delegate.gender || "",
      age: delegate.age ?? null,
      dateOfBirth: delegate.date_of_birth ?? null,
      entitledPositions,
      verifiedAt: new Date().toISOString(),
      expiresAt,
    };

    const token = signDelegateSession(sessionData);

    const response = NextResponse.json(
      {
        success: true,
        message: "Identity verified successfully.",
        delegate: {
          id: delegate.id,
          name: delegate.executive_name,
          voterId: delegate.voter_id,
          phone: delegate.phone,
          level: delegate.executive_level,
          region: delegate.region,
          constituency: delegate.constituency,
          pollingStation: delegate.polling_station,
          position: delegate.position,
          gender: delegate.gender,
          age: delegate.age,
        },
        entitledPositions,
        token,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );

    // Set secure session cookie
    response.cookies.set({
      name: "delegate_voting_session",
      value: token,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 4 * 60 * 60, // 4 hours
    });

    return response;
  } catch (err: any) {
    console.error("[DELEGATE OTP API] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during OTP verification." },
      { status: 500 }
    );
  }
}
