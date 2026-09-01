# FEP Bravi Rewards Update Package

## Bravi member application

`apps/bravi-web` is the deployable v0.6 member experience and server-only BFF. It provides mobile-first Home, Discover, Give, Activity, and You routes, a wallet projection with degraded states, and a no-effect equal-value gift-card planner. The example `$400 / $15` plan produces 26 gift cards with $10 left unallocated.

The app does not expose gift-card order creation, provider submission, FEP recipient selection, reservations, or money movement. Production fails closed without a member-session adapter and authenticated Rewards Core connection. See `docs/BRAVI_WEB_V0_6.md`.

Replace these files in your Shopify app project:

- `extensions/fep-cart-match/blocks/fep-match.liquid`
- `extensions/fep-cart-match/blocks/fep-cart-drawer.liquid`
- `extensions/fep-cart-match/assets/fep-match.js`
- `extensions/fep-cart-match/assets/fep-match.css`

The cart-page block and side-cart embed now create a real, optional Shopify
contribution line. Enable **FEP Movement cart drawer** under Theme settings →
App embeds, and use the same $1.00 and $0.01 variant IDs on both surfaces. See
`extensions/fep-cart-match/README.md` for product configuration and the full
acceptance test.

Optional: use `pages/fep-mission-page.html` as the body content for `/pages/fep-mission` in Shopify.

## Dev-store variant IDs included as defaults

- $1.00 contribution variant: `8721388634166`
- $0.01 contribution variant: `8720793665590`

## Important copy/model change

This version removes the duplicate food/nutrients routes and reframes the widget around Bravi Rewards capacity return:

- Small business capacity
- Community projects
- Environment restoration

It also changes return handling to unused eligible value, not a blanket refund promise.

Customer-facing copy uses **Fulfillment Economics Movement**, never
"Fulfillment Economics Protocol."

## After replacing files

```bash
cd ~/Desktop/FEP-Shopify/fep-checkout-application
shopify app dev --store luzione-dev-store.myshopify.com
```

Then refresh the cart page preview.

## Tremendous webhook

The Supabase Edge Function in `supabase/functions/tremendous-webhook` verifies the
`Tremendous-Webhook-Signature` against the untouched request body. It retains only
the provider/environment, event ID, event type, and SHA-256 payload digest through
the service-only `bravi_record_webhook_event` boundary. Raw provider payloads,
recipient details, and reward links are not stored in the receipt table.

Apply both migrations in timestamp order. The consolidation migration moves the
authoritative receipt boundary to `bravi_private.provider_webhook_events` and
removes the earlier public-schema inbox only when that table is empty.

Set these Edge Function secrets without committing them to Git:

```bash
supabase secrets set \
  TREMENDOUS_WEBHOOK_SECRET='<private key returned when the webhook is created>' \
  TREMENDOUS_ENVIRONMENT='sandbox' \
  --project-ref lbsskynkwlfdexwncoud
```

Register this sandbox URL with Tremendous:

```text
https://lbsskynkwlfdexwncoud.supabase.co/functions/v1/tremendous-webhook
```

Use `https://api.tremendous.com` and `TREMENDOUS_ENVIRONMENT=production` only after
the sandbox flow has been verified end to end. The shared-project isolation
decision is recorded in
`docs/adr/0001-shared-supabase-rewards-boundary.md`.


## Tremendous order submission

The reference Rewards service now supports a reserve-first provider flow:

1. create a gift-card order at `POST /v1/gift-card-orders`;
2. submit the reserved order at `POST /v1/gift-card-orders/{id}/submit`;
3. provide the same one-time `deliveryDestination` used when reserving it.

The adapter sends one reward per provider order and uses
`bravi:{rewardOrderId}` as Tremendous's stable `external_id`. A confirmed
`200` or idempotent `201` captures the reservation. Provider conflicts,
timeouts, and ambiguous failures leave the balance reserved for reconciliation.
The response boundary retains provider IDs and statuses only; raw contacts and
LINK delivery URLs are never retained.

Configure the reference service outside source control:

```bash
TREMENDOUS_API_KEY='<sandbox bearer token>'
TREMENDOUS_ENVIRONMENT='sandbox'
TREMENDOUS_FUNDING_SOURCE_ID='BALANCE'
# Optional; when absent, each reward order's verified product ID is used.
TREMENDOUS_CAMPAIGN_ID='<campaign id>'
```

The reference adapter currently accepts USD minor units only. Keep the sandbox
base URL until product or campaign configuration, funding, delivery, webhook
deduplication, and reconciliation have passed end-to-end verification.


## Amazon essentials and work-item catalog

The workbook remains a manual research and SiteStripe review tool. Only rows
with a final ASIN, final SiteStripe URL, reviewer identity, verification
timestamp, and `VERIFIED` status may enter the runtime catalog through
`POST /v1/amazon-catalog/import`.

Use `catalog/amazon-sitestripe-import.template.json` for the API or the CSV
template for editing/export. The exact workbook mapping and fail-closed rules
are in `docs/amazon-sitestripe-import-contract.md`. Imported affiliate links
are aggregate-pool-only: they cannot mint member points or act as a recipient
eligibility signal.
