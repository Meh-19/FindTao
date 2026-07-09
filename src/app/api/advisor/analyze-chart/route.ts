import { isValidYupooHost } from "@/lib/yupoo";
import type { ChartRow, GarmentType } from "@/lib/sizeAdvisor";
import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Cheap, fast, vision-capable — one call per chart, kept deliberately small.
const MODEL = "claude-haiku-4-5-20251001";

const CHART_FIELDS = [
  "size", "chestCm", "shoulderWidthCm", "sleeveLengthCm", "bodyLengthCm", "neckCm",
  "waistCm", "hipsCm", "inseamCm", "thighCm", "riseCm",
  "footLengthCm", "shoeSizeUs", "shoeSizeEu", "shoeSizeUk",
] as const;

const PROMPT = `You are reading a clothing/footwear size chart from a product photo. Extract every size row into structured data.

Rules:
- Respond with ONLY a single JSON object. No markdown code fences, no commentary, nothing before or after the JSON.
- Convert every LENGTH measurement (chest, waist, hips, sleeve, etc. — not shoe sizes) to centimeters. If the chart is in inches, multiply by 2.54. If values look like millimeters (numbers in the 600-1400 range for a chest/waist figure, or 200-330 for a foot length), divide by 10. Typical adult chest/waist/hip measurements are roughly 60-140cm; a typical adult foot length is roughly 22-30cm — use those ranges as a sanity check on which unit you're looking at.
- IMPORTANT — flat vs. full circumference: many charts (especially from Chinese sellers) measure chest/waist/hips/neck/thigh with the garment laid FLAT and measured straight across, which is roughly HALF the actual circumference. Watch for: a label saying "flat", "平量" or similar; a diagram showing the garment folded/laid flat; or numbers that look implausibly small for an adult garment (e.g. a "chest" figure under ~70cm, a "waist" under ~55cm). When you see these signs, DOUBLE the raw number before reporting chestCm/waistCm/hipsCm/neckCm/thighCm, since the recommendation engine expects true circumference, not the flat/half figure. If you're not sure whether a chart is flat-measured, report the number as-is — a second automated check downstream also watches for this.
- For footwear charts: extract footLengthCm (the actual foot/insole length in cm — convert mm by dividing by 10, inches by multiplying by 2.54) whenever a length is shown. Also extract shoeSizeUs, shoeSizeEu, and/or shoeSizeUk exactly as printed (these are size-scale numbers, e.g. 9, 42, 8 — do NOT convert or scale them, just copy the number).
- Use exactly these field names for whichever columns the chart actually has — omit any field the chart doesn't show. Never invent or guess a number that isn't legible.
  size (string label exactly as shown, e.g. "M", "L", "42", "US 9"), chestCm, shoulderWidthCm, sleeveLengthCm, bodyLengthCm, neckCm, waistCm, hipsCm, inseamCm, thighCm, riseCm, footLengthCm, shoeSizeUs, shoeSizeEu, shoeSizeUk
- garmentType: "top" if it has chest/shoulder/sleeve columns, "outerwear" if it's clearly a jacket/coat chart, "bottom" if it has waist/hips/inseam columns, "footwear" if it has foot length or shoe size columns, otherwise "unknown".
- If the image is NOT a size chart at all (a product photo, model shot, logo, random detail shot), respond with exactly: {"error": "not_a_size_chart"}
- If part of the chart is illegible, just omit those specific fields for that row rather than guessing a value.

Respond with exactly this shape and nothing else:
{"garmentType": "top", "rows": [{"size": "M", "chestCm": 104, "shoulderWidthCm": 46}]}`;

interface ParsedChart {
  garmentType: GarmentType;
  rows: ChartRow[];
}

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function isGarmentType(v: unknown): v is GarmentType {
  return v === "top" || v === "bottom" || v === "outerwear" || v === "footwear" || v === "unknown";
}

/** Defensive validation — only keep fields we actually asked for, coerced to number, never trust the model blindly. */
function sanitizeChart(data: unknown): ParsedChart | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.rows)) return null;

  const rows: ChartRow[] = [];
  for (const raw of d.rows) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.size !== "string" || !r.size.trim()) continue;
    const row: ChartRow = { size: r.size.trim() };
    for (const field of CHART_FIELDS) {
      if (field === "size") continue;
      const v = r[field];
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 300) {
        (row as unknown as Record<string, number>)[field] = v;
      }
    }
    rows.push(row);
  }
  if (rows.length === 0) return null;

  return { garmentType: isGarmentType(d.garmentType) ? d.garmentType : "unknown", rows };
}

// Each request costs real money (one paid Anthropic vision call) and this
// route has no auth gate, so it's rate-limited per caller IP well below
// anything a real shopper would hit — 10 chart scans per 15 minutes is
// generous for someone actually shopping, but shuts down scripted abuse.
const LIMIT = 10;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  const rl = rateLimit(`advisor:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return rateLimitResponse(rl, "Too many size-chart scans from this connection — try again in a few minutes.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "not_configured", message: "AI Advisor isn't set up — add ANTHROPIC_API_KEY to run this." },
      { status: 501 },
    );
  }

  let body: { host?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid request body" }, { status: 400 });
  }

  const host = body.host ?? "";
  const imageUrl = body.imageUrl ?? "";
  if (!isValidYupooHost(host)) {
    return Response.json({ error: "bad_request", message: "Invalid store host" }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(imageUrl);
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid image URL" }, { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== "photo.yupoo.com") {
    return Response.json({ error: "bad_request", message: "Image must be a photo.yupoo.com URL" }, { status: 400 });
  }

  // Fetch the photo the same way the image proxy does — Yupoo hotlink-blocks
  // requests without a Referer from the owning store.
  let imageBytes: ArrayBuffer;
  let mediaType: string;
  try {
    const imgRes = await fetch(target, {
      headers: { "User-Agent": UA, Referer: `https://${host}.x.yupoo.com/` },
    });
    if (!imgRes.ok) {
      return Response.json({ error: "fetch_failed", message: "Couldn't load that photo" }, { status: 502 });
    }
    mediaType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png|gif|webp)$/.test(mediaType)) mediaType = "image/jpeg";
    imageBytes = await imgRes.arrayBuffer();
  } catch {
    return Response.json({ error: "fetch_failed", message: "Couldn't load that photo" }, { status: 502 });
  }

  // 5MB cap — Anthropic rejects oversized images outright, and a size chart
  // photo has no business being that large.
  if (imageBytes.byteLength > 5 * 1024 * 1024) {
    return Response.json({ error: "too_large", message: "That photo is too large to analyze" }, { status: 413 });
  }
  const base64 = Buffer.from(imageBytes).toString("base64");

  let aiRes: Response;
  try {
    aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    return Response.json({ error: "ai_unreachable", message: "Couldn't reach the AI service" }, { status: 502 });
  }

  if (!aiRes.ok) {
    // Anthropic error bodies are JSON with a `.error.message` — surface it
    // without leaking the key or full request.
    const errBody = await aiRes.json().catch(() => null);
    const message =
      aiRes.status === 401
        ? "AI Advisor's API key is invalid — check ANTHROPIC_API_KEY"
        : (errBody as { error?: { message?: string } } | null)?.error?.message ?? "The AI service returned an error";
    return Response.json({ error: "ai_error", message }, { status: aiRes.status === 401 ? 501 : 502 });
  }

  const aiData = (await aiRes.json()) as { content?: { type: string; text?: string }[] };
  const text = aiData.content?.find((c) => c.type === "text")?.text ?? "";
  const cleaned = stripCodeFence(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return Response.json(
      { error: "unreadable", message: "Couldn't read that as a size chart — try a clearer or more direct photo of it" },
      { status: 422 },
    );
  }

  if (typeof parsed === "object" && parsed !== null && (parsed as { error?: string }).error === "not_a_size_chart") {
    return Response.json(
      { error: "not_a_size_chart", message: "That photo doesn't look like a size chart — pick a different one" },
      { status: 422 },
    );
  }

  const chart = sanitizeChart(parsed);
  if (!chart) {
    return Response.json(
      { error: "unreadable", message: "Couldn't extract any usable size rows from that photo" },
      { status: 422 },
    );
  }

  return Response.json(chart);
}
