# FEP Bravi Rewards Update Package

Replace these files in your Shopify app project:

- `extensions/fep-cart-match/blocks/fep-match.liquid`
- `extensions/fep-cart-match/assets/fep-match.js`
- `extensions/fep-cart-match/assets/fep-match.css`

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

## After replacing files

```bash
cd ~/Desktop/FEP-Shopify/fep-checkout-application
shopify app dev --store luzione-dev-store.myshopify.com
```

Then refresh the cart page preview.

## Tremendous webhook

The Supabase Edge Function in `supabase/functions/tremendous-webhook` verifies the
`Tremendous-Webhook-Signature` against the untouched request body, then stores each
event once in `public.bravi_reward_provider_events`.

Deploy the migration and function, then set these Edge Function secrets without
committing them to Git:

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
the sandbox flow has been verified end to end.
