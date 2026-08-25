# Shopify ingestion reference v0.6

This package is a shadow-only reference adapter for authenticated Shopify webhooks. It does not mutate a Bravvi Rewards wallet, FEP funding pool, order, payment, or external provider.

## Boundary

The adapter:

- verifies the Shopify HMAC against the exact raw request body before parsing JSON;
- derives a durable source-event identity from shop domain plus Shopify webhook ID;
- maps supported topics to canonical economic/privacy events;
- calculates an eligible merchandise basis using integer minor units;
- excludes configured product/variant IDs and gift cards;
- pins every economic event to an immutable reward-program id/version/rate/currency;
- emits linked refund reversal intent rather than performing a balance mutation;
- treats cancellation alone as non-economic;
- emits privacy/uninstall events without carrying customer email or phone data.

The authoritative Rewards service must independently enforce replay protection, original-accrual linkage, reversal caps, account binding, program state, and ledger balance before any wallet state changes.

## Supported topics

- `orders/paid` → `ORDER_SETTLED`
- `orders/cancelled` → `ORDER_CANCELLED`
- `refunds/create` → `REFUND_RECORDED`
- `app/uninstalled` → `APP_UNINSTALLED`
- `customers/data_request` → `PRIVACY_CUSTOMER_DATA_REQUEST`
- `customers/redact` → `PRIVACY_CUSTOMER_REDACT`
- `shop/redact` → `PRIVACY_SHOP_REDACT`

## Run

```bash
npm test
```

The reference test suite includes the canonical `$90,000 × 3% = $2,700` case.

## Production gate

Do not connect this adapter to production wallet mutation until a server-only authenticated webhook endpoint, durable inbox, connection registry, customer/account binding, program-version registry, replay/conflict handling, observability, and reconciliation runbooks are installed and validated.
