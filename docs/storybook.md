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
  - `Imports`

## Commands

- `npm run storybook`
- `npm run build-storybook`
- `npm run test-storybook`
- `npm run preview:live`
- `npm run preview:refresh`

## Current Preview Source Of Truth

- use `npm run preview:live` for local UI work
- it restarts both live dev servers in place on stable URLs: app `http://localhost:3008` and Storybook `http://localhost:6008`
- the command verifies both over HTTP and writes the current status to `.codex-artifacts/current-previews.json`
- `npm run preview:refresh` is now just an alias to the same stable live-preview flow

## Rules

- UI work starts in Storybook: component states first, composed screen second, application integration last
- every meaningful UI surface and state must be represented in Storybook in the same pull request
- stories should use mock data and stay independent from Supabase
- page stories should reflect realistic Moniq layouts, not isolated demo fragments
- stateful review surfaces such as the import inbox should have a focused story that opens directly into the target interaction state
- `npm run check:storybook-first` blocks runtime UI changes without a story change; `.storybook/non-visual-change.md` is only for a documented, genuinely non-visual exception
- local-first stories cover cached, syncing, offline, pending, reconnecting, conflict, storage-failure, and expired-authorization states without contacting PowerSync or Supabase
