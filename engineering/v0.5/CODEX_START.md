# Bravi Rewards v0.5 — Codex Execution Prompt

Preserve the existing Shopify/cart-match extension. Add a separate authoritative rewards core; do not convert the cart extension into the wallet ledger.

## Build

- company, member, and opaque external-account links;
- immutable reward-program versions;
- signed settled sale/refund ingestion;
- double-entry reward journal;
- wallet projection with available, pending, reserved, and lifetime totals;
- goals/vision board;
- atomic gift transfer;
- reservation, capture, release, expiry, and explicit reversal;
- optional reward-to-FEP contribution intent;
- redemption catalog/order adapter boundary;
- inbox, outbox, idempotency, audit, and reconciliation.

## Required proofs

1. A $90,000 qualified Luzione sale under a pinned 3% program creates a $2,700 accrual.
2. Duplicate sale/refund/gift commands create one effect.
3. Full and partial refunds create linked reversal transactions.
4. Gifting atomically debits and credits and cannot make available balance negative.
5. Goal allocation is not authoritative spend unless reward units are reserved.
6. Reward-to-FEP giving follows reserve → signed intent → FEP accept → capture; reject/timeout → release.
7. Reward balance, purchase history, gifting, and giving are never exported as FEP eligibility features.
8. The browser never calculates authoritative balance.

## Launch posture

Keep redemptions, reward-to-FEP giving, and external production source connectors disabled until terms, liability accounting, fraud, refund, fulfillment, and reconciliation reviews pass.

Run focused tests, race/replay tests, migration validation, and write exact receipts. Continue through dependency-ready work without stopping for routine clarification.