-- Bravvi Rewards read-only invariant harness v1
-- Run after applying the migration to an isolated development/staging Rewards database.
-- Any returned row is a failure unless otherwise noted.

begin read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

-- 1. Every journal transaction must balance to zero by currency.
select
  p.transaction_id,
  p.currency,
  sum(p.amount_minor) as imbalance_minor
from rewards_core.journal_postings p
group by p.transaction_id, p.currency
having sum(p.amount_minor) <> 0;

-- 2. A transaction must not post in multiple currencies.
select transaction_id, count(distinct currency) as currencies
from rewards_core.journal_postings
group by transaction_id
having count(distinct currency) > 1;

-- 3. Reservation resolution cannot exceed the reservation.
select reservation_id, amount_minor, captured_amount_minor, released_amount_minor
from rewards_core.reservations
where captured_amount_minor < 0
   or released_amount_minor < 0
   or captured_amount_minor + released_amount_minor > amount_minor;

-- 4. Available wallet projection cannot be negative.
select wallet_id, available_minor
from rewards_core.wallet_projection
where available_minor < 0;

-- 5. Active reservation must not be expired.
select reservation_id, expires_at
from rewards_core.reservations
where status = 'ACTIVE' and expires_at <= now();

-- 6. FEP intent amount/currency must match its reservation.
select i.intent_id, i.reservation_id
from rewards_core.fep_contribution_intents i
join rewards_core.reservations r on r.reservation_id = i.reservation_id
where i.amount_minor <> r.amount_minor
   or i.currency <> r.currency
   or r.purpose <> 'FEP_GIVING';

-- 7. Settled/reversal economic events must have verified source signatures where applicable.
select economic_event_id, source_system, external_event_id, event_type
from rewards_core.economic_events
where event_type in ('SALE_SETTLED','REFUND_SETTLED','CHARGEBACK_SETTLED')
  and signature_verified is not true;

-- 8. Refund/chargeback events must link to an earlier economic event.
select economic_event_id, event_type
from rewards_core.economic_events
where event_type in ('REFUND_SETTLED','CHARGEBACK_SETTLED')
  and reversal_of_event_id is null;

-- 9. Outbox retry counters remain within bounds.
select outbox_event_id, attempts, max_attempts
from rewards_integration.outbox_events
where attempts < 0 or max_attempts <= 0 or attempts > max_attempts;

-- 10. Completed effect receipts need a completion timestamp.
select capability_effect_receipt_id, status, completed_at
from rewards_core.capability_effect_receipts
where status = 'COMPLETED' and completed_at is null;

-- 11. Production-capable authorization must be attributable and recoverable.
select capability_authorization_id, capability_key, authorization_state
from rewards_core.capability_authorizations
where authorization_state = 'PRODUCTION_ALLOWED'
  and (authorized_by is null or authorized_at is null or operator_owner is null or recovery_playbook_ref is null);

-- 12. Expired authorizations cannot remain allowed.
select capability_authorization_id, capability_key, authorization_state, expires_at
from rewards_core.capability_authorizations
where authorization_state in ('PILOT_ALLOWED','PRODUCTION_ALLOWED')
  and expires_at is not null
  and expires_at <= now();

rollback;
