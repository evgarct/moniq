# Savings Goals Spec

Status: implemented product direction for the current savings goals model.

This document defines the next evolution of savings allocations inside Moniq.

## Summary

Savings subgroups should stop being modeled as a flat list of generic categories only.

Inside every `saving` wallet, Moniq should support three internal money buckets:

1. `free`
2. `goal_open`
3. `goal_targeted`

This keeps the current "reserved money inside one savings balance" behavior, but adds a first-class goal model and a target amount when the user wants one.

## User Value

- Users can distinguish money that is still free to withdraw from money already reserved for goals.
- Users can keep long-running savings buckets even when there is no exact target yet.
- Users can track progress for goals that do have a concrete final amount.

## Scope

This feature changes the savings sub-entity model and the savings UI presentation.

This feature does not change:

- wallet currency rules
- the invariant that one savings wallet still represents one real balance
- liability wallet behavior
- FX behavior

## Domain Model

The current `allocation` concept should evolve into a richer savings child entity. Naming can stay `allocation` internally for migration safety, but product behavior should be based on explicit subtype semantics.

### Savings Child Types

#### `free`

- System-defined remainder bucket for one savings wallet.
- Represents money that is available to withdraw or reassign.
- Cannot be renamed, deleted, or directly edited as a standalone row.
- Computed value only:
  - `free.amount = saving.balance - sum(all user-managed goal amounts)`

#### `goal_open`

- User-created goal without a final target amount.
- Has `name` and `amount`.
- Does not have progress against a target.
- Used for flexible reserves such as "Travel" or "Future Home".

#### `goal_targeted`

- User-created goal with a final target amount.
- Has `name`, `amount`, and `target_amount`.
- Shows progress against target.
- Used for concrete savings targets such as emergency fund, car down payment, or trip budget.

## Data Shape

Recommended product-level shape:

```ts
type SavingsGoalType = "free" | "goal_open" | "goal_targeted";

type SavingsGoal = {
  id: string;
  wallet_id: string;
  name: string;
  type: SavingsGoalType;
  amount: number;
  target_amount?: number | null;
  created_at: string;
};
```

Notes:

- `free` may remain virtual/computed and not require a persisted row.
- `goal_open` must store `target_amount = null`.
- `goal_targeted` must store `target_amount > 0`.

## Core Invariants

### Wallet-Level

- Savings goals can only belong to `saving` wallets.
- Savings goal currency always inherits the parent wallet currency.
- Sum of all user-managed goal amounts in one wallet must never exceed the wallet balance.
- `free.amount` must never be negative.

### Type-Level

- Exactly one `free` bucket exists per savings wallet at the product level.
- `free` cannot be created, renamed, deleted, or manually assigned an amount.
- `goal_open` cannot have a `target_amount`.
- `goal_targeted` must have a positive `target_amount`.
- `goal_targeted.amount` may exceed `target_amount`; progress should clamp visually at 100% while preserving the real amount.

### Mutation Rules

- Creating, editing, or deleting a goal must never change the parent wallet balance.
- Changing a goal from `goal_targeted` to `goal_open` removes the target amount but keeps the current saved amount.
- Changing a goal from `goal_open` to `goal_targeted` requires a target amount.
- Changing a wallet from `saving` to a non-saving type removes all user-managed savings goals because the structure is no longer valid.

## UI Model

Each savings wallet should present:

- wallet total at the parent row
- one grouped list of internal buckets below it
- `free` first
- then user-defined goals

### Row Treatment

#### `free`

- Label should be explicit product copy, for example `Free` or `Available to withdraw`.
- No progress bar.
- Secondary tone compared to goals.
- Exposed as the immediately withdrawable amount.

#### `goal_open`

- Shows goal name and current amount.
- No denominator and no target copy.
- No progress bar, or a visibly different neutral fill if design wants a common row height.

#### `goal_targeted`

- Shows goal name plus `current / target`.
- Shows progress bar below or inline depending on density.
- Uses the wallet currency formatter for both current and target amounts.

## Recommended Interaction Design

### Create Goal

The add flow for a savings child should ask:

1. goal name
2. current reserved amount
3. whether the goal has a target
4. target amount, only when the answer above is yes

### Edit Goal

Users can edit:

- name
- current amount
- target mode
- target amount when relevant

Users cannot edit:

- the `free` bucket directly

### Withdraw / Reassign Mental Model

- Withdrawing money from savings should default to `free`.
- If product later supports withdrawing from a goal directly, that should be an explicit choice, not an implicit side effect.
- Reassigning money between goals should preserve the parent wallet balance and only move reserved amounts between savings children.

## Screen States

### Empty Savings Wallet

- Show only the computed `free` row equal to the wallet balance.
- Encourage creating the first goal.

### Savings Wallet With Mixed Goal Types

- `free` row first
- open goals next
- targeted goals next

Ordering between user-managed goals can stay manual or creation-based for now, but the order rule should be consistent.

### Overfunded Targeted Goal

- Show actual amount and target, for example `12,000 / 10,000`.
- Clamp progress bar at full.
- Do not silently move overflow into `free`.

## Validation Rules

- Goal name is required for `goal_open` and `goal_targeted`.
- Goal amount cannot be negative.
- Target amount is required and must be greater than zero for `goal_targeted`.
- Saving all user-managed goals in one wallet cannot exceed the wallet balance.
- Validation errors should mention the wallet-level available balance, not only the field-level failure.

## Migration From Current Allocations

Recommended backward-compatible migration:

1. Keep existing savings child rows as `goal_open`.
2. Rename the product-level computed bucket from `Uncategorized` to `Free`.
3. Add nullable `target_amount`.
4. Add explicit child `type` for persisted user-managed rows if needed.

If the database keeps `free` as a computed row only, persisted rows only need:

- `goal_open`
- `goal_targeted`

## Technical Start Plan

Likely touched areas:

- `types/finance.ts`
- `types/finance-schemas.ts`
- `features/allocations/lib/*` or a renamed `features/goals/lib/*` domain slice
- savings wallet UI components in `components/` and `features/accounts/components/`
- Supabase schema and RPC functions
- node-level invariant tests for all create/edit/delete and type-change cases

## Acceptance Criteria

- A savings wallet always exposes one product-level `free` bucket derived from the remaining unassigned amount.
- Users can create a savings goal without a target amount.
- Users can create a savings goal with a positive target amount.
- A targeted goal shows current and target amounts plus progress.
- An open goal shows current amount without target progress.
- The sum of all user-managed goals cannot exceed the savings wallet balance.
- Editing or deleting a goal updates the computed `free` amount immediately.
- Converting a savings wallet to a non-saving wallet removes all user-managed savings goals according to the existing wallet-type invariant.
- Existing savings allocations migrate to `goal_open` behavior without data loss.

## Open Questions

- Final product copy: `Free`, `Available`, or `Available to withdraw`.
- Whether user-managed goals should be manually reorderable.
- Whether targeted and open goals should be visually interleaved or grouped by type.
- Whether future transaction flows should let the user spend directly from a goal or only from `free`.
