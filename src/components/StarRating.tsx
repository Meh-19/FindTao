"use client";

import { Star } from "lucide-react";

/** 1–5 star rating. Read-only when no `onChange`; click the current value to clear to 0. */
export function StarRating({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const readOnly = !onChange;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n === value ? 0 : n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={readOnly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"}
        >
          <Star
            size={size}
            aria-hidden="true"
            className={n <= value ? "fill-warning text-warning" : "text-mist-600"}
          />
        </button>
      ))}
    </span>
  );
}
