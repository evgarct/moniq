create table if not exists public.performance_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (
    event_type in (
      'web_vital',
      'navigation',
      'fetch',
      'client_error',
      'api',
      'repository',
      'db_phase',
      'mutation'
    )
  ),
  name text not null,
  route text,
  method text,
  status integer,
  duration_ms double precision,
  phase text,
  user_id_hash text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  constraint performance_events_identity_check
    check (user_id_hash is not null or session_id is not null),
  constraint performance_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

alter table public.performance_events enable row level security;

revoke all on table public.performance_events from anon;
revoke all on table public.performance_events from authenticated;

create index if not exists performance_events_created_at_idx
  on public.performance_events(created_at desc);

create index if not exists performance_events_event_type_idx
  on public.performance_events(event_type);

create index if not exists performance_events_route_idx
  on public.performance_events(route);

create index if not exists performance_events_name_idx
  on public.performance_events(name);

create index if not exists performance_events_duration_idx
  on public.performance_events(duration_ms desc)
  where duration_ms is not null;
