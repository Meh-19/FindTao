import { CheckCircle2, RefreshCw } from "lucide-react";
import { resolveFootLength, resolveMeasurements, type Measurements } from "@/lib/measurements";
import { adviceStatus, scoreChart, type SizeAdvice } from "@/lib/sizeAdvisor";

const CONFIDENCE_CHIP: Record<SizeAdvice["confidence"], string> = {
  high: "border-success/40 bg-success/10 text-success",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-danger/40 bg-danger/10 text-danger",
};

const CONFIDENCE_WORD: Record<SizeAdvice["confidence"], string> = {
  high: "High confidence you'll fit",
  medium: "Medium confidence",
  low: "Low confidence — few matching measurements",
};

/**
 * Expanded "what size did I land on, and why" panel for a saved size call —
 * shown under a haul/cart line so the shopper can reflect back on the pick
 * without re-opening the advisor. When the chart was cached (advice.chart) it
 * recomputes the per-dimension You/Chart/Ease breakdown for the recommended
 * size against the shopper's current measurements — no AI call. Older advice
 * saved before chart caching shows the headline only.
 */
export function AdviceDetail({ advice, measurements }: { advice: SizeAdvice; measurements: Measurements }) {
  const resolved = { ...resolveMeasurements(measurements), footLengthCm: resolveFootLength(measurements) };
  const row = advice.chart?.rows.find((r) => r.size === advice.size) ?? null;
  const breakdown =
    advice.chart && row
      ? scoreChart({ garmentType: advice.garmentType, rows: [row] }, resolved, advice.fitPreference)[0].breakdown
      : [];
  const status = adviceStatus(advice, measurements);
  const when = new Date(advice.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="text-xs text-mist-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl font-extrabold leading-none text-mist-100">{advice.size}</span>
        <span
          className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_CHIP[advice.confidence]}`}
        >
          <CheckCircle2 size={11} aria-hidden="true" /> {CONFIDENCE_WORD[advice.confidence]}
        </span>
        <span className="text-mist-500">
          {advice.fitPreference} fit · {advice.garmentType} · sized {when}
        </span>
      </div>

      {breakdown.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-mist-500">
                <th className="py-1 pr-3 font-medium">Dimension</th>
                <th className="py-1 pr-3 font-medium">You</th>
                <th className="py-1 pr-3 font-medium">Chart ({advice.size})</th>
                <th className="py-1 font-medium">Ease</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.dimension} className="border-t border-white/5">
                  <td className="py-1 pr-3 text-mist-300">{b.label}</td>
                  <td className="py-1 pr-3 tabular-nums text-mist-100">
                    {b.bodyCm.toFixed(1)}cm
                    {!b.bodyMeasured && <span className="ml-1 font-mono text-[9px] uppercase text-mist-500">est.</span>}
                  </td>
                  <td className="py-1 pr-3 tabular-nums text-mist-100">
                    {b.chartCm.toFixed(1)}cm
                    {b.flatCorrected && (
                      <span
                        className="ml-1 font-mono text-[9px] uppercase text-warning"
                        title={`Chart said ${b.rawChartCm.toFixed(1)}cm — doubled (looked like a flat measurement)`}
                      >
                        2x
                      </span>
                    )}
                  </td>
                  <td className="py-1 tabular-nums text-mist-300">
                    {b.easeCm >= 0 ? "+" : ""}
                    {b.easeCm.toFixed(1)}cm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-mist-500">
          Saved before detailed breakdowns existed — re-run the advisor on this item to see the full comparison.
        </p>
      )}

      {status === "recomputable" && (
        <p className="mt-3 flex items-center gap-1.5 border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[11px] text-warning">
          <RefreshCw size={11} aria-hidden="true" />
          Your measurements changed since this was sized — reopen the advisor to refresh it (free, no AI scan).
        </p>
      )}
    </div>
  );
}
