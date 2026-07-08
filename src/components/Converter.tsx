"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Link2 } from "lucide-react";
import { isShortLink, parseLink, toAgentUrl } from "@/lib/links";
import { ACTIVE_AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";
import { CopyButton } from "./CopyButton";

const MARKETPLACE_LABEL = { taobao: "Taobao", weidian: "Weidian", "1688": "1688", xianyu: "Xianyu" } as const;

export function Converter() {
  const initial = useSearchParams().get("link") ?? "";
  const [input, setInput] = useState(initial);
  const { prefs, applyRef } = useStore();

  const trimmed = input.trim();
  const parsed = useMemo(() => parseLink(trimmed), [trimmed]);
  const shortLink = useMemo(() => isShortLink(trimmed), [trimmed]);

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <span className="inline-flex items-center gap-1.5 rounded-none border border-neon-500/30 bg-neon-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-neon-300">
        <Link2 size={12} aria-hidden="true" /> Any link in · every agent out
      </span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
        Link <span className="flow-text">converter</span>
      </h1>
      <p className="mt-1 text-sm text-mist-400">
        Paste a Taobao, Tmall, Weidian, 1688, or agent link — get every agent's version of it.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="https://item.taobao.com/item.htm?id=675330292891"
        className="mt-5 w-full rounded-none border border-ink-500 bg-ink-800/80 px-4 py-3 font-mono text-sm text-mist-100 placeholder-mist-500 outline-none transition-colors focus:border-neon-500"
      />

      {trimmed.length > 0 && !parsed && (
        <div className="fade-up mt-3 rounded-none border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          {shortLink
            ? "That's a shortened link (tb.cn / youshop10). Open it in a browser first, then paste the full product URL it redirects to."
            : "Couldn't find a product ID in that link. Paste a full product page URL from Taobao, Tmall, Weidian, 1688, or a supported agent."}
        </div>
      )}

      {parsed && (
        <div className="fade-up mt-5">
          <div className="rounded-none border border-white/5 bg-ink-800/80 px-4 py-3 text-sm">
            <span className="font-semibold text-mist-100">
              {MARKETPLACE_LABEL[parsed.marketplace]}
            </span>{" "}
            <span className="text-mist-400">
              · item <span className="font-mono">{parsed.itemId}</span>
            </span>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-none bg-ink-950/80 px-2 py-1.5 text-xs text-mist-300">
                {parsed.rawUrl}
              </code>
              <CopyButton text={parsed.rawUrl} label="Copy raw" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {ACTIVE_AGENTS.map((agent, i) => {
              const url = applyRef(toAgentUrl(parsed, agent), agent.id);
              if (!url) return null;
              const preferred = agent.id === prefs.agentId;
              return (
                <div
                  key={agent.id}
                  className={`card-pop fade-up flex items-center gap-3 rounded-none border px-4 py-3 ${
                    preferred
                      ? "border-neon-500/50 bg-neon-600/10"
                      : "border-white/5 bg-ink-800/80"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-mist-100">
                      {agent.name}
                      {preferred && (
                        <span className="ml-2 text-xs font-medium text-neon-300">preferred</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-mist-500">{url}</p>
                  </div>
                  <CopyButton text={url} />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-glow flex items-center gap-1 rounded-none px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Open <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
