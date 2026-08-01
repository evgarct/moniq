---
name: Feature catalog — moniq
description: JSON feature catalog, its schema, and the future usage-prioritization workflow that depends on PostHog data.
type: reference
---

# Feature Catalog

This directory is a machine-readable catalog of Moniq's product features, one JSON file per domain (matching `features/<domain>` and the relevant `app/[locale]/(app)/*` routes). Each entry conforms to `schema.json`.

- `schema.json` — the JSON Schema every `<domain>.json` file must satisfy.
- `index.json` — lists every domain file, for tooling that wants to enumerate the catalog without globbing.
- `<domain>.json` — one entry per feature domain (accounts, budget, transactions, etc.).

## Current state

Every entry currently has `priority: null` and `postHogEvents: []`. That's expected: PostHog was just installed (see `docs/analytics.md`) and no usage data exists yet, and feature call sites haven't been instrumented with `trackFeatureEvent` calls.

## Future prioritization workflow (not yet executed)

Once PostHog has collected real usage data:

1. Instrument each feature's `keyActions` with `trackFeatureEvent(name, props)` calls (see `lib/analytics/posthog.ts`), using event names that match that feature's `postHogEvents` list.
2. Pull event counts/insights from PostHog for those event names over a representative window.
3. Compute a `priority` score per feature (e.g. normalized event volume, or event volume × distinct-user count) and update each `<domain>.json`'s `priority` field.
4. Sort the catalog by `priority` to get the ranked "top features by usage/importance" slice.
5. That ranked slice is what drives which features get built into the iOS app next (see `docs/ios-swift-reference.md` and `ios/Moniq/Documentation/`) — the iOS skeleton scaffolded in this repo intentionally ships with no feature screens yet, waiting on this ranking.

## Adding or updating an entry

- Keep `id`/`domain` equal to the `features/<name>` folder name where one exists.
- `routes` should be locale-relative App Router paths (e.g. `/budget`), not full URLs.
- `platforms` should include `"ios"` once a feature actually ships in the iOS app — don't add it preemptively.
- Validate against `schema.json` before committing (a small Node/`ajv` check; see the repo's `verify:local` script for where to hook this in if it becomes a recurring need).
