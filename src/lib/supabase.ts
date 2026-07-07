import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let resolved: SupabaseClient | null | undefined;

/**
 * Resolve the Supabase client. Prefers build-time NEXT_PUBLIC_* env (inlined
 * into the bundle); if those are absent — e.g. the host didn't pass build
 * args — falls back to fetching runtime config from /api/env. Returns null
 * when neither source has keys, and the app runs in local-only mode.
 */
export async function resolveSupabase(): Promise<SupabaseClient | null> {
  if (resolved !== undefined) return resolved;

  const buildUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const buildKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (buildUrl && buildKey) {
    resolved = createClient(buildUrl, buildKey);
    return resolved;
  }

  if (typeof window === "undefined") return null; // don't cache during SSR

  try {
    const res = await fetch("/api/env");
    const { url, anonKey } = (await res.json()) as { url: string | null; anonKey: string | null };
    resolved = url && anonKey ? createClient(url, anonKey) : null;
  } catch {
    resolved = null;
  }
  return resolved;
}
