import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Grant dev/admin access to whoever signs in with the email set in the Railway
 * `DEV_EMAIL` env var. The check runs here (server-side) because that's the only
 * place the env var is readable — it's never shipped to the client. On a match
 * we add the 'owner' role tag to the caller's own profile row, which is what the
 * dev panel UI and the database's is_admin() RLS gate both key on.
 *
 * The write uses the caller's own Clerk session token (the "update own profile"
 * RLS policy permits a user to write their own row), so no service-role key is
 * needed — only DEV_EMAIL. Non-matching users get {granted:false} and nothing
 * changes.
 */
export async function POST() {
  const devEmail = process.env.DEV_EMAIL?.trim().toLowerCase();
  if (!devEmail) return Response.json({ granted: false });

  const { userId, getToken } = await auth();
  if (!userId) return Response.json({ granted: false }, { status: 401 });

  const user = await currentUser();
  // Only a verified email that exactly matches DEV_EMAIL counts.
  const match = user?.emailAddresses?.find(
    (e) =>
      e.emailAddress.trim().toLowerCase() === devEmail &&
      (e.verification?.status ?? "verified") === "verified",
  );
  if (!match) return Response.json({ granted: false });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = await getToken();
  if (!url || !anonKey || !token) {
    return Response.json({ granted: false, error: "cloud not configured" }, { status: 500 });
  }

  // Authorized as the caller (Clerk token) — writes land on their own profile
  // row and satisfy RLS.
  const sb = createClient(url, anonKey, { accessToken: async () => token });

  // Make sure the row exists (email/username are set by the client sign-in
  // effect), then add 'owner' if it isn't already an admin.
  await sb.from("profiles").upsert({ user_id: userId }, { onConflict: "user_id" });
  const { data } = await sb.from("profiles").select("tags").eq("user_id", userId).maybeSingle();
  const tags = (data?.tags as string[] | undefined) ?? [];
  if (tags.includes("owner") || tags.includes("admin")) {
    return Response.json({ granted: true });
  }
  const { error } = await sb
    .from("profiles")
    .update({ tags: [...tags, "owner"] })
    .eq("user_id", userId);
  if (error) return Response.json({ granted: false, error: error.message }, { status: 500 });
  return Response.json({ granted: true });
}
