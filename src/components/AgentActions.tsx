"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { ParsedLink } from "@/lib/links";
import { toAgentUrl } from "@/lib/links";
import { ACTIVE_AGENTS, getAgent, DEFAULT_AGENT_ID } from "@/lib/agents";
import { useStore } from "@/lib/store";
import { CopyButton } from "./CopyButton";

export function AgentActions({ link, dropUp = false }: { link: ParsedLink; dropUp?: boolean }) {
  const { prefs, applyRef } = useStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const preferred = getAgent(prefs.agentId) ?? getAgent(DEFAULT_AGENT_ID)!;
  const preferredUrl = applyRef(toAgentUrl(link, preferred), preferred.id);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex gap-2">
        <a
          href={preferredUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-glow flex flex-1 items-center justify-center gap-1.5 rounded-none px-4 py-2.5 text-center text-sm font-semibold text-white"
        >
          Buy on {preferred.name} <ExternalLink size={13} aria-hidden="true" />
        </a>
        {!prefs.oneClick && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Choose another agent"
            aria-expanded={open}
            className="rounded-none border border-ink-500 px-3 text-mist-300 transition-colors hover:border-neon-500/60 hover:bg-neon-600/10 hover:text-neon-300"
          >
            <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && (
        <div
          className={`fade-up absolute right-0 z-10 max-h-72 w-64 overflow-y-auto rounded-none border border-ink-500 bg-ink-700 shadow-hard ${
            dropUp ? "bottom-full mb-2" : "mt-2"
          }`}
        >
          {ACTIVE_AGENTS.map((agent) => {
            const url = applyRef(toAgentUrl(link, agent), agent.id);
            if (!url) return null;
            return (
              <a
                key={agent.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-2.5 text-sm text-mist-300 transition-colors hover:bg-neon-600/15 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <span>{agent.name}</span>
                {agent.id === preferred.id && (
                  <span className="text-xs font-medium text-neon-300">preferred</span>
                )}
              </a>
            );
          })}
          <div className="flex gap-2 border-t border-white/5 px-3 py-2.5">
            {preferredUrl && <CopyButton text={preferredUrl} label="Copy agent link" />}
            <CopyButton text={link.rawUrl} label="Copy raw link" />
          </div>
        </div>
      )}
    </div>
  );
}
