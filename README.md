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
| Browse with search + filters (marketplace, QC, trust, price) | `/` | Working on mock catalog |
| Item page with buy-on-agent split button + QC/trust/fit panels | `/item/[id]` | Working, QC photos are placeholders |
| Haul builder (pin items, totals, weight estimate, bulk link export) | `/haul` | Working |
| Settings (preferred agent, currency, one-click hand-off) | `/settings` | Working, localStorage |

## Verifying agents (do this before launch)

Agent URL formats in `src/lib/agents.ts` are best-effort and drift over time. For each agent:

1. Open a real product on the agent's site and copy its URL.
2. Compare against the registry template; fix the template if it differs.
3. `npm test` — the round-trip test catches templates the parser can't read back.
4. When you get affiliate codes, set the `ref` field per agent.

## Auth & cloud sync (Supabase)

Sign-in (email magic link) and cross-device sync of hauls, library, cart, and settings run on
Supabase. Without keys the app runs in local-only mode — everything stays in localStorage and
the header shows "Local mode".

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In the dashboard, open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql)
   (creates the `user_state` table with row-level security).
3. Copy `.env.example` to `.env.local` and fill in **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Restart the dev server. Sign in from **Settings**; sync is automatic (debounced on every
   change) with a manual **Sync now** button.

Under **Authentication → URL Configuration**, add your production URL (and
`http://localhost:3000`) to the redirect allow-list so magic links land back in the app.

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
