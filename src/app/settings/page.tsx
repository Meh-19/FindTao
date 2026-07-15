"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudUpload, ExternalLink, Globe, Lock, LogOut, Shirt } from "lucide-react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { CopyButton } from "@/components/CopyButton";
import { useStore, ACCENTS, type AccentId, type CardSize } from "@/lib/store";

const selectClass =
  "mt-3 w-full rounded-none border border-ink-500 bg-ink-900 px-3 py-2.5 text-sm text-mist-100 outline-none transition-colors focus:border-neon-500";

const CARD_SIZES: { id: CardSize; label: string }[] = [
  { id: "s", label: "Small" },
  { id: "m", label: "Medium" },
  { id: "l", label: "Large" },
];

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
      <p className="text-sm font-semibold text-mist-100">{title}</p>
      <p className="mt-0.5 text-xs text-mist-500">{blurb}</p>
      {children}
    </div>
  );
}

function AccountSection() {
  const {
    cloudEnabled, user, profileName, syncStatus, lastSyncAt, signOut, syncNow,
    profileTags, tagDefs,
  } = useStore();
  const roleDefs = tagDefs.filter((t) => t.kind === "user" && profileTags.includes(t.name));

  if (!cloudEnabled) {
    return (
      <div className="rounded-none border border-dashed border-ink-500 p-5">
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
    return (
      <div className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
        <p className="text-sm font-semibold text-mist-100">Account & cloud sync</p>
        <p className="mt-0.5 text-xs text-mist-500">
          Sign in to sync hauls, library, and settings across devices.
        </p>
        <div className="mt-3 flex gap-2">
          <SignInButton mode="modal">
            <button className="btn-glow rounded-none px-4 py-2.5 text-sm font-semibold text-white">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-none border border-ink-500 px-4 py-2.5 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300">
              Create account
            </button>
          </SignUpButton>
        </div>
      </div>
    );
  }

  return (
    <div className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
      <div className="flex items-center gap-3">
        <span className="flow-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-none text-sm font-bold text-white">
          {(profileName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold text-mist-100">
            {profileName ?? user.email}
            {roleDefs.map((t) => (
              <span
                key={t.id}
                className="rounded-none border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ borderColor: `${t.color}99`, background: `${t.color}22`, color: t.color }}
              >
                {t.name}
              </span>
            ))}
          </p>
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
          className="flex flex-1 items-center justify-center gap-1.5 rounded-none border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CloudUpload size={14} aria-hidden="true" /> Sync now
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-none border border-ink-500 px-4 py-2 text-sm font-medium text-mist-400 transition-colors hover:border-danger/40 hover:text-danger"
        >
          <LogOut size={14} aria-hidden="true" /> Sign out
        </button>
      </div>

      {/* Email, password, connected accounts, and security are all managed in
          Clerk's account menu. */}
      <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
        <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        <p className="text-xs text-mist-500">
          Manage your email, password, and security in the account menu.
        </p>
      </div>
    </div>
  );
}

function ProfileSection() {
  const {
    cloudEnabled, user, prefs, setProfilePrefs, publishProfile, unpublishProfile, profileName, toast, collection, hydrated,
  } = useStore();
  const [busy, setBusy] = useState(false);
  const profile = prefs.profile;
  const profileUrl =
    profile.handle && typeof window !== "undefined" ? `${window.location.origin}/u/${profile.handle}` : null;

  async function togglePublic(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const url = await publishProfile();
        if (url) toast("Your profile is live");
      } else {
        await unpublishProfile();
        toast("Your profile is now private", "info");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!cloudEnabled || !user) {
    return (
      <div className="rounded-none border border-dashed border-ink-500 p-5">
        <p className="text-sm font-semibold text-mist-300">Public profile</p>
        <p className="mt-0.5 text-xs text-mist-500">
          Sign in to publish a shareable profile with your collection and followed stores. It stays private until you
          turn it on.
        </p>
      </div>
    );
  }

  return (
    <div className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-mist-100">Public profile</p>
          <p className="mt-0.5 text-xs text-mist-500">
            A shareable page at <span className="font-mono text-mist-400">/u/{profile.handle ?? "yourname"}</span> with
            your collection and stores. Off by default.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-mist-400">
          {profile.public ? <Globe size={13} aria-hidden="true" className="text-success" /> : <Lock size={13} aria-hidden="true" />}
          <input
            type="checkbox"
            checked={profile.public}
            disabled={busy}
            onChange={(e) => togglePublic(e.target.checked)}
            className="h-5 w-5 accent-white"
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-mist-400">
          Display name
          <input
            value={profile.displayName}
            onChange={(e) => setProfilePrefs({ displayName: e.target.value })}
            placeholder={profileName ?? "Your name"}
            className="mt-1 w-full rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
          />
        </label>
        <label className="block text-xs text-mist-400">
          Bio
          <textarea
            value={profile.bio}
            onChange={(e) => setProfilePrefs({ bio: e.target.value })}
            rows={2}
            placeholder="A line about your style, sizing, favorite stores…"
            className="mt-1 w-full resize-none rounded-none border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder-mist-500 outline-none focus:border-neon-500"
          />
        </label>

        <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-mist-500">Show on profile</p>
        <label className="flex cursor-pointer items-center justify-between rounded-none border border-white/5 bg-ink-900/60 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-mist-200">
            <Shirt size={14} aria-hidden="true" className="text-mist-500" /> Collection
            <Link href="/collection" className="text-xs text-neon-300 hover:text-neon-400">
              ({collection.length} — manage)
            </Link>
          </span>
          <input
            type="checkbox"
            checked={profile.showCollection}
            onChange={(e) => setProfilePrefs({ showCollection: e.target.checked })}
            className="h-4 w-4 accent-white"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between rounded-none border border-white/5 bg-ink-900/60 px-3 py-2.5">
          <span className="text-sm text-mist-200">Followed stores</span>
          <input
            type="checkbox"
            checked={profile.showStores}
            onChange={(e) => setProfilePrefs({ showStores: e.target.checked })}
            className="h-4 w-4 accent-white"
          />
        </label>
      </div>

      {profile.public && profileUrl && (
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-mist-500">Your profile link</p>
          <p className="mt-1 truncate font-mono text-xs text-mist-300">{profileUrl}</p>
          <div className="mt-2 flex gap-2">
            <CopyButton text={profileUrl} label="Copy link" className="flex-1 py-2" />
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-none border border-ink-500 px-4 py-2 text-sm font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
            >
              <ExternalLink size={14} aria-hidden="true" /> Open
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralSection() {
  const { prefs, setPrefs } = useStore();

  function setCode(agentId: string, code: string) {
    const next = { ...prefs.myRefs };
    if (code.trim()) next[agentId] = code.trim();
    else delete next[agentId];
    setPrefs({ myRefs: next });
  }

  return (
    <div className="card-pop rounded-none border border-white/5 bg-ink-800/80 p-5">
      <p className="text-sm font-semibold text-mist-100">Your referral codes</p>
      <p className="mt-0.5 text-xs text-mist-500">
        Added to agent links you open, copy, or share — earning you the referral instead of the
        site. Paste the full parameter, e.g.{" "}
        <code className="rounded bg-ink-900 px-1">partnercode=YOURCODE</code>. Leave blank to use
        the site default.
      </p>
      <div className="mt-3 space-y-2">
        {ACTIVE_AGENTS.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-xs text-mist-400">
            <span className="w-24 shrink-0 truncate">{a.name}</span>
            <input
              value={prefs.myRefs[a.id] ?? ""}
              onChange={(e) => setCode(a.id, e.target.value)}
              placeholder="param=code"
              className="min-w-0 flex-1 rounded-none border border-ink-500 bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-mist-100 placeholder-mist-500/60 outline-none transition-colors focus:border-neon-500"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { prefs, setPrefs, hauls, ratesLive, hydrated, toast } = useStore();
  if (!hydrated) return null;

  return (
    <div className="fade-up mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        <span className="flow-text">Settings</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Saved on this device — sign in below to sync across devices.
      </p>

      <div className="mt-6 space-y-5">
        <Section title="Theme" blurb="A flat accent color for buttons and highlights — the sharp-border, monochrome base stays the same.">
          <div className="mt-3 flex flex-wrap gap-2.5">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const { label, fg } = ACCENTS[id];
              const active = prefs.accent === id;
              return (
                <button
                  key={id}
                  onClick={() => { setPrefs({ accent: id }); toast(`Theme set to ${label}`); }}
                  aria-label={`${label} theme`}
                  aria-pressed={active}
                  title={label}
                  className={`h-9 w-9 border transition-all duration-150 ${
                    active ? "border-white shadow-hard-sm" : "border-ink-500 hover:border-mist-400"
                  }`}
                  style={{ background: fg }}
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
                className={`flex-1 rounded-none border px-3 py-2 text-sm font-medium transition-colors ${
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

        <label className="card-pop flex cursor-pointer items-center justify-between rounded-none border border-white/5 bg-ink-800/80 p-5">
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
            className="h-5 w-5 accent-white"
          />
        </label>

        <label className="card-pop flex cursor-pointer items-center justify-between rounded-none border border-white/5 bg-ink-800/80 p-5">
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
            className="h-5 w-5 accent-white"
          />
        </label>

        <AccountSection />

        <ProfileSection />

        <ReferralSection />

        <p className="text-xs text-mist-500">
          Outbound agent links may include our referral code, which funds the site. It never
          changes your price.
        </p>
      </div>
    </div>
  );
}
