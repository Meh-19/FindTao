import path from "path";
import type { NextConfig } from "next";

// Content-Security-Policy. Deliberately permissive on img-src/connect-src:
// the app renders images from many marketplace/Yupoo/Weidian CDNs (over the
// image proxy and directly) and talks to Supabase + open.er-api.com from the
// client, so those are allowed over https. script/style keep 'unsafe-inline'
// because Next's App Router injects inline hydration scripts and there's no
// nonce middleware here; React's default escaping is the primary XSS defense.
//
// Clerk (auth) loads its client SDK, a web worker, and sign-in frames from its
// own domains, so those are allowlisted in script-src/worker-src/frame-src.
// connect-src/img-src already allow all https, covering Clerk's Frontend API and
// avatar CDN. For a production Clerk instance on a custom domain, add that
// domain to script-src and frame-src.
const clerk = "https://*.clerk.accounts.dev https://*.clerk.com";
// Clerk's bot protection embeds Cloudflare Turnstile, which loads BOTH a script
// and an iframe from this host — so it must be in script-src and frame-src.
const turnstile = "https://challenges.cloudflare.com";
// Next.js Fast Refresh (dev-only) evaluates code via eval(), which needs
// 'unsafe-eval'. Production builds don't use it, so we keep prod strict and only
// relax this for `next dev` — otherwise dev HMR is CSP-blocked and pages can't hydrate.
const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} ${clerk} ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  `frame-src 'self' ${clerk} ${turnstile}`,
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
