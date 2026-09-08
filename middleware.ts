import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getRateLimitHeaders, isKnownScraperUserAgent } from "@/lib/rate-limiter";

function extractClientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const trueClient = req.headers.get("true-client-ip");
  if (trueClient) return trueClient.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const clientPublic = req.headers.get("x-client-public-ip");
  if (clientPublic) return clientPublic.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const userAgent = req.headers.get("user-agent");

  // 1. Scraper & automated script bot deterrence
  const scraperCheck = isKnownScraperUserAgent(userAgent);
  if (scraperCheck.isScraper) {
    // Exempt local development / test curl if explicitly tagged with development header
    const devBypass = req.headers.get("x-dev-test-bypass");
    if (process.env.NODE_ENV !== "development" || devBypass !== "allow") {
      return NextResponse.json(
        {
          error: "Access restricted: Automated scraping, bot scripts, and unverified crawlers are prohibited on administrative endpoints.",
          signature: scraperCheck.signature,
        },
        {
          status: 403,
          headers: {
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
            "Retry-After": "3600",
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  // 2. Sliding Window Rate Limiting on API endpoints
  if (pathname.startsWith("/api/admin")) {
    const ip = extractClientIp(req);
    const deviceId = req.headers.get("x-device-id") || "nodev";
    const clientKey = `${ip}:${deviceId}`;

    const rateLimit = checkRateLimit(clientKey, pathname);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many requests. Rate limit quota exceeded. Please retry in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimit),
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = NextResponse.next();
    const rateHeaders = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(rateHeaders)) {
      response.headers.set(key, value);
    }
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }

  // 3. Admin web pages: inject anti-crawling security headers
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: ["/api/admin/:path*", "/admin/:path*"],
};
