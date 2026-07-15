"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOff, Layers, Plus, Trash2 } from "lucide-react";
import { proxiedImg } from "@/lib/yupoo";
import { useStore, type SavedItem } from "@/lib/store";
import type { CollectionPiece } from "@/lib/profile";
import { ItemLink } from "@/components/ItemLink";
import { StarRating } from "@/components/StarRating";

const inputClass =
  "w-full rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

function PieceImage({ piece, className }: { piece: CollectionPiece; className: string }) {
  const src = piece.image && piece.imgHost ? proxiedImg(piece.image, piece.imgHost) : piece.image;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" className={className} />;
  }
  return (
    <span className={`flex items-center justify-center bg-ink-700 text-mist-500 ${className}`}>
      <ImageOff size={16} aria-hidden="true" />
    </span>
  );
}

/** One owned piece — editable size, star rating, and a short review. */
function CollectionRow({ piece }: { piece: CollectionPiece }) {
  const { updateCollectionPiece, removeFromCollection } = useStore();
  const [size, setSize] = useState(piece.size);
  const [review, setReview] = useState(piece.review);
  useEffect(() => setSize(piece.size), [piece.size]);
  useEffect(() => setReview(piece.review), [piece.review]);

  return (
    <div className="flex gap-3 rounded-none border border-white/5 bg-ink-900/60 p-3">
      <ItemLink item={piece} className="shrink-0">
        <PieceImage piece={piece} className="h-16 w-16 border border-white/5 object-cover" />
      </ItemLink>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium" title={piece.title}>
            <ItemLink item={piece} className="text-mist-100 transition-colors hover:text-neon-300 hover:underline">
              {piece.title}
            </ItemLink>
          </p>
          <button
            onClick={() => removeFromCollection(piece.id)}
            aria-label="Remove from collection"
            className="shrink-0 rounded px-1 py-1 text-mist-500 transition-colors hover:text-danger"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
        {piece.storeName && <p className="truncate text-[11px] text-mist-500">{piece.storeName}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-mist-400">
            Size
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              onBlur={() => updateCollectionPiece(piece.id, { size: size.trim() })}
              placeholder="—"
              className="w-16 rounded-none border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-mist-100 outline-none focus:border-neon-500"
            />
          </label>
          <StarRating value={piece.rating} onChange={(v) => updateCollectionPiece(piece.id, { rating: v })} />
        </div>

        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          onBlur={() => updateCollectionPiece(piece.id, { review: review.trim() })}
          rows={2}
          placeholder="Quick review — fit, quality, would you buy again?"
          className="mt-2 w-full resize-none rounded-none border border-ink-500 bg-ink-900 px-2.5 py-1.5 text-xs text-mist-200 placeholder-mist-500 outline-none focus:border-neon-500"
        />
      </div>
    </div>
  );
}

/** Quick-add strip: pieces already in the cart/hauls that aren't in the collection yet. */
function QuickAdd() {
  const { cart, hauls, collection, addToCollection } = useStore();
  const candidates = useMemo(() => {
    const byId = new Map<string, SavedItem>();
    for (const i of [...cart, ...hauls.flatMap((h) => h.items)]) {
      if ((i.id.startsWith("album:") || i.id.startsWith("cat:")) && !byId.has(i.id)) byId.set(i.id, i);
    }
    const inColl = new Set(collection.map((p) => p.id));
    return [...byId.values()].filter((i) => !inColl.has(i.id));
  }, [cart, hauls, collection]);

  if (candidates.length === 0) return null;

  return (
    <div className="border border-white/5 bg-ink-800/80 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
        <Layers size={14} aria-hidden="true" className="text-neon-300" /> Add from your cart &amp; hauls
      </p>
      <p className="mt-0.5 text-xs text-mist-500">Mark something you own — then set its size and review below.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {candidates.map((i) => (
          <button
            key={i.id}
            onClick={() =>
              addToCollection({
                id: i.id,
                title: i.title,
                image: i.image,
                imgHost: i.imgHost,
                storeId: i.storeId,
                storeName: i.storeName,
                url: i.url,
                size: i.manualSize ?? i.advice?.size ?? "",
                rating: 0,
                review: "",
              })
            }
            className="flex items-center gap-2 border border-ink-500 px-2 py-1.5 text-left transition-colors hover:border-neon-500/60"
          >
            <PieceImage
              piece={{
                id: i.id,
                title: i.title,
                image: i.image,
                imgHost: i.imgHost,
                storeId: i.storeId,
                storeName: i.storeName,
                url: i.url,
                size: "",
                rating: 0,
                review: "",
                addedAt: 0,
              }}
              className="h-8 w-8 shrink-0 border border-white/5 object-cover"
            />
            <span className="max-w-[10rem] truncate text-xs text-mist-200">{i.title}</span>
            <Plus size={13} aria-hidden="true" className="shrink-0 text-neon-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Manual add form for pieces not in the cart/haul (e.g. things bought before using the app). */
function ManualAdd() {
  const { addToCollection, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [storeName, setStoreName] = useState("");
  const [url, setUrl] = useState("");
  const [size, setSize] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  function reset() {
    setTitle("");
    setStoreName("");
    setUrl("");
    setSize("");
    setRating(0);
    setReview("");
  }

  function add() {
    if (!title.trim()) {
      toast("Give the piece a name", "error");
      return;
    }
    addToCollection({
      id: `manual:${Date.now().toString(36)}`,
      title: title.trim(),
      image: null,
      imgHost: null,
      storeId: "",
      storeName: storeName.trim(),
      url: url.trim() || null,
      size: size.trim(),
      rating,
      review: review.trim(),
    });
    toast("Added to your collection");
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 border border-dashed border-ink-500 px-4 py-3 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
      >
        <Plus size={15} aria-hidden="true" /> Add a piece manually
      </button>
    );
  }

  return (
    <div className="space-y-2 border border-white/10 bg-ink-800/80 p-4">
      <p className="text-sm font-semibold text-mist-100">Add a piece</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name — e.g. Fyredwrld baby fit tee" className={inputClass} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Store (optional)" className={inputClass} />
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size (e.g. L)" className={inputClass} />
      </div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Product link (optional)" className={inputClass} />
      <label className="flex items-center gap-2 text-xs text-mist-400">
        Rating <StarRating value={rating} onChange={setRating} />
      </label>
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        rows={2}
        placeholder="Quick review (optional)"
        className={`${inputClass} resize-none`}
      />
      <div className="flex gap-2">
        <button onClick={add} className="btn-glow rounded-none px-4 py-2 text-sm font-semibold text-white">
          Add
        </button>
        <button
          onClick={() => { reset(); setOpen(false); }}
          className="border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-mist-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CollectionManager() {
  const { collection, hydrated } = useStore();
  if (!hydrated) return null;

  return (
    <div className="fade-up">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Your <span className="flow-text">collection</span>
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          The pieces you own, with your size and a quick review. Shown on your public profile when you turn it on in
          Settings.
        </p>
      </div>

      <div className="space-y-4">
        <QuickAdd />
        <ManualAdd />

        {collection.length === 0 ? (
          <div className="border border-dashed border-ink-500 px-4 py-16 text-center text-sm text-mist-400">
            Nothing in your collection yet — add pieces you own from your cart/hauls above, or add one manually.
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-mist-500">
              {collection.length} piece{collection.length === 1 ? "" : "s"}
            </p>
            {collection.map((piece) => (
              <CollectionRow key={piece.id} piece={piece} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
