-- Guarded recurring schedule update for MCP partial patches.
--
-- The MCP server merges a partial patch onto the stored schedule, then submits the full
-- payload. To stop two concurrent patches from silently restoring each other's stale
-- fields, this wrapper locks the schedule row and rejects the update when the row changed
-- since the patch was read (updated_at is maintained by the set_updated_at trigger).

create or replace function public.mcp_update_recurring_transaction_schedule_if_unchanged(
  p_key_hash text,
  p_schedule_id uuid,
  p_schedule jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
  current_updated_at timestamptz;
begin
  key_user_id := public.mcp_recurring_key_user_id(p_key_hash);

  select s.updated_at
  into current_updated_at
  from public.finance_transaction_schedules s
  where s.id = p_schedule_id
    and s.user_id = key_user_id
  for update;

  if not found then
    raise exception 'Recurring transaction series not found';
  end if;

  if p_expected_updated_at is not null and current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Recurring transaction series changed concurrently; read it again and retry';
  end if;

  return public.mcp_update_recurring_transaction_schedule(p_key_hash, p_schedule_id, p_schedule);
end;
$$;

revoke all on function public.mcp_update_recurring_transaction_schedule_if_unchanged(text, uuid, jsonb, timestamptz) from public;
grant execute on function public.mcp_update_recurring_transaction_schedule_if_unchanged(text, uuid, jsonb, timestamptz) to anon, authenticated;
