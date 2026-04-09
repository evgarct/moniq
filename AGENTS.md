<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes ? APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repo Workflow Rules

- When starting a new feature in this repo, first update from the latest remote `main`, then create a fresh feature branch from that current base.
- Before opening a PR in this repo, update the relevant documentation first, then prepare the PR.
- After finishing implementation work, always run the relevant local verification for this repo.
- For wallet, allocation, and other finance-state mutations in this repo, keep invariants in pure domain helpers and cover them with node-level tests. Do not leave critical create/edit/delete rules only inside React component handlers.
- For finance runtime code in this repo, do not import mock wallet or transaction snapshots into app pages or live data hooks. Mocks are only for stories, tests, and isolated fixtures once a domain slice has moved to Supabase.
- For finance analytics in this repo, never aggregate category or cashflow totals across currencies into one number. Keep category trees, summaries, and reports split by wallet/transaction currency.
- For UI work in this repo, do not hand-roll components or interaction patterns when the project UI library or approved component libraries already provide a suitable primitive. Compose from the library first and treat custom UI as the fallback only when no library option fits.
- The primary component library in this repo is `shadcn/ui`. For layout or structural UI changes, use the `shadcn` CLI and existing `components/ui` primitives first. Only build custom UI when the task is explicitly bespoke or the library does not provide the needed pattern.
- For UI work in this repo that touches `shadcn/ui` components, registries, presets, or `components.json`, use the installed `shadcn` skill first.
- In this repo, build UI through the design system by default: reuse theme tokens, `components/ui` primitives, and existing composition patterns before introducing any new layout or visual pattern.
- In this repo, when iterating on stateful UI primitives such as date pickers, popovers, calendars, dropdowns, or sheets, create and maintain an isolated Storybook story that opens directly into the interaction state needed for review. Use that focused story as the primary verification surface before adjusting the screen-level integration.
- In this repo, when fixing visual alignment or spacing issues, inspect the actual box geometry, line-height, and spacing in DevTools before changing classes, and re-check the same elements after the patch. Do not rely on repeated blind 1px nudges without geometry inspection.
- In this repo, when refining sheet-based or row-based forms, make spacing and ordering changes in shared layout wrappers or section structure first. Do not solve rhythm issues by repeatedly overriding control-level text size, radius, hover, or focus styles inside the form file.
- In this repo, when labeling custom controls such as `Select`, `ToggleGroup`, or other non-native widgets inside `components/ui/field`, do not leave a bare `FieldLabel` without a native target. Use `FieldTitle` for section-style labels or wire an explicit accessible association.
- For UI work in this repo, use `chrome-devtools` against the verified local preview when available to inspect live layout, interaction states, console errors, and network behavior before concluding a visual fix is correct. Do not rely only on static screenshots when the issue involves hover, focus, selection, auth redirects, or runtime rendering.
- In this repo, do not sign off a Storybook or UI fix until the touched story/page has been opened in DevTools and checked for console errors introduced by the change, especially hydration warnings, nested interactive elements, and `next-intl` environment fallbacks.
- In this repo, if both browser verification paths (`chrome-devtools` and Playwright/browser backend) are unavailable, stop presenting UI work as visually verified. Call out the browser-tool outage explicitly, switch to code-only verification, and avoid long iterative pixel-tuning until a live browser path is restored.
- In this repo, when a Storybook story renders through a portal-backed primitive such as `Sheet`, `Dialog`, `Popover`, or `DropdownMenu`, do not write `play` assertions that search only inside the story canvas. Target the portalled surface explicitly or omit the `play` check, otherwise Storybook will report false runtime failures against working UI.
- In this repo, when comparing page-level header alignment, spacing, or transition consistency across app screens, Storybook page stories must wrap the view with the same `PageContainer` and route-level layout shell used by the real page. Do not judge cross-page spacing from a raw view story that omits the production page wrapper.
- In this repo, client-side form schemas should treat account, category, allocation, and similar relational IDs as opaque strings unless the exact UUID format is itself the feature under test. Keep strict persistence-format validation in API/domain layers so Storybook fixtures and local mocks do not break UI rendering.
- In this repo, all user-facing copy must go through `next-intl`: keep messages in `messages/{locale}.json`, use `useTranslations`/`getTranslations`, and do not introduce new hardcoded UI text in JSX.
- In this repo, localized navigation must use the wrappers from `@/i18n/navigation` instead of raw `next/link` or `next/navigation` APIs in user-facing route transitions.
- In this repo, when locale routing and auth/session middleware both apply, compose them in the root `proxy.ts` and keep login/dashboard redirects locale-aware. Do not leave a second middleware path that redirects to bare `/login` or `/dashboard`.
- In this repo, if API routes return user-facing error messages to the UI, localize those messages from the request locale instead of returning hardcoded English fallbacks.
- In this repo, when consolidating or removing a user-facing route, keep the old pathname as a redirect to the new canonical route and preserve existing query parameters so deep links and sheet-opening flows keep working.
- In this repo, keep translations in `messages/{locale}.json` grouped by stable namespaces such as `common`, `navigation`, `auth`, `accounts`, `transactions`, and `categories`. Add new copy to an existing namespace when it fits before creating a new top-level group.
- In this repo, translation keys must be stable identifiers like `view.title`, `form.fields.name`, or `common.errors.wallet.create`. Do not use visible text as a translation key.
- In this repo, server components and server helpers must use `getTranslations` or request-scoped translators; client components must use `useTranslations`. Do not bypass `next-intl` with ad-hoc locale conditionals in component code.
- In this repo, when adding pluralized, conditional, or count-based copy, use ICU messages in the locale JSON files instead of assembling grammar in TypeScript.
- In this repo, after editing `messages/{locale}.json`, validate the edited JSON files explicitly before reporting success. Do not assume a small manual patch preserved the namespace structure that `next-intl` expects.
- In this repo, when a new overlay mode or sheet behavior is needed in more than one place, extend the shared `components/ui` primitive instead of forcing it with consumer-side class overrides against an unrelated variant.
- For Supabase schema changes in this repo, prefer the current schema as the source of truth. Do not add backward-compatibility fallbacks for obsolete columns, RPC signatures, or rows unless the user explicitly asks for a migration window; deleting or reshaping old data is acceptable when it keeps the schema clean.
- This repo uses the linked remote Supabase project as the development database. When schema changes are required, apply the repo migrations to the linked remote immediately instead of deferring them to a separate local database flow.
- After completing meaningful work in this repo, invoke the `instruction-retrospective` skill to review execution problems and update durable instructions.
- For this repo, do not reuse an already running `next start` preview after source changes. Rebuild with `npm run build`, restart the preview process, and then verify the reported app URL by HTTP before claiming the local preview is current.
- For this repo, when fresh local app and Storybook links are needed after UI changes, use `npm run preview:live`, which must restart both dev servers in place on the stable URLs `http://localhost:3008` and `http://localhost:6008`. Do not rotate to new preview ports for normal UI work in this repo.
- If the app shows hydration mismatches or old styling after recent edits, treat a stale `.next` build or stale `next start` process as the first debugging target before changing React code.
- If App Router files are moved or renamed in this repo and TypeScript still reports `.next/*/validator` imports for the old paths, clear `.next` before treating it as a code bug.
- In the final response, always include:
  - the PR link, if a PR exists
  - the local app URL, only after verifying it via HTTP
  - the local Storybook URL, only if Storybook exists and has been verified via HTTP
- If a PR does not exist yet, say that explicitly instead of implying one exists.
- If Storybook is not configured yet, say that explicitly instead of implying one exists.
