import path from "path";
import type { NextConfig } from "next";

// Content-Security-Policy. Deliberately permissive on img-src/connect-src:
// the app renders images from many marketplace/Yupoo/Weidian CDNs (over the
// image proxy and directly) and talks to Supabase + open.er-api.com from the
// client, so those are allowed over https. script/style keep 'unsafe-inline'
// because Next's App Router injects inline hydration scripts and there's no
// nonce middleware here; React's default escaping is the primary XSS defense.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (node .next/standalone/server.js).
  output: "standalone",
  // Pin the tracing root to this project — a stray lockfile in a parent directory
  // otherwise makes Next nest the standalone output under the wrong root.
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
