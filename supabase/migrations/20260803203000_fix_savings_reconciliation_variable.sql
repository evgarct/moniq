-- The original rollout used a local `wallet_id` variable that made unqualified
-- wallet_allocations.wallet_id references ambiguous at runtime. Rename only the
-- PL/pgSQL variable in-place so already-linked development databases receive the
-- same function definition as clean migration rebuilds.
do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.sync_wallet_balance_on_transaction()'::regprocedure)
  into definition;

  definition := replace(definition, E'  wallet_id uuid;\n', E'  affected_wallet_id uuid;\n');
  definition := replace(definition, 'foreach wallet_id in array affected_wallets loop', 'foreach affected_wallet_id in array affected_wallets loop');
  definition := replace(definition, 'enforce_wallet_allocations_limit(wallet_id)', 'enforce_wallet_allocations_limit(affected_wallet_id)');

  execute definition;
end;
$$;
