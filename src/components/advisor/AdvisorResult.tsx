"use client";

import { useState } from "react";
import { BookmarkCheck, CheckCircle2, MessageSquareText, RotateCcw, Save } from "lucide-react";
import type { Recommendation, ReviewSignal, SizeChart } from "@/lib/sizeAdvisor";

const CONFIDENCE_LABEL: Record<Recommendation["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — few matching dimensions",
};

const CONFIDENCE_COLOR: Record<Recommendation["confidence"], string> = {
  high: "border-success/40 bg-success/10 text-success",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-danger/40 bg-danger/10 text-danger",
};

export function AdvisorResult({
  recommendation,
  chart,
  reviewSignal,
  autoSaved,
  attachable,
  onAttach,
  onReset,
}: {
  recommendation: Recommendation;
  chart: SizeChart;
  reviewSignal: ReviewSignal | null;
  /** True when the size already auto-saved onto a matching cart/haul item. */
  autoSaved: boolean;
  /** Album-backed cart/haul items this size can be attached to. */
  attachable: { id: string; title: string }[];
  onAttach: (itemId: string) => void;
  onReset: () => void;
}) {
  const [attachId, setAttachId] = useState(attachable[0]?.id ?? "");
  const [attached, setAttached] = useState(false);
  const showSaved = autoSaved || attached;

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

      {/* Save-to-item: keeps the size call with the item in the cart/haul so it
          shows as a colored chip there, not just on this screen. */}
      <div className="border-t border-white/5 p-5">
        {showSaved ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <BookmarkCheck size={15} aria-hidden="true" />
            Saved to your item — size <span className="font-semibold">{recommendation.size}</span> now shows on it in your cart &amp; hauls.
          </p>
        ) : attachable.length > 0 ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-mist-500">Save this size to an item</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
                className="min-w-0 flex-1 rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-neon-500"
              >
                {attachable.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!attachId) return;
                  onAttach(attachId);
                  setAttached(true);
                }}
                className="btn-glow flex items-center justify-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white"
              >
                <Save size={14} aria-hidden="true" /> Save size
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-mist-500">
            Add this item to your cart or a haul to save this size onto it.
          </p>
        )}
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
                  <td className="py-1.5 pr-3 tabular-nums text-mist-100">
                    {b.chartCm.toFixed(1)}cm
                    {b.flatCorrected && (
                      <span
                        className="ml-1 font-mono text-[9px] uppercase text-warning"
                        title={`Chart said ${b.rawChartCm.toFixed(1)}cm — doubled, looked like a flat (laid-flat) garment measurement`}
                      >
                        2x
                      </span>
                    )}
                  </td>
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
        <p className="text-[11px] leading-relaxed text-mist-500">
          This is a best-effort estimate from the seller&rsquo;s chart and your measurements — not a
          guarantee of fit. Charts are often approximate or mislabeled, so double-check the numbers
          above against the original photo before you buy.
        </p>
      </div>

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
