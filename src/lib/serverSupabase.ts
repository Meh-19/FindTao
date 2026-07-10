import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anon Supabase client for server-side public reads (the shared-haul page and
 * its OG image). No user token → anon role → RLS only exposes public rows, which
 * is exactly what a share link needs. Returns null when Supabase isn't configured.
 */
export function serverSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
