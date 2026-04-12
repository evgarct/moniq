do $$
declare
  user_row record;
  income_root_id uuid;
  existing_child_id uuid;
begin
  for user_row in
    select distinct user_id
    from public.finance_categories
  loop
    select id
      into income_root_id
    from public.finance_categories
    where user_id = user_row.user_id
      and type = 'income'
      and lower(trim(name)) = 'income'
      and parent_id is null
    order by created_at
    limit 1;

    if income_root_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Income', 'banknote-arrow-up', 'income', null)
      returning id into income_root_id;
    else
      update public.finance_categories
      set icon = 'banknote-arrow-up'
      where id = income_root_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'salary'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Salary', 'briefcase-business', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Salary', icon = 'briefcase-business', parent_id = income_root_id
      where id = existing_child_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'business income'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Business income', 'building-2', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Business income', icon = 'building-2', parent_id = income_root_id
      where id = existing_child_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'money back'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Money Back', 'rotate-ccw', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Money Back', icon = 'rotate-ccw', parent_id = income_root_id
      where id = existing_child_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'gifts'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Gifts', 'gift', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Gifts', icon = 'gift', parent_id = income_root_id
      where id = existing_child_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'interest income'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Interest income', 'landmark', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Interest income', icon = 'landmark', parent_id = income_root_id
      where id = existing_child_id;
    end if;

    select id into existing_child_id
    from public.finance_categories
    where user_id = user_row.user_id and type = 'income' and lower(trim(name)) = 'other'
    order by case when parent_id = income_root_id then 0 else 1 end, created_at
    limit 1;
    if existing_child_id is null then
      insert into public.finance_categories (user_id, name, icon, type, parent_id)
      values (user_row.user_id, 'Other', 'ellipsis', 'income', income_root_id);
    else
      update public.finance_categories
      set name = 'Other', icon = 'ellipsis', parent_id = income_root_id
      where id = existing_child_id;
    end if;
  end loop;
end $$;
