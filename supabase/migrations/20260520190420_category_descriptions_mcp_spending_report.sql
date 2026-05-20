alter table public.finance_categories
  add column if not exists description text;

update public.finance_categories
set description = case lower(trim(name))
  when 'income' then 'All money received during the period. Use this root to understand available income before splitting expenses into envelopes.'
  when 'salary' then 'Regular employment income and predictable payroll deposits.'
  when 'business income' then 'Client, freelance, company, or side-business income.'
  when 'money back' then 'Refunds, cashback, reimbursements, and returned money that offsets earlier spending.'
  when 'gifts' then 'Money received as gifts, informal support, or one-off personal transfers.'
  when 'interest income' then 'Interest, yield, dividends, or other passive finance income.'
  when 'other' then 'Income that does not fit a more specific income category.'

  when 'living costs' then 'Рядовые расходы: everyday baseline spending needed for normal daily life, separate from fixed bills and pleasure spending.'
  when 'food & home' then 'Groceries, household basics, cleaning supplies, and routine home consumables.'
  when 'beauty & care' then 'Routine personal care and grooming expenses.'
  when 'pet care' then 'Pet food, supplies, vet visits, and recurring pet care.'
  when 'medical' then 'Healthcare, medicine, doctor visits, and health-related essentials.'
  when 'cosmetics' then 'Cosmetics and beauty products.'
  when 'mobile' then 'Mobile phone plans, SIM cards, and phone-related service costs.'
  when 'bureaucracy' then 'Documents, fees, registrations, public services, and administrative errands.'
  when 'transport' then 'Public transport, fuel, parking, and routine mobility costs.'

  when 'enjoy life' then 'Наслаждение жизнью: discretionary spending that improves quality of life, leisure, hobbies, travel, and fun.'
  when 'eat out & chill' then 'Restaurants, cafes, bars, delivery, and casual social time.'
  when 'english skills' then 'English lessons, learning materials, tutors, and practice subscriptions.'
  when 'shows & events' then 'Concerts, theater, cinema, exhibitions, festivals, and tickets.'
  when 'home & stuff' then 'Non-essential home items, decor, gadgets, and nice-to-have purchases.'
  when 'giving' then 'Gifts, donations, celebrations, and generosity spending.'
  when 'subscriptions' then 'Recurring digital subscriptions and memberships.'
  when 'tech & toys' then 'Technology, gadgets, accessories, and hobby gear.'
  when 'beauty' then 'Discretionary beauty, salon, and appearance-related spending.'
  when 'fitness' then 'Gym, training, sports classes, and fitness services.'
  when 'tennis' then 'Tennis lessons, court bookings, gear, and related costs.'
  when 'music' then 'Music lessons, instruments, concerts, apps, and music-related hobbies.'
  when 'banking' then 'Bank fees, card fees, exchange costs, and finance-service charges.'
  when 'streamings' then 'Streaming video, music, media, and entertainment platforms.'
  when 'ai' then 'AI tools, subscriptions, credits, and productivity assistants.'
  when 'czech skills' then 'Czech language lessons, practice, tutors, and learning materials.'
  when 'taxi' then 'Taxi, ride-hailing, and convenience transport.'
  when 'travel stay' then 'Hotels, rentals, accommodation, and lodging during trips.'
  when 'travel prep' then 'Travel preparation, luggage, visas, insurance, and pre-trip purchases.'
  when 'apple' then 'Apple products, services, accessories, and repairs.'
  when 'clothing' then 'Clothes, shoes, accessories, and wardrobe updates.'

  when 'core bills' then 'Обязательные платежи: fixed obligations and must-pay commitments that keep life running.'
  when 'rent' then 'Rent and regular housing payments.'
  when 'loans' then 'Loan payments and required debt obligations.'
  when 'mortgage' then 'Mortgage payments and housing debt obligations.'
  when 'taxes' then 'Taxes, mandatory contributions, and official payments.'
  when 'for mom' then 'Regular family support or money set aside for mom.'
  when 'insurance' then 'Insurance premiums and required protection payments.'

  when 'next & safe' then 'Краткосрочные сбережения: near-term reserves, cushions, and planned purchases that protect cash flow.'
  when 'cushion' then 'General emergency cushion and short-term safety reserve.'
  when 'cat cushion' then 'Dedicated reserve for pet-related emergencies or larger pet costs.'
  when 'big buys' then 'Short-term savings for larger planned purchases.'
  when 'travel' then 'Short-term travel savings and trip budget reserves.'

  when 'wealth' then 'Будущие инвестиции: money directed toward long-term capital, retirement, and future financial growth.'
  when 'investments' then 'Brokerage contributions, ETFs, stocks, funds, and long-term investment purchases.'
  when 'pension' then 'Pension contributions and retirement-focused savings.'

  when 'adjustment' then 'System category for wallet balance corrections and reconciliation adjustments.'
  else description
end
where description is null or trim(description) = '';

create or replace function public.mcp_get_category_spending_report_source(
  p_key_hash text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key_user_id uuid;
begin
  select user_id
  into key_user_id
  from public.mcp_api_keys
  where key_hash = p_key_hash
  limit 1;

  if key_user_id is null then
    raise exception 'Invalid MCP API key';
  end if;

  return jsonb_build_object(
    'wallets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'user_id', w.user_id,
            'name', w.name,
            'type', w.type,
            'cash_kind', w.cash_kind,
            'debt_kind', w.debt_kind,
            'balance', w.balance,
            'credit_limit', w.credit_limit,
            'currency', w.currency,
            'created_at', w.created_at
          )
          order by w.created_at desc
        )
        from public.wallets w
        where w.user_id = key_user_id
      ),
      '[]'::jsonb
    ),
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'user_id', c.user_id,
            'name', c.name,
            'description', c.description,
            'icon', c.icon,
            'type', c.type,
            'parent_id', c.parent_id,
            'is_system', c.is_system,
            'created_at', c.created_at
          )
          order by c.created_at asc
        )
        from public.finance_categories c
        where c.user_id = key_user_id
      ),
      '[]'::jsonb
    ),
    'transactions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'user_id', t.user_id,
            'title', t.title,
            'note', t.note,
            'occurred_at', t.occurred_at,
            'created_at', t.created_at,
            'status', t.status,
            'kind', t.kind,
            'amount', t.amount,
            'destination_amount', t.destination_amount,
            'fx_rate', t.fx_rate,
            'principal_amount', t.principal_amount,
            'interest_amount', t.interest_amount,
            'extra_principal_amount', t.extra_principal_amount,
            'category_id', t.category_id,
            'source_account_id', t.source_account_id,
            'destination_account_id', t.destination_account_id,
            'schedule_id', t.schedule_id,
            'schedule_occurrence_date', t.schedule_occurrence_date,
            'is_schedule_override', t.is_schedule_override,
            'allocation_id', t.allocation_id
          )
          order by t.occurred_at desc, t.created_at desc
        )
        from public.finance_transactions t
        where t.user_id = key_user_id
          and t.status = 'paid'
          and t.kind <> 'transfer'
          and t.occurred_at >= p_start_date
          and t.occurred_at <= p_end_date
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.mcp_get_category_spending_report_source(text, date, date) from public;
grant execute on function public.mcp_get_category_spending_report_source(text, date, date) to anon;
