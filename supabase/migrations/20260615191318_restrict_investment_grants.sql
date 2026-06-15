revoke all on public.investment_instruments from anon, authenticated;
revoke all on public.investment_positions from anon, authenticated;
revoke all on public.investment_quotes from anon, authenticated;

grant select on public.investment_instruments to authenticated;
grant select, insert, update, delete on public.investment_positions to authenticated;
grant select on public.investment_quotes to authenticated;
