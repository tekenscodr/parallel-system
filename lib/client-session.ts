"use client";

import { useEffect, useRef } from "react";

export const SESSION_TOKEN_KEY = "admin_session_token";
export const SESSION_EXPIRES_KEY = "admin_session_expires_at";
export const SESSION_ROLE_KEY = "admin_user_role";

let isLoggingOut = false;
let isFetchInterceptorInstalled = false;

/**
 * Save active session information in localStorage and cookie
 */
export function saveClientSession(
  token: string,
  expiresAt?: string | Date | null,
  role?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      localStorage.setItem("admin_token", token);
    }
    if (expiresAt) {
      const iso = expiresAt instanceof Date ? expiresAt.toISOString() : String(expiresAt);
      localStorage.setItem(SESSION_EXPIRES_KEY, iso);
    }
    if (role) {
      localStorage.setItem(SESSION_ROLE_KEY, String(role).toUpperCase());
    }
  } catch {
    // ignore
  }
}

/**
 * Completely purge client-side session credentials and cookies
 */
export function clearClientSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem("admin_token");
    localStorage.removeItem(SESSION_EXPIRES_KEY);
    localStorage.removeItem(SESSION_ROLE_KEY);
    localStorage.removeItem("admin_login_time");
    localStorage.removeItem("admin_password_updated");
    localStorage.removeItem("admin_sidebar_open");
    sessionStorage.clear();
    // Invalidate session cookie immediately
    document.cookie = "admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch {
    // ignore
  }
}

/**
 * Retrieve session expiration timestamp in ms, or null if unknown
 */
export function getSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (!raw) return null;
    const time = new Date(raw).getTime();
    return isNaN(time) ? null : time;
  } catch {
    return null;
  }
}

/**
 * Check if the stored session token has already expired
 */
export function isSessionTokenExpired(): boolean {
  const expiresAt = getSessionExpiresAt();
  if (expiresAt === null) return false;
  return Date.now() >= expiresAt;
}

/**
 * Perform automatic or manual logout and redirect to login page with reason
 */
export async function logoutAndRedirect(
  reason: "expired" | "user_logout" | "unauthorized" = "expired"
): Promise<void> {
  if (typeof window === "undefined") return;
  if (isLoggingOut) return;
  isLoggingOut = true;

  try {
    // Notify server to revoke session in ec-data
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/admin/auth/logout");
    } else {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
  } catch {
    // ignore
  } finally {
    clearClientSession();
    // Redirect to login
    const targetUrl = `/admin/login?reason=${reason}`;
    if (window.location.pathname !== "/admin/login") {
      window.location.href = targetUrl;
    } else {
      isLoggingOut = false;
    }
  }
}

/**
 * Install global fetch interceptor to catch any 401 Unauthorized API responses
 */
export function installAuthFetchInterceptor(): void {
  if (typeof window === "undefined" || isFetchInterceptorInstalled) return;
  isFetchInterceptorInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    if (response.status === 401) {
      const url =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof Request
          ? args[0].url
          : "";

      // Exclude login endpoint which naturally returns 401 on bad credentials
      if (
        url.includes("/api/admin/") &&
        !url.includes("/api/admin/auth/login") &&
        !url.includes("/api/admin/auth/logout")
      ) {
        logoutAndRedirect("expired");
      }
    }

    return response;
  };
}

/**
 * Hook to guard active admin views: monitors token expiration, visibility, and focus
 */
export function useSessionGuard(options?: {
  expiresAt?: string | Date | null;
  onExpired?: () => void;
}) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ensure fetch interceptor is installed
    installAuthFetchInterceptor();

    // If options.expiresAt is provided, update stored expiration
    if (options?.expiresAt) {
      const iso =
        options.expiresAt instanceof Date
          ? options.expiresAt.toISOString()
          : String(options.expiresAt);
      try {
        localStorage.setItem(SESSION_EXPIRES_KEY, iso);
      } catch {
        // ignore
      }
    }

    const checkAndTriggerExpiration = () => {
      if (isSessionTokenExpired()) {
        if (options?.onExpired) {
          options.onExpired();
        } else {
          logoutAndRedirect("expired");
        }
        return true;
      }
      return false;
    };

    // Immediate check
    if (checkAndTriggerExpiration()) {
      return;
    }

    // Schedule exact expiration timer
    const expiryTime = getSessionExpiresAt();
    if (expiryTime !== null) {
      const remainingMs = expiryTime - Date.now();
      if (remainingMs <= 0) {
        checkAndTriggerExpiration();
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        checkAndTriggerExpiration();
      }, remainingMs);
    }

    // Periodic check interval (every 15 seconds)
    const interval = setInterval(() => {
      checkAndTriggerExpiration();
    }, 15000);

    // Visibility / tab focus check
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkAndTriggerExpiration();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [options?.expiresAt, options?.onExpired]);
}
