"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

const analyticsEnabled = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const previousUserId = useRef<string | null>(null);

  // Clerk supplies a stable user id. Identifying once when Clerk resolves also
  // restores identity after a page refresh; posthog-js persists it thereafter.
  useEffect(() => {
    if (!analyticsEnabled || !isLoaded) return;

    if (user && previousUserId.current !== user.id) {
      if (previousUserId.current) posthog.reset();
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
        username: user.username ?? undefined,
      });
      previousUserId.current = user.id;
    } else if (!user && previousUserId.current) {
      // Only reset after a known user signs out, never on an initial anonymous load.
      posthog.reset();
      previousUserId.current = null;
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (!analyticsEnabled) return;
    const qs = searchParams?.toString();
    posthog.capture("$pageview", {
      $current_url: window.location.origin + pathname + (qs ? `?${qs}` : ""),
    });
  }, [pathname, searchParams]);

  return null;
}
