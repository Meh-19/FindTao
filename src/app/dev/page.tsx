"use client";

import { useMemo, useState } from "react";
import { BadgeDollarSign, Globe, Plus, ShieldCheck, Tags, Trash2, Users, Wrench } from "lucide-react";
import { STORE_CATEGORIES, type StoreCategory, type StoreInfo } from "@/data/stores";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { useStore, type TagDef } from "@/lib/store";

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

/** "https://unionkingdom.x.yupoo.com" → "unionkingdom" */
function yupooName(url: string): string | null {
  const m = url.match(/^(?:https?:\/\/)?([a-z0-9-]+)\.x\.yupoo\.com/i);
  return m ? m[1] : null;
}

const inputClass =
  "rounded-xl border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

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
      className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
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
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-5">
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
  const [busy, setBusy] = useState(false);

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
      discover,
    });
    if (error) {
      toast(error.message, "error");
    } else {
      toast(`${n} added to the directory`);
      setName(""); setUrl(""); setBlurb(""); setTags([]);
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
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STORE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))}
            aria-pressed={cats.includes(c)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
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
      <div className="mt-3 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-mist-300">
          <input type="checkbox" checked={discover} onChange={(e) => setDiscover(e.target.checked)} className="accent-violet-500" />
          Show in Discover
        </label>
        <button onClick={add} disabled={busy} className="btn-glow ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
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
      <button onClick={run} disabled={busy} className="btn-glow mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
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

  async function update(patch: Record<string, unknown>, msg: string) {
    if (!sb) return;
    const { error } = await sb.from("store_directory").update(patch).eq("id", store.id);
    if (error) toast(error.message, "error");
    else {
      toast(msg);
      await refreshDirectory();
    }
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
    <div className={`rounded-xl border p-3 ${store.banned ? "border-red-400/30 bg-red-400/5" : "border-white/5 bg-ink-900/60"}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${store.name}`}
          className="accent-violet-500"
        />
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${store.hue[0]}, ${store.hue[1]})` }}
        >
          {store.name.slice(0, 2).toUpperCase()}
        </span>
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
          <button
            onClick={() => update({ discover: !(store.discover ?? true) }, `${store.name} ${store.discover === false ? "shown in" : "hidden from"} Discover`)}
            className="rounded-lg border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300"
          >
            {store.discover === false ? "Show" : "Hide"}
          </button>
          <button
            onClick={() => update({ banned: !store.banned }, store.banned ? `${store.name} unbanned` : `${store.name} banned`)}
            className="rounded-lg border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-amber-400/60 hover:text-amber-300"
          >
            {store.banned ? "Unban" : "Ban"}
          </button>
          <button
            onClick={remove}
            aria-label={`Remove ${store.name}`}
            className="rounded-lg border border-ink-500 px-2 py-1 text-mist-400 transition-colors hover:border-red-400/60 hover:text-red-300"
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
    "rounded-lg border border-ink-500 px-2.5 py-1 text-[11px] font-medium text-mist-400 transition-colors hover:text-mist-100 disabled:opacity-40";

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
        <p className="rounded-xl border border-dashed border-ink-500 px-4 py-8 text-center text-sm text-mist-500">
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
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Tag color" className="h-9 w-12 cursor-pointer rounded-lg border border-ink-500 bg-ink-900 p-1" />
        <button onClick={create} className="btn-glow rounded-xl px-3.5 py-2 text-sm font-semibold text-white">Create</button>
      </div>
      <div className="mt-4 space-y-2">
        {(["store", "user"] as const).map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-1.5">
            <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-mist-500">{k}</span>
            {tagDefs.filter((t) => t.kind === k).map((t) => (
              <span key={t.id} className="group flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: `${t.color}99`, background: `${t.color}1f`, color: t.color }}>
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
              className="min-w-0 flex-1 rounded-lg border border-ink-500 bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-mist-100 placeholder-mist-500/60 outline-none transition-colors focus:border-neon-500"
            />
          </label>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="btn-glow mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
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
        <button onClick={load} className="rounded-xl border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300">
          Load users
        </button>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-mist-500">No signed-up users yet.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.user_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-ink-900/60 px-3 py-2.5">
              <span className="flow-bg flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white">
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
      <div className="fade-up mx-auto max-w-md rounded-2xl border border-dashed border-ink-500 px-6 py-14 text-center">
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
        <RefCodeManager />
        <TagManager />
        <UserManager />
      </div>
    </div>
  );
}
