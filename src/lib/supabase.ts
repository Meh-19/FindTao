import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedConfig: SupabaseConfig | null | undefined;

/**
 * Resolve the Supabase URL + anon key. Prefers build-time NEXT_PUBLIC_* env
 * (inlined into the bundle); if those are absent — e.g. the host didn't pass
 * build args — falls back to fetching runtime config from /api/env. Returns
 * null when neither source has keys, and the app runs in local-only mode.
 */
export async function resolveSupabaseConfig(): Promise<SupabaseConfig | null> {
  if (cachedConfig !== undefined) return cachedConfig;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    cachedConfig = { url, anonKey };
    return cachedConfig;
  }

  if (typeof window === "undefined") return null; // don't cache during SSR

  try {
    const res = await fetch("/api/env");
    const { url: u, anonKey: k } = (await res.json()) as { url: string | null; anonKey: string | null };
    cachedConfig = u && k ? { url: u, anonKey: k } : null;
  } catch {
    cachedConfig = null;
  }
  return cachedConfig;
}

/**
 * Build a Supabase client authorized by Clerk. The `accessToken` callback is
 * invoked by supabase-js on every request, so it always reflects the current
 * Clerk session: signed in → the session token (carrying the `sub` user id and
 * the `role: authenticated` claim the native integration injects), signed out →
 * null, which Supabase treats as the anon role. That's why one client serves
 * both public reads (RLS `using (true)`) and per-user writes without rebuilding.
 */
export function createClerkSupabaseClient(
  config: SupabaseConfig,
  getToken: () => Promise<string | null>,
): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    accessToken: async () => (await getToken()) ?? null,
  });
}
