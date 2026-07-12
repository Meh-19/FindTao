"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Root-level error boundary — only fires when the error happens in the root
 * layout itself (e.g. StoreProvider throwing), which error.tsx can't catch
 * since it lives inside that layout. This has to render its own <html>/<body>
 * since it replaces the entire layout tree, so it stays deliberately minimal
 * and doesn't depend on Nav/StoreProvider/any app state.
 */
export default function GlobalError({
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
    <html lang="en">
      <body className="bg-ink-950 text-mist-100 antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md border border-white/10 bg-ink-800/80 px-6 py-14 text-center">
            <h1 className="font-display text-xl font-bold">FindTao hit an error</h1>
            <p className="mt-1.5 text-sm text-mist-400">
              Something went wrong loading the app itself. Your saved data lives in this browser and
              is untouched — reloading usually fixes this.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-[10px] text-mist-600">Ref: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="btn-glow mt-5 rounded-none px-4 py-2 text-sm font-semibold text-white"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
