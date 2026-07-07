"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";

const inputClass =
  "w-full rounded-xl border border-ink-500 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";
const labelClass = "block text-xs font-medium text-mist-400";

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className={`${inputClass} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 transition-colors hover:text-mist-300"
      >
        {show ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function AuthModal() {
  const {
    authOpen, setAuthOpen, cloudEnabled, user,
    signInWithPassword, signInWithEmail, signUp,
  } = useStore();
  const [view, setView] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);

  // Close once sign-in lands (auth listener sets user), and reset to the
  // sign-in view for next time.
  useEffect(() => {
    if (user && authOpen) setAuthOpen(false);
  }, [user, authOpen, setAuthOpen]);

  useEffect(() => {
    if (!authOpen) return;
    setView("signin");
    setPassword("");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAuthOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [authOpen, setAuthOpen]);

  if (!authOpen || !cloudEnabled) return null;

  async function submit() {
    if (busy) return;
    const mail = email.trim();
    if (!mail || !password) return;
    setBusy(true);
    if (view === "signin") {
      await signInWithPassword(mail, password);
    } else {
      const name = username.trim();
      if (!name) {
        setBusy(false);
        return;
      }
      const ok = await signUp(mail, password, name, agentId || undefined);
      if (ok) setAuthOpen(false);
    }
    setBusy(false);
  }

  async function magicLink() {
    const mail = email.trim();
    if (!mail || busy) return;
    setBusy(true);
    await signInWithEmail(mail);
    setBusy(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={view === "signin" ? "Sign in" : "Create account"}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setAuthOpen(false)}
    >
      <div
        className="fade-up w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flow-bg h-0.5" />
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-mist-100">
                {view === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-0.5 text-xs text-mist-500">
                {view === "signin"
                  ? "Sync your hauls, library, and settings across devices."
                  : "Free — your data follows you to any device."}
              </p>
            </div>
            <button
              onClick={() => setAuthOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-mist-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className={labelClass}>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${inputClass} mt-1`}
              />
            </label>

            {view === "signup" && (
              <label className={labelClass}>
                Username
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="what should we call you?"
                  className={`${inputClass} mt-1`}
                />
              </label>
            )}

            <label className={labelClass}>
              Password
              <div className="mt-1">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  autoComplete={view === "signin" ? "current-password" : "new-password"}
                />
              </div>
            </label>

            {view === "signup" && (
              <label className={labelClass}>
                Preferred agent <span className="text-mist-500">(optional)</span>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">No preference yet</option>
                  {ACTIVE_AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-glow w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "One sec…" : view === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {view === "signin" && (
            <button
              onClick={magicLink}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-ink-500 px-4 py-2 text-xs font-medium text-mist-400 transition-colors hover:border-neon-500/60 hover:text-neon-300 disabled:opacity-60"
            >
              Email me a sign-in link instead
            </button>
          )}

          <p className="mt-4 text-center text-xs text-mist-500">
            {view === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={() => setView("signup")} className="font-semibold text-neon-300 hover:text-neon-400">
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setView("signin")} className="font-semibold text-neon-300 hover:text-neon-400">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
