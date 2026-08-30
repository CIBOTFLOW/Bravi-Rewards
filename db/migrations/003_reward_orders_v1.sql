-- Bravi Rewards gift-card order lifecycle v1
-- Requires 001_rewards_core_v1.sql and 002_rewards_journal_integrity.sql.

create table if not exists rewards_core.reward_orders (
  reward_order_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  spender_wallet_id uuid not null references rewards_core.wallets(wallet_id) on delete restrict,
  reservation_id uuid not null unique references rewards_core.reservations(reservation_id) on delete restrict,
  selection_mode text not null check (selection_mode in (
    'SELF',
    'DIRECT_GIFT',
    'FEP_FAIR_RANDOM',
    'FEP_NEED_PRIORITY',
    'FEP_COMMUNITY_RECOGNITION'
  )),
  fep_allocation_id text,
  recipient_subject_id text,
  delivery_channel text not null check (delivery_channel in ('EMAIL','PHONE','LINK')),
  delivery_destination_digest text check (
    delivery_destination_digest is null
    or delivery_destination_digest ~ '^[0-9a-f]{64}$'
  ),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  provider text not null default 'tremendous' check (provider = 'tremendous'),
  provider_environment text not null check (provider_environment in ('sandbox','production')),
  provider_product_id text not null,
  provider_external_id text not null,
  provider_reference text,
  visibility text not null default 'PRIVATE' check (visibility in (
    'PRIVATE',
    'GIVER_AND_RECIPIENT',
    'PUBLIC_AGGREGATE',
    'PUBLIC_ATTRIBUTED'
  )),
  attribution_alias text,
  attribution_consent_at timestamptz,
  status text not null default 'RESERVED' check (status in (
    'RESERVED',
    'SUBMITTING',
    'SUBMITTED',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
    'RECONCILIATION_REQUIRED'
  )),
  idempotency_key text not null,
  correlation_id text not null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  unique (provider, provider_environment, provider_external_id),
  check (
    selection_mode = 'SELF'
    or recipient_subject_id is not null
    or delivery_destination_digest is not null
  ),
  check (
    selection_mode not like 'FEP_%'
    or (fep_allocation_id is not null and length(trim(fep_allocation_id)) > 0)
  ),
  check (
    visibility <> 'PUBLIC_ATTRIBUTED'
    or (
      attribution_consent_at is not null
      and attribution_alias is not null
      and length(trim(attribution_alias)) > 0
    )
  ),
  check (expires_at > created_at)
);

create unique index if not exists rewards_reward_orders_provider_reference_idx
  on rewards_core.reward_orders(provider, provider_environment, provider_reference)
  where provider_reference is not null;

create index if not exists rewards_reward_orders_work_queue_idx
  on rewards_core.reward_orders(status, created_at)
  where status in ('RESERVED','SUBMITTING','RECONCILIATION_REQUIRED');

create index if not exists rewards_reward_orders_fep_allocation_idx
  on rewards_core.reward_orders(tenant_id, fep_allocation_id)
  where fep_allocation_id is not null;

create table if not exists rewards_core.reward_order_events (
  reward_order_event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  reward_order_id uuid not null references rewards_core.reward_orders(reward_order_id) on delete restrict,
  event_type text not null check (event_type in (
    'RESERVED',
    'SUBMISSION_STARTED',
    'PROVIDER_ACCEPTED',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
    'RECONCILIATION_REQUIRED'
  )),
  provider_event_id text,
  event_digest text check (event_digest is null or event_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null,
  correlation_id text not null,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists rewards_reward_order_events_order_idx
  on rewards_core.reward_order_events(reward_order_id, occurred_at);

create or replace function rewards_core.reject_reward_order_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Reward order events are immutable; append a compensating event instead';
end;
$$;

drop trigger if exists rewards_reward_order_events_immutable
  on rewards_core.reward_order_events;
create trigger rewards_reward_order_events_immutable
before update or delete on rewards_core.reward_order_events
for each row execute function rewards_core.reject_reward_order_event_mutation();

-- Aggregate-only projection. It deliberately excludes recipient identifiers,
-- delivery destinations, provider references, aliases, and need-related inputs.
create or replace view rewards_core.public_reward_impact_projection as
select
  tenant_id,
  date_trunc('month', coalesce(delivered_at, submitted_at, created_at)) as impact_month,
  selection_mode,
  currency,
  count(*)::bigint as gift_card_count,
  sum(amount_minor)::bigint as gift_card_value_minor
from rewards_core.reward_orders
where visibility in ('PUBLIC_AGGREGATE','PUBLIC_ATTRIBUTED')
  and status in ('SUBMITTED','DELIVERED')
group by
  tenant_id,
  date_trunc('month', coalesce(delivered_at, submitted_at, created_at)),
  selection_mode,
  currency;

revoke all on table
  rewards_core.reward_orders,
  rewards_core.reward_order_events,
  rewards_core.public_reward_impact_projection
from public, anon, authenticated;

comment on table rewards_core.reward_orders is
  'Authoritative Bravi gift-card order state. Delivery destinations are stored only as one-way digests.';
comment on table rewards_core.reward_order_events is
  'Append-only, payload-minimized lifecycle evidence for gift-card orders.';
comment on view rewards_core.public_reward_impact_projection is
  'Aggregate gift-card impact only; never includes recipient identity, need signals, or delivery data.';
