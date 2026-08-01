// Lightweight liveness probe for uptime monitors and Railway's healthcheck —
// no dependencies touched, so it stays green as long as the server is serving.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
}
