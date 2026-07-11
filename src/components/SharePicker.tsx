"use client";

import { useState } from "react";
import { ImageIcon, Link2, Loader2, Share2 } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * Share control for hauls and carts. `publish` takes an optional store filter
 * and returns the share URL (publishing the snapshot). When the items span more
 * than one store, a checklist lets the sharer include only some — handy for
 * posting just one brand's picks. Offers "Copy link" and "Copy image" (the full
 * grid image), both respecting the filter.
 */
export function SharePicker({
  stores,
  publish,
  triggerLabel = "Share",
  triggerClass,
  dropUp = false,
}: {
  stores: { id: string; name: string }[];
  publish: (storeIds?: string[]) => Promise<string | null>;
  triggerLabel?: string;
  triggerClass?: string;
  /** Open the popover upward (for triggers near the bottom of the screen, e.g. the cart). */
  dropUp?: boolean;
}) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(stores.map((s) => s.id)));
  const [busy, setBusy] = useState<null | "link" | "image">(null);

  const multi = stores.length > 1;
  // undefined = no filter (all stores); otherwise the chosen subset.
  const storeIds = multi && selected.size < stores.length ? [...selected] : undefined;
  const noneChosen = multi && selected.size === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyLink() {
    if (busy) return;
    setBusy("link");
    const url = await publish(storeIds);
    setBusy(null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast("Share link copied");
    } catch {
      toast(url, "info");
    }
    setOpen(false);
  }

  async function copyImage() {
    if (busy) return;
    setBusy("image");
    try {
      const url = await publish(storeIds);
      if (!url) return;
      const slug = url.split("/haul/")[1];
      const res = await fetch(`/haul/${slug}/image`, { cache: "no-store" });
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      toast("Image copied — paste it anywhere");
      setOpen(false);
    } catch {
      toast("Couldn't copy the image — try the link instead", "error");
    } finally {
      setBusy(null);
    }
  }

  const trigger =
    triggerClass ??
    "btn-glow flex items-center gap-1.5 rounded-none px-4 py-2 text-xs font-semibold text-white";
  const action =
    "flex flex-1 items-center justify-center gap-1 rounded-none border border-ink-500 px-2 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={trigger}>
        <Share2 size={13} aria-hidden="true" /> {triggerLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute left-0 z-50 w-60 rounded-none border border-white/10 bg-ink-900 p-3 shadow-hard-sm ${
              dropUp ? "bottom-full mb-1" : "mt-1"
            }`}
          >
            {multi && (
              <>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-mist-500">
                  Include stores
                </p>
                <div className="mb-2.5 max-h-40 space-y-1 overflow-y-auto">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-mist-300">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="accent-white"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={copyLink} disabled={!!busy || noneChosen} className={action}>
                {busy === "link" ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 size={12} aria-hidden="true" />
                )}
                Copy link
              </button>
              <button onClick={copyImage} disabled={!!busy || noneChosen} className={action}>
                {busy === "image" ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon size={12} aria-hidden="true" />
                )}
                Copy image
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
