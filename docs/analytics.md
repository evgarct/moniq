---
name: Product analytics — moniq
description: PostHog product-analytics setup, event conventions, and how this differs from the performance-events pipeline.
type: reference
---

# Product Analytics (PostHog)

Moniq uses [PostHog](https://posthog.com) for product/feature-usage analytics — which features people actually use, how often, and by whom. This is separate from `docs/performance-analytics.md`, which is diagnostic-only (page/API latency) and must never carry finance payload data.

| | PostHog (this doc) | Performance events (`docs/performance-analytics.md`) |
|---|---|---|
| Purpose | Product/feature usage, funnels, retention | Latency/error diagnostics |
| Data | Pageviews, feature events, user/session identity | Route, duration, status — no user identity, no payload |
| Storage | PostHog cloud | `public.performance_events` (Supabase) |

## Setup

1. Create a PostHog project (cloud.posthog.com or self-hosted) and copy its project API key.
2. Set env vars:
   - `NEXT_PUBLIC_POSTHOG_KEY` — the project API key.
   - `NEXT_PUBLIC_POSTHOG_HOST` — defaults to `https://us.i.posthog.com` if unset.
3. Add both to `.env.local` for local development.
4. For production, add them to Vercel:

```text
vercel env add NEXT_PUBLIC_POSTHOG_KEY production
vercel env add NEXT_PUBLIC_POSTHOG_HOST production
```

Then redeploy. If `NEXT_PUBLIC_POSTHOG_KEY` is unset, `initPostHog()` is a no-op and no PostHog network calls are made.

## How it's wired

- `lib/analytics/posthog.ts` exports `initPostHog()`, `capturePageview(route)`, and `trackFeatureEvent(name, props)`.
- `initPostHog()` runs once from `instrumentation-client.ts`, the same file that already reports router-transition performance events. `capture_pageview` autocapture is disabled; `capturePageview` is called manually from the existing `onRouterTransitionStart` hook so there's a single router-transition listener instead of two.
- Feature code should call `trackFeatureEvent(name, props)` for meaningful product actions (e.g. `transaction_created`, `budget_category_expanded`). Event names should match the `postHogEvents` entries declared for that feature in `docs/features/*.json` (see `docs/features/README.md`) so usage can later be joined back to the feature catalog.
- This pass only wires the SDK and pageview capture. Individual feature call sites are added incrementally as normal feature work — instrumenting every feature at once would make this change unreviewable.

## Privacy

- `person_profiles: "identified_only"` — anonymous visitors are not profiled until a user is identified (not yet wired to Supabase auth identity in this pass).
- Do not pass transaction titles, amounts, notes, or other finance payload values as event properties. Feature/action names and coarse metadata (e.g. transaction `kind`, category count) are fine; raw user financial data is not.
