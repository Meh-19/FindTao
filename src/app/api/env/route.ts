export const dynamic = "force-dynamic";

/**
 * Runtime public config. The anon key is public by design (it ships in the
 * client bundle when build-time env is present); this route exists so
 * deployments whose build args didn't materialize (e.g. Railway) still get
 * Supabase config from the running container's environment.
 */
export function GET() {
  return Response.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
  });
}
