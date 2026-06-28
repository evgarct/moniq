-- Service-role automation seeds synthetic users and performs server-side
-- finance operations. RLS still protects authenticated and anonymous clients.
grant select, insert, update, delete on table
  public.investment_positions,
  public.transaction_import_column_presets,
  public.transaction_imports,
  public.transaction_import_rules,
  public.transaction_import_batches,
  public.finance_transactions,
  public.finance_transaction_schedules,
  public.finance_categories,
  public.wallet_allocations,
  public.wallets,
  public.user_preferences,
  public.user_billing_entitlements
to service_role;

grant select on table
  public.investment_instruments,
  public.investment_quotes,
  public.fx_rates
to service_role;

-- Authenticated application access is still constrained by each table's RLS
-- policies; these grants make the effective privileges explicit and rebuildable.
grant select, insert, update, delete on table
  public.wallets,
  public.wallet_allocations,
  public.finance_categories,
  public.finance_transactions,
  public.finance_transaction_schedules,
  public.user_preferences
to authenticated;

grant select on table
  public.investment_instruments,
  public.investment_quotes,
  public.fx_rates,
  public.user_billing_entitlements
to authenticated;
