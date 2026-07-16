import { clientKey, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import type { GarmentType } from "@/lib/sizeAdvisor";
import type { W2CIdentity } from "@/lib/w2c";

export const dynamic = "force-dynamic";

// Same cheap vision model the size-chart reader uses — one small call per photo.
const MODEL = "claude-haiku-4-5-20251001";

const PROMPT = `You are helping a shopper find a specific clothing item on Chinese reseller sites (Yupoo/Taobao/Weidian) from a photo. Your job is to turn the photo into SEARCH TERMS, not to guess where to buy it.

Rules:
- Respond with ONLY a single JSON object. No markdown code fences, no commentary, nothing before or after the JSON.
- brand: only if a brand name, logo, or graphic text is actually legible in the photo. If you cannot read one, use null. Never guess a brand from style alone.
- keywords: 3-8 English search terms a reseller would put in a listing title, most distinctive first. Include the garment type, cut/fit, notable graphics or text, materials, and any collab name. Avoid generic filler like "clothing", "fashion", "streetwear".
- keywordsZh: 2-5 Simplified Chinese terms a Chinese seller would title the listing with (e.g. 卫衣 for hoodie, 工装裤 for cargo pants, 冲锋衣 for a shell jacket). Use the terms sellers actually write, not literal translations.
- colors: 1-3 plain colour words visible on the piece.
- category: a short plain-language name for the garment, e.g. "boxy varsity jacket".
- garmentType: one of "top", "bottom", "outerwear", "footwear", "unknown".
- notes: ONE sentence on the details that separate it from lookalikes (stitching, panel layout, logo placement, hardware).
- If the photo does not show a wearable item at all (a screenshot of text, a size chart, a landscape, a person's face with no visible garment), respond with exactly: {"error": "no_garment"}

Respond with exactly this shape and nothing else:
{"category": "boxy varsity jacket", "garmentType": "outerwear", "brand": null, "colors": ["navy", "cream"], "keywords": ["varsity jacket", "wool leather sleeve", "chenille patch"], "keywordsZh": ["棒球服", "夹克"], "notes": "Cream leather sleeves with ribbed navy trim and a chenille chest patch."}`;

function stripCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function isGarmentType(v: unknown): v is GarmentType {
  return v === "top" || v === "bottom" || v === "outerwear" || v === "footwear" || v === "unknown";
}

/** Keep only clean, bounded strings — the model's output drives UI and search, never trust it raw. */
function strings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 40)
    .slice(0, max);
}

function sanitizeIdentity(data: unknown): W2CIdentity | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  const category = typeof d.category === "string" ? d.category.trim().slice(0, 60) : "";
  const keywords = strings(d.keywords, 8);
  if (!category || keywords.length === 0) return null;

  const brand = typeof d.brand === "string" && d.brand.trim() ? d.brand.trim().slice(0, 40) : null;

  return {
    category,
    garmentType: isGarmentType(d.garmentType) ? d.garmentType : "unknown",
    brand,
    colors: strings(d.colors, 3),
    keywords,
    keywordsZh: strings(d.keywordsZh, 5),
    notes: typeof d.notes === "string" ? d.notes.trim().slice(0, 240) : "",
  };
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = /^image\/(jpeg|png|gif|webp)$/;

// Every call costs real money and this route has no auth gate — the client
// caches identifications by image hash, so a real shopper re-checking the same
// photo never gets here twice. 8 distinct photos per 15 minutes is plenty.
const LIMIT = 8;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  const rl = rateLimit(`w2c:${clientKey(request)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return rateLimitResponse(rl, "Too many photo lookups from this connection — try again in a few minutes.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "not_configured", message: "The finder isn't set up — add ANTHROPIC_API_KEY to run this." },
      { status: 501 },
    );
  }

  let body: { image?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid request body" }, { status: 400 });
  }

  const image = body.image ?? "";
  const mediaType = body.mediaType ?? "";
  if (!image || !ALLOWED_TYPES.test(mediaType)) {
    return Response.json(
      { error: "bad_request", message: "Send a JPEG, PNG, GIF or WebP image" },
      { status: 400 },
    );
  }
  // base64 inflates by ~4/3; check the decoded size before handing it to Anthropic.
  if ((image.length * 3) / 4 > MAX_BYTES) {
    return Response.json({ error: "too_large", message: "That photo is too large — keep it under 5MB" }, { status: 413 });
  }

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
        max_tokens: 512,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
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
    const errBody = await aiRes.json().catch(() => null);
    const message =
      aiRes.status === 401
        ? "The AI API key is invalid — check ANTHROPIC_API_KEY"
        : (errBody as { error?: { message?: string } } | null)?.error?.message ?? "The AI service returned an error";
    return Response.json({ error: "ai_error", message }, { status: aiRes.status === 401 ? 501 : 502 });
  }

  const aiData = (await aiRes.json()) as { content?: { type: string; text?: string }[] };
  const text = aiData.content?.find((c) => c.type === "text")?.text ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return Response.json(
      { error: "unreadable", message: "Couldn't read that photo — try a clearer shot of the piece" },
      { status: 422 },
    );
  }

  if (typeof parsed === "object" && parsed !== null && (parsed as { error?: string }).error === "no_garment") {
    return Response.json(
      { error: "no_garment", message: "No clothing in that photo — try a shot of the piece itself" },
      { status: 422 },
    );
  }

  const identity = sanitizeIdentity(parsed);
  if (!identity) {
    return Response.json(
      { error: "unreadable", message: "Couldn't pin down what that is — try a clearer, closer photo" },
      { status: 422 },
    );
  }

  return Response.json(identity);
}
