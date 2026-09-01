# FEP Shopify holistic handoff

## Product name

Customer-facing language uses **Fulfillment Economics Movement**. `Protocol` is not customer-facing terminology.

## One platform, three responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| Shopify checkout | Priced contribution line, cart total, payment, refund and signed commerce events | Recipient selection, eligibility or the FEP ledger |
| FEP Allocation | Reviewed allocation recommendation, restrictions and reservation request | Payment settlement or unreviewed money movement |
| FEP Platform | Canonical funding source, balanced ledger, policy, reservation, fulfillment case, evidence, reconciliation and public-safe outcome | Browser cart state as economic truth |

The shared spine is one immutable lineage:

`shop + order + line → settled contribution → funding source → allocation intent → reservation → fulfillment order → delivery evidence → reconciliation/outcome`

Every object needs a canonical ID, version, actor, timestamp and idempotency key. Systems exchange versioned events or APIs; they do not write each other's databases.

## Implemented in this package

- A priced Shopify contribution made from allowlisted $1 and $0.01 variants.
- Exact cart-total changes through Shopify Ajax Cart API.
- Compact cart-page UI and an app-embed mount for side-cart drawers.
- Theme refresh events without a forced page reload.
- Intent metadata on contribution lines.
- Signed paid/refund normalization that derives value from Shopify line prices.
- Automatic exclusion of contribution variants from the Rewards earning basis.
- Separate paid contribution and refund-reversal summaries.

## Remaining production path

1. **Durable webhook ingress** — verify HMAC, persist provider event ID, deduplicate, and acknowledge before asynchronous processing.
2. **Contribution source command** — convert `fepContribution` into one immutable FEP economic-source record keyed by shop, order and program version.
3. **Ledger posting** — post balanced pending/settled/reversal entries. Never edit a posted amount; compensate it.
4. **Allocation contract** — submit only settled, available value to FEP Allocation. An accepted recommendation creates an atomic reservation; it does not itself pay anyone.
5. **Fulfillment contract** — bind the reservation to a verified individual/case and delivery address inside the restricted FEP boundary, then create the vendor order.
6. **Evidence and reconciliation** — record provider acceptance, charge, shipment, delivery, refund and exception receipts; reconcile Shopify, vendor and ledger totals.
7. **Public-safe projection** — publish sponsor/company branding and an individual-safe funded update only after consent and policy checks. Never expose address, raw evidence or private identity.
8. **Operations** — add dead-letter handling, replay, mismatch queue, role-based approvals, kill switches, metrics and incident runbooks.

## Required state model

`CART_SELECTED → CHECKOUT_STARTED → ORDER_PAID → CONTRIBUTION_SETTLED → RESERVED → FULFILLMENT_ORDERED → DELIVERED → RECONCILED`

Side exits are `REMOVED`, `PAYMENT_FAILED`, `REFUNDED`, `RESERVATION_RELEASED`, `FULFILLMENT_FAILED`, and `REVERSED`. Each transition is a command with preconditions and an idempotency key.

## Production gate

Do not enable real allocation from checkout until duplicate webhooks produce one effect, contribution lines cannot earn rewards, refunds produce capped linked reversals, ledger entries balance, reservations cannot double-spend, private recipient data stays out of Shopify/public feeds, fulfillment exceptions are recoverable, and an end-to-end sandbox order reconciles to zero unexplained variance.
