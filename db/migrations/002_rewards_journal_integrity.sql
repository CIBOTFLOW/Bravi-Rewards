-- Bravvi Rewards journal integrity v1
-- Requires 001_rewards_core_v1.sql.
-- Enforces the same core invariants at the database boundary that the reference
-- service already enforces in memory.

alter table rewards_core.journal_transactions
  add column if not exists currency char(3);

-- Upgrade-safe backfill: a pre-existing transaction is only backfilled when all
-- of its postings agree on one currency. Anything else is an integrity failure.
update rewards_core.journal_transactions t
set currency = x.currency
from (
  select transaction_id, min(currency)::char(3) as currency
  from rewards_core.journal_postings
  group by transaction_id
  having count(distinct currency) = 1
) x
where x.transaction_id = t.transaction_id
  and t.currency is null;

do $$
begin
  if exists (select 1 from rewards_core.journal_transactions where currency is null) then
    raise exception 'cannot enforce journal currency: transaction without one canonical posting currency exists';
  end if;
end $$;

alter table rewards_core.journal_transactions
  alter column currency set not null;

create or replace function rewards_core.assert_journal_transaction_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction_id uuid := coalesce(new.transaction_id, old.transaction_id);
  v_posting_count integer;
  v_balance bigint;
  v_currency_count integer;
  v_scope_mismatches integer;
begin
  select
    count(*)::integer,
    coalesce(sum(p.amount_minor), 0)::bigint,
    count(distinct p.currency)::integer,
    count(*) filter (
      where p.tenant_id <> t.tenant_id
         or p.tenant_id <> a.tenant_id
         or p.currency <> t.currency
         or p.currency <> a.currency
    )::integer
  into v_posting_count, v_balance, v_currency_count, v_scope_mismatches
  from rewards_core.journal_transactions t
  left join rewards_core.journal_postings p on p.transaction_id = t.transaction_id
  left join rewards_core.journal_accounts a on a.account_id = p.account_id
  where t.transaction_id = v_transaction_id
  group by t.transaction_id;

  if v_posting_count is null then
    -- A deleted transaction is not a valid committed journal state. The immutable
    -- trigger below normally blocks this path; retain fail-closed behavior here.
    raise exception 'journal transaction % does not exist', v_transaction_id;
  end if;
  if v_posting_count < 2 then
    raise exception 'journal transaction % must contain at least two postings', v_transaction_id;
  end if;
  if v_balance <> 0 then
    raise exception 'journal transaction % is unbalanced by % minor units', v_transaction_id, v_balance;
  end if;
  if v_currency_count <> 1 then
    raise exception 'journal transaction % contains multiple posting currencies', v_transaction_id;
  end if;
  if v_scope_mismatches <> 0 then
    raise exception 'journal transaction % contains tenant or currency scope mismatch', v_transaction_id;
  end if;

  return null;
end;
$$;

-- Check at COMMIT so the service can insert the transaction and all postings in
-- one database transaction before the invariant is evaluated.
drop trigger if exists rewards_journal_transaction_integrity_tx on rewards_core.journal_transactions;
create constraint trigger rewards_journal_transaction_integrity_tx
after insert or update on rewards_core.journal_transactions
deferrable initially deferred
for each row execute function rewards_core.assert_journal_transaction_integrity();

drop trigger if exists rewards_journal_transaction_integrity_posting on rewards_core.journal_postings;
create constraint trigger rewards_journal_transaction_integrity_posting
after insert or update or delete on rewards_core.journal_postings
deferrable initially deferred
for each row execute function rewards_core.assert_journal_transaction_integrity();

create or replace function rewards_core.reject_journal_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Rewards journal rows are immutable; append a compensating transaction instead';
end;
$$;

drop trigger if exists rewards_journal_transactions_immutable on rewards_core.journal_transactions;
create trigger rewards_journal_transactions_immutable
before update or delete on rewards_core.journal_transactions
for each row execute function rewards_core.reject_journal_mutation();

drop trigger if exists rewards_journal_postings_immutable on rewards_core.journal_postings;
create trigger rewards_journal_postings_immutable
before update or delete on rewards_core.journal_postings
for each row execute function rewards_core.reject_journal_mutation();

-- A capability that can leave internal-test mode must be attributable and have a
-- named operational recovery owner/playbook.
alter table rewards_core.capability_authorizations
  drop constraint if exists rewards_capability_activation_attribution_check;
alter table rewards_core.capability_authorizations
  add constraint rewards_capability_activation_attribution_check check (
    authorization_state not in ('PILOT_ALLOWED','PRODUCTION_ALLOWED')
    or (
      authorized_by is not null
      and authorized_at is not null
      and operator_owner is not null
      and length(trim(operator_owner)) > 0
      and recovery_playbook_ref is not null
      and length(trim(recovery_playbook_ref)) > 0
    )
  );
