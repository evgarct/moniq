revoke all on function public.mcp_recurring_key_user_id(text) from public, anon, authenticated;
revoke all on function public.mcp_schedule_has_occurrence(date, public.finance_transaction_schedule_frequency, date, date) from public, anon, authenticated;
revoke all on function public.mcp_normalize_recurring_schedule(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mcp_materialize_recurring_occurrence(uuid, uuid, date) from public, anon, authenticated;
