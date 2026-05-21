-- Restrict user-id based MCP finance RPCs to private execution.
-- Public callers must use the key-hash wrappers, which resolve p_user_id
-- inside Postgres from the MCP API key.

revoke execute on function public.mcp_get_finance_context(uuid) from public, anon, authenticated;
revoke execute on function public.mcp_create_transactions(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.mcp_get_finance_context(uuid) to service_role;
grant execute on function public.mcp_create_transactions(uuid, jsonb) to service_role;
