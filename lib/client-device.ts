/**
 * Client-side device identification and public IP discovery utility.
 * Helps distinguish distinct client devices even when sharing NAT routers or cellular WAN IPs.
 */

export function getDeviceId(): string {
  if (typeof window === "undefined") return "web";
  try {
    let deviceId = localStorage.getItem("admin_device_id");
    if (!deviceId || !deviceId.startsWith("dev_")) {
      const randStr =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
          : Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      deviceId = `dev_${randStr}`;
      localStorage.setItem("admin_device_id", deviceId);
    }
    return deviceId;
  } catch {
    return "web";
  }
}

export function getClientPublicIp(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem("admin_client_public_ip") || null;
  } catch {
    return null;
  }
}

export async function initClientIpDetection(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // Ensure persistent device ID is created/stored
  getDeviceId();

  // Return cached public IP if already resolved in this session
  try {
    const cached = sessionStorage.getItem("admin_client_public_ip");
    if (cached && cached !== "127.0.0.1" && cached !== "::1") {
      return cached;
    }
  } catch {
    // ignore storage error
  }

  // 1. Try public IP discovery via ipify (reliable global IP mirror)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.ip === "string" && data.ip.trim()) {
        const publicIp = data.ip.trim();
        try {
          sessionStorage.setItem("admin_client_public_ip", publicIp);
        } catch {
          // ignore
        }
        return publicIp;
      }
    }
  } catch {
    // Ipify unreachable or blocked; proceed to fallback
  }

  // 2. Fallback to application's internal IP endpoint
  try {
    const res = await fetch("/api/admin/ip", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.ip === "string" && data.ip.trim()) {
        const publicIp = data.ip.trim();
        if (publicIp !== "127.0.0.1" && publicIp !== "::1") {
          try {
            sessionStorage.setItem("admin_client_public_ip", publicIp);
          } catch {
            // ignore
          }
          return publicIp;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function getClientHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (typeof window === "undefined") return headers;

  try {
    const token = localStorage.getItem("admin_session_token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }

  const deviceId = getDeviceId();
  if (deviceId) {
    headers["x-device-id"] = deviceId;
  }

  const publicIp = getClientPublicIp();
  if (publicIp) {
    headers["x-client-public-ip"] = publicIp;
  }

  return headers;
}
