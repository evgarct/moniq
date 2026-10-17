# Pension accounts and budget execution

## Liquidity

MCP wallet context preserves `balance` and adds `total_balance`, `reserved_balance`,
`available_to_spend`, named `allocations` with availability, and `availability_status`.
User-managed goals are reserved; the saving wallet's unallocated remainder is Free.
Over-allocation is reported as a negative remainder rather than concealed. Pension
accounts are fully locked. Liabilities have no spendable cash and a null reserve.
Expected income is separate from received income and must never fund current advice.

## Envelope execution

`buildBudgetExecution` replays persisted operations in posting order and derives FIFO
funding lots with their original transaction, category, remaining native amount and FX
ratio. The original ledger is the durable provenance; lots are rebuilt after edits or
deletions, rather than maintained as a second mutable money ledger. Opening goal
amounts without categorized funding do not count as budget execution.

Categorized transfers into a savings goal or pension account execute an envelope.
Moving already funded money carries its attribution without executing another envelope.
Expenses consume available funded lots first and only their uncovered part executes
an envelope. Cashflow and spending reports always use the original operations.
Explicit returns (linked through the `link_budget_return` MCP tool, with
`linked_transaction_id` referring to the funding transaction) reduce
the original category in the month of the return, capped at unused funding. Automatic
goal releases carry provenance to the wallet and never count as new contributions.
Paid provenance is replayed before a separate planned forecast; forecasts do not alter
confirmed lots. Ordinary uncategorized transfers do not execute envelopes.

Both the online snapshot and MCP budget source include historical operations so prior
funding can cover this month's purchases. Online transactions are paginated at 1000
rows; the user-scoped PowerSync stream already contains the complete ledger.
Budget row editing always resolves projections back to their real persisted operation.

## Pension model

`pension` extends `wallet_type`. A pension's versioned `pension_state` JSON document
contains dated `statements` and identified `entries`; it travels atomically through the
existing owner-scoped wallet sync stream. Statement figures (`total_value`, `invested`,
`provider_result`) remain independent and do not assert any arithmetic relationship.
Entries identify own, employer, state contributions, or internal investment activity.
Internal investment entries store positive activity amounts, without changing value.

Balance is the latest statement value plus paid incoming ledger movements and external
employer/state entries dated after that statement. Contributions on or before the
statement date are included, never added again. Future planned payments do not change
the balance. Lower valuations are valid; revaluation is not budget income. Employer
and state contributions are pension activity, outside ordinary income reports.

The statement RPC serializes imports by owner and wallet, replaces a valuation for the
same date, deduplicates identical entry IDs, and rejects conflicting entries. An own
contribution requires an exact existing paid transaction reference. Linking an expense
converts that same row to a transfer; the existing ledger trigger reverses/reapplies it
atomically, keeping the source debit unchanged. Earlier paid history is not replayed.
Pension source transactions and changes away from the pension type/currency are blocked
in PostgreSQL, including MCP, direct API and sync writes.

Pension accounts appear inside the existing Investments section, alongside market
positions, with a combined total in the saved default currency. `get_investment_summary`
uses the same conversion helper and exposes native amounts, converted totals, market
and pension subtotals and valuation dates. Missing FX/quotes yield null totals, never
partial totals presented as complete. Pension funds remain locked even in this grouping.

MCP exposes `get_pension_accounts` and `upsert_pension_statement`. Screenshot reading
belongs to the agent, with user-confirmed dates and amounts. No OCR service or image
upload is added. New accounts created by this MCP flow default to CZK; existing pension
accounts use their recorded currency. The Balance detail also permits manual valuations
through `POST /api/wallets/:walletId/pension`, coordinated optimistically with finance.
Database ownership is resolved from a verified session or the MCP key hash; internal
helpers have no public, anonymous or authenticated execute grant.

## Verification and rollout

Unit tests cover liquidity, FIFO funding, partial coverage, moves, returns, forecasts,
FX proportions, valuation decreases, repeat imports and included contributions.
`supabase/tests/pension_reliability.sql` runs rollback-only against synthetic personas in
Migration Preview after two schema rebuilds, alongside debt/recurring and concurrency
checks. Never run the synthetic suite against a personal database.
Storybook covers Balance with a pension, pension details, empty state and open valuation
form. The design remains flat rows with shared forms, translated into English/Russian.

After verified promotion, import the authorized October statement separately from schema
migrations: 17 October 2026 value 229294.06 CZK, invested 190781.80, provider result
29572.72; link the existing 8 October own payment of 1700, add employer 4161 and record
9 October internal investment 5861. Convert only the future Pension schedule to a
transfer, preserving its cadence and overrides. Do not fabricate September or state aid.

The authorized Czech account name is Doplňkové penzijní spoření (DPS).

The account also has structured `product_type: cz_dps`, `product_name` and
`country_code: CZ` in MCP context, pension reads and the investment summary. Renaming
the wallet preserves its DPS identity. Imports supply `product_type` once; later
valuation updates preserve it.

The combined total is aligned with the Investments heading; it has no separate total
row. Pension wallet edits lock type/currency/balance; valuation changes use statements.
Categorized transfer schemas preserve the category and defer destination eligibility
to account-aware validation. Envelope projection is idempotent, including signed returns.

The shared account domain and server reject nonzero pension openings, balance edits,
currency changes and conversion of existing wallets to/from pension. Database inserts
also require an empty pension; incoming ledger activity must be a transfer. Raw balance
delta helpers are unavailable to client roles. Recurring MCP creation and patches check
the actual destination account before accepting a categorized transfer without a goal.
The rollback suite exercises key-authenticated edits of already linked own contributions.

Categorized funding from a general cash wallet is a new budget commitment for its full
amount, even when that cash wallet previously received money released from a goal.
Direct goal-to-goal moves carry provenance instead. This matches the explicit October
acceptance: 3000 CZK paid to GTFO Fund executes 3000 CZK of Next & Safe. A later purchase
from that goal still consumes the new funding FIFO and does not execute it twice.
When no default currency has been saved, MCP investment totals infer it from all wallets
using the same preference resolver as Balance, rather than from pension accounts alone.
