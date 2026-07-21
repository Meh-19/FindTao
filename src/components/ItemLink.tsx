"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { itemHref } from "@/lib/itemLink";
import { useStore, type SavedItem } from "@/lib/store";
import { albumPreviewTarget, useAlbumPreview } from "@/lib/albumPreview";

/**
 * Wraps children in a link to the item's exact product page (see itemHref):
 * an in-app <Link> for catalog items, a new-tab <a> for outbound marketplace
 * urls, or a plain <span> when there's nothing to link to.
 *
 * Album items are special-cased: rather than navigate to the whole store page,
 * clicking one opens it in the shared preview modal in place (from the cart,
 * a haul, or anywhere else).
 */
export function ItemLink({
  item,
  className,
  title,
  onNavigate,
  children,
}: {
  item: Pick<SavedItem, "id" | "storeId" | "url" | "title" | "image">;
  className?: string;
  title?: string;
  /** Fired on click before navigation/preview — e.g. to close the cart drawer. */
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const preview = useAlbumPreview();
  const { allStores } = useStore();
  const previewTarget = preview
    ? albumPreviewTarget(item, (id) => allStores.some((s) => s.id === id))
    : null;
  if (previewTarget && preview) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          preview.openPreview(previewTarget);
        }}
        className={className}
        title={title}
      >
        {children}
      </button>
    );
  }

  const link = itemHref(item);
  if (!link) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    );
  }
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className} title={title}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} onClick={onNavigate} className={className} title={title}>
      {children}
    </Link>
  );
}
