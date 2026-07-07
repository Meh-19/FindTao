import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null when the Supabase env vars aren't configured — the app then runs in
 * local-only mode (everything in localStorage, sign-in disabled).
 * Copy .env.example to .env.local and fill in your project's values to enable it.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
