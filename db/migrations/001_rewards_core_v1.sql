-- Bravvi Rewards authoritative persistence v1
-- DRAFT MIGRATION: do not apply to FEP or a shared product database.
-- Intended for an isolated Bravvi Rewards Supabase/Postgres project.

create extension if not exists pgcrypto;

create schema if not exists rewards_core;
create schema if not exists rewards_integration;
create schema if not exists rewards_audit;

revoke all on schema rewards_core, rewards_integration, rewards_audit from public, anon, authenticated;

create table if not exists rewards_core.tenants (
  tenant_id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  display_name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CLOSED')),
  created_at timestamptz not null default now()
);

create table if not exists rewards_core.program_versions (
  program_version_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  program_key text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('DRAFT','ACTIVE','RETIRED')),
  currency char(3) not null,
  reward_rate_bps integer not null check (reward_rate_bps between 0 and 10000),
  eligible_rules jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null,
  expires_at timestamptz,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, program_key, version),
  check (expires_at is null or expires_at > effective_at)
);

create unique index if not exists rewards_program_one_active_idx
  on rewards_core.program_versions(tenant_id, program_key)
  where status = 'ACTIVE';

create table if not exists rewards_core.wallets (
  wallet_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  subject_id text not null,
  currency char(3) not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CLOSED')),
  created_at timestamptz not null default now(),
  unique (tenant_id, subject_id, currency)
);

create table if not exists rewards_core.journal_accounts (
  account_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  wallet_id uuid references rewards_core.wallets(wallet_id) on delete restrict,
  account_code text not null,
  account_type text not null check (account_type in (
    'PLATFORM_REWARD_LIABILITY','WALLET_AVAILABLE','WALLET_PENDING','WALLET_RESERVED',
    'REDEMPTION_CLEARING','FEP_CLEARING','GIFT_CLEARING','REVERSAL_CLEARING'
  )),
  currency char(3) not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED')),
  created_at timestamptz not null default now(),
  unique (tenant_id, account_code, currency)
);

create table if not exists rewards_core.economic_events (
  economic_event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  source_system text not null,
  source_connection_id text not null,
  external_event_id text not null,
  event_type text not null check (event_type in (
    'SALE_SETTLED','REFUND_SETTLED','CHARGEBACK_SETTLED','CANCELLATION','PRIVACY_REQUEST','APP_UNINSTALLED'
  )),
  order_reference text,
  transaction_reference text,
  program_version_id uuid references rewards_core.program_versions(program_version_id) on delete restrict,
  eligible_basis_minor bigint check (eligible_basis_minor is null or eligible_basis_minor >= 0),
  currency char(3),
  occurred_at timestamptz not null,
  payload_hash text not null,
  signature_verified boolean not null default false,
  normalized_payload jsonb not null,
  reversal_of_event_id uuid references rewards_core.economic_events(economic_event_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, source_system, source_connection_id, external_event_id)
);

create table if not exists rewards_core.journal_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'ACCRUAL','SETTLE_PENDING','GIFT','RESERVE','CAPTURE','RELEASE','REDEEM','REVERSAL','CORRECTION'
  )),
  idempotency_key text not null,
  request_hash text not null,
  correlation_id text not null,
  source_type text not null,
  source_id text not null,
  reversal_of_transaction_id uuid references rewards_core.journal_transactions(transaction_id) on delete restrict,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists rewards_core.journal_postings (
  posting_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  transaction_id uuid not null references rewards_core.journal_transactions(transaction_id) on delete restrict,
  account_id uuid not null references rewards_core.journal_accounts(account_id) on delete restrict,
  amount_minor bigint not null,
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create index if not exists rewards_postings_transaction_idx
  on rewards_core.journal_postings(transaction_id);
create index if not exists rewards_postings_account_idx
  on rewards_core.journal_postings(account_id, created_at);

create table if not exists rewards_core.reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  wallet_id uuid not null references rewards_core.wallets(wallet_id) on delete restrict,
  purpose text not null check (purpose in ('GIFT','REDEMPTION','FEP_GIVING')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CAPTURED','RELEASED','EXPIRED','REVERSED')),
  captured_amount_minor bigint not null default 0 check (captured_amount_minor >= 0),
  released_amount_minor bigint not null default 0 check (released_amount_minor >= 0),
  expires_at timestamptz not null,
  idempotency_key text not null,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  check (captured_amount_minor + released_amount_minor <= amount_minor)
);

create table if not exists rewards_core.fep_contribution_intents (
  intent_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  wallet_id uuid not null references rewards_core.wallets(wallet_id) on delete restrict,
  reservation_id uuid not null unique references rewards_core.reservations(reservation_id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  fep_program_code text,
  status text not null default 'CREATED' check (status in (
    'CREATED','SENT','ACCEPTED','REJECTED','CAPTURED','RELEASED','EXPIRED','FAILED'
  )),
  request_hash text not null,
  correlation_id text not null,
  fep_reference text,
  disposition_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rewards_integration.idempotency_records (
  idempotency_record_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  response_status integer,
  response_payload jsonb,
  locked_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, scope, idempotency_key)
);

create table if not exists rewards_integration.inbox_events (
  inbox_event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  source_system text not null,
  source_connection_id text not null,
  external_event_id text not null,
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  payload jsonb not null,
  payload_hash text not null,
  signature_verified boolean not null default false,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSING','PROCESSED','REJECTED','FAILED')),
  correlation_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  unique (tenant_id, source_system, source_connection_id, external_event_id)
);

create table if not exists rewards_integration.outbox_events (
  outbox_event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  payload jsonb not null,
  payload_hash text not null,
  correlation_id text not null,
  causation_id text,
  idempotency_key text not null,
  status text not null default 'PENDING' check (status in (
    'PENDING','DISPATCHING','DISPATCHED','RETRYABLE_FAILED','PERMANENT_FAILED','CANCELLED'
  )),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  not_before timestamptz not null default now(),
  dispatched_at timestamptz,
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  check (attempts >= 0 and max_attempts > 0 and attempts <= max_attempts)
);

create index if not exists rewards_outbox_queue_idx
  on rewards_integration.outbox_events(status, not_before, created_at);

create table if not exists rewards_core.capability_authorizations (
  capability_authorization_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  capability_key text not null,
  version integer not null check (version > 0),
  environment text not null check (environment in ('development','staging','production')),
  authorization_state text not null check (authorization_state in (
    'DISABLED','INTERNAL_TEST','PILOT_ALLOWED','PRODUCTION_ALLOWED','SUSPENDED','EXPIRED'
  )),
  maximum_single_effect_minor bigint check (maximum_single_effect_minor is null or maximum_single_effect_minor >= 0),
  maximum_period_effect_minor bigint check (maximum_period_effect_minor is null or maximum_period_effect_minor >= 0),
  period_seconds integer check (period_seconds is null or period_seconds > 0),
  currency char(3),
  allowed_action_types text[] not null default '{}',
  operator_owner text,
  recovery_playbook_ref text,
  effective_at timestamptz,
  expires_at timestamptz,
  authorized_by uuid,
  authorized_at timestamptz,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, capability_key, environment, version),
  check (expires_at is null or effective_at is null or expires_at > effective_at)
);

create table if not exists rewards_core.capability_effect_receipts (
  capability_effect_receipt_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references rewards_core.tenants(tenant_id) on delete restrict,
  capability_authorization_id uuid not null references rewards_core.capability_authorizations(capability_authorization_id) on delete restrict,
  capability_key text not null,
  action_type text not null,
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency char(3),
  resource_type text not null,
  resource_id text not null,
  status text not null check (status in ('AUTHORIZED','COMPLETED','FAILED','REVERSED','CANCELLED','RECONCILIATION_REQUIRED')),
  idempotency_key text not null,
  correlation_id text not null,
  provider_reference text,
  authorized_at timestamptz not null,
  completed_at timestamptz,
  outcome_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists rewards_audit.events (
  audit_event_id bigint generated always as identity primary key,
  tenant_id uuid references rewards_core.tenants(tenant_id) on delete restrict,
  actor_type text not null,
  actor_id text,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  correlation_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Projection view only. This is not the accounting journal.
create or replace view rewards_core.wallet_projection as
select
  w.wallet_id,
  w.tenant_id,
  w.subject_id,
  w.currency,
  coalesce(sum(case a.account_type when 'WALLET_AVAILABLE' then p.amount_minor else 0 end), 0)::bigint as available_minor,
  coalesce(sum(case a.account_type when 'WALLET_PENDING' then p.amount_minor else 0 end), 0)::bigint as pending_minor,
  coalesce(sum(case a.account_type when 'WALLET_RESERVED' then p.amount_minor else 0 end), 0)::bigint as reserved_minor,
  max(p.created_at) as as_of
from rewards_core.wallets w
left join rewards_core.journal_accounts a on a.wallet_id = w.wallet_id
left join rewards_core.journal_postings p on p.account_id = a.account_id
where w.status <> 'CLOSED'
group by w.wallet_id, w.tenant_id, w.subject_id, w.currency;

-- Fail closed: no browser/client role receives direct authority access by default.
revoke all on all tables in schema rewards_core, rewards_integration, rewards_audit from public, anon, authenticated;
revoke all on all sequences in schema rewards_core, rewards_integration, rewards_audit from public, anon, authenticated;

alter default privileges in schema rewards_core revoke all on tables from public, anon, authenticated;
alter default privileges in schema rewards_integration revoke all on tables from public, anon, authenticated;
alter default privileges in schema rewards_audit revoke all on tables from public, anon, authenticated;
