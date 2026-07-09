import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="fade-up mx-auto flex max-w-md flex-col items-center border border-dashed border-ink-500 px-6 py-14 text-center">
      <h1 className="text-xl font-bold text-mist-100">Page not found</h1>
      <p className="mt-1.5 text-sm text-mist-400">
        Whatever you were looking for isn&apos;t here — it may have been removed, or the link is off.
      </p>
      <div className="mt-5 flex gap-2">
        <Link
          href="/"
          className="btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-sm font-semibold text-white"
        >
          <Home size={14} aria-hidden="true" /> Go home
        </Link>
        <Link
          href="/browse"
          className="flex items-center gap-1.5 border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
        >
          <Search size={14} aria-hidden="true" /> Search
        </Link>
      </div>
    </div>
  );
}
