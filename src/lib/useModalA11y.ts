"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility behavior, used by every dialog/lightbox in the
 * app (AlbumModal, Lightbox, AuthModal, QcModal, CartPanel): while `active`,
 * this locks background scroll, traps Tab/Shift+Tab focus cycling inside
 * the returned container, moves focus into the modal on open, and restores
 * focus to whatever was focused before it opened once it closes.
 *
 * Attach the returned ref to the modal's outer container element.
 */
export function useModalA11y<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusable(): HTMLElement[] {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
    }

    // Move focus into the modal — the first focusable control if there is
    // one, otherwise the container itself (which needs tabIndex={-1} on the
    // element the ref is attached to for this to be a valid focus target).
    const items = focusable();
    (items[0] ?? containerRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
