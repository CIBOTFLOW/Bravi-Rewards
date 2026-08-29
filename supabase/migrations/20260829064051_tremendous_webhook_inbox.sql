create extension if not exists pgcrypto;

create table if not exists public.bravi_reward_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'tremendous' check (provider = 'tremendous'),
  provider_environment text not null check (provider_environment in ('sandbox', 'production')),
  event_uuid uuid not null,
  event_type text not null,
  provider_created_at timestamptz,
  resource_type text,
  resource_id text,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  signature_verified boolean not null default true check (signature_verified),
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (provider, provider_environment, event_uuid)
);

create index if not exists bravi_reward_provider_events_pending_idx
  on public.bravi_reward_provider_events (received_at)
  where status in ('RECEIVED', 'FAILED');

alter table public.bravi_reward_provider_events enable row level security;

revoke all on table public.bravi_reward_provider_events from anon, authenticated;
grant select, insert, update on table public.bravi_reward_provider_events to service_role;

comment on table public.bravi_reward_provider_events is
  'Server-only, idempotent inbox for verified reward-provider webhook events.';
