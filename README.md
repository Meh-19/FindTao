# FindTao

Discovery layer for Taobao / Weidian / 1688 finds, built for EU/US shoppers. No checkout —
browse, plan hauls, check QC data, and hand off to your shopping agent (Kakobuy, Superbuy,
Sugargoo, GTBuy, CNFans, AllChinaBuy) with converted links.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # link-engine test suite
npm run build    # production build
```

## What's here

| Area | Where | Status |
|---|---|---|
| Link engine (parse any marketplace/agent link → convert to any agent) | `src/lib/links.ts` | Working, tested |
| Agent registry (data-driven, add agents without code changes) | `src/lib/agents.ts` | Working — formats need live verification |
| Converter tool page | `/convert` | Working |
| Home (hero, quick actions, featured finds) | `/` | Working |
| Cross-store search with filters (marketplace, QC, trust, price, wishlist) | `/browse` | Working on mock catalog |
| Store library with favorites + add-by-URL | `/library` | Working |
| Community store directory with category search | `/discover` | Working |
| Store view with album browser (modal photo viewer) | `/store/[id]` | Working, album photos are placeholders |
| Item page with buy-on-agent split button + QC/trust/fit panels | `/item/[id]` | Working, QC photos are placeholders |
| Multi-haul planner (budgets, weight, bulk link export, deep links) | `/hauls` | Working |
| Cart panel (dual-currency subtotal, assign to haul, share link) | everywhere | Working |
| Package tracking with carrier detection → 17TRACK | `/tracking` | Working |
| Shipping estimator (rate card by weight/region, prefill from haul) | `/shipping` | Working, placeholder rates |
| Settings (accent, agent, currency, card size, active haul) | `/settings` | Working |
| Auth + cloud sync (Supabase magic link, debounced push, Sync now) | `src/lib/store.tsx` | Working — needs env keys |
| Live CNY exchange rates (12h cache, fallback table) | `src/lib/currency.ts` | Working |

## Verifying agents (do this before launch)

Agent URL formats in `src/lib/agents.ts` are best-effort and drift over time. For each agent:

1. Open a real product on the agent's site and copy its URL.
2. Compare against the registry template; fix the template if it differs.
3. `npm test` — the round-trip test catches templates the parser can't read back.
4. When you get affiliate codes, set the `ref` field per agent.

## Auth (Clerk) & cloud sync (Supabase)

Authentication is handled by **Clerk**; **Supabase** is the database for cross-device sync
(hauls, library, cart, settings, measurements) and the shared store directory/catalog/reviews.
Sign-in is optional — without it the app runs in local-only mode (everything in localStorage,
header shows "Local mode").

**Clerk** authorizes Supabase via the native third-party-auth integration: Clerk issues a
session token, the Supabase client passes it, and RLS trusts the Clerk user id (`auth.jwt()->>'sub'`).

1. **Clerk:** this project is linked to a Clerk app via the Clerk CLI (`clerk init`), which wrote
   development `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` into `.env.local`. To set up
   a fresh clone or your own app, run `npm i -g clerk && clerk auth login && clerk init`. For
   production, add the production instance keys from [dashboard.clerk.com](https://dashboard.clerk.com)
   and add your production Clerk domain to the CSP `script-src`/`frame-src` in `next.config.ts`.
2. **Supabase:** create a free project at [supabase.com](https://supabase.com/dashboard) and copy
   **Project Settings → API** into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. **Connect them:** in the Supabase dashboard go to **Authentication → Sign In / Providers → add
   Clerk**, and paste your Clerk domain (from the Clerk dashboard's Supabase integration page).
4. **Schema:** open Supabase **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql)
   (Clerk-keyed tables + row-level security).
5. Restart the dev server. Sign in from **Settings** (or the nav); sync is automatic (debounced)
   with a manual **Sync now** button. To grant yourself admin, sign in once, then re-run
   `schema.sql` — its owner-bootstrap tags your profile by email.

## Deploy on Railway

The repo ships with [`railway.json`](railway.json) — Railway auto-detects Next.js and uses
`npm run start` (Next respects Railway's `PORT`).

```bash
npm i -g @railway/cli
railway login
railway init                 # create the project (run from the repo root)
railway variables --set "NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co" \
                  --set "NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>"
railway up                   # build + deploy
railway domain               # generate a public URL
```

`NEXT_PUBLIC_*` vars are inlined at **build time** — set them before `railway up`, and
redeploy after changing them. Alternatively, connect the GitHub repo in the Railway dashboard
for deploys on every push.

## Not built yet (by design)

- **Real catalog data** — the catalog is mock data in `src/data/catalog.ts`. The real pipeline
  (agent API / affiliate feed → DB → Meilisearch) replaces it; the `CatalogItem` shape is the contract.
- **Image proxy** — marketplace CDN images are slow/broken outside China; proxy + cache them
  (Cloudflare Images or imgproxy) instead of hotlinking. Thumbnails are colored placeholders until then.
- **QC photo uploads, reverse image search, sizing suggestions** — per the strategy doc.
