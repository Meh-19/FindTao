"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <button
      onClick={copy}
      className={`flex items-center justify-center gap-1 rounded-none border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        copied
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
          : "border-ink-500 text-mist-300 hover:border-neon-500/60 hover:bg-neon-600/10 hover:text-neon-300"
      } ${className}`}
    >
      {copied && <Check size={12} aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}
