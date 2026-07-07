"use client";

import { useState } from "react";
import { CloudUpload, LogOut } from "lucide-react";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { useStore, ACCENTS, type AccentId, type CardSize } from "@/lib/store";

const selectClass =
  "mt-3 w-full rounded-xl border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 outline-none transition-colors focus:border-neon-500";

const CARD_SIZES: { id: CardSize; label: string }[] = [
  { id: "s", label: "Small" },
  { id: "m", label: "Medium" },
  { id: "l", label: "Large" },
];

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="card-pop rounded-2xl border border-white/5 bg-ink-800/80 p-5">
      <p className="text-sm font-semibold text-mist-100">{title}</p>
      <p className="mt-0.5 text-xs text-mist-500">{blurb}</p>
      {children}
    </div>
  );
}

function AccountSection() {
  const { cloudEnabled, user, syncStatus, lastSyncAt, signInWithEmail, signOut, syncNow } = useStore();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  if (!cloudEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-500 p-5">
        <p className="text-sm font-semibold text-mist-300">Account & cloud sync</p>
        <p className="mt-0.5 text-xs text-mist-500">
          Cloud sync isn&apos;t configured on this deployment. Copy{" "}
          <code className="rounded bg-ink-900 px-1">.env.example</code> to{" "}
          <code className="rounded bg-ink-900 px-1">.env.local</code> with your Supabase project
          keys to enable sign-in — until then everything lives in this browser.
        </p>
      </div>
    );
  }

  if (!user) {
    async function send() {
      const trimmed = email.trim();
      if (!trimmed || sending) return;
      setSending(true);
      const ok = await signInWithEmail(trimmed);
      if (ok) setEmail("");
      setSending(false);
    }
    return (
      <div className="card-pop rounded-2xl border border-white/5 bg-ink-800/80 p-5">
        <p className="text-sm font-semibold text-mist-100">Account & cloud sync</p>
        <p className="mt-0.5 text-xs text-mist-500">
          Sign in with a magic link to sync hauls, library, and settings across devices.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-xl border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500"
          />
          <button
            onClick={send}
            disabled={sending}
            className="btn-glow rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send link"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-pop rounded-2xl border border-white/5 bg-ink-800/80 p-5">
      <div className="flex items-center gap-3">
        <span className="flow-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
          {(user.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-mist-100">{user.email}</p>
          <p className="text-xs text-mist-500">
            {syncStatus === "syncing"
              ? "Syncing…"
              : syncStatus === "error"
                ? "Last sync failed — try Sync now"
                : lastSyncAt
                  ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()}`
                  : "Cloud sync on"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={syncNow}
          disabled={syncStatus === "syncing"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CloudUpload size={14} aria-hidden="true" /> Sync now
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-xl border border-ink-500 px-4 py-2 text-sm font-medium text-mist-400 transition-colors hover:border-red-400/40 hover:text-red-300"
        >
          <LogOut size={14} aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { prefs, setPrefs, hauls, ratesLive, hydrated, toast } = useStore();
  if (!hydrated) return null;

  return (
    <div className="fade-up mx-auto max-w-xl">
      <h1 className="text-3xl font-extrabold tracking-tight">
        <span className="flow-text">Settings</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Saved on this device — sign in below to sync across devices.
      </p>

      <div className="mt-6 space-y-5">
        <Section title="Accent color" blurb="Recolors the flowing gradients across the whole app.">
          <div className="mt-3 flex gap-2.5">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const [a, b] = ACCENTS[id];
              const active = prefs.accent === id;
              return (
                <button
                  key={id}
                  onClick={() => { setPrefs({ accent: id }); toast(`Accent set to ${id}`); }}
                  aria-label={`${id} accent`}
                  className={`h-9 w-9 rounded-full transition-all duration-200 ${
                    active ? "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-ink-900" : "hover:scale-105"
                  }`}
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Preferred agent" blurb="Used for the buy button, haul exports, and highlighted in the converter.">
          <select value={prefs.agentId} onChange={(e) => setPrefs({ agentId: e.target.value })} className={selectClass}>
            {ACTIVE_AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Section>

        <Section
          title="Display currency"
          blurb={`Prices stay in ¥ with your currency alongside. Rate source: ${ratesLive ? "live (updates every 12h)" : "fallback table — live fetch unavailable"}.`}
        >
          <select
            value={prefs.currency}
            onChange={(e) => setPrefs({ currency: e.target.value as Currency })}
            className={selectClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Card size" blurb="How dense the search and store grids are.">
          <div className="mt-3 flex gap-2">
            {CARD_SIZES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPrefs({ cardSize: id })}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  prefs.cardSize === id
                    ? "border-neon-500/60 bg-neon-600/20 text-neon-300"
                    : "border-ink-500 text-mist-400 hover:text-mist-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Active haul" blurb="Where cart items go when you hit “Assign to haul”.">
          <select
            value={prefs.activeHaulId}
            onChange={(e) => setPrefs({ activeHaulId: e.target.value })}
            className={selectClass}
          >
            {hauls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.items.length})
              </option>
            ))}
          </select>
        </Section>

        <label className="card-pop flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-ink-800/80 p-5">
          <span>
            <span className="block text-sm font-semibold text-mist-100">Auto-load prices</span>
            <span className="mt-0.5 block text-xs text-mist-500">
              Show prices on cards. Turn off for a cleaner browse.
            </span>
          </span>
          <input
            type="checkbox"
            checked={prefs.autoPrices}
            onChange={(e) => setPrefs({ autoPrices: e.target.checked })}
            className="h-5 w-5 accent-violet-500"
          />
        </label>

        <label className="card-pop flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-ink-800/80 p-5">
          <span>
            <span className="block text-sm font-semibold text-mist-100">One-click hand-off</span>
            <span className="mt-0.5 block text-xs text-mist-500">
              Hide the agent dropdown on items — the buy button always uses your preferred agent.
            </span>
          </span>
          <input
            type="checkbox"
            checked={prefs.oneClick}
            onChange={(e) => setPrefs({ oneClick: e.target.checked })}
            className="h-5 w-5 accent-violet-500"
          />
        </label>

        <AccountSection />

        <p className="text-xs text-mist-500">
          Outbound agent links may include our referral code, which funds the site. It never
          changes your price.
        </p>
      </div>
    </div>
  );
}
