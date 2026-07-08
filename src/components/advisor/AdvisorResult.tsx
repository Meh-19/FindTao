"use client";

import { CheckCircle2, MessageSquareText, RotateCcw } from "lucide-react";
import type { Recommendation, ReviewSignal, SizeChart } from "@/lib/sizeAdvisor";

const CONFIDENCE_LABEL: Record<Recommendation["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — few matching dimensions",
};

const CONFIDENCE_COLOR: Record<Recommendation["confidence"], string> = {
  high: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  low: "border-red-400/40 bg-red-400/10 text-red-300",
};

export function AdvisorResult({
  recommendation,
  chart,
  reviewSignal,
  onReset,
}: {
  recommendation: Recommendation;
  chart: SizeChart;
  reviewSignal: ReviewSignal | null;
  onReset: () => void;
}) {
  return (
    <div className="border border-white/10 bg-ink-800/80">
      <div className="flow-bg h-0.5" />
      <div className="p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-mist-500">We recommend</p>
        <p className="mt-2 text-5xl font-extrabold text-mist-100">{recommendation.size}</p>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 border px-3 py-1 text-xs font-medium ${CONFIDENCE_COLOR[recommendation.confidence]}`}
        >
          <CheckCircle2 size={13} aria-hidden="true" /> {CONFIDENCE_LABEL[recommendation.confidence]}
        </span>
      </div>

      <div className="border-t border-white/5 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-mist-500">Why</p>
        <ul className="mt-2 space-y-1.5 text-sm text-mist-300">
          {recommendation.reasoning.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-mist-600">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-mist-500">Per-measurement breakdown</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-mist-500">
                <th className="py-1.5 pr-3 font-medium">Dimension</th>
                <th className="py-1.5 pr-3 font-medium">You</th>
                <th className="py-1.5 pr-3 font-medium">Chart ({recommendation.size})</th>
                <th className="py-1.5 font-medium">Ease</th>
              </tr>
            </thead>
            <tbody>
              {recommendation.score.breakdown.map((b) => (
                <tr key={b.dimension} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 text-mist-300">{b.label}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-mist-100">
                    {b.bodyCm.toFixed(1)}cm
                    {!b.bodyMeasured && (
                      <span className="ml-1 font-mono text-[9px] uppercase text-mist-500">est.</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-mist-100">{b.chartCm.toFixed(1)}cm</td>
                  <td className="py-1.5 tabular-nums text-mist-300">
                    {b.easeCm >= 0 ? "+" : ""}
                    {b.easeCm.toFixed(1)}cm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chart.rows.length > 1 && (
          <p className="mt-2 text-[11px] text-mist-500">
            Full chart has {chart.rows.length} sizes: {chart.rows.map((r) => r.size).join(", ")}.
          </p>
        )}
      </div>

      {reviewSignal && reviewSignal.sampleCount > 0 && (
        <div className="border-t border-white/5 p-5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-mist-500">
            <MessageSquareText size={13} aria-hidden="true" /> Store reviews ({reviewSignal.sampleCount})
          </p>
          <p className="mt-1.5 text-sm text-mist-300">
            {reviewSignal.bias === "runs-small" && `Reviewers say this seller runs small (${reviewSignal.votes.small} mentions).`}
            {reviewSignal.bias === "runs-large" && `Reviewers say this seller runs large (${reviewSignal.votes.large} mentions).`}
            {reviewSignal.bias === "true-to-size" && "Reviewers say this seller runs true to size."}
            {reviewSignal.bias === null && "No clear sizing consensus in the reviews on file — not factored in."}
          </p>
        </div>
      )}

      <div className="border-t border-white/5 p-5">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
        >
          <RotateCcw size={14} aria-hidden="true" /> Check another item
        </button>
      </div>
    </div>
  );
}
