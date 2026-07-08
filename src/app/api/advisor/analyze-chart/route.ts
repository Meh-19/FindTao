import { isValidYupooHost } from "@/lib/yupoo";
import type { ChartRow, GarmentType } from "@/lib/sizeAdvisor";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Cheap, fast, vision-capable — one call per chart, kept deliberately small.
const MODEL = "claude-haiku-4-5-20251001";

const CHART_FIELDS = [
  "size", "chestCm", "shoulderWidthCm", "sleeveLengthCm", "bodyLengthCm", "neckCm",
  "waistCm", "hipsCm", "inseamCm", "thighCm", "riseCm",
] as const;

const PROMPT = `You are reading a clothing/footwear size chart from a product photo. Extract every size row into structured data.

Rules:
- Respond with ONLY a single JSON object. No markdown code fences, no commentary, nothing before or after the JSON.
- Convert every numeric measurement to centimeters (cm). If the chart is already in inches, multiply by 2.54. If values look like millimeters (e.g. in the 600-1400 range for a chest/waist figure), divide by 10. Typical adult chest/waist/hip measurements are roughly 60-140cm — use that as a sanity check.
- Use exactly these field names for whichever columns the chart actually has — omit any field the chart doesn't show. Never invent or guess a number that isn't legible.
  size (string label exactly as shown, e.g. "M", "L", "42", "US 9"), chestCm, shoulderWidthCm, sleeveLengthCm, bodyLengthCm, neckCm, waistCm, hipsCm, inseamCm, thighCm, riseCm
- garmentType: "top" if it has chest/shoulder/sleeve columns, "outerwear" if it's clearly a jacket/coat chart, "bottom" if it has waist/hips/inseam columns, otherwise "unknown".
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
  return v === "top" || v === "bottom" || v === "outerwear" || v === "unknown";
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

export async function POST(request: Request) {
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
