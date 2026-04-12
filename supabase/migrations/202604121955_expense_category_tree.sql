create or replace function public.ensure_finance_category(
  _user_id uuid,
  _type public.finance_category_type,
  _name text,
  _icon text,
  _parent_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  category_id uuid;
begin
  select id
  into category_id
  from public.finance_categories
  where user_id = _user_id
    and type = _type
    and lower(trim(name)) = lower(trim(_name))
  order by
    case
      when parent_id is not distinct from _parent_id then 0
      else 1
    end,
    created_at
  limit 1;

  if category_id is null then
    insert into public.finance_categories (user_id, name, icon, type, parent_id)
    values (_user_id, _name, _icon, _type, _parent_id)
    returning id into category_id;
  else
    update public.finance_categories
    set
      name = _name,
      icon = _icon,
      parent_id = _parent_id
    where id = category_id;
  end if;

  return category_id;
end;
$$;

do $$
declare
  user_row record;
  core_bills_id uuid;
  living_costs_id uuid;
  enjoy_life_id uuid;
  next_safe_id uuid;
  wealth_id uuid;
begin
  for user_row in
    select distinct user_id
    from public.finance_categories
  loop
    core_bills_id := public.ensure_finance_category(user_row.user_id, 'expense', 'Core Bills', 'receipt');
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Rent', 'house', core_bills_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Loans', 'circle-dollar-sign', core_bills_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Mortgage', 'house', core_bills_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Taxes', 'receipt', core_bills_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'For Mom', 'heart', core_bills_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Insurance', 'shield', core_bills_id);

    living_costs_id := public.ensure_finance_category(user_row.user_id, 'expense', 'Living Costs', 'wallet');
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Food & Home', 'shopping-cart', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Beauty & Care', 'sparkles', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Pet care', 'paw-print', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Medical', 'stethoscope', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Cosmetics', 'sparkles', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Mobile', 'smartphone', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Bureaucracy', 'file-text', living_costs_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Transport', 'bus-front', living_costs_id);

    enjoy_life_id := public.ensure_finance_category(user_row.user_id, 'expense', 'Enjoy Life', 'party-popper');
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Eat Out & Chill', 'utensils-crossed', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'English skills', 'languages', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Shows & Events', 'ticket', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Home & Stuff', 'package', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Giving', 'gift', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Subscriptions', 'repeat', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Tech & Toys', 'laptop', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Beauty', 'sparkles', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Fitness', 'dumbbell', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Tennis', 'trophy', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Music', 'music-4', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Banking', 'landmark', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Streamings', 'tv', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'AI', 'bot', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Czech skills', 'languages', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Taxi', 'car', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Travel Stay', 'bed', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Travel Prep', 'luggage', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Apple', 'apple', enjoy_life_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Clothing', 'shirt', enjoy_life_id);

    next_safe_id := public.ensure_finance_category(user_row.user_id, 'expense', 'Next & Safe', 'shield');
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Cushion', 'shield', next_safe_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Cat Cushion', 'paw-print', next_safe_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Big Buys', 'shopping-bag', next_safe_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Travel', 'plane', next_safe_id);

    wealth_id := public.ensure_finance_category(user_row.user_id, 'expense', 'Wealth', 'trending-up');
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Investments', 'trending-up', wealth_id);
    perform public.ensure_finance_category(user_row.user_id, 'expense', 'Pension', 'landmark', wealth_id);
  end loop;
end $$;

drop function public.ensure_finance_category(uuid, public.finance_category_type, text, text, uuid);
