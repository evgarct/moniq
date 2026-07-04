# Storybook

Storybook is the review surface for Moniq UI work.

## Purpose

- show the full UI structure outside the app runtime
- review components from small primitives up to route-level pages
- keep visual work testable with story-attached checks

## Atomic Structure

- `Foundations`
  - `DesignLanguage`
  - `UIPlaybook`
  - `Typography`
  - `RadiusSystem`
  - `VisualTokens`
  - `BalancePanelPatterns`
- `Atoms`
  - `MoneyAmount`
  - `Surface`
- `Molecules`
  - `AccountRow`
  - `TransactionRow`
  - `EmptyState`
  - `ZeroState`
  - `DetailField`
  - `FormPrimitives`
  - `FormSheet`
  - `DateRangePicker`
  - `TransactionList`
- `Organisms`
  - `AccountList`
  - `AppSidebar`
  - `MobileBottomNav`
- `Features`
  - `Accounts` (`AccountFormSheet`, `AccountsView`, `BalanceRegisterPanel`)
  - `Auth` (`AuthForm`)
  - `Banking` (`BankingView`, `ImportApprovalList`)
  - `Budget` (`BudgetBarChart`)
  - `Categories` (`CategoryFormSheet`)
  - `Goals` (`GoalFormSheet`)
  - `Inbox` (`CsvBatchSection`, `McpBatchSection`)
  - `Settings` (`McpSettings`, `BillingSettings`)
  - `Sync` (`SyncStatusIndicator`)
- `Templates`
  - `WorkspaceShell`
  - `PendingTransactionRow`
- `Pages`
  - `Today`
  - `Accounts`
  - `Transactions`
  - `Budget`
  - `Calendar`
  - `Settings`
  - `ClaudeInbox`
  - `McpResultWidget`
  - `ProjectedBalance`

## Commands

- `npm run storybook` - Starts the local Storybook dev server on a verified port (default: `6008`)
- `npm run build-storybook` - Builds Storybook statically
- `npm run test-storybook` - Runs automated browser tests via Vitest (with Playwright + axe-core accessibility checks)
- `npm run preview:live` - Starts both the App and Storybook preview dev servers synchronously
- `npm run preview:refresh` - Clean restarts preview dev servers

## Automated Accessibility (a11y) Testing

Moniq enforces strict accessibility guidelines. The test runner executes **axe-core** checks automatically on every story rendering in Vitest.
- Visual elements are audited for contrast ratios, proper ARIA labeling, keyboard focusability, and structure.
- Parameters set in `.storybook/preview.tsx` with `a11y: { test: "error" }` ensure that any accessibility violation will immediately fail the Storybook test run.
- Keep components compliant with accessibility standards (ARIA properties, semantic elements, text contrast, screen reader friendliness).

## Rules

- **Storybook-First Rule:** ALL visual and UI work—including creating new UI elements, styling modifications, or adding states—must be initiated and verified inside Storybook first. Direct editing of the live app UI without a story cover is prohibited.
- **Story for Every State:** Every new screen, stateful component, panel, empty state, and edge case (e.g. pending, offline, error) must have a corresponding story.
- **CI Enforcement:** `npm run check:storybook-first` blocks pull requests with runtime UI modifications if no story files have been edited, unless explicitly waived in `.storybook/non-visual-change.md`.
- **Offline / Sync Mocking:** Stories should use isolated mock data and cover offline, local-first syncing, storage failures, or expired auth session states without connecting to Supabase or PowerSync.
- **Design Tokens:** Always build UI components using defined design tokens. Do not write arbitrary rounded or shadow classes.
- **Accessibility Compliance:** Do not sign off on a UI component if it introduces accessibility warnings or errors. Inspect accessibility results using the **Accessibility** addon panel in the Storybook UI or the Vitest CLI reporter.
