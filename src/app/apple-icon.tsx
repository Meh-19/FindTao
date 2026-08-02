import { ImageResponse } from "next/og";

// iOS uses this (not the manifest icons) for the "Add to Home Screen" icon.
// Full-bleed — iOS applies its own rounded-corner mask.
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The brand sparkle (matches app/icon.svg), embedded as an <img> so Satori
// rasterises the gradient reliably.
const SPARKLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#8b5cf6"/><stop offset="0.55" stop-color="#d946ef"/>' +
  '<stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>' +
  '<path fill="url(#g)" d="M32 9l5.6 14.9L52 29.5l-14.4 5.6L32 50l-5.6-14.9L12 29.5l14.4-5.6z"/>' +
  '<circle cx="49" cy="13" r="3.4" fill="#67e8f9"/></svg>';

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(SPARKLE).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #17102b 0%, #0a0a0a 72%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={116} height={116} alt="" />
      </div>
    ),
    { ...size },
  );
}
