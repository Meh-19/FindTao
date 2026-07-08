"use client";

import { useState } from "react";
import { ExternalLink, Package, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { detectCarrier, track17Url as track17 } from "@/lib/tracking";

export default function TrackingPage() {
  const { tracking, addTracking, removeTracking, toast, hydrated } = useStore();
  const [input, setInput] = useState("");

  if (!hydrated) return null;

  function add() {
    const num = input.trim().replace(/\s/g, "");
    if (!num) return;
    const carrier = detectCarrier(num);
    addTracking({ number: num, carrier, addedAt: Date.now() });
    setInput("");
    toast(carrier === "Unknown" ? "Added — 17TRACK will auto-detect the carrier" : `Added — looks like ${carrier}`);
  }

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Package <span className="flow-text">tracking</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Paste a tracking number — the carrier is detected from its shape and opens on 17TRACK.
      </p>

      <div className="mt-5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="YT2612345678901234, 1Z…, EA123456789CN…"
          className="flex-1 rounded-none border border-ink-500 bg-ink-800/80 px-4 py-2.5 font-mono text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500"
        />
        <button onClick={add} className="btn-glow rounded-none px-5 py-2.5 text-sm font-semibold text-white">
          Track
        </button>
      </div>

      {tracking.length === 0 ? (
        <div className="mt-6 rounded-none border border-dashed border-ink-500 py-14 text-center text-sm text-mist-400">
          No packages yet. Your agent gives you a tracking number when the parcel ships.
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {tracking.map((p, i) => (
            <div
              key={p.number}
              className="card-pop fade-up flex items-center gap-3 rounded-none border border-white/5 bg-ink-800/80 px-4 py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Package size={18} aria-hidden="true" className="text-mist-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-mist-100">{p.number}</p>
                <p className="text-xs text-mist-500">
                  {p.carrier === "Unknown" ? "Carrier auto-detected on 17TRACK" : p.carrier}
                </p>
              </div>
              <a
                href={track17(p.number)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-glow flex items-center gap-1 rounded-none px-3 py-1.5 text-xs font-semibold text-white"
              >
                17TRACK <ExternalLink size={11} aria-hidden="true" />
              </a>
              <button
                onClick={() => removeTracking(p.number)}
                aria-label="Remove tracking number"
                className="rounded px-1.5 py-1 text-mist-500 hover:text-red-400"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
