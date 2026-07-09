"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary — catches a thrown error anywhere in a page or
 * its components and swaps just the <main> content for this fallback while
 * the surrounding layout (nav, cart, topbar) stays intact and usable.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fade-up mx-auto flex max-w-md flex-col items-center border border-white/10 bg-ink-800/80 px-6 py-14 text-center">
      <AlertTriangle size={22} aria-hidden="true" className="text-red-400" />
      <h1 className="mt-3 text-xl font-bold text-mist-100">Something broke</h1>
      <p className="mt-1.5 text-sm text-mist-400">
        This page hit an unexpected error. Your cart, hauls, and saved measurements are untouched —
        try again, or head back home.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-[10px] text-mist-600">Ref: {error.digest}</p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          onClick={reset}
          className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white"
        >
          <RotateCcw size={14} aria-hidden="true" /> Try again
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
        >
          <Home size={14} aria-hidden="true" /> Go home
        </Link>
      </div>
    </div>
  );
}
