do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_category_purpose') then
    create type public.finance_category_purpose as enum ('investment');
  end if;
end $$;

alter table public.finance_categories
  add column if not exists purpose public.finance_category_purpose;

alter table public.finance_categories
  drop constraint if exists finance_categories_purpose_type_check,
  add constraint finance_categories_purpose_type_check
    check (purpose is null or type = 'expense');

create unique index if not exists finance_categories_user_purpose_key
  on public.finance_categories (user_id, purpose)
  where purpose is not null;

with canonical_investments as (
  select category.id,
    row_number() over (
      partition by category.user_id
      order by category.created_at, category.id
    ) as category_rank
  from public.finance_categories category
  join public.finance_categories parent
    on parent.id = category.parent_id
   and parent.user_id = category.user_id
  where category.type = 'expense'
    and lower(trim(category.name)) = 'investments'
    and lower(trim(parent.name)) = 'wealth'
)
update public.finance_categories category
set purpose = 'investment'
from canonical_investments canonical
where category.id = canonical.id
  and canonical.category_rank = 1
  and category.purpose is null;
