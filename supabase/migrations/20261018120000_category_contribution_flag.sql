-- Savings/investment envelopes: contributions are plan progress, never spending.
alter table public.finance_categories
  add column if not exists is_contribution boolean not null default false;

-- Existing investment-purpose categories are contribution envelopes already.
update public.finance_categories
set is_contribution = true
where purpose = 'investment' and not is_contribution;
