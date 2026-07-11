import { Ruler } from "lucide-react";
import type { SizeAdvice } from "@/lib/sizeAdvisor";

/** Confidence → chip color (mirrors AdvisorResult's palette) = "how sure it is you'll fit". */
const CONFIDENCE_CHIP: Record<SizeAdvice["confidence"], string> = {
  high: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  low: "border-red-400/40 bg-red-400/10 text-red-300",
};

const CONFIDENCE_WORD: Record<SizeAdvice["confidence"], string> = {
  high: "high confidence you'll fit",
  medium: "medium confidence you'll fit",
  low: "low confidence — few matching measurements",
};

/**
 * Compact size chip shown on cart/haul lines from a saved AI Advisor run — the
 * recommended size, colored by confidence. See lib/store `setItemAdvice`.
 */
export function AdviceBadge({ advice, className = "" }: { advice: SizeAdvice; className?: string }) {
  return (
    <span
      title={`AI Advisor: size ${advice.size} — ${CONFIDENCE_WORD[advice.confidence]} (${advice.fitPreference} fit)`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-none border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONFIDENCE_CHIP[advice.confidence]} ${className}`}
    >
      <Ruler size={9} aria-hidden="true" /> {advice.size}
    </span>
  );
}
