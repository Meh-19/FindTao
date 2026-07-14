"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { itemHref } from "@/lib/itemLink";
import type { SavedItem } from "@/lib/store";

/**
 * Wraps children in a link to the item's exact product page (see itemHref):
 * an in-app <Link> for album/catalog items, a new-tab <a> for outbound
 * marketplace urls, or a plain <span> when there's nothing to link to.
 */
export function ItemLink({
  item,
  className,
  title,
  onNavigate,
  children,
}: {
  item: Pick<SavedItem, "id" | "storeId" | "url">;
  className?: string;
  title?: string;
  /** Fired on click before navigation — e.g. to close the cart drawer. */
  onNavigate?: () => void;
  children: ReactNode;
}) {
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
