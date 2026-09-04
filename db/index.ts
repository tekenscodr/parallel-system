import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function getCloudflareEnv(): Record<string, any> {
  try {
    return eval('require("cloudflare:workers")')?.env || {};
  } catch {
    return ((globalThis as any)?.__CLOUDFLARE_ENV__ || {}) as Record<string, any>;
  }
}

export function getDb() {
  const env = getCloudflareEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
