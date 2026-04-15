create table if not exists mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text unique not null default encode(gen_random_bytes(16), 'hex'),
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);
alter table mcp_oauth_clients enable row level security;

create table if not exists mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default encode(gen_random_bytes(32), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'mcp',
  used boolean not null default false,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);
alter table mcp_oauth_codes enable row level security;
