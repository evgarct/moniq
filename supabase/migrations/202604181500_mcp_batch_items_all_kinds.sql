-- Expand mcp_batch_items.kind check to support all transaction kinds
alter table public.mcp_batch_items
  drop constraint if exists mcp_batch_items_kind_check;

alter table public.mcp_batch_items
  add constraint mcp_batch_items_kind_check
    check (kind in ('income', 'expense', 'transfer', 'save_to_goal', 'spend_from_goal', 'debt_payment', 'investment', 'refund', 'adjustment'));
