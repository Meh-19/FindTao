# FindTao — Unified Design System

**Codename:** _Streetwear Index v2_
**Status:** Specification for adoption (dark-mode primary)
**Scope:** Color, spacing, typography, radius/borders, elevation, motion, and component tokens for the entire app (`src/app/**`, `src/components/**`).

---

## 0. Design Philosophy

FindTao is a **discovery + logistics tool for cross-border streetwear shopping** — a power-user utility that lives next to Yupoo grids, agent links, and price data. The existing UI already has a strong point of view: **brutalist monochrome, sharp corners, hard block-offset shadows, uppercase micro-labels**. That identity is an asset — it reads as an _index / terminal_, not a generic SaaS dashboard.

This system **keeps that DNA and sharpens it** rather than starting over. Three deliberate upgrades:

1. **A real color palette** — the current system is pure gray with a single flat accent (defaulting to white). We keep the ink/mist monochrome foundation but introduce **one signature accent** (electric magenta) as the default brand color, plus a **disciplined semantic layer** (success / warning / danger / info) so status colors stop being ad-hoc `emerald-400 / amber-400 / rose-400` literals scattered in JSX.
2. **A typography pairing** — the app currently renders in the browser default sans. We introduce a three-voice system: a **grotesque display** face for headlines (the "index" voice), **Inter** for UI/body, and a **monospace** for the huge amount of numeric data (prices, IDs, tracking numbers, measurements, exchange rates) so figures line up and read as data.
3. **Formalized tokens** — spacing, radius, elevation, and motion become named tokens so pages stay consistent as the app grows.

> **Non-goals:** This is dark-mode primary. A light theme is explicitly out of scope for v2 (the product is used in low-light "late-night haul" contexts and the brand is built on ink). The user-settable accent architecture (`--acc1` / `--acc-ink`) is **preserved** — we only change its default and curate the options.

---

## 1. Color

### 1.1 Foundation — Ink (surfaces) & Mist (text)

The monochrome base is retained and mapped to **semantic elevation** rather than raw grays. Avoid pure `#000000` (OLED black smear on scroll) — the darkest surface is `#050505`.

| Token | Hex | Role | Tailwind |
|---|---|---|---|
| `--color-ink-950` | `#050505` | App background (`body`) | `bg-ink-950` |
| `--color-ink-900` | `#0a0a0a` | Sunken / footer wells | `bg-ink-900` |
| `--color-ink-800` | `#121212` | **Card / panel surface** (default) | `bg-ink-800` |
| `--color-ink-700` | `#1a1a1a` | Raised surface / hover fill | `bg-ink-700` |
| `--color-ink-600` | `#262626` | Input fill / scrollbar thumb | `bg-ink-600` |
| `--color-ink-500` | `#3a3a3a` | Strong divider / dashed borders | `border-ink-500` |

| Token | Hex | Role | Contrast on `ink-950` |
|---|---|---|---|
| `--color-mist-100` | `#f5f5f5` | Primary text (headings, body) | ~18.8:1 ✅ AAA |
| `--color-mist-300` | `#c7c7c7` | Secondary text / values | ~11.6:1 ✅ AAA |
| `--color-mist-400` | `#9a9a9a` | Tertiary text / captions | ~7.5:1 ✅ AAA |
| `--color-mist-500` | `#808080` | **Muted labels** (was `#737373`) | ~5.3:1 ✅ AA |

> **Fix baked in:** the old `mist-500` (`#737373`) sits at ~4.4:1 — it **fails AA** for the small blurb/footer text it's currently used for (`page.tsx`, `layout.tsx`, `ItemCard.tsx`). v2 nudges it to `#808080` (~5.3:1). Reserve anything dimmer than `mist-500` for **non-essential decoration only**, never for readable copy.

**Borders** stay as translucent white hairlines (already the codebase convention — keep it): `border-white/5` (default card edge), `border-white/10` (hover / inputs), `border-white/15` (badges over photos). These read correctly over both flat placeholder tiles and real photos.

### 1.2 Signature Accent (the one new brand color)

The current default accent is plain white. v2 makes the **default** an electric magenta — punchy, streetwear, and distinct from every competitor's blue. The **user-settable accent system stays** (`--acc1` = fill, `--acc-ink` = readable text on the fill); we only change the default and curate the swatch set.

| Token | Hex | Role |
|---|---|---|
| `--acc1` (default) | `#EC4899` | Accent fill — primary CTA, active nav, focus ring, key stats |
| `--acc-ink` | `#0a0a0a` | Text/icon color **on** an accent fill (near-black, ~6:1 on magenta) |
| `--color-accent-soft` | `color-mix(in srgb, var(--acc1) 12%, transparent)` | Tinted badge/chip background |
| `--color-accent-line` | `color-mix(in srgb, var(--acc1) 30%, transparent)` | Tinted badge/chip border |

**Magenta as text on `ink-950`** measures ~5.9:1 — safe for `flow-text` headings and links (AA). When an accent is used as a large fill, always place `--acc-ink` on top, never `mist` text.

**Curated Settings → Theme swatches** (each ships with a matching `--acc-ink`):

| Name | `--acc1` | `--acc-ink` |
|---|---|---|
| Magenta _(default)_ | `#EC4899` | `#0a0a0a` |
| Volt | `#D4FF4F` | `#0a0a0a` |
| Cyber | `#22D3EE` | `#0a0a0a` |
| Blaze | `#FB923C` | `#0a0a0a` |
| Ultra | `#A78BFA` | `#0a0a0a` |
| Mono _(legacy)_ | `#FFFFFF` | `#000000` |

> Because every consumer already reads `var(--acc1)` / `var(--acc-ink)` (`.btn-glow`, `.flow-bg`, `.flow-text`, `.card-pop`), switching the default is a **one-line change** in `:root` — no component edits required.

### 1.3 Semantic Status Colors

Replace the scattered `emerald-/amber-/rose-/neon-` literals with four named roles. Each is defined at three intensities: a `-text` (readable on ink), a `-soft` fill, and a `-line` border — matching the existing "tinted chip" pattern in `ItemCard.tsx`.

| Role | Text (on ink) | Soft fill | Border | Used for |
|---|---|---|---|---|
| **Success** | `#34D399` | `rgb(52 211 153 / 0.10)` | `rgb(52 211 153 / 0.25)` | In-cart / in-haul state, "Trusted seller", cheapest shipping |
| **Warning** | `#FBBF24` | `rgb(251 191 36 / 0.10)` | `rgb(251 191 36 / 0.25)` | "Low data" badge, price estimate `¥ (est.)`, budget nearing |
| **Danger** | `#F87171` | `rgb(248 113 113 / 0.10)` | `rgb(248 113 113 / 0.25)` | Over-budget, destructive actions, sync error, wishlist heart |
| **Info** | `#60A5FA` | `rgb(96 165 250 / 0.10)` | `rgb(96 165 250 / 0.25)` | Neutral hints, "Local mode", live-rate indicator |

All four `-text` values clear **4.5:1** on `ink-950`. **Never rely on color alone** — every status already pairs with an icon or text label; keep that (e.g. the budget bar shows "over by ¥X", not just red).

---

## 2. Spacing

A strict **4px base scale**. All padding, gaps, and margins use these tokens — no arbitrary values. Density resolves to the **Standard (6/10)** tier from the design engine.

| Token | px | rem | Typical use |
|---|---|---|---|
| `--space-1` | 4 | 0.25 | Icon–label gap, chip inset |
| `--space-2` | 8 | 0.5 | Tight stacks, badge padding-y |
| `--space-3` | 12 | 0.75 | Chip gaps, compact card padding |
| `--space-4` | 16 | 1 | **Card padding (default)**, grid gap |
| `--space-5` | 20 | 1.25 | Roomy card padding |
| `--space-6` | 24 | 1.5 | Section inner padding |
| `--space-8` | 32 | 2 | Between related blocks |
| `--space-12` | 48 | 3 | **Between page sections** (`mb-12` today) |
| `--space-16` | 64 | 4 | Hero top/bottom rhythm |
| `--space-20` | 80 | 5 | Major page-level breaks |

**Layout rules (keep current, now named):**
- Content column: `max-w-6xl` (1152px), horizontal padding `--space-4` mobile → `--space-8` desktop.
- Grid gutter: `--space-4` on card grids.
- Section rhythm: `--space-12` between top-level sections; `--space-4` between a section header and its grid.
- Fixed chrome (topbar, bottom nav) must reserve safe padding — bottom content inset `pb-14` mobile / `pb-8` desktop is retained.

---

## 3. Typography

### 3.1 The three voices

| Voice | Font | Why | Weights |
|---|---|---|---|
| **Display** | **Space Grotesk** | Geometric grotesque with quirky detailing — reads as "technical index / streetwear label". Carries the brutalist headline energy the system-default sans can't. | 500, 600, 700 |
| **UI / Body** | **Inter** | The workhorse. Neutral, superb at small sizes, huge weight range for hierarchy. | 400, 500, 600 |
| **Data / Mono** | **JetBrains Mono** | Prices, item IDs, tracking numbers, measurements, exchange rates, agent URLs. **Tabular figures** so columns and running totals don't jitter. | 400, 500 |

> **Editorial alternative:** if the brand wants to lean _fashion-luxury_ over _streetwear-technical_, swap the display face for **Playfair Display** (the engine's editorial pick) and keep Inter + JetBrains Mono. Pick one display face and commit — don't ship both.

Load via `next/font/google` (self-hosted, zero layout shift, `display: swap` handled automatically) and expose as CSS variables — see §8.

### 3.2 Type scale

| Token | Size | Line-height | Tracking | Voice | Role |
|---|---|---|---|---|---|
| `text-display` | 48–60px (`3rem`→`3.75rem`) | 1.05 | -0.02em | Space Grotesk 700 | Hero H1 |
| `text-h1` | 30px (`1.875rem`) | 1.15 | -0.02em | Space Grotesk 700 | Page title |
| `text-h2` | 20px (`1.25rem`) | 1.25 | -0.01em | Space Grotesk 600 | Section header |
| `text-h3` | 16px (`1rem`) | 1.35 | -0.005em | Inter 600 | Card title |
| `text-body` | 16px (`1rem`) | 1.6 | 0 | Inter 400 | Default body |
| `text-body-sm` | 14px (`0.875rem`) | 1.55 | 0 | Inter 400 | Card copy, dense UI |
| `text-caption` | 12px (`0.75rem`) | 1.5 | 0 | Inter 400 | Captions, helper text |
| `text-label` | 11px (`0.6875rem`) | 1.4 | **0.15em** | Inter 700 **UPPERCASE** | The signature micro-label |
| `text-data` | 13–14px | 1.4 | 0 | JetBrains Mono 500 | Prices, IDs, totals |

**Rules**
- **Uppercase tracked labels** (`text-label`) are a brand signature — keep them for eyebrows, stat captions, marketplace tags, and section kickers. `letter-spacing: 0.15em` is mandatory at this size for legibility.
- **Minimum body size is 16px** on mobile (prevents iOS auto-zoom). The current `text-sm` (14px) body copy on Home/blurbs should move to `text-body-sm` only in genuinely dense contexts, not primary reading.
- **All numeric data uses `text-data`** (JetBrains Mono, `font-variant-numeric: tabular-nums`). This is the biggest single upgrade for a data-heavy app: prices in cards, cart subtotals, budget bars, exchange rates, measurement grids, and tracking numbers stop shifting width as digits change.
- **Line length** 60–75 chars on desktop; the `max-w-xl`/`max-w-2xl` hero copy already respects this.
- **Weight hierarchy:** 700 display headings, 600 titles/labels, 500 emphasis/data, 400 body. Don't use weight <400 for any text on a dark surface — thin strokes disappear.

---

## 4. Radius, Borders & Icons

**Radius stays sharp — this is core identity.** Do not soften cards into rounded SaaS panels.

| Token | Value | Use |
|---|---|---|
| `--radius-none` | `0` | **Everything** — cards, buttons, inputs, badges, modals |
| `--radius-xs` | `2px` | Optional, only for text inputs if hairline corners feel too severe |
| `--radius-full` | `9999px` | **Sole exception:** avatars, the heart/status dots |

**Borders:** 1px, translucent white hairlines (§1.1). Dashed `border-ink-500` for empty states (already used on Home's empty community strip).

**Icons:** **Lucide** only (already in use), `1.5px` stroke, sized on a token scale — `icon-sm 14px`, `icon-md 16–17px`, `icon-lg 20px`. Never emoji as structural icons. Keep filled-vs-outline discipline (e.g. wishlist heart fills only when active).

---

## 5. Elevation (Hard Block-Offset Shadows)

The brutalist "hard shadow" is the depth language — **no blurry `shadow-lg`**. Offsets are solid, single-color, and shift on press. Retain and formalize the existing utilities:

| Token | Value | Use |
|---|---|---|
| `--shadow-hard-sm` | `2px 2px 0 0 rgb(0 0 0 / 0.9)` | Badges, small chips, icon tiles |
| `--shadow-hard` | `4px 4px 0 0 rgb(0 0 0 / 0.9)` | Cards on hover, popovers |
| `--shadow-hard-lg` | `6px 6px 0 0 rgb(0 0 0 / 0.9)` | Modals, cart drawer |
| `--shadow-accent` | `4px 4px 0 0 color-mix(in srgb, var(--acc1) 35%, transparent)` | Primary CTA (`.btn-glow`) |
| `--shadow-accent-card` | `4px 4px 0 0 color-mix(in srgb, var(--acc1) 18%, transparent)` | `.card-pop` hover |

**Interaction physics (keep `.btn-glow` / `.card-pop` behavior):** on hover the element lifts `translate(-1px,-1px)` and the shadow grows; on active it slams flush `translate(3px,3px)` with a shrunk shadow. This tactile "press into the page" is the product's motion signature.

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances (`fade-up`), reveals |
| `--ease-standard` | `ease` | Hover/press state changes |
| `--dur-fast` | `120ms` | Press/active feedback |
| `--dur-base` | `200ms` | Hover, color/opacity transitions |
| `--dur-slow` | `400ms` | `fade-up` entrance, modal in |

**Rules**
- Micro-interactions **150–300ms**; entrances ≤400ms. Nothing over 500ms.
- Animate **transform / opacity only** (never width/height/top/left) — the codebase already follows this.
- Stagger grid entrances **~60ms/item**, capped (the `Math.min(index * 60, 480)` pattern in `ItemCard` is correct — reuse it).
- **`fade-up` must use `backwards` fill**, never `both` — a retained transform makes the element a containing block and breaks `position: fixed` modals (this bug is already documented in `globals.css`; preserve the comment).
- Respect `prefers-reduced-motion` — disable `fade-up`, `pulse-soft`, and the tile texture (already wired; keep it and extend to any new animation).

---

## 7. Component Tokens (mapping to existing classes)

| Component | Spec |
|---|---|
| **Primary button** (`.btn-glow`) | `--acc1` fill, `--acc-ink` text, `--shadow-accent`, sharp corners. Press → flush. One primary CTA per view. |
| **Secondary button** | `bg-ink-700`, `border-white/10`, `mist-100` text, `--shadow-hard-sm`. |
| **Card** (`.card-pop`) | `bg-ink-800`, `border-white/5`, `--space-4` padding, sharp. Hover → lift + accent-tinted border + `--shadow-accent-card`. Active/selected state → `border` uses **Success** line. |
| **Badge / chip** | `--space-2` × `--space-1` padding, `text-label` or `text-caption`, semantic `-soft` fill + `-line` border. Over photos, use solid `bg-ink-950/90` + `border-white/15` for legibility (existing `ItemCard` fix — keep). |
| **Input** | `bg-ink-900`, `border-white/10`, `mist-100` text, `mist-500` placeholder, focus → `2px` ring in `--acc1`. Visible `<label>`, never placeholder-only. Numeric inputs use `text-data`. |
| **Nav (active item)** | Active route marked with `--acc1` (text + left indicator), not color alone — pair with weight bump to 600. |
| **Modal / drawer / lightbox** | `bg-ink-900`, `--shadow-hard-lg`, scrim `rgb(0 0 0 / 0.6)` (strong enough to isolate foreground). Escape + visible close affordance; confirm before dismissing unsaved changes. |
| **Toast** | `bg-ink-800`, `border-white/10`, semantic accent stripe by type, `toast-in` animation, auto-dismiss 3–5s, `aria-live="polite"`, must not steal focus. |
| **Data / price display** | `text-data` (JetBrains Mono, tabular). CNY always paired with converted currency. Estimates flagged `¥ (est.)` in **Warning** text. |

---

## 8. Implementation

### 8.1 Tailwind v4 `@theme` (drop-in extension of `globals.css`)

```css
@import "tailwindcss";

@theme {
  /* ── Ink (surfaces) ── */
  --color-ink-950: #050505;
  --color-ink-900: #0a0a0a;
  --color-ink-800: #121212;
  --color-ink-700: #1a1a1a;
  --color-ink-600: #262626;
  --color-ink-500: #3a3a3a;

  /* ── Mist (text) ── */
  --color-mist-100: #f5f5f5;
  --color-mist-300: #c7c7c7;
  --color-mist-400: #9a9a9a;
  --color-mist-500: #808080; /* was #737373 — now AA-compliant */

  /* ── Semantic status ── */
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger:  #f87171;
  --color-info:    #60a5fa;

  /* ── Type ── */
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans:    "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, monospace;

  /* ── Radius ── */
  --radius-none: 0;
  --radius-xs: 2px;
}

/* Signature accent (user-settable via Settings → Theme) */
:root {
  --acc1: #ec4899;    /* default: Magenta */
  --acc-ink: #0a0a0a;
}

body {
  @apply bg-ink-950 text-mist-100 antialiased;
  font-family: var(--font-sans);
}

/* Tabular figures for all monospace data */
.text-data,
[data-numeric] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

> Keep the existing `.btn-glow`, `.card-pop`, `.flow-bg/.flow-text`, `.shadow-hard*`, `.fade-up`, `.tile-shimmer`, and reduced-motion blocks exactly as they are — they already read from `--acc1` and the shadow tokens above, so they inherit v2 for free.

### 8.2 Fonts via `next/font/google` (in `layout.tsx`)

```tsx
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-display" });
const sans    = Inter({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-sans" });
const mono    = JetBrains_Mono({ subsets: ["latin"], weight: ["400","500"], variable: "--font-mono" });

// <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
```

Then headings use `font-display`, data uses `font-mono` / `.text-data`, everything else inherits Inter.

---

## 9. Accessibility & Pre-Delivery Checklist

- [ ] **Contrast:** all body/label text ≥ 4.5:1 on its surface; large display ≥ 3:1. (`mist-500` fix in §1.1 closes the current gap.)
- [ ] **Accent contrast:** custom accents must keep `--acc-ink` at ≥ 4.5:1 on the fill — validate each swatch in §1.2.
- [ ] **Color never alone:** every status pairs with icon or text (budget "over by ¥X", `¥ (est.)`, trust badge label).
- [ ] **Focus rings visible** on every interactive element (2px `--acc1`) — never remove them.
- [ ] **Touch targets ≥ 44×44px**; expand hit area on small icon buttons (wishlist/cart heart) with padding or `hitSlop`.
- [ ] **Tabular numerals** on every price / total / measurement / tracking column.
- [ ] **`prefers-reduced-motion`** disables entrances and looping animations.
- [ ] **Responsive** at 375 / 768 / 1024 / 1440; no horizontal scroll; `min-h-dvh` over `100vh`.
- [ ] **Modals:** strong scrim, Escape + visible close, confirm on unsaved dismiss.
- [ ] **One primary CTA per view;** secondary actions visually subordinate.

---

## 10. Anti-Patterns (do not)

- ❌ Round the corners — sharp is the identity.
- ❌ Blurry `shadow-lg` / `shadow-2xl` — use hard offsets only.
- ❌ Pure `#000000` backgrounds (OLED smear) — floor is `#050505`.
- ❌ Emoji as structural icons — Lucide only.
- ❌ Raw hex or one-off `emerald-400`/`amber-400` in components — use the semantic tokens.
- ❌ Placeholder-only inputs — always a visible label.
- ❌ Gray-on-gray muted copy below `mist-500`.
- ❌ Two display faces at once — pick Space Grotesk _or_ Playfair, not both.
- ❌ Animating layout properties (width/height/top/left) — transform/opacity only.
```
