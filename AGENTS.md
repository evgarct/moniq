<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes ? APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI Design System

The canonical UI reference is `stories/foundations/ui-playbook.stories.tsx`. Read it before building any new screen. The Balance page (`Pages/Balance` in Storybook) is the gold standard of the full system in action.

## No cards. No chips. Ever.

This is the single most important visual rule in Moniq. It applies to every new page without exception — including settings screens, inbox views, and admin-style pages. There is no "this is a settings page so cards are fine" exemption.

**No card-per-item layout.** Do not wrap individual list items, transactions, accounts, or categories in their own bordered/shadowed card. Items live as rows inside a shared Surface. A card is for a major content region — not for a repeating data unit.

**No chips or pills for metadata.** Do not render category names, account types, statuses, or tags as `<Badge>`, pill, or rounded chip elements. Show this information as plain `type-body-12` text (muted) next to or below the primary label. If a status must be visually distinct, use color on the text only — not a filled or bordered container.

**No icon badges.** All icons in this app — account type icons, category icons, status icons — must be raw inline outline marks rendered directly via `CategoryIcon` or a Lucide component. Never wrap any icon in a colored circle, square, rounded container, or chip background, regardless of context (tiles, rows, panels, grids).

Wrong: every transaction row is its own rounded card with border and shadow.
Wrong: category shown as `<span class="bg-blue-100 text-blue-700 rounded-full px-2">Food</span>`.
Wrong: account type shown as a filled pill "CASH" or "CREDIT".
Right: a flat row with icon + label + muted sub-text + right-aligned amount.
Right: category shown as plain muted text below the transaction title.

## Core visual identity
- **Warm neutrals carry everything.** Use `bg-background` (#fafaf7), `bg-card` (#f0f0eb), `bg-secondary` (#e5e4df). Avoid bright brand color fills on surfaces.
- **The `Surface` component** is the only approved container primitive. Three tones: `canvas` (base workspace), `panel` (primary work area, default), `floating` (tools, popovers). Never replicate its styles inline.
- **Typography**: Use the four heading classes (`type-h1`–`type-h4` for serif editorial, `type-h5`–`type-h6` for UI), `type-body-14`, `type-body-12`. Do not use arbitrary font sizes like `text-[15px]`.
- **Radius**: Always use `radius-tight` / `radius-control` / `radius-surface` / `radius-floating`. Do not write `rounded-2xl`, `rounded-3xl`, or any arbitrary `rounded-[Xpx]` value outside the Surface component.
- **Shadows**: Only the Surface component introduces shadow. Do not add `shadow-*` or `box-shadow` values on other elements.

## Building a new screen
1. Wrap the page content in the inner content area — no new shell wrappers.
2. Open with a `Surface tone="panel" padding="lg"` containing the section header: eyebrow (ALL-CAPS 12px tracked) + `type-h2` heading + optional `type-body-14` subtext.
3. Use `gap-6` or `gap-8` between top-level Surface blocks. Use `gap-4`–`gap-5` inside a Surface. Use `gap-1`–`gap-3` between rows.
4. For any screen listing items with a detail/register view, use the two-panel grid: `grid-cols-[280px_minmax(0,1fr)]`. Left = inventory, right = register/detail.
5. Every list or register needs an `EmptyState` component.

## Rows and lists
- Row hover: `hover:bg-secondary/50`. Never use border-based hover states.
- Account/category icons: Lucide outline icons at `h-[18px] w-[18px]` with `strokeWidth={1.75}` and `text-muted-foreground`. No filled icons, no bordered chips.
- Amounts: always use `MoneyAmount`. Use `tabular-nums` class. Hero balances: `text-[32px] font-semibold`. Row amounts: `text-sm font-medium tabular-nums`.
- Do not repeat group context (type label, currency label) inside the row if the group heading already provides it.

## Buttons and actions
- Primary action: default `Button` (black fill). One per surface.
- Secondary: `Button variant="outline"`. Escape/cancel paths only.
- Ghost: `Button variant="ghost"`. In-row or low-emphasis actions.
- Never use bright colors (`bg-blue-*`, `bg-indigo-*`, etc.) for buttons. Use the token system.
- Icon-only buttons require `aria-label` and a Tooltip.

## Colors for data
- Do not use Tailwind semantic colors (blue, green, indigo) for income/expense or category highlights.
- Use `chart-1` (#cc785c) through `chart-5` (#40403e) for data visualization.
- Use `text-destructive` for negative/expense amounts and error states.

## Full-bleed page views
- Pages that fill the entire `main` area (Budget, Balance, Calendar) must NOT wrap their content in `Surface` — that creates a visible card box around the whole page. Use raw `<div>` or `<section>` elements directly on the background, exactly as `AccountsView` does.
- Pages that own a full-height layout (viewport-fitting with internal section scrolls) must NOT use `PageContainer` — render the view directly from the route `page.tsx` so the view controls its own padding and `h-full` structure. `PageContainer` is only for simple padded-scroll pages.

## Storybook
- Every new screen or stateful component gets a story in `stories/pages/` or `features/**/components/`.
- Foundation stories in `stories/foundations/` are reference only — do not modify them to fix UI bugs. Fix the component.
- Story `play` functions must not query inside portalled content (Sheet, Dialog, Popover) from the root canvas.
- Storybook stories for full-height page views must use `<div className="h-screen">` (no padding) as the wrapper so the viewport-fitting layout renders correctly in the canvas.

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
- For UI work in this repo, use `chrome-devtools` against the verified local preview when available to inspect live layout, interaction states, console errors, and network behavior before concluding a visual fix is correct. Do not rely only on static screenshots when the issue involves hover, focus, selection, auth redirects, or runtime rendering. For screenshots specifically, always prefer `mcp__chrome-devtools__take_screenshot` (instant, no access grant needed) over `mcp__computer-use__screenshot`. If devtools MCP returns "already running", try calling the tool anyway — it often works despite the error; if it returns a black screen, call `navigate_page` first.
- In this repo, do not sign off a Storybook or UI fix until the touched story/page has been opened in DevTools and checked for console errors introduced by the change, especially hydration warnings, nested interactive elements, and `next-intl` environment fallbacks.
- In this repo, if both browser verification paths (`chrome-devtools` and Playwright/browser backend) are unavailable, stop presenting UI work as visually verified. Call out the browser-tool outage explicitly, switch to code-only verification, and avoid long iterative pixel-tuning until a live browser path is restored.
- In this repo, when a Storybook story renders through a portal-backed primitive such as `Sheet`, `Dialog`, `Popover`, or `DropdownMenu`, do not write `play` assertions that search only inside the story canvas. Target the portalled surface explicitly or omit the `play` check, otherwise Storybook will report false runtime failures against working UI.
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
- In this repo, after adding new top-level namespaces or navigation keys to `messages/en.json`, also update `messages/en.d.json.ts` with the same additions — TypeScript reads the `.d.json.ts` declaration file, not the JSON directly, so new keys are invisible to the type checker until the declaration is updated.
- When a feature needs to display the app's own public URL (MCP config snippets, OAuth callback URIs, webhook setup instructions), read it from `process.env.NEXT_PUBLIC_APP_URL` — never hardcode a placeholder like `your-domain`. The env var is set in `.env.local` and Vercel.
- In this repo, when a new overlay mode or sheet behavior is needed in more than one place, extend the shared `components/ui` primitive instead of forcing it with consumer-side class overrides against an unrelated variant.
- For Supabase schema changes in this repo, prefer the current schema as the source of truth. Do not add backward-compatibility fallbacks for obsolete columns, RPC signatures, or rows unless the user explicitly asks for a migration window; deleting or reshaping old data is acceptable when it keeps the schema clean.
- This repo uses the linked remote Supabase project as the development database. When schema changes are required, apply the repo migrations to the linked remote immediately instead of deferring them to a separate local database flow.
- In a fresh worktree of this repo, do not assume Supabase link metadata exists just because another sibling checkout is linked. Before running `npx supabase db push`, verify `supabase/.temp/project-ref` exists in that exact worktree, or re-link/copy the metadata first.
- After completing meaningful work in this repo, invoke the `instruction-retrospective` skill to review execution problems and update durable instructions.
- For this repo, do not reuse an already running `next start` preview after source changes. Rebuild with `npm run build`, restart the preview process, and then verify the reported app URL by HTTP before claiming the local preview is current.
- For this repo, when fresh local app and Storybook links are needed after UI changes, use `npm run preview:live`, which must restart both dev servers in place on the stable URLs `http://localhost:3008` and `http://localhost:6008`. Do not rotate to new preview ports for normal UI work in this repo.
- In this repo, the app shell sets `body` and `main` to `overflow-hidden`. Every scrollable page view must add `overflow-y-auto` to its own outermost container (the root element returned by the page or top-level view component). Do not rely on the shell to scroll; do not set `h-full` without a matching `overflow-y-auto` on the same element.
- In this repo, `proxy.ts` must export the middleware handler as a named `proxy` export in addition to default: `export async function proxy(...)` + `export default proxy`. Turbopack's middleware template resolves `mod.proxy` for proxy files; a default-only export causes a silent `adapterFn is not a function` error on every request.
- If the app shows hydration mismatches or old styling after recent edits, treat a stale `.next` build or stale `next start` process as the first debugging target before changing React code.
- If App Router files are moved or renamed in this repo and TypeScript still reports `.next/*/validator` imports for the old paths, clear `.next` before treating it as a code bug.
- In the final response, always include:
  - the PR link, if a PR exists
  - the local app URL, only after verifying it via HTTP
  - the local Storybook URL, only if Storybook exists and has been verified via HTTP
- If a PR does not exist yet, say that explicitly instead of implying one exists.
- If Storybook is not configured yet, say that explicitly instead of implying one exists.

# Windows Environment

- Do not attempt `npm install -g supabase` — the Supabase CLI rejects global npm installs. On Windows, download the binary from GitHub releases, extract with `tar -xzf`, and move `supabase.exe` to `C:\Users\PC\bin\` which is already in PATH.
- The `claude` CLI is not on the bash PATH. Its full path is `C:\Users\PC\AppData\Roaming\Claude\claude-code\2.1.101\claude.exe`. Use this path or invoke via PowerShell when running `claude` commands in scripts.
- `supabase login` requires a TTY and will fail in non-interactive shells. Always use `supabase login --token <token>` or set `SUPABASE_ACCESS_TOKEN` env var. The login token is the personal access token from supabase.com/dashboard/account/tokens — it is different from the project anon key.
- Running `npm run dev` or `npm run storybook` with `&` in Git Bash does not keep the process alive after the shell exits. Use `start cmd /k "npm run ..."` to open a persistent terminal window, or run with `run_in_background: true` and read the output file.
- On this machine, git user identity is `evgarct <evgarct@gmail.com>`. If `git commit` fails with "Author identity unknown", run `git config user.email evgarct@gmail.com && git config user.name evgarct` before retrying.
- Storybook picks the next available port if 6008 is occupied. When reporting the Storybook URL, read the actual port from startup output rather than assuming 6008.
