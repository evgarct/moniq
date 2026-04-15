-- MCP Connector: API keys and transaction batches for Claude integration

-- API keys for authenticating Claude's MCP server calls
create table mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,    -- SHA-256 hash of the actual key
  key_prefix text not null,         -- First 8 chars for display (e.g. "mnq_a1b2")
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table mcp_api_keys enable row level security;

create policy "Users can manage their own API keys"
  on mcp_api_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Batch submissions from Claude
create table mcp_transaction_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source_description text,          -- e.g. "Screenshot from Tinkoff, March 2025"
  submitted_by text,                -- Claude model / client info
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table mcp_transaction_batches enable row level security;

create policy "Users can view their own batches"
  on mcp_transaction_batches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Individual transactions within a batch
create table mcp_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references mcp_transaction_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Transaction details (from Claude's analysis)
  title text not null,
  amount numeric not null,
  occurred_at date not null,
  kind text not null check (kind in ('income', 'expense')),
  currency text,
  note text,

  -- Claude's category suggestion (by name, since Claude doesn't know IDs)
  suggested_category_name text,

  -- User's review decisions
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Resolved category (set during review)
  resolved_category_id uuid references finance_categories(id) on delete set null,
  -- Account to use (set during review)
  resolved_account_id uuid references wallets(id) on delete set null,
  -- Final transaction created after approval
  finance_transaction_id uuid references finance_transactions(id) on delete set null,

  created_at timestamptz not null default now()
);

alter table mcp_batch_items enable row level security;

create policy "Users can manage their own batch items"
  on mcp_batch_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index mcp_transaction_batches_user_id_status_idx on mcp_transaction_batches(user_id, status);
create index mcp_batch_items_batch_id_idx on mcp_batch_items(batch_id);
