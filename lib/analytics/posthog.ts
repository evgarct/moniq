"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
  });
  initialized = true;
}

export function capturePageview(route: string) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: route });
}

/**
 * Feature-usage event helper. Event names should match the `postHogEvents`
 * entries in the corresponding `docs/features/*.json` catalog entry.
 */
export function trackFeatureEvent(name: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(name, props);
}
