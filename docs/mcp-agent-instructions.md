# Moniq MCP Agent Instructions

Use this instruction block for ChatGPT, Claude, or any agent connected to the Moniq MCP server.

```text
You are connected to Moniq through MCP.

Moniq is a personal finance workspace. It stores wallets/accounts, categories, ledger transactions, recurring transaction schedules, Claude review batches, and finance analytics. Do not say that Moniq cannot read transactions, future plans, balances, or categories until you have listed and tried the available Moniq MCP tools.

Always discover tools first:
1. Call tools/list.
2. Look for Moniq tools by name.
3. Use the most specific Moniq tool instead of answering from memory.

Core rule:
- If the user asks about historical transactions, spending, income, cashflow, transfers, debt payments, or analytics for any period, call get_transactions or get_category_spending_report.
- If the user asks about future cashflow, forecasts, upcoming bills, planned payments, or scheduled transactions, call get_transactions with a future date range. Moniq can return generated recurring schedule occurrences for the requested period; do not claim this data is unavailable.
- If the user asks to create ledger entries, first call get_finance_context, then call create_transactions only after all required fields are known.
- If confidence is low or the user wants review before writing, use submit_transaction_batch instead of create_transactions.

Important:
- Dates are inclusive and use YYYY-MM-DD.
- Transaction kinds are income, expense, transfer, and debt_payment.
- Transaction statuses are paid, planned, and skipped.
- Planned and skipped transactions are part of the transaction history/plan. Do not filter them out unless the user asks for settled cashflow only.
- Recurring schedules may be returned as generated transactions with source="schedule", is_generated=true, and id="schedule:{schedule_id}:{date}".
- For money analytics, keep currencies separate. Do not combine EUR, USD, CZK, or other currencies into one total.
```

## MCP Connection

- Server URL: `https://<moniq-app-host>/api/mcp`
- Auth:
  - Claude OAuth can connect from Moniq Settings.
  - Manual MCP clients use `Authorization: Bearer <Moniq MCP API key>`.
- The server implements Streamable HTTP MCP and exposes tools through `tools/list`.

## Tools

### `get_finance_context`

Reads wallet/account and category context.

Use it before writing transactions so the agent can choose exact IDs. The response includes:

- wallets/accounts with IDs, names, types, currency, balance, credit limit, and debt/card metadata
- categories with IDs, type, hierarchy path, and selectable flags
- rules for valid transaction relationships

Do not invent account IDs or category IDs. Call this tool first.

### `get_transactions`

Reads transactions for an inclusive date range.

Use it whenever the user asks for:

- all transactions in a past period
- retrospective spending or income analysis
- all paid/planned/skipped entries
- future scheduled transactions
- forecast or cashflow projection
- transfers or debt payments in a period

Input:

- `start_date` required, `YYYY-MM-DD`
- `end_date` required, `YYYY-MM-DD`
- `statuses` optional: `paid`, `planned`, `skipped`
- `kinds` optional: `income`, `expense`, `transfer`, `debt_payment`
- `account_ids` optional
- `category_ids` optional
- `include_context` optional boolean

Default behavior returns all statuses and all transaction kinds. The response includes:

- `period`
- `transactions`
- `summary_by_currency`
- `limits`
- optional `accounts`, `categories`, `schedules` when `include_context=true`

Future recurring transactions are supported. Active schedules are expanded into generated occurrences for the requested range. Materialized ledger rows override generated schedule rows for the same occurrence, so edited, paid, or skipped occurrences are authoritative.

### `get_category_spending_report`

Reads category analytics for a period, focused on settled spending/income reporting.

Use it when the user asks for:

- category spending report
- budget/category breakdown
- last complete month spending
- income and expense category trees
- percentages and totals by category

Inputs:

- `period_preset`: currently `last_complete_month`
- `month`: `YYYY-MM`
- or `start_date` and `end_date`: `YYYY-MM-DD`

This report uses paid transactions and separates totals by currency.

### `get_card_and_debt_balances`

Reads current card-like wallets and debt balances.

Use it when the user asks about:

- debit card balances
- credit card outstanding amount
- available credit
- loans, mortgages, or other debt balances
- total debts by currency

The tool returns card/debt lists and totals by currency.

### `create_transactions`

Creates complete transactions directly in the ledger.

Use only after the user has provided or confirmed all required fields. Always call `get_finance_context` first.

Supported kinds:

- `income`: requires `destination_account_id` and income `category_id`
- `expense`: requires `source_account_id` and expense `category_id`
- `transfer`: requires `source_account_id` and `destination_account_id`, no category
- `debt_payment`: requires `source_account_id`, debt `destination_account_id`, and amount split into `principal_amount`, `interest_amount`, `extra_principal_amount`

Supported statuses for writes:

- `paid`
- `planned`

Do not use this tool if required wallet/category/date/amount fields are missing. Ask the user first.

### `submit_transaction_batch`

Legacy review flow for uncertain imports.

Use it when:

- the user gave a bank screenshot, statement, or file
- extracted transaction data may need review
- the user wants Moniq Inbox approval before ledger creation

This creates a batch in the Claude Inbox for review rather than writing directly to the ledger.

## Common Agent Workflows

### Historical analytics

1. Call `get_transactions` with the requested past `start_date` and `end_date`.
2. Include `statuses=["paid","planned","skipped"]` only if the user wants the operational record; use `statuses=["paid"]` for settled cashflow.
3. Summarize by currency, kind, category, account, and date as requested.

### Future forecast

1. Call `get_transactions` with the future date range.
2. Include planned transactions by default.
3. Treat generated schedule rows as future planned occurrences.
4. Explain that forecasts are based on current planned and recurring data.

### Create a transaction

1. Call `get_finance_context`.
2. Ask for missing date, amount, wallet, category, destination wallet, or debt breakdown.
3. Call `create_transactions`.
4. Report created IDs/titles back to the user.

### Import from bank screenshot or statement

1. Extract candidate transactions from the image/file.
2. If uncertain, call `submit_transaction_batch`.
3. Tell the user the batch is waiting in Moniq Inbox.

## Do Not Say

- "Moniq cannot access transactions."
- "Future scheduled transactions are not available."
- "There is no tool for this."

Say this only after calling `tools/list` and confirming the Moniq MCP server is not connected or the relevant tool call failed.
