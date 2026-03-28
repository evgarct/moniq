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
- Subgroup creation and edits must pass one invariant:
  - total subgroup amount for one savings wallet must never exceed the wallet balance

## Uncategorized Savings

- Every `saving` wallet has a system remainder bucket called `Uncategorized`.
- It is computed as:
  - `uncategorized = saving.balance - sum(all user-created subgroups)`
- It cannot be renamed or deleted.
- If money is taken from savings without choosing a subgroup, it should come from `Uncategorized`.

## Balance Rules

- `cash` and `saving` balances are stored as positive values.
- `credit_card` and `debt` balances are stored as negative values because they are liabilities.

## Currency Rules

- Every wallet has an explicit wallet currency.
- The first-class currencies in Moniq are:
  - `EUR`
  - `CZK`
  - `RUB`
- The wallet form also offers a curated set of other major currencies for users who need them.
- Savings subgroups do not carry their own currency; they always inherit the currency of their parent savings wallet.
- Until FX support exists, overview totals and cashflow summaries must stay separated by currency instead of combining values into one fake total.

## CRUD Invariants

- Wallet create and edit operations normalize balances by wallet type before state is saved.
- Changing a wallet from `saving` to a non-saving type removes its subgroups because that structure is no longer valid.
- Wallet edits also update embedded account snapshots inside transactions so the register stays consistent.
- Wallet delete removes the wallet together with its linked subgroups and transactions in the mock state layer.
