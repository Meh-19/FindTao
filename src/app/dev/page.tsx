"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeDollarSign, Globe, ImagePlus, MessageSquareText, Package, Plus, ShieldCheck, Tags, Trash2, Users, Wrench } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORE_CATEGORIES, type StoreCategory, type StoreInfo } from "@/data/stores";
import type { Category, CatalogItem } from "@/data/catalog";
import { parseLink } from "@/lib/links";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { StoreAvatar } from "@/components/StoreAvatar";
import { useStore, type TagDef } from "@/lib/store";

const STORE_AVATAR_BUCKET = "store-avatars";

/**
 * Upload a store profile picture to Supabase Storage and return its public URL.
 * Admin-only by the bucket's RLS policy (see supabase/schema.sql). Returns null
 * on failure so callers can toast.
 */
async function uploadStoreImage(sb: SupabaseClient, file: File, storeId: string): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${storeId || "store"}-${Date.now()}.${ext}`;
  const { error } = await sb.storage
    .from(STORE_AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return null;
  return sb.storage.from(STORE_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

const CATALOG_CATEGORIES: Category[] = ["jacket", "hoodie", "tee", "pants", "shoes", "bag", "accessory"];

const PALETTE: [string, string][] = [
  ["#8b5cf6", "#22d3ee"],
  ["#ec4899", "#f59e0b"],
  ["#10b981", "#3b82f6"],
  ["#f43f5e", "#8b5cf6"],
  ["#f97316", "#ef4444"],
  ["#14b8a6", "#3b82f6"],
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hueFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const GENERIC_SUBDOMAINS = new Set(["www", "item", "detail", "shop", "world", "h5", "market", "s"]);

/**
 * Derive a store name from a pasted URL:
 * yupoo subdomain → "unionkingdom"; taobao/tmall shop subdomain → "shop123";
 * weidian ?userid= → "weidian-123".
 */
function yupooName(url: string): string | null {
  const yupoo = url.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.x\.yupoo\.com/i);
  if (yupoo) return yupoo[1];
  const tb = url.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.(?:taobao|tmall)\.com/i);
  if (tb && !GENERIC_SUBDOMAINS.has(tb[1].toLowerCase())) return tb[1];
  const wd = url.match(/weidian\.com\/?\?(?:.*&)?userid=(\d+)/i);
  if (wd) return `weidian-${wd[1]}`;
  return null;
}

const inputClass =
  "rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

function TagChip({
  def,
  active,
  onClick,
}: {
  def: TagDef;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-none border px-2 py-0.5 text-[11px] font-medium transition-colors"
      style={
        active
          ? { borderColor: `${def.color}99`, background: `${def.color}26`, color: def.color }
          : { borderColor: "#3a2f5e", color: "#746d8f" }
      }
    >
      {def.name}
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  blurb,
  children,
}: {
  icon: typeof Wrench;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-none border border-white/5 bg-ink-800/70 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100">
        <Icon size={15} aria-hidden="true" className="text-neon-300" />
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-mist-500">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AddStore() {
  const { sb, refreshDirectory, tagDefs, toast } = useStore();
  const storeTags = tagDefs.filter((t) => t.kind === "store");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [blurb, setBlurb] = useState("");
  const [cats, setCats] = useState<StoreCategory[]>(["Clothing"]);
  const [tags, setTags] = useState<string[]>([]);
  const [discover, setDiscover] = useState(true);
  const [trust, setTrust] = useState(50);
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage(file: File) {
    if (!sb) return;
    setUploading(true);
    const storeId = slugify(name.trim() || yupooName(url.trim()) || "store");
    const publicUrl = await uploadStoreImage(sb, file, storeId);
    if (publicUrl) setImageUrl(publicUrl);
    else toast("Image upload failed — check the storage bucket", "error");
    setUploading(false);
  }

  async function add() {
    if (!sb || busy) return;
    const n = name.trim() || yupooName(url.trim()) || "";
    const u = url.trim();
    if (!n || !u) {
      toast("Name and URL are required", "error");
      return;
    }
    setBusy(true);
    const [hue1, hue2] = hueFor(n);
    const { error } = await sb.from("store_directory").insert({
      id: slugify(n),
      name: n,
      url: u.startsWith("http") ? u : `https://${u}`,
      categories: cats,
      tags,
      blurb: blurb.trim(),
      hue1,
      hue2,
      trust: Math.max(0, Math.min(100, Math.round(trust))),
      discover,
      image_url: imageUrl,
    });
    if (error) {
      toast(error.message, "error");
    } else {
      toast(`${n} added to the directory`);
      setName(""); setUrl(""); setBlurb(""); setTags([]); setTrust(50); setImageUrl(null);
      await refreshDirectory();
    }
    setBusy(false);
  }

  return (
    <Section icon={Plus} title="Add store" blurb="Goes straight into the live directory. Yupoo URLs auto-fill the name.">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={url} onChange={(e) => { setUrl(e.target.value); const y = yupooName(e.target.value); if (y && !name) setName(y); }} placeholder="https://store.x.yupoo.com" className={inputClass} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Store name" className={inputClass} />
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Short blurb (optional)" className={`${inputClass} sm:col-span-2`} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <StoreAvatar store={{ name: name.trim() || "?", image: imageUrl }} className="h-10 w-10 rounded-none text-[11px]" />
        <label className="flex cursor-pointer items-center gap-1.5 rounded-none border border-ink-500 px-3 py-2 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300">
          <ImagePlus size={13} aria-hidden="true" />
          {uploading ? "Uploading…" : imageUrl ? "Change picture" : "Profile picture (optional)"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ""; }}
          />
        </label>
        {imageUrl && (
          <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-mist-500 hover:text-red-400">
            Remove
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STORE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
            aria-pressed={cats.includes(c)}
            className={`rounded-none border px-2.5 py-1 text-xs font-medium transition-colors ${
              cats.includes(c)
                ? "border-neon-500/60 bg-neon-600/20 text-neon-300"
                : "border-ink-500 text-mist-500 hover:text-mist-300"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {storeTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {storeTags.map((t) => (
            <TagChip
              key={t.id}
              def={t}
              active={tags.includes(t.name)}
              onClick={() => setTags((prev) => (prev.includes(t.name) ? prev.filter((x) => x !== t.name) : [...prev, t.name]))}
            />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-mist-300">
          <input type="checkbox" checked={discover} onChange={(e) => setDiscover(e.target.checked)} className="accent-white" />
          Show in Discover
        </label>
        <label className="flex items-center gap-1.5 text-xs text-mist-300">
          Trust
          <input
            type="number"
            min={0}
            max={100}
            value={trust}
            onChange={(e) => setTrust(Number(e.target.value))}
            className="w-14 rounded-none border border-ink-500 bg-ink-900 px-1.5 py-1 text-center text-xs text-mist-100 outline-none focus:border-neon-500"
          />
        </label>
        <button onClick={add} disabled={busy} className="btn-glow ml-auto rounded-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Adding…" : "Add store"}
        </button>
      </div>
    </Section>
  );
}

function BulkAdd() {
  const { sb, refreshDirectory, toast } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!sb || busy) return;
    const urls = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setBusy(true);
    const rows = urls.map((u) => {
      const n = yupooName(u) ?? slugify(u.replace(/^https?:\/\//, "").split("/")[0]);
      const [hue1, hue2] = hueFor(n);
      return {
        id: slugify(n),
        name: n,
        url: u.startsWith("http") ? u : `https://${u}`,
        categories: ["Clothing"],
        hue1,
        hue2,
        discover: true,
      };
    });
    const { error } = await sb.from("store_directory").upsert(rows, { onConflict: "id" });
    if (error) toast(error.message, "error");
    else {
      toast(`${rows.length} store${rows.length === 1 ? "" : "s"} added`);
      setText("");
      await refreshDirectory();
    }
    setBusy(false);
  }

  return (
    <Section icon={Globe} title="Bulk add" blurb="One URL per line — Yupoo subdomains become the store name. Existing ids are updated, not duplicated.">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"https://unionkingdom.x.yupoo.com\nhttps://mobiusstudio.x.yupoo.com"}
        className={`${inputClass} w-full font-mono text-xs`}
      />
      <button onClick={run} disabled={busy} className="btn-glow mt-2 rounded-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Adding…" : "Add all"}
      </button>
    </Section>
  );
}

function StoreRow({
  store,
  selected,
  onSelect,
}: {
  store: StoreInfo;
  selected: boolean;
  onSelect: (v: boolean) => void;
}) {
  const { sb, refreshDirectory, tagDefs, toast } = useStore();
  const storeTags = tagDefs.filter((t) => t.kind === "store");
  const [trustDraft, setTrustDraft] = useState(String(store.trust));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTrustDraft(String(store.trust)), [store.trust]);

  async function pickImage(file: File) {
    if (!sb) return;
    setUploading(true);
    const publicUrl = await uploadStoreImage(sb, file, store.id);
    if (!publicUrl) toast("Image upload failed — check the storage bucket", "error");
    else await update({ image_url: publicUrl }, `Picture updated for ${store.name}`);
    setUploading(false);
  }

  async function update(patch: Record<string, unknown>, msg: string) {
    if (!sb) return;
    const { error } = await sb.from("store_directory").update(patch).eq("id", store.id);
    if (error) toast(error.message, "error");
    else {
      toast(msg);
      await refreshDirectory();
    }
  }

  function commitTrust() {
    const n = Math.max(0, Math.min(100, Math.round(Number(trustDraft))));
    if (!Number.isFinite(n) || n === store.trust) {
      setTrustDraft(String(store.trust));
      return;
    }
    update({ trust: n }, `Trust set to ${n} for ${store.name}`);
  }

  async function remove() {
    if (!sb) return;
    const { error } = await sb.from("store_directory").delete().eq("id", store.id);
    if (error) toast(error.message, "error");
    else {
      toast(`${store.name} removed`, "info");
      await refreshDirectory();
    }
  }

  async function toggleTag(tag: string) {
    const next = store.tags?.includes(tag)
      ? (store.tags ?? []).filter((t) => t !== tag)
      : [...(store.tags ?? []), tag];
    await update({ tags: next }, `Tags updated for ${store.name}`);
  }

  return (
    <div className={`rounded-none border p-3 ${store.banned ? "border-red-400/30 bg-red-400/5" : "border-white/5 bg-ink-900/60"}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${store.name}`}
          className="accent-white"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={store.image ? "Change profile picture" : "Upload profile picture"}
          aria-label={`Upload profile picture for ${store.name}`}
          className="relative shrink-0 disabled:opacity-60"
        >
          <StoreAvatar store={store} className="h-7 w-7 rounded-none text-[9px]" />
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-none border border-ink-500 bg-ink-900 text-mist-300">
            <ImagePlus size={8} aria-hidden="true" />
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ""; }}
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-mist-100">
            {store.name}
            {store.banned && <span className="ml-2 text-[10px] font-bold uppercase text-red-400">banned</span>}
            {store.discover === false && !store.banned && (
              <span className="ml-2 text-[10px] font-bold uppercase text-mist-500">hidden from discover</span>
            )}
          </p>
          <a href={store.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11px] text-mist-500 hover:text-neon-300">
            {store.url}
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <label className="flex items-center gap-1 text-mist-500">
            Trust
            <input
              type="number"
              min={0}
              max={100}
              value={trustDraft}
              onChange={(e) => setTrustDraft(e.target.value)}
              onBlur={commitTrust}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label={`Trust score for ${store.name}`}
              className="w-12 rounded-none border border-ink-500 bg-ink-900 px-1 py-1 text-center text-mist-100 outline-none focus:border-neon-500"
            />
          </label>
          <button
            onClick={() => update({ discover: !(store.discover ?? true) }, `${store.name} ${store.discover === false ? "shown in" : "hidden from"} Discover`)}
            className="rounded-none border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300"
          >
            {store.discover === false ? "Show" : "Hide"}
          </button>
          <button
            onClick={() => update({ banned: !store.banned }, store.banned ? `${store.name} unbanned` : `${store.name} banned`)}
            className="rounded-none border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-amber-400/60 hover:text-amber-300"
          >
            {store.banned ? "Unban" : "Ban"}
          </button>
          <button
            onClick={remove}
            aria-label={`Remove ${store.name}`}
            className="rounded-none border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-red-400/60 hover:text-red-300"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
      {storeTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
          {storeTags.map((t) => (
            <TagChip key={t.id} def={t} active={store.tags?.includes(t.name) ?? false} onClick={() => toggleTag(t.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreManager() {
  const { sb, directory, refreshDirectory, toast } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function setOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk(patch: Record<string, unknown> | "delete", msg: string) {
    if (!sb || selected.size === 0) return;
    const ids = [...selected];
    const q = sb.from("store_directory");
    const { error } =
      patch === "delete" ? await q.delete().in("id", ids) : await q.update(patch).in("id", ids);
    if (error) toast(error.message, "error");
    else {
      toast(`${ids.length} store${ids.length === 1 ? "" : "s"} ${msg}`);
      setSelected(new Set());
      await refreshDirectory();
    }
  }

  const bulkBtn =
    "rounded-none border border-ink-500 px-2.5 py-1 text-[11px] font-medium text-mist-400 transition-colors hover:text-mist-100 disabled:opacity-40";

  return (
    <Section icon={ShieldCheck} title={`Directory (${directory.length})`} blurb="Ban hides a store from everyone. Hide keeps it reachable but out of Discover.">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() =>
            setSelected(selected.size === directory.length ? new Set() : new Set(directory.map((s) => s.id)))
          }
          className={bulkBtn}
        >
          {selected.size === directory.length && directory.length > 0 ? "Deselect all" : "Select all"}
        </button>
        <span className="text-[11px] text-mist-500">{selected.size} selected:</span>
        <button disabled={selected.size === 0} onClick={() => bulk({ discover: true }, "shown in Discover")} className={bulkBtn}>Discover on</button>
        <button disabled={selected.size === 0} onClick={() => bulk({ discover: false }, "hidden from Discover")} className={bulkBtn}>Discover off</button>
        <button disabled={selected.size === 0} onClick={() => bulk({ banned: true }, "banned")} className={bulkBtn}>Ban</button>
        <button disabled={selected.size === 0} onClick={() => bulk({ banned: false }, "unbanned")} className={bulkBtn}>Unban</button>
        <button disabled={selected.size === 0} onClick={() => bulk("delete", "removed")} className={`${bulkBtn} hover:border-red-400/60 hover:text-red-300`}>Remove</button>
      </div>
      {directory.length === 0 ? (
        <p className="rounded-none border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-500">
          Directory is empty — add your first store above.
        </p>
      ) : (
        <div className="space-y-2">
          {directory.map((s) => (
            <StoreRow key={s.id} store={s} selected={selected.has(s.id)} onSelect={(v) => setOne(s.id, v)} />
          ))}
        </div>
      )}
    </Section>
  );
}

interface ReviewRow {
  id: number;
  store_id: string;
  author: string;
  content: string;
  created_at: string;
}

/**
 * Discrub (a Discord export extension) ships an array of message objects —
 * usually `{ content, author: { username } | author: "name", ... }`. This
 * accepts that shape, a flat `{author, content}[]`, or just falls back to
 * treating the whole paste as one review if it isn't recognizable JSON.
 */
function parseImport(text: string): { author: string; content: string }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) {
      const rows: { author: string; content: string }[] = [];
      for (const raw of data) {
        if (typeof raw !== "object" || raw === null) continue;
        const r = raw as Record<string, unknown>;
        const content = typeof r.content === "string" ? r.content : typeof r.message === "string" ? r.message : "";
        if (!content.trim()) continue;
        const authorRaw = r.author;
        const author =
          typeof authorRaw === "string"
            ? authorRaw
            : typeof authorRaw === "object" && authorRaw !== null
              ? ((authorRaw as Record<string, unknown>).username as string | undefined) ??
                ((authorRaw as Record<string, unknown>).name as string | undefined) ??
                "Unknown"
              : "Unknown";
        rows.push({ author, content: content.trim() });
      }
      return rows;
    }
  } catch {
    // not JSON — fall through to plain-text handling
  }
  return [{ author: "Imported", content: trimmed }];
}

function ReviewManager() {
  const { sb, directory, toast } = useStore();
  const [storeId, setStoreId] = useState("");
  const [customStoreId, setCustomStoreId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const effectiveStoreId = (storeId || customStoreId).trim();

  useEffect(() => {
    if (!sb || !effectiveStoreId) {
      setReviews([]);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    sb.from("store_reviews")
      .select("id, store_id, author, content, created_at")
      .eq("store_id", effectiveStoreId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setReviews((data as ReviewRow[] | null) ?? []);
        setLoadedFor(effectiveStoreId);
      });
    return () => {
      cancelled = true;
    };
  }, [sb, effectiveStoreId]);

  async function importText() {
    if (!sb || busy) return;
    if (!effectiveStoreId) {
      toast("Pick or type a store id first", "error");
      return;
    }
    const parsed = parseImport(text);
    if (parsed.length === 0) {
      toast("Nothing to import — paste some text or a Discrub JSON export", "error");
      return;
    }
    setBusy(true);
    const { error } = await sb
      .from("store_reviews")
      .insert(parsed.map((r) => ({ store_id: effectiveStoreId, author: r.author, content: r.content })));
    if (error) {
      toast(error.message, "error");
    } else {
      toast(`Imported ${parsed.length} review${parsed.length === 1 ? "" : "s"} for ${effectiveStoreId}`);
      setText("");
      const { data } = await sb
        .from("store_reviews")
        .select("id, store_id, author, content, created_at")
        .eq("store_id", effectiveStoreId)
        .order("created_at", { ascending: false });
      setReviews((data as ReviewRow[] | null) ?? []);
    }
    setBusy(false);
  }

  async function remove(id: number) {
    if (!sb) return;
    const { error } = await sb.from("store_reviews").delete().eq("id", id);
    if (error) toast(error.message, "error");
    else setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Section
      icon={MessageSquareText}
      title="Store reviews"
      blurb="Sizing/fit notes the AI Advisor reads for its recommendation. Paste raw text or a Discrub JSON export — one message per review row."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass}>
          <option value="">Pick a directory store…</option>
          {directory.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={customStoreId}
          onChange={(e) => setCustomStoreId(e.target.value)}
          placeholder="…or type a store id directly"
          className={`${inputClass} flex-1`}
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'Paste Discord messages, or a Discrub JSON export, e.g.\n[{"author":"user#1234","content":"runs small, sized up and it fit great"}]'}
        className={`${inputClass} mt-2 w-full font-mono text-xs`}
      />
      <button onClick={importText} disabled={busy} className="btn-glow mt-2 rounded-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Importing…" : "Import"}
      </button>

      {loadedFor && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-mist-500">
            {reviews.length} review{reviews.length === 1 ? "" : "s"} for {loadedFor}
          </p>
          {reviews.length > 0 && (
            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 border border-white/5 bg-ink-900/60 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-mist-300">{r.author}</p>
                    <p className="mt-0.5 text-mist-400">{r.content}</p>
                  </div>
                  <button onClick={() => remove(r.id)} aria-label="Delete review" className="shrink-0 text-mist-500 hover:text-red-400">
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function slugForItem(marketplace: string, itemId: string): string {
  return `${marketplace}-${itemId}`;
}

function AddCatalogItem() {
  const { sb, directory, refreshCatalogItems, toast } = useStore();
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState<Category>("hoodie");
  const [storeId, setStoreId] = useState("");
  const [qcCount, setQcCount] = useState(0);
  const [tags, setTags] = useState("");
  const [fitNote, setFitNote] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseLink(link.trim()), [link]);
  const store = directory.find((s) => s.id === storeId);

  async function add() {
    if (!sb || busy) return;
    if (!parsed) {
      toast("Paste a valid Taobao/Weidian/1688/Xianyu item link", "error");
      return;
    }
    if (!title.trim() || !store) {
      toast("Title and store are required", "error");
      return;
    }
    setBusy(true);
    const { error } = await sb.from("catalog_items").insert({
      id: slugForItem(parsed.marketplace, parsed.itemId),
      title: title.trim(),
      marketplace: parsed.marketplace,
      item_id: parsed.itemId,
      price_cny: Math.max(0, price),
      category,
      store_id: store.id,
      store_name: store.name,
      store_trust: store.trust,
      store_hue1: store.hue[0],
      store_hue2: store.hue[1],
      qc_count: Math.max(0, Math.round(qcCount)),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      fit_note: fitNote.trim() || null,
      hue1: store.hue[0],
      hue2: store.hue[1],
    });
    if (error) {
      toast(error.message, "error");
    } else {
      toast(`${title.trim()} added to the catalog`);
      setLink(""); setTitle(""); setPrice(0); setQcCount(0); setTags(""); setFitNote("");
      await refreshCatalogItems();
    }
    setBusy(false);
  }

  return (
    <Section icon={Package} title="Add catalog item" blurb="Paste a marketplace item link — goes straight into Browse/Home/Store pages.">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://weidian.com/item.html?itemID=…"
          className={`${inputClass} sm:col-span-2 font-mono text-xs`}
        />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`${inputClass} sm:col-span-2`} />
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="Price (CNY)"
          className={inputClass}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputClass}>
          {CATALOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={inputClass}>
          <option value="">Pick a directory store…</option>
          {directory.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={qcCount}
          onChange={(e) => setQcCount(Number(e.target.value))}
          placeholder="QC photo count"
          className={inputClass}
        />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated (optional)" className={inputClass} />
        <input value={fitNote} onChange={(e) => setFitNote(e.target.value)} placeholder="Fit note (optional)" className={inputClass} />
      </div>
      {link.trim() && !parsed && (
        <p className="mt-2 text-xs text-amber-400">That doesn't look like a Taobao/Weidian/1688/Xianyu item link.</p>
      )}
      <button onClick={add} disabled={busy} className="btn-glow mt-3 rounded-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Adding…" : "Add item"}
      </button>
    </Section>
  );
}

function CatalogManager() {
  const { sb, catalogItems, refreshCatalogItems, toast } = useStore();

  async function remove(item: CatalogItem) {
    if (!sb) return;
    const { error } = await sb.from("catalog_items").delete().eq("id", item.id);
    if (error) toast(error.message, "error");
    else {
      toast(`${item.title} removed`, "info");
      await refreshCatalogItems();
    }
  }

  return (
    <Section icon={Package} title={`Catalog (${catalogItems.length})`} blurb="Items live for everyone immediately.">
      {catalogItems.length === 0 ? (
        <p className="rounded-none border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-500">
          Catalog is empty — add your first item above.
        </p>
      ) : (
        <div className="space-y-2">
          {catalogItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 rounded-none border border-white/5 bg-ink-900/60 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mist-100">{item.title}</p>
                <p className="truncate text-[11px] text-mist-500">
                  {item.storeName} · ¥{item.priceCny} · {item.category} · {item.qcCount} QC
                </p>
              </div>
              <button
                onClick={() => remove(item)}
                aria-label={`Remove ${item.title}`}
                className="rounded-none border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-red-400/60 hover:text-red-300"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function TagManager() {
  const { sb, tagDefs, refreshTagDefs, toast } = useStore();
  const [kind, setKind] = useState<"store" | "user">("store");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");

  async function create() {
    if (!sb) return;
    const n = name.trim().toLowerCase();
    if (!n) return;
    const { error } = await sb.from("tag_defs").insert({ kind, name: n, color });
    if (error) toast(error.message, "error");
    else {
      toast(`Tag "${n}" created`);
      setName("");
      await refreshTagDefs();
    }
  }

  async function remove(def: TagDef) {
    if (!sb) return;
    const { error } = await sb.from("tag_defs").delete().eq("id", def.id);
    if (error) toast(error.message, "error");
    else {
      toast(`Tag "${def.name}" deleted`, "info");
      await refreshTagDefs();
    }
  }

  return (
    <Section icon={Tags} title="Tags" blurb="Discord-style labels. Store tags decorate directory cards; user tags go on profiles.">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as "store" | "user")} className={inputClass}>
          <option value="store">store</option>
          <option value="user">user</option>
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="tag name" className={`${inputClass} w-36`} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Tag color" className="h-9 w-12 cursor-pointer rounded-none border border-ink-500 bg-ink-900 p-1" />
        <button onClick={create} className="btn-glow rounded-none px-3.5 py-2 text-sm font-semibold text-white">Create</button>
      </div>
      <div className="mt-4 space-y-2">
        {(["store", "user"] as const).map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-1.5">
            <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-mist-500">{k}</span>
            {tagDefs.filter((t) => t.kind === k).map((t) => (
              <span key={t.id} className="group flex items-center gap-1 rounded-none border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: `${t.color}99`, background: `${t.color}1f`, color: t.color }}>
                {t.name}
                <button onClick={() => remove(t)} aria-label={`Delete tag ${t.name}`} className="opacity-50 transition-opacity hover:opacity-100">
                  ×
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

function RefCodeManager() {
  const { sb, agentRefs, refreshAgentRefs, toast } = useStore();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function value(agentId: string): string {
    return draft[agentId] ?? agentRefs[agentId] ?? "";
  }

  async function save() {
    if (!sb || busy) return;
    const rows = ACTIVE_AGENTS.map((a) => ({ agent_id: a.id, code: value(a.id).trim() }));
    setBusy(true);
    const { error } = await sb.from("agent_refs").upsert(rows, { onConflict: "agent_id" });
    if (error) toast(error.message, "error");
    else {
      toast("Referral codes saved — live for everyone");
      setDraft({});
      await refreshAgentRefs();
    }
    setBusy(false);
  }

  return (
    <Section
      icon={BadgeDollarSign}
      title="Site referral codes"
      blurb="Appended to every agent link users open or copy — unless they set their own code in Settings. Full parameter format, e.g. partnercode=FINDTAO."
    >
      <div className="space-y-2">
        {ACTIVE_AGENTS.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-xs text-mist-400">
            <span className="w-24 shrink-0 truncate">{a.name}</span>
            <input
              value={value(a.id)}
              onChange={(e) => setDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
              placeholder="param=code"
              className="min-w-0 flex-1 rounded-none border border-ink-500 bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-mist-100 placeholder-mist-500/60 outline-none transition-colors focus:border-neon-500"
            />
          </label>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="btn-glow mt-3 rounded-none px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save codes"}
      </button>
    </Section>
  );
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  tags: string[];
}

function UserManager() {
  const { sb, tagDefs, toast } = useStore();
  const userTags = tagDefs.filter((t) => t.kind === "user");
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);

  async function load() {
    if (!sb) return;
    const { data, error } = await sb.from("profiles").select("user_id, email, tags").order("created_at");
    if (error) toast(error.message, "error");
    else setProfiles(data as ProfileRow[]);
  }

  async function toggle(p: ProfileRow, tag: string) {
    if (!sb) return;
    const next = p.tags.includes(tag) ? p.tags.filter((t) => t !== tag) : [...p.tags, tag];
    const { error } = await sb.from("profiles").update({ tags: next }).eq("user_id", p.user_id);
    if (error) toast(error.message, "error");
    else {
      toast(`${p.email ?? "user"} → ${next.length ? next.join(", ") : "no tags"}`);
      setProfiles((prev) => prev?.map((x) => (x.user_id === p.user_id ? { ...x, tags: next } : x)) ?? null);
    }
  }

  return (
    <Section icon={Users} title="User roles" blurb="Assign profile tags (beta, admin, owner, …). Admin/owner unlock this panel.">
      {profiles === null ? (
        <button onClick={load} className="rounded-none border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300">
          Load users
        </button>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-mist-500">No signed-up users yet.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.user_id} className="flex flex-wrap items-center gap-2 rounded-none border border-white/5 bg-ink-900/60 px-3 py-2.5">
              <span className="flow-bg flex h-6 w-6 items-center justify-center rounded-none text-[10px] font-bold text-white">
                {(p.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{p.email ?? p.user_id}</span>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map((t) => (
                  <TagChip key={t.id} def={t} active={p.tags.includes(t.name)} onClick={() => toggle(p, t.name)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export default function DevPage() {
  const { hydrated, cloudEnabled, user, isAdmin } = useStore();
  const state = useMemo(() => {
    if (!hydrated) return "loading";
    if (!cloudEnabled) return "no-cloud";
    if (!user) return "signed-out";
    if (!isAdmin) return "forbidden";
    return "ok";
  }, [hydrated, cloudEnabled, user, isAdmin]);

  if (state === "loading") return null;
  if (state !== "ok") {
    return (
      <div className="fade-up mx-auto max-w-md rounded-none border border-dashed border-ink-500 px-6 py-14 text-center">
        <Wrench size={20} aria-hidden="true" className="mx-auto text-mist-500" />
        <p className="mt-3 text-sm text-mist-300">
          {state === "no-cloud"
            ? "The dev panel needs cloud sync configured."
            : state === "signed-out"
              ? "Sign in from Settings — the dev panel is admin-only."
              : "This account doesn't have admin access."}
        </p>
      </div>
    );
  }

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight">
        <Wrench size={24} aria-hidden="true" className="text-neon-300" />
        Dev <span className="flow-text">panel</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Directory, tags, and roles. Changes are live for everyone immediately.
      </p>
      <div className="mt-6 space-y-5">
        <AddStore />
        <BulkAdd />
        <StoreManager />
        <AddCatalogItem />
        <CatalogManager />
        <ReviewManager />
        <RefCodeManager />
        <TagManager />
        <UserManager />
      </div>
    </div>
  );
}
