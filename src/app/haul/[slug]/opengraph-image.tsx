import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { serverSupabase } from "@/lib/serverSupabase";
import { sanitizeSharedItems } from "@/lib/shareHaul";
import { proxiedImg } from "@/lib/yupoo";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A shared FindTao haul";

// Cap the number of item photos we fetch so image generation stays fast; extras
// are summarised as "+N more".
const MAX_TILES = 12;

/** Fetch an image through the proxy and inline it as a data URL (Satori can't do
 * the Referer-spoofed fetch itself, and inlining avoids one failed image breaking
 * the whole render). Returns null on any failure. */
async function inline(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${b64}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = serverSupabase();
  const row = sb ? (await sb.from("shared_hauls").select("*").eq("slug", slug).maybeSingle()).data : null;

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;

  const name = (row?.name as string) ?? "Haul";
  const owner = (row?.owner_name as string) ?? "someone";
  const items = sanitizeSharedItems(row?.data);
  const totalCny = Math.round(Number(row?.total_cny) || 0);
  const unitCount = (row?.unit_count as number) ?? 0;
  const weightKg = (((row?.weight_g as number) ?? 0) / 1000).toFixed(1);

  const withImg = items.filter((i) => i.image && i.imgHost);
  const shown = withImg.slice(0, MAX_TILES);
  const tiles = await Promise.all(shown.map((i) => inline(`${origin}${proxiedImg(i.image!, i.imgHost!)}`)));
  const more = withImg.length - shown.length;

  const bg = "#0a0a0a";
  const accent = "#8b5cf6";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: bg,
          color: "#f5f5f5",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 30, fontWeight: 800 }}>Find</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: accent }}>Tao</span>
          </div>
          <span style={{ fontSize: 22, color: "#9a9a9a" }}>shared haul</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
          <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{name}</span>
          <span style={{ fontSize: 26, color: "#b5b5b5", marginTop: 6 }}>by {owner}</span>
        </div>

        <div style={{ display: "flex", gap: 34, marginTop: 18 }}>
          <span style={{ fontSize: 26, color: "#e5e5e5" }}>
            {unitCount} item{unitCount === 1 ? "" : "s"}
          </span>
          <span style={{ fontSize: 26, color: accent, fontWeight: 700 }}>¥{totalCny.toLocaleString()}</span>
          <span style={{ fontSize: 26, color: "#e5e5e5" }}>~{weightKg}kg</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26, flex: 1, alignContent: "flex-start" }}>
          {tiles.map((src, i) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                width={150}
                height={150}
                style={{ objectFit: "cover", borderRadius: 4, border: "1px solid #222" }}
              />
            ) : (
              <div
                key={i}
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 4,
                  display: "flex",
                  background: "linear-gradient(135deg, #8b5cf6, #22d3ee)",
                  opacity: 0.5,
                }}
              />
            ),
          )}
          {more > 0 && (
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #333",
                fontSize: 30,
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
    { ...size },
  );
}
