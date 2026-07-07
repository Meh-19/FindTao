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
