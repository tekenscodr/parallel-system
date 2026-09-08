/**
 * Frontend Client-Side Rate Limiter & Anti-Bot Deterrence Engine
 * 
 * Protects against:
 * 1. Rapid click hammering and in-browser request loops (sliding window throttler).
 * 2. Headless automation scripts, Selenium, Puppeteer, and WebDriver crawlers.
 * 3. Script-driven scraping attempts bypassing standard human interaction entropy.
 */

export type RateLimitCategory = "LOGIN" | "LOOKUP" | "EXPORT" | "MUTATION" | "GENERAL";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  cooldownMs: number;
}

export const CLIENT_RATE_LIMITS: Record<RateLimitCategory, RateLimitConfig> = {
  LOGIN: { maxRequests: 5, windowMs: 60000, cooldownMs: 2000 },
  LOOKUP: { maxRequests: 15, windowMs: 60000, cooldownMs: 600 },
  EXPORT: { maxRequests: 3, windowMs: 60000, cooldownMs: 5000 },
  MUTATION: { maxRequests: 15, windowMs: 60000, cooldownMs: 1200 },
  GENERAL: { maxRequests: 60, windowMs: 60000, cooldownMs: 200 },
};

// In-memory sliding window store for timestamps per category
const requestTimestamps: Map<RateLimitCategory, number[]> = new Map();
const lastRequestTime: Map<RateLimitCategory, number> = new Map();

// Human interaction entropy tracking
let humanInteractionScore = 0;
let pageLoadTimestamp = typeof window !== "undefined" ? Date.now() : 0;
let isEntropyInitialized = false;

/**
 * Initialize human interaction listeners (passive mouse, keyboard, touch, scroll)
 */
export function initHumanInteractionTracker(): void {
  if (typeof window === "undefined" || isEntropyInitialized) return;
  isEntropyInitialized = true;
  pageLoadTimestamp = Date.now();

  const handleInteraction = () => {
    humanInteractionScore = Math.min(100, humanInteractionScore + 1);
  };

  window.addEventListener("mousemove", handleInteraction, { passive: true, once: false });
  window.addEventListener("keydown", handleInteraction, { passive: true, once: false });
  window.addEventListener("touchstart", handleInteraction, { passive: true, once: false });
  window.addEventListener("scroll", handleInteraction, { passive: true, once: false });
}

// Auto-initialize if running in browser
if (typeof window !== "undefined") {
  initHumanInteractionTracker();
}

/**
 * Automated browser and scraper heuristics detection
 */
export function detectAutomatedBot(): { isBot: boolean; indicators: string[] } {
  if (typeof window === "undefined") {
    return { isBot: false, indicators: [] };
  }

  const indicators: string[] = [];
  const win = window as unknown as Record<string, unknown>;

  // 1. Navigator WebDriver indicator (Puppeteer, Selenium, Playwright)
  if (navigator.webdriver === true) {
    indicators.push("webdriver_active");
  }

  // 2. Automation framework globals
  if (win._phantom || win.callPhantom || win.__nightmare) {
    indicators.push("phantom_headless_detected");
  }
  if (win.Cypress || win.__selenium_evaluate) {
    indicators.push("selenium_cypress_detected");
  }

  // 3. Headless Chrome specific signatures
  if (
    navigator.userAgent.includes("HeadlessChrome") ||
    navigator.userAgent.includes("PhantomJS")
  ) {
    indicators.push("headless_user_agent");
  }

  // 4. Missing window dimensions (common in zero-display scraper scripts)
  if (window.outerWidth === 0 && window.outerHeight === 0) {
    indicators.push("zero_window_dimensions");
  }

  return {
    isBot: indicators.length > 0,
    indicators,
  };
}

/**
 * Checks client-side rate limit for a specific category.
 * Prevents rapid-fire UI clicks or automated script loops before network transmission.
 */
export function checkClientRateLimit(
  category: RateLimitCategory = "GENERAL"
): { allowed: boolean; retryAfterSeconds: number; message?: string } {
  if (typeof window === "undefined") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const config = CLIENT_RATE_LIMITS[category] || CLIENT_RATE_LIMITS.GENERAL;
  const now = Date.now();

  // 1. Check minimum cooldown between consecutive requests
  const lastTime = lastRequestTime.get(category) || 0;
  const elapsedSinceLast = now - lastTime;
  if (elapsedSinceLast < config.cooldownMs) {
    const cooldownRemainingSec = Math.ceil((config.cooldownMs - elapsedSinceLast) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, cooldownRemainingSec),
      message: `Action throttled: please wait ${Math.max(1, cooldownRemainingSec)}s before clicking again.`,
    };
  }

  // 2. Sliding window rate limit
  const timestamps = requestTimestamps.get(category) || [];
  const windowStart = now - config.windowMs;
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= config.maxRequests) {
    const oldestInWindow = activeTimestamps[0];
    const waitTimeMs = config.windowMs - (now - oldestInWindow);
    const retryAfterSec = Math.max(1, Math.ceil(waitTimeMs / 1000));
    return {
      allowed: false,
      retryAfterSeconds: retryAfterSec,
      message: `Rate limit reached: maximum ${config.maxRequests} requests per minute. Please retry in ${retryAfterSec}s.`,
    };
  }

  // Record allowed request
  activeTimestamps.push(now);
  requestTimestamps.set(category, activeTimestamps);
  lastRequestTime.set(category, now);

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Returns human verification and anti-bot verification headers.
 */
export function getHumanVerificationHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const botCheck = detectAutomatedBot();
  const now = Date.now();
  const timeOnPage = Math.max(0, now - pageLoadTimestamp);

  // Generate lightweight verification payload
  const payload = {
    v: 1,
    ts: now,
    score: humanInteractionScore,
    elapsed: timeOnPage,
    isBot: botCheck.isBot,
  };

  let token = "";
  try {
    token = btoa(JSON.stringify(payload));
  } catch {
    token = "fallback";
  }

  return {
    "x-human-verification": token,
    "x-bot-suspect": botCheck.isBot ? "1" : "0",
  };
}
