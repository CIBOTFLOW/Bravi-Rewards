-- Consolidate Tremendous webhook receipts into the existing private Bravi boundary.
-- The prior migration created a temporary public-schema inbox. This migration is
-- intentionally safe on both upgraded and fresh installations.

create schema if not exists bravi_private;
revoke all on schema bravi_private from public, anon, authenticated;
grant usage on schema bravi_private to service_role;

create table if not exists bravi_private.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  payload_digest text,
  unique (provider, provider_event_id)
);

create unique index if not exists bravi_provider_webhook_unique
  on bravi_private.provider_webhook_events (provider, provider_event_id);

alter table bravi_private.provider_webhook_events enable row level security;
revoke all on table bravi_private.provider_webhook_events from public, anon, authenticated;
grant select, insert, update on table bravi_private.provider_webhook_events to service_role;

comment on table bravi_private.provider_webhook_events is
  'Private idempotency and audit boundary for verified provider webhooks; raw payloads and recipient data are not retained.';

create or replace function public.bravi_record_webhook_event(
  _provider text,
  _event_id text,
  _event_type text,
  _payload_digest text
)
returns boolean
language plpgsql
security definer
set search_path = bravi_private, public
as $$
declare
  inserted boolean := false;
begin
  if _provider is null or length(trim(_provider)) = 0
     or _event_id is null or length(trim(_event_id)) = 0
     or _event_type is null or length(trim(_event_type)) = 0
     or _payload_digest is null or _payload_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid provider webhook receipt'
      using errcode = '22023';
  end if;

  insert into bravi_private.provider_webhook_events
    (provider, provider_event_id, event_type, payload_digest, status)
  values
    (trim(_provider), trim(_event_id), trim(_event_type), _payload_digest, 'received')
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.bravi_record_webhook_event(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.bravi_record_webhook_event(text, text, text, text)
  to service_role;

comment on function public.bravi_record_webhook_event(text, text, text, text) is
  'Service-only insert-once boundary for verified provider webhook metadata.';

do $$
declare
  public_event_count bigint;
begin
  if to_regclass('public.bravi_reward_provider_events') is not null then
    execute 'select count(*) from public.bravi_reward_provider_events'
      into public_event_count;
    if public_event_count <> 0 then
      raise exception
        'refusing to remove public.bravi_reward_provider_events because it contains % rows',
        public_event_count;
    end if;
    execute 'drop table public.bravi_reward_provider_events';
  end if;
end;
$$;
