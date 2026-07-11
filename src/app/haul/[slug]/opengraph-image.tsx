import { ImageResponse } from "next/og";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeSharedItems, formatShared } from "@/lib/shareHaul";
import { formatMoney } from "@/lib/currency";
import { inlineYupooImage, poolMap } from "@/lib/imageInline";

export const runtime = "nodejs";
// Shares change (re-share, store filter), so avoid the default 1-year immutable cache.
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A shared FindTao haul";

// Fixed 1200×630 link-unfurl (Discord/Twitter card). The full "copy image" with
// every item lives at ./image; this stays a tidy summary.
const MAX_TILES = 12;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
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
  const stores = [...new Set(allItems.map((i) => i.storeName).filter(Boolean))];

  const withImg = allItems.filter((i) => i.image && i.imgHost);
  const shown = withImg.slice(0, MAX_TILES);
  const tiles = await poolMap(shown, 8, (i) => inlineYupooImage(i.image!, i.imgHost!));
  const more = allItems.length - shown.length;
  const accent = "#8b5cf6";

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", color: "#f5f5f5", padding: 56 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: 2, color: "#9a9a9a" }}>FINDTAO {kind} SHARE</span>
            <span style={{ fontSize: 50, fontWeight: 800, marginTop: 6 }}>
              {unitCount} items{stores.length ? ` from ${stores.slice(0, 3).join(", ")}` : ""}
            </span>
            <span style={{ fontSize: 24, color: "#b5b5b5", marginTop: 4 }}>by {owner}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: accent }}>{formatMoney(totalCny, "CNY")}</span>
            <span style={{ fontSize: 24, color: "#b5b5b5" }}>~{formatShared(totalCny, currency, rate)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28, flex: 1, alignContent: "flex-start" }}>
          {tiles.map((src, i) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} width={150} height={150} style={{ objectFit: "cover", borderRadius: 4, border: "1px solid #222" }} />
            ) : (
              <div key={i} style={{ width: 150, height: 150, borderRadius: 4, display: "flex", background: "linear-gradient(135deg, #8b5cf6, #22d3ee)", opacity: 0.5 }} />
            ),
          )}
          {more > 0 && (
            <div style={{ width: 150, height: 150, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", fontSize: 30, fontWeight: 700, color: "#cfcfcf" }}>
              +{more}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  );
}
