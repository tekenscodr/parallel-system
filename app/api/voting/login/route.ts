import { NextResponse } from "next/server";
import { findDelegate, createOtp } from "@/lib/delegate-auth";
import { sendOtpSms, maskPhoneNumber, normalizePhoneNumber } from "@/lib/sms";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentifier = String(body?.identifier || "").trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter your 10-digit Voter ID or registered Phone number.",
        },
        { status: 400 }
      );
    }

    // Lookup delegate in database
    const { delegate, error } = await findDelegate(rawIdentifier);

    if (!delegate || error) {
      return NextResponse.json(
        {
          success: false,
          error: error || "Delegate verification failed. No eligible voter was found matching the provided details.",
        },
        { status: 404 }
      );
    }

    // Resolve phone number for OTP dispatch
    const rawPhone = delegate.phone && delegate.phone.trim() !== "None" ? delegate.phone.trim() : "";
    const isIdentifierPhone = normalizePhoneNumber(rawIdentifier).length >= 9;
    const phoneToUse = rawPhone || (isIdentifierPhone ? rawIdentifier : "");

    if (!phoneToUse || normalizePhoneNumber(phoneToUse).length < 9) {
      return NextResponse.json(
        {
          success: false,
          error: `Delegate ${delegate.executive_name} does not have an active phone number on file. Please visit the regional electoral desk to update your contact details.`,
        },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = await createOtp(rawIdentifier, phoneToUse, delegate.voter_id || "");

    // Send OTP via SMS
    await sendOtpSms(phoneToUse, otp, delegate.executive_name || undefined);

    const isDev = process.env.NODE_ENV !== "production";

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent successfully to your registered phone number.",
        identifier: rawIdentifier,
        phoneMasked: maskPhoneNumber(phoneToUse),
        expiresInSeconds: 600,
        ...(isDev ? { devOtp: otp } : {}),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err: any) {
    console.error("[DELEGATE LOGIN API] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while processing your login. Please try again shortly.",
      },
      { status: 500 }
    );
  }
}
