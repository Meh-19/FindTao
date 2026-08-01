"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/**
 * PostHog analytics + error capture. Entirely gated on NEXT_PUBLIC_POSTHOG_KEY:
 * with no key (local dev, previews, or if you never set one) this initialises
 * nothing and captures nothing, so it's safe to leave mounted everywhere.
 *
 * Privacy-conscious defaults: honours Do-Not-Track, and only builds a person
 * profile once someone is identified rather than for every anonymous visitor.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export const analyticsEnabled = Boolean(KEY);

let initialised = false;

/** Report a handled/boundary error to PostHog (no-op when analytics is off). */
export function captureError(error: unknown) {
  if (initialised && error instanceof Error) posthog.captureException(error);
}

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY || initialised) return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // captured manually below (App Router has no full page loads)
      capture_exceptions: true, // unhandled errors → PostHog
      autocapture: true,
      person_profiles: "identified_only",
      respect_dnt: true,
    });
    initialised = true;
  }, []);

  useEffect(() => {
    if (!initialised) return;
    const qs = searchParams?.toString();
    posthog.capture("$pageview", {
      $current_url: window.location.origin + pathname + (qs ? `?${qs}` : ""),
    });
  }, [pathname, searchParams]);

  return null;
}
