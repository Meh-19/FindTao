"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { Camera, Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useModalA11y } from "@/lib/useModalA11y";

const inputClass =
  "w-full rounded-none border border-ink-500 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500";

/**
 * First-run onboarding, shown once after a user signs in (tracked via Clerk
 * `unsafeMetadata.onboarded`). Collects a public display name + avatar — the
 * only things other users can see. Email, hauls, cart, and measurements are
 * never surfaced here and stay private to the account.
 */
export function Onboarding() {
  const { isLoaded, user } = useUser();
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shownRef = useRef(false);

  // Open once per session when a signed-in user hasn't finished onboarding.
  useEffect(() => {
    if (!isLoaded || !user || shownRef.current) return;
    if (!user.unsafeMetadata?.onboarded) {
      shownRef.current = true;
      setUsername(user.username ?? user.firstName ?? "");
      setPreview(user.hasImage ? user.imageUrl : null);
      setOpen(true);
    }
  }, [isLoaded, user]);

  const containerRef = useModalA11y<HTMLDivElement>(open);

  if (!open || !user) return null;

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Pick an image file", "error");
    if (f.size > 10 * 1024 * 1024) return toast("That image is too large (max 10MB)", "error");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function markDone() {
    await user!.update({ unsafeMetadata: { ...(user!.unsafeMetadata ?? {}), onboarded: true } });
  }

  async function finish() {
    if (busy) return;
    const name = username.trim();
    if (name.length < 2) return toast("Pick a username (2+ characters)", "error");
    setBusy(true);
    try {
      if (file) {
        try {
          await user!.setProfileImage({ file });
        } catch {
          toast("Couldn't upload the photo, but your name is saved", "info");
        }
      }
      // Prefer a real Clerk username; fall back to first name if usernames
      // aren't enabled on the instance (or the name is taken).
      try {
        await user!.update({ username: name });
      } catch {
        try {
          await user!.update({ firstName: name });
        } catch {
          /* keep going — the onboarded flag below still gets set */
        }
      }
      await markDone();
      await user!.reload();
      toast(`You're all set, ${name}!`);
      setOpen(false);
    } catch {
      toast("Couldn't save — try again", "error");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    try {
      await markDone();
      await user!.reload();
    } catch {
      /* non-fatal — it'll just prompt again next session */
    }
    setBusy(false);
    setOpen(false);
  }

  const initial = (username.trim() || user.firstName || "?").slice(0, 1).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your profile"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="fade-up w-full max-w-sm overflow-hidden rounded-none border border-white/10 bg-ink-900 outline-none"
      >
        <div className="flow-bg h-0.5" />
        <div className="p-6">
          <h2 className="text-lg font-bold text-mist-100">Welcome to FindTao</h2>
          <p className="mt-0.5 text-xs text-mist-500">
            Set up how you&apos;ll appear. It&apos;s the only thing other users can see.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload a profile photo"
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-none border border-ink-500"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flow-bg flex h-full w-full items-center justify-center text-xl font-bold text-white">
                  {initial}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={18} className="text-white" aria-hidden="true" />
              </span>
            </button>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-none border border-ink-500 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:border-neon-500/60 hover:text-neon-300"
              >
                Upload photo
              </button>
              <p className="mt-1 text-[10px] text-mist-500">Optional · PNG or JPG</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
          </div>

          <label className="mt-5 block text-xs font-medium text-mist-400">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="what should we call you?"
              className={`${inputClass} mt-1`}
              onKeyDown={(e) => e.key === "Enter" && finish()}
            />
          </label>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-mist-500">
            <ShieldCheck size={13} className="mt-px shrink-0 text-emerald-400/80" aria-hidden="true" />
            Your username and photo are public. Your email, hauls, cart, and measurements stay
            private to you.
          </p>

          <div className="mt-5 flex gap-2">
            <button
              onClick={finish}
              disabled={busy}
              className="btn-glow flex-1 rounded-none px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="mx-auto animate-spin" aria-hidden="true" /> : "Continue"}
            </button>
            <button
              onClick={skip}
              disabled={busy}
              className="rounded-none border border-ink-500 px-4 py-2.5 text-sm font-medium text-mist-400 transition-colors hover:text-mist-200 disabled:opacity-60"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
