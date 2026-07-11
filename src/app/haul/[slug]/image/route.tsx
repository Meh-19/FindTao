import { ImageResponse } from "next/og";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeSharedItems, formatShared } from "@/lib/shareHaul";
import { formatMoney } from "@/lib/currency";
import { inlineYupooImage, poolMap } from "@/lib/imageInline";

export const runtime = "nodejs";
// A share is a snapshot that changes (re-share, store filter, price edits), and
// ImageResponse otherwise sends a 1-year immutable cache — so force fresh renders.
export const dynamic = "force-dynamic";

// Full "copy image" of a share — every item in a grid, dynamic height. Distinct
// from opengraph-image (the fixed 1200×630 link-unfurl). Capped so a giant haul
// doesn't produce an unbounded image.
const MAX_TILES = 48;
const WIDTH = 1200;
const PAD = 48;
const GAP = 16;
const COLS = 6;
const TILE = Math.floor((WIDTH - PAD * 2 - GAP * (COLS - 1)) / COLS); // ~175
const TEXT_H = 82;
const HEADER_H = 150;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = serverSupabase();
  const row = sb ? (await sb.from("shared_hauls").select("*").eq("slug", slug).maybeSingle()).data : null;

  const owner = (row?.owner_name as string) ?? "someone";
  const kind = row?.kind === "cart" ? "CART" : "HAUL";
  const currency = (row?.currency as string) ?? "USD";
  const rate = Number(row?.rate) || 0;
  const totalCny = Number(row?.total_cny) || 0;
  const unitCount = (row?.unit_count as number) ?? 0;
  const allItems = sanitizeSharedItems(row?.data);
  const items = allItems.slice(0, MAX_TILES);
  const more = allItems.length - items.length;
  const stores = [...new Set(allItems.map((i) => i.storeName).filter(Boolean))];

  const tiles = await poolMap(items, 8, (i) =>
    i.image && i.imgHost ? inlineYupooImage(i.image, i.imgHost) : Promise.resolve(null),
  );

  const rows = Math.ceil((items.length + (more > 0 ? 1 : 0)) / COLS) || 1;
  const height = HEADER_H + rows * (TILE + TEXT_H + GAP) + PAD;
  const accent = "#8b5cf6";
  const green = "#22c55e";

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height,
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#f5f5f5",
          padding: PAD,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, letterSpacing: 2, color: "#9a9a9a" }}>
              FINDTAO {kind} SHARE
            </span>
            <span style={{ fontSize: 40, fontWeight: 800, marginTop: 4 }}>
              {unitCount} items from {stores.slice(0, 4).join(", ") || owner}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: accent }}>{formatMoney(totalCny, "CNY")}</span>
            <span style={{ fontSize: 22, color: "#b5b5b5" }}>~{formatShared(totalCny, currency, rate)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: GAP, marginTop: 24 }}>
          {items.map((i, idx) => {
            const lineCny = (i.priceCny ?? 0) * i.qty;
            return (
              <div key={idx} style={{ width: TILE, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    width: TILE,
                    height: TILE,
                    display: "flex",
                    borderRadius: 4,
                    overflow: "hidden",
                    background: "#161616",
                  }}
                >
                  {tiles[idx] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tiles[idx]!} width={TILE} height={TILE} style={{ objectFit: "cover" }} />
                  ) : (
                    <div
                      style={{ width: TILE, height: TILE, display: "flex", background: "linear-gradient(135deg, #8b5cf6, #22d3ee)", opacity: 0.5 }}
                    />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", paddingTop: 6 }}>
                  <span
                    style={{ fontSize: 15, color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: TILE }}
                  >
                    {i.title}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: green }}>
                    {i.priceCny !== null ? formatMoney(lineCny, "CNY") : "—"}
                    {i.qty > 1 ? `  ×${i.qty}` : ""}
                  </span>
                  {i.priceCny !== null && (
                    <span style={{ fontSize: 13, color: "#8a8a8a" }}>{formatShared(lineCny, currency, rate)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {more > 0 && (
            <div
              style={{
                width: TILE,
                height: TILE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                border: "1px solid #333",
                fontSize: 26,
                fontWeight: 700,
                color: "#cfcfcf",
              }}
            >
              +{more}
            </div>
          )}
        </div>
      </div>
    ),
    { width: WIDTH, height, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
