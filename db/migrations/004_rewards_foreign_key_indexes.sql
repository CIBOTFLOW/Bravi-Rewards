-- Cover Rewards foreign keys used by lifecycle joins and deletion checks.
-- Requires 001-003.

create index if not exists rewards_audit_events_tenant_idx
  on rewards_audit.events(tenant_id, created_at);

create index if not exists rewards_capability_receipts_authorization_idx
  on rewards_core.capability_effect_receipts(capability_authorization_id);

create index if not exists rewards_economic_events_program_idx
  on rewards_core.economic_events(program_version_id)
  where program_version_id is not null;

create index if not exists rewards_economic_events_reversal_idx
  on rewards_core.economic_events(reversal_of_event_id)
  where reversal_of_event_id is not null;

create index if not exists rewards_fep_intents_tenant_idx
  on rewards_core.fep_contribution_intents(tenant_id, created_at);

create index if not exists rewards_fep_intents_wallet_idx
  on rewards_core.fep_contribution_intents(wallet_id, created_at);

create index if not exists rewards_journal_accounts_wallet_idx
  on rewards_core.journal_accounts(wallet_id)
  where wallet_id is not null;

create index if not exists rewards_journal_postings_tenant_idx
  on rewards_core.journal_postings(tenant_id, created_at);

create index if not exists rewards_journal_transactions_reversal_idx
  on rewards_core.journal_transactions(reversal_of_transaction_id)
  where reversal_of_transaction_id is not null;

create index if not exists rewards_reservations_wallet_idx
  on rewards_core.reservations(wallet_id, created_at);

create index if not exists rewards_reward_orders_spender_wallet_idx
  on rewards_core.reward_orders(spender_wallet_id, created_at);
