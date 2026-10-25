---
name: fintech-handbook
description: Moniq engineering checklist distilled from the Fintech Engineering Handbook (w.pitula.me/fintech-engineering-handbook). Invoke BEFORE starting any work in Moniq (feature, bugfix, migration, MCP tool, UI that shows or mutates money) and consult it again when touching money math, currencies, transactions, balances, budgets, recurring/debt flows, sync, imports, webhooks or market data.
---

# Fintech handbook for Moniq

Source: Voytek Pitula, *Fintech Engineering Handbook* (https://w.pitula.me/fintech-engineering-handbook). This is a paraphrased checklist mapped onto Moniq, not a copy. Fetch the original for depth; the anchors are listed per section.

## How to use this skill (do this first)

1. Before any work, classify the task against the **trigger table** below and read only the matching sections.
2. State in one line which handbook rules apply (and which Moniq rules in `AGENTS.md` / `docs/design.md` they reinforce). Skip the line only for pure copy/styling changes that touch no money data.
3. Before finishing, run the **pre-merge checklist** at the end.
4. If the work reveals a Moniq-specific lesson, record it in `AGENTS.md`, not here. This file only holds handbook-derived rules.

| Task touches | Read |
| --- | --- |
| amounts, parsing, formatting, rounding, sums | 1 Money |
| transactions, balances, wallets, envelopes, budgets, debt, pensions | 2 Ledger, 3 Flows |
| create/edit/delete mutations, retries, offline/sync, imports, recurring | 3 Flows |
| MCP tools, bearer API keys, webhooks, market data, bank/provider imports | 4 External world |
| roles, RLS, API keys, deploys, migrations | 5 Controls |
| any new test | 6 Testing |

## Three principles (apply to everything)

- **No invented data**: no duplicates, no arbitrary balance changes, no money minted by clamping or fallbacks.
- **No lost data**: persist and track everything; corrections are new records, not overwrites.
- **No trust**: verify providers, internal components and inputs (client, MCP caller, sync payload).

## 1. Representing money (`#representing-money`)

- Never use floats for money without a guard. Moniq's money math is raw JS floats today: **round to cents with `roundMoney` before any comparison or invariant check**, otherwise exactly-balanced operations are falsely rejected. Prefer integer minor units or decimals for new storage and computation.
- Money is `{amount, currency}`. **Never add, compare or aggregate across currencies** (also an `AGENTS.md` rule: category trees, summaries and reports stay split by currency). Reject cross-currency arithmetic at the type/domain layer, not in a component.
- Round explicitly, as late as possible, once. Rounding mode is a product decision. When splitting an amount, keep the residual so parts still sum to the total.
- Serialize amounts as strings or integer minor units in APIs, MCP payloads and SQL, never as bare JSON numbers where precision matters. Mind currencies with non-2 minor digits.
- Validate currency codes against a controlled set at every boundary (form, MCP, import, SQL).
- FX rates are directional (bid/ask), time-specific and sourced. Store rate, source and timestamp with any converted value. A reference rate for valuation is not a transaction rate.
- Investments: crypto/market assets are identified by symbol plus network/venue, not a bare code. Pegged, wrapped or bridged assets are not their underlying asset.

## 2. Recording money: the ledger (`#recording-money-the-ledger`)

- **Derive balances, do not hand-edit them.** If a number can be recomputed from recorded movements, it must be (envelope execution, wallet balance, debt remaining, budget progress). Cached or denormalized values need a recompute/verify path.
- Money moves, it is not created: every change is balanced by a counter-movement (account to account, wallet to envelope, payment to debt). Transfers are two legs that must both exist or both not.
- Posted history is effectively immutable. Fix forward with a **linked compensating entry** (reversal, refund, return, budget return) rather than rewriting. Never replay paid historical records to repair a balance (Moniq rule).
- Keep every relevant date: transaction/value date, created/booked time, settlement or paid time. Backdated and future-dated entries are normal; make reports state which date they use.
- Record who/what/when/why for changes (user, MCP key, sync, recurring job). Silent system edits are a smell.
- GDPR vs immutability: keep PII out of ledger rows, reference users by opaque ID; on logout/account deletion clear local copies (Moniq namespaces local data by verified user ID).

## 3. Executing money flows (`#executing-money-flows`)

- **Invariants**: enforce by construction (domain helpers, types, DB constraints/RLS), plus runtime checks, plus post-factum detection (reconciliation queries). Keep rules in pure domain helpers with node-level tests, never only in React handlers.
- **Reservation (hold/release)**: `available = total - reserved`. Savings, goals and envelopes are reservations, not spending. Check-and-reserve must be atomic (single SQL function/transaction), never read-then-write in the client.
- **Overdrafts/negatives**: do not make a negative state unrepresentable by clamping to zero (that mints money). Surface it, book it explicitly, and recover it.
- **Idempotency**: every mutation reachable by retry (optimistic background persist, sync replay, MCP tool call, recurring job, webhook) needs a stable idempotency key scoped to the operation. Replaying must return the stored result. The dedupe barrier must be atomic under concurrency, and released on failure so legitimate retries are not swallowed. Must also hold under out-of-order retries.
- **Resumability**: multi-step flows (debt payment, recurring occurrence paid, budget return linking, imports) are state machines that commit per step, can be re-run safely, and either roll forward or compensate. Prove with a synthetic rollback test (`supabase/tests/debt_recurring_reliability.sql`) and a concurrency check.
- **Optimistic UI** is only acceptable for deterministic reversible mutations, with rollback and a toast on failure. Parsing/upload, auth and external calls stay blocking (Moniq rule).
- Cross-queue operations that affect `financeSnapshotQueryKey` go through the shared `FinanceMutationCoordinator`.

## 4. The external world (`#the-external-world`)

- Treat every outside input as hostile or wrong: market-data providers, bank/CSV imports, MCP callers, the client. Validate only the fields you need, **fail loudly** on surprises, never fabricate fallbacks that look like real data.
- Set timeouts and bounded retries; do napkin math on provider quotas; avoid parallel retry storms on the small Supabase instance.
- Persist the raw provider response (or at least provider ID and fetch time) so a bad value can be traced and re-derived. Provider fallbacks must use persisted instrument metadata; a missing active symbol must **fail the refresh**, not return silent success.
- Webhooks/notifications: assume duplicates, reordering, loss. Verify the signature over the raw body, acknowledge fast, persist, process async and idempotently, use the payload as a trigger and re-query for authoritative state. Notification-style inputs (e.g. wallet notifications) fire twice: dedupe.
- Avoid dual writes (DB plus external effect). Use an outbox or a single source of truth with a reconciler.
- **Reconcile**: periodically compare internal state with the source (provider prices, bank statements, remote vs local PowerSync data). Missing vs mismatched are different cases; fix with first-class correcting entries, never by overwriting. Verify fresh rows in the linked database after a refresh fix, not just a 200.
- MCP tools authenticate by key hash inside SECURITY DEFINER RPCs; never trust a caller-supplied `user_id`.

## 5. Controls and access (`#controls-and-access`)

- Least privilege: RPC helpers revoked from `public/anon/authenticated` unless intended; verify with `has_function_privilege`. RLS and tenant isolation are verified on synthetic personas, not assumed.
- Four-eyes for engineering: changes go through PR and review, CI green, no force-push to `main`, deploys traceable to a commit. Database promotion is of the exact verified commit.
- Break-glass or manual data edits (repair scripts, direct SQL) are audited: write down who, why, the query, and the before/after check.
- Secrets never in client code, logs or fixtures; synthetic data only in CI/staging seeds.

## 6. Testing (`#testing`)

- Property-based or table tests for invariants: sum of parts equals total, balance equals sum of movements, no cross-currency sums, `available >= 0` unless explicitly overdraft.
- Run invariant checks after every step of generated operation sequences (create, edit, delete, recur, pay, refund).
- **Idempotency**: replay each mutation twice and assert one effect. **Crash/resume**: inject failure between steps and assert rollback or clean resume.
- Round-trip tests for money parsing/formatting/serialization, including edge currencies and large values; golden tests for report calculations; a corpus of old payloads for backward compatibility (sync, MCP, stored JSON).
- Test full compositions (Budget plus MCP plus analytics converter), not just a helper in isolation (Moniq rule). Use dynamic dates, never static ones that expire.

## Review prompts (ask on every money-touching change)

1. Where could this create or destroy money, or double-count it?
2. What happens if it runs twice, partially, or out of order?
3. Which currency is each number in, and is anything summed across currencies?
4. Is this number derived or stored, and what recomputes it?
5. What is the compensating path if it was wrong, and is the history preserved?
6. What does the user see while it is pending, failed, or rolled back?

## Pre-merge checklist

- [ ] Money rounded via `roundMoney` at comparison/invariant points; no float equality.
- [ ] No cross-currency aggregation introduced.
- [ ] Mutation is idempotent and has a failure/rollback path; barrier released on error.
- [ ] Invariants live in pure domain helpers with tests; DB side enforced where applicable.
- [ ] History is corrected by compensating records, not overwritten or replayed.
- [ ] External input validated, failures loud, raw data or provider IDs persisted.
- [ ] Grants/RLS checked for any new RPC; migrations tested per `AGENTS.md`.
- [ ] Tests cover retry/crash/ordering for the changed flow.

## Further reading (from the handbook)

Kleppmann, *Accounting for Computer Scientists*; Modern Treasury, *How to Scale a Ledger*; *Designing Data-Intensive Applications*. Handbook sections also include a glossary (Appendix A) and three end-to-end flow examples (Appendix B: crypto withdrawal, card deposit, conversion with cashback) worth reading for multi-step flow design.
