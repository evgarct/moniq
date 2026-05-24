# Localization Audit

Date: 2026-05-24

Scope: `app`, `features`, `components`, and `stories` TypeScript/TSX files. The scan looked for JSX text, visible JSX attributes, object fields commonly used as labels/messages, and JSON API error strings. It excludes import paths, class names, route paths, enum values, technical MIME strings, and generated/build output.

## Production UI Violations

These are user-visible strings in runtime UI code that are not read through `next-intl`.

Status: fixed in `features/goals/components/goal-form-sheet.tsx` and `features/goals/components/goals-panel.tsx`. The strings now live under `accounts.goals.*` in `messages/{locale}.json`.

| File | Line | Text |
| --- | ---: | --- |
| `features/goals/components/goal-form-sheet.tsx` | 20 | `Goal name is required.` |
| `features/goals/components/goal-form-sheet.tsx` | 22 | `Amount cannot be negative.` |
| `features/goals/components/goal-form-sheet.tsx` | 23 | `Target must be greater than 0.` |
| `features/goals/components/goal-form-sheet.tsx` | 26 | `Target amount is required.` |
| `features/goals/components/goal-form-sheet.tsx` | 71 | `Add goal` |
| `features/goals/components/goal-form-sheet.tsx` | 71 | `Edit goal` |
| `features/goals/components/goal-form-sheet.tsx` | 84 | `Name` |
| `features/goals/components/goal-form-sheet.tsx` | 86 | `e.g. Rent, Vacation, Emergency fund` |
| `features/goals/components/goal-form-sheet.tsx` | 94 | `Type` |
| `features/goals/components/goal-form-sheet.tsx` | 110 | `Open` |
| `features/goals/components/goal-form-sheet.tsx` | 111 | `No target amount` |
| `features/goals/components/goal-form-sheet.tsx` | 122 | `With target` |
| `features/goals/components/goal-form-sheet.tsx` | 123 | `Track progress` |
| `features/goals/components/goal-form-sheet.tsx` | 132 | `Current amount` |
| `features/goals/components/goal-form-sheet.tsx` | 151 | `Target amount` |
| `features/goals/components/goal-form-sheet.tsx` | 170 | `Add goal` |
| `features/goals/components/goal-form-sheet.tsx` | 170 | `Save changes` |
| `features/goals/components/goals-panel.tsx` | 41 | `Goals` |
| `features/goals/components/goals-panel.tsx` | 51 | `Add goal` |
| `features/goals/components/goals-panel.tsx` | 62 | `Free` |
| `features/goals/components/goals-panel.tsx` | 66 | `over` |
| `features/goals/components/goals-panel.tsx` | 113 | `Edit ${allocation.name}` |
| `features/goals/components/goals-panel.tsx` | 127 | `Delete ${allocation.name}` |

## Production API And MCP Text

These strings are returned to clients or exposed as MCP tool/schema descriptions. Some OAuth error codes are protocol constants and should remain stable, but human-readable descriptions and JSON error messages should either use localization keys or be explicitly documented as protocol-only copy.

Status: fixed for user/client-facing JSON errors and OAuth consent copy. The remaining MCP tool `title` and `description` fields in `app/api/mcp/route.ts` are protocol metadata for LLM tool selection, not app UI copy; keep them stable unless the MCP client explicitly supports localized tool metadata.

| File | Line | Text |
| --- | ---: | --- |
| `app/api/mcp/api-keys/route.ts` | 36 | `Invalid JSON` |
| `app/api/mcp/batches/[batchId]/items/[itemId]/route.ts` | 37 | `Batch not found` |
| `app/api/mcp/batches/[batchId]/items/[itemId]/route.ts` | 41 | `Batch has already been reviewed` |
| `app/api/mcp/batches/[batchId]/items/[itemId]/route.ts` | 48 | `Invalid JSON` |
| `app/api/mcp/batches/[batchId]/route.ts` | 46 | `Batch not found` |
| `app/api/mcp/batches/[batchId]/route.ts` | 69 | `Invalid JSON` |
| `app/api/mcp/batches/[batchId]/route.ts` | 74 | `action must be 'approve' or 'reject'` |
| `app/api/mcp/batches/[batchId]/route.ts` | 86 | `Batch not found` |
| `app/api/mcp/batches/[batchId]/route.ts` | 90 | `Batch has already been reviewed` |
| `app/api/mcp/oauth/authorize/route.ts` | 102 | `Missing required parameters` |
| `app/api/mcp/oauth/authorize/route.ts` | 109 | `Only 'code' is supported` |
| `app/api/mcp/oauth/authorize/route.ts` | 116 | `Only S256 code_challenge_method is supported` |
| `app/api/mcp/oauth/authorize/route.ts` | 128 | `Unknown client_id` |
| `app/api/mcp/oauth/authorize/route.ts` | 135 | `redirect_uri not allowed for this client` |
| `app/api/mcp/oauth/register/route.ts` | 20 | `Invalid JSON body` |
| `app/api/mcp/oauth/register/route.ts` | 30 | `redirect_uris must be a non-empty array` |
| `app/api/mcp/oauth/register/route.ts` | 38 | `redirect_uris must contain strings` |
| `app/api/mcp/oauth/register/route.ts` | 64 | `Failed to register client` |
| `app/api/mcp/oauth/token/route.ts` | 37 | `Invalid JSON body` |
| `app/api/mcp/oauth/token/route.ts` | 57 | `Missing required parameters` |
| `app/api/mcp/oauth/token/route.ts` | 72 | `Code is invalid, expired, or already used` |
| `app/api/mcp/oauth/token/route.ts` | 86 | `client_id mismatch` |
| `app/api/mcp/oauth/token/route.ts` | 93 | `redirect_uri mismatch` |
| `app/api/mcp/oauth/token/route.ts` | 102 | `PKCE verification failed` |
| `app/api/mcp/oauth/token/route.ts` | 121 | `Failed to create access token` |
| `app/api/performance/events/route.ts` | 12 | `Invalid performance event payload.` |
| `app/api/performance/summary/route.ts` | 17 | `Performance summary is disabled.` |
| `app/api/performance/summary/route.ts` | 30 | `Performance analytics storage is not configured.` |
| `app/api/performance/summary/route.ts` | 47 | `Unable to load performance summary.` |

`app/api/mcp/route.ts` also contains MCP tool titles and descriptions. These are not JSX UI, but they are human-readable and externally visible:

- Tool and schema copy around lines 249-738, including titles such as `Get Moniq finance context`, `Create Moniq transactions`, `Recurring transaction`, `Destination amount`, `From wallet`, and their descriptions.
- Validation/result messages were moved under the `mcp.errors.*` and `mcp.success.*` namespaces.

## Storybook And Fixtures

Storybook contains many hardcoded visible strings in stories and foundation documentation. This includes titles, headings, examples, labels, demo merchant names, and story names under `stories/**` and `*.stories.tsx`. They are not runtime app UI, but they are still visible product/design copy. Under the stricter rule, new Storybook-visible copy should either use existing localized components/fixtures or be explicitly marked as design documentation/demo-only data.

## Rule Going Forward

All new user-visible text must be introduced as localization keys first, then consumed through `useTranslations` or `getTranslations`. This includes JSX text, `aria-label`, `title`, `placeholder`, form validation messages, toast/status copy, metadata, empty states, API errors surfaced to users, and Storybook-visible component copy.
