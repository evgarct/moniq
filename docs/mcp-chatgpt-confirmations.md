# MCP ChatGPT confirmations

ChatGPT renders native confirmation screens for write-capable MCP tool calls.
Moniq cannot control that UI directly, but the MCP tool descriptor can influence
the title, running state, approval framing, and field labels.

For every user-facing MCP tool, keep the descriptor metadata human-readable:

- `title` should describe the user action, not the internal function name.
- `description` should tell the model how to explain the action in plain language.
- `annotations` should mark read-only tools with `readOnlyHint: true` and write
  tools with `readOnlyHint: false`.
- `_meta["openai/toolInvocation/invoking"]` and
  `_meta["openai/toolInvocation/invoked"]` should be short status strings.
- JSON Schema field `title` values should use product language such as
  "From wallet" and "Category" instead of database-oriented names.

For direct transaction creation, the model should confirm transaction count,
dates, merchant titles, amounts with currencies, wallet names, and category
names before calling the tool. Raw wallet and category UUIDs are still required
in the tool payload, but they should stay out of user-facing confirmation text
unless the user asks for technical details.

For recurring transaction tools, confirmations should state whether the action
affects the whole series or one occurrence. For series creation/update, include
the first occurrence date, frequency, optional end date, amount, wallet names,
category name, and transaction kind. For one occurrence, include the occurrence
date and clarify that deleting one occurrence marks it skipped so it will not
regenerate.
