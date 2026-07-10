"use client";

import { useEffect, useState } from "react";
import { proxiedImg } from "@/lib/yupoo";

interface PreviewItem {
  image: string | null;
  imgHost: string | null;
}

/**
 * A 2×2 tile that crossfades through a haul's item photos — each of the four
 * cells cycles independently through the items assigned to it (round-robin), so
 * a big haul gently shuffles. Reused on the hauls list and the shared-haul page.
 * Static first frame when a haul has ≤4 photos or the viewer prefers reduced
 * motion; empty cells fall back to the accent gradient.
 */
export function HaulPreview({ items, className = "" }: { items: PreviewItem[]; className?: string }) {
  const withImg = items.filter((i): i is { image: string; imgHost: string } => !!i.image && !!i.imgHost);
  const cells: { image: string; imgHost: string }[][] = [[], [], [], []];
  withImg.forEach((it, i) => cells[i % 4].push(it));
  const animate = withImg.length > 4;

  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!animate || reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, [animate, reduced]);

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-ink-900 ${className}`}>
      {cells.map((cellItems, c) => {
        const active = cellItems.length ? (tick + c) % cellItems.length : 0;
        return (
          <div key={c} className="relative overflow-hidden bg-ink-800">
            {cellItems.length === 0 ? (
              <div className="flow-bg h-full w-full opacity-40" />
            ) : (
              cellItems.map((it, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={proxiedImg(it.image, it.imgHost)}
                  alt=""
                  loading="lazy"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    idx === active ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ transitionDelay: `${c * 90}ms` }}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
