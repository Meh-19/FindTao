/** Best-effort carrier detection from tracking number shape; 17TRACK resolves the rest. */
const CARRIER_PATTERNS: { carrier: string; pattern: RegExp }[] = [
  { carrier: "UPS", pattern: /^1Z[0-9A-Z]{16}$/i },
  { carrier: "YunExpress", pattern: /^YT\d{16}$/i },
  { carrier: "4PX", pattern: /^(4PX|UUS)\w+$/i },
  { carrier: "SF Express", pattern: /^SF\d{12,15}$/i },
  { carrier: "China Post / EMS", pattern: /^[A-Z]{2}\d{9}CN$/i },
  { carrier: "DHL Express", pattern: /^\d{10}$/ },
  { carrier: "USPS", pattern: /^9[2-5]\d{18,24}$/ },
  { carrier: "FedEx", pattern: /^\d{12}(\d{3})?$/ },
];

export function detectCarrier(num: string): string {
  const clean = num.replace(/\s/g, "");
  for (const { carrier, pattern } of CARRIER_PATTERNS) {
    if (pattern.test(clean)) return carrier;
  }
  return "Unknown";
}

export const track17Url = (num: string) => `https://t.17track.net/en#nums=${encodeURIComponent(num)}`;

/**
 * Alternate universal trackers — no API, just deep-links. Different aggregators
 * cover different regional carriers better, so offering a few beats betting on one.
 */
export const TRACKERS: { id: string; label: string; url: (num: string) => string }[] = [
  { id: "17track", label: "17TRACK", url: track17Url },
  { id: "aftership", label: "AfterShip", url: (n) => `https://www.aftership.com/track/${encodeURIComponent(n)}` },
  { id: "parcelsapp", label: "Parcels", url: (n) => `https://parcelsapp.com/en/tracking/${encodeURIComponent(n)}` },
  { id: "4tracking", label: "4Tracking", url: (n) => `https://www.4tracking.net/search?nums=${encodeURIComponent(n)}` },
];
