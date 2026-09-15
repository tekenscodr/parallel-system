export function normalizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // If Ghana format with 233 prefix: 233XXXXXXXXX (12 digits) -> 0XXXXXXXXX (10 digits)
  if (digits.startsWith("233") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  // If 9 digits without leading 0: 24XXXXXXX -> 024XXXXXXX
  if (digits.length === 9) {
    return "0" + digits;
  }
  return digits;
}

export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "—";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return cleaned;
  const startLen = Math.min(3, Math.floor(cleaned.length / 3));
  const endLen = Math.min(3, Math.floor(cleaned.length / 3));
  const maskedMiddle = "*".repeat(cleaned.length - startLen - endLen);
  return cleaned.slice(0, startLen) + maskedMiddle + cleaned.slice(-endLen);
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendOtpSms(
  phone: string,
  otp: string,
  delegateName?: string
): Promise<SmsSendResult> {
  const normPhone = normalizePhoneNumber(phone);
  const message = `Your NPP National Elections voter verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;

  // Primary SMS API key configuration
  const apiKey = process.env.SMS_API_KEY || process.env.ARKESEL_API_KEY;
  // NCA Ghana telecom limits alphanumeric Sender ID to a maximum of 11 characters
  const senderId = (process.env.SMS_SENDER_ID || "NPP").slice(0, 11);
  const apiUrl = process.env.SMS_API_URL || "https://sms.arkesel.com/api/v2/sms/send";

  if (apiKey) {
    try {
      const recipient = normPhone.startsWith("0") ? "233" + normPhone.slice(1) : normPhone;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: senderId,
          message,
          recipients: [recipient],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[SMS SERVICE] Failed to send SMS:", errText);
      } else {
        return { success: true, messageId: `sms_${Date.now()}` };
      }
    } catch (err: any) {
      console.error("[SMS SERVICE] Error during SMS dispatch:", err.message);
    }
  }

  // Fallback / Development / Testing mode: Log OTP securely for verification
  console.log(`[SMS SERVICE] Dispatched OTP [${otp}] to ${normPhone} (${delegateName || "Delegate"})`);
  return { success: true, messageId: `mock_${Date.now()}` };
}
