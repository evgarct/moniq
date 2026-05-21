-- Publicly callable MCP direct RPC wrappers.
-- These accept the MCP API key hash, resolve the owning user inside Postgres,
-- then delegate to the private user-id RPCs. Callers cannot choose p_user_id.

create or replace function public.mcp_get_finance_context(p_key_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  return public.mcp_get_finance_context(key_user_id);
end;
$$;

create or replace function public.mcp_create_transactions(
  p_key_hash text,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  return public.mcp_create_transactions(key_user_id, p_transactions);
end;
$$;

revoke execute on function public.mcp_get_finance_context(text) from public;
revoke execute on function public.mcp_create_transactions(text, jsonb) from public;

grant execute on function public.mcp_get_finance_context(text) to anon, authenticated;
grant execute on function public.mcp_create_transactions(text, jsonb) to anon, authenticated;
