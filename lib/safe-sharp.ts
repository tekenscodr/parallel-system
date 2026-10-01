/**
 * Safe, lazy loader for 'sharp'.
 * In environments like Cloudflare Workers, workerd, or vinext runner,
 * native C++ Node.js binaries (.node) cannot be loaded via require()
 * and will cause the entire server to crash on startup if statically imported.
 *
 * This utility dynamically loads sharp when available in native Node.js,
 * while safely returning null in non-compatible worker environments.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cachedSharp: any = null;
let _attempted = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSafeSharp(): Promise<any | null> {
  if (_attempted) return _cachedSharp;
  _attempted = true;

  // If in browser or workerd environment without standard Node process bindings
  if (typeof process === "undefined" || !process.versions?.node) {
    return null;
  }

  try {
    // Shield dynamic import from static AST bundling by Vite / Rolldown / Webpack
    const dynamicImport = new Function("pkg", "return import(pkg);");
    const mod = await dynamicImport("sharp");
    _cachedSharp = (mod && mod.default) ? mod.default : mod;
    return _cachedSharp;
  } catch {
    _cachedSharp = null;
    return null;
  }
}

/**
 * Synchronous check if sharp was already successfully loaded.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSafeSharpSync(): any | null {
  return _cachedSharp;
}
