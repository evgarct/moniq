# Storybook

Storybook is the review surface for Moniq UI work.

## Purpose

- show the full UI structure outside the app runtime
- review components from small primitives up to route-level pages
- keep visual work testable with story-attached checks

## Atomic Structure

- `Atoms`
  - `MoneyAmount`
  - `AccountTypeBadge`
- `Molecules`
  - `AccountCard`
  - `TransactionRow`
  - `AllocationItem`
  - `EmptyState`
- `Organisms`
  - `AccountList`
  - `AppSidebar`
  - `AppHeader`
  - `AuthForm`
- `Templates`
  - `AccountsView`
  - `WorkspaceShell`
- `Pages`
  - `Dashboard`
  - `Calendar`
  - `Today`
  - `Accounts`

## Commands

- `npm run storybook`
- `npm run build-storybook`
- `npm run test-storybook`

## Rules

- every meaningful UI surface should be represented in Storybook
- stories should use mock data and stay independent from Supabase
- page stories should reflect realistic Moniq layouts, not isolated demo fragments
