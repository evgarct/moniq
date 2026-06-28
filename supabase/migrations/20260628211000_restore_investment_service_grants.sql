-- Service-role automation seeds and refreshes user investment data. RLS still
-- protects authenticated clients; the service role keeps only table-level CRUD.
grant select, insert, update, delete
  on table public.investment_positions
  to service_role;
