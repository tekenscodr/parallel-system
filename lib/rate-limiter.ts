/**
 * Server-Side Sliding Window Rate Limiter & Scraper Shield
 * 
 * Works seamlessly across Edge Runtime (Next.js Middleware) and Node.js API routes.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds to wait
}

export const ROUTE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/admin/auth/login": { maxRequests: 5, windowSeconds: 60 },
  "/api/admin/auth/change-password": { maxRequests: 5, windowSeconds: 60 },
  "/api/admin/export": { maxRequests: 3, windowSeconds: 60 },
  "/api/admin/voters/lookup": { maxRequests: 15, windowSeconds: 60 },
  "/api/admin/executives": { maxRequests: 35, windowSeconds: 60 },
  "/api/admin/users": { maxRequests: 25, windowSeconds: 60 },
  "default": { maxRequests: 60, windowSeconds: 60 },
};

// In-memory sliding window bucket store
interface ClientBucket {
  timestamps: number[];
  lastAccess: number;
}

const rateLimitStore = new Map<string, ClientBucket>();

// Periodic cleanup of expired entries every 2 minutes
const CLEANUP_INTERVAL_MS = 120000;
let lastCleanup = Date.now();

function cleanupExpiredBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of rateLimitStore.entries()) {
    // If bucket was inactive for more than 5 minutes, delete it
    if (now - bucket.lastAccess > 300000) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Resolves the appropriate rate limit config for a given request path.
 */
export function getRouteConfig(pathname: string): RateLimitConfig {
  for (const [routePrefix, config] of Object.entries(ROUTE_RATE_LIMITS)) {
    if (routePrefix !== "default" && pathname.startsWith(routePrefix)) {
      return config;
    }
  }
  return ROUTE_RATE_LIMITS.default;
}

/**
 * Enforces sliding window rate limit for a client key and pathname.
 */
export function checkRateLimit(
  clientKey: string,
  pathname: string,
  customConfig?: RateLimitConfig
): RateLimitResult {
  cleanupExpiredBuckets();

  const config = customConfig || getRouteConfig(pathname);
  const nowMs = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = nowMs - windowMs;

  const storageKey = `${clientKey}:${pathname.split("?")[0]}`;
  let bucket = rateLimitStore.get(storageKey);

  if (!bucket) {
    bucket = { timestamps: [], lastAccess: nowMs };
    rateLimitStore.set(storageKey, bucket);
  }

  bucket.lastAccess = nowMs;

  // Filter out timestamps outside the sliding window
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  const requestCount = bucket.timestamps.length;
  const resetTimestampSec = Math.ceil((nowMs + windowMs) / 1000);

  if (requestCount >= config.maxRequests) {
    const oldestTimestamp = bucket.timestamps[0] || nowMs;
    const retryAfterMs = windowMs - (nowMs - oldestTimestamp);
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: resetTimestampSec,
      retryAfter: retryAfterSec,
    };
  }

  // Record allowed hit
  bucket.timestamps.push(nowMs);
  const remaining = Math.max(0, config.maxRequests - bucket.timestamps.length);

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining,
    resetTime: resetTimestampSec,
    retryAfter: 0,
  };
}

/**
 * Returns standard rate limiting HTTP headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetTime),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Known Scraper and Malicious Bot User-Agent Detector
 */
const KNOWN_SCRAPER_PATTERNS = [
  /python-requests/i,
  /aiohttp/i,
  /scrapy/i,
  /curl\//i,
  /wget\//i,
  /httpclient/i,
  /urllib/i,
  /libwww-perl/i,
  /got\//i,
  /node-fetch/i,
  /postmanruntime/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /mechanize/i,
  /playwright/i,
  /puppeteer/i,
];

export function isKnownScraperUserAgent(userAgent: string | null): {
  isScraper: boolean;
  signature?: string;
} {
  if (!userAgent || userAgent.trim() === "") {
    // Missing user-agent on protected API is highly suspicious
    return { isScraper: true, signature: "empty_user_agent" };
  }

  for (const pattern of KNOWN_SCRAPER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isScraper: true, signature: pattern.source };
    }
  }

  return { isScraper: false };
}
