# Bravi Rewards Core v0.5

Bravi Rewards is the authoritative liability and wallet system for rewards created by ecosystem-company commerce. It is separate from FEP's aid funding and sponsor ledger.

## Existing repository boundary

The current Shopify/cart-match extension remains an integration and merchandising surface. It may collect or display an intent, but it is not the authoritative wallet, reward journal, or FEP decision system.

## Core flow

```text
signed settled sale
→ active immutable program version
→ reward accrual journal transaction
→ wallet projection
→ goal, gift, reservation, redemption, or optional FEP giving
```

## Money-like invariants

- integer minor units only;
- every journal transaction balances;
- available balance cannot be negative;
- no double spend across gift, redemption, and FEP giving;
- refunds create linked reversals;
- captured effects are corrected with compensating transactions, never erased;
- every command is idempotent and replay-safe;
- wallet projections can be rebuilt from the journal.

## FEP boundary

A user may voluntarily direct rewards through Bravi. Bravi Rewards first reserves reward units, sends a signed intent, and captures only after FEP accepts. FEP rejection or timeout releases the reservation. FEP eligibility and priority never receive reward balance, purchase history, or giving behavior.

## Initial reference proof

- $90,000 Luzione settled sale;
- pinned 3% program version;
- $2,700 reward accrual;
- goal created without spend;
- $200 atomic gift;
- $500 optional FEP intent reservation;
- capture on FEP acceptance or release on rejection;
- refund produces linked reversal/review treatment.