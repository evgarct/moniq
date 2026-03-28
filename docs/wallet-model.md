# Wallet Model

Moniq now models wallets around four user-facing types.

## Wallet Types

- `cash`: debit cards and physical cash wallets. Spending happens directly from these wallets.
- `saving`: a savings wallet that cannot be spent from directly. Money must be taken out of savings first.
- `credit_card`: direct-spend card wallet. Advanced payoff flows are intentionally out of scope for now.
- `debt`: non-card liabilities such as loans and mortgages. The current app only keeps them in the model and CRUD flow.

## Saving Subgroups

- A `saving` wallet can contain user-created subgroups.
- Subgroups are logical reservations inside one physical savings balance.
- Creating, editing, or deleting a subgroup never changes the wallet balance itself.

## Uncategorized Savings

- Every `saving` wallet has a system remainder bucket called `Uncategorized`.
- It is computed as:
  - `uncategorized = saving.balance - sum(all user-created subgroups)`
- It cannot be renamed or deleted.
- If money is taken from savings without choosing a subgroup, it should come from `Uncategorized`.

## Balance Rules

- `cash` and `saving` balances are stored as positive values.
- `credit_card` and `debt` balances are stored as negative values because they are liabilities.
