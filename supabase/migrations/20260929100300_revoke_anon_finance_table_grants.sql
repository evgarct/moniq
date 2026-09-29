-- The anonymous role never reads finance tables directly: the MCP endpoints call
-- SECURITY DEFINER RPCs and the app uses authenticated sessions. Newer Supabase stacks
-- can grant table privileges to anon by default, so revoke them explicitly (RLS stays
-- the authority for authenticated access).
revoke all on table
  public.wallets,
  public.wallet_allocations,
  public.finance_categories,
  public.finance_transactions,
  public.finance_transaction_schedules,
  public.user_preferences
from anon;
