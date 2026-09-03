# FEP Movement Shopify cart surface

This theme extension adds an optional, priced Fulfillment Economics Movement contribution to both the cart page and a supported side-cart drawer.

## G0 safety posture

Both theme surfaces have a default-off `Enable Movement contribution` setting.
When disabled, additions are blocked; if a contribution is already present, the
surface remains visible in a removal-only recovery state. The customer must also
check an explicit opt-in before either priced percentage button becomes available.
If a replacement add fails after removal, the client attempts to restore the
previous priced lines and reports the result in an accessible live status.

The isolated lab at `evidence/synthetic-checkout.html` runs the production theme
asset against an in-memory Shopify Cart API. It proves `$100.00 → $102.50 →
$105.00 → $100.00`, cart and drawer mounting, replacement recovery, removal, and
the kill switch without contacting Shopify, creating an order, or emitting a
payment, refund, provider, journal, or canonical-readback effect.

The adjacent compatibility adapter is pinned to the effect-disabled B03 candidate:

- controller release: `b626c665d14a7baf419ec2fef42b1ee98b66a370`
- FEP producer: `CIBOTFLOW/FEP-Platform@5e9b64528c536b9a5b6b283422a171438f09dd48`
- journal: `fep-balanced-journal/v0.1-draft`
- A02 producer: `CIBOTFLOW/Luzione-API@f2d643a0913b888809c217adfd9bdcef0385b05a`
- contracts: `luzione-shared-contracts/v0.2-draft.1`, `luzione-identity-tenant/v0.2-draft.1`, `luzione-command-envelope/v0.2-draft.1`, `luzione-receipt-envelope/v0.2-draft.1`, and `luzione-readback-envelope/v0.2-draft.1`

It accepts only signed, server-bound synthetic events and returns `NO_EFFECT`.
Settlement and refund state exists only in memory; no B03 journal write or A02
canonical readback is requested, and no response is business-final.

## Shopify product setup

Create one product named `Fulfillment Economics Movement contribution` and publish it to the Online Store channel. It must have two active variants:

| Variant | Price | Inventory | Shipping |
| --- | ---: | --- | --- |
| Dollar unit | $1.00 | Do not track | Not physical |
| Cent unit | $0.01 | Do not track | Not physical |

The extension composes an exact amount from the two variants. A $21.80 contribution is 21 dollar units plus 80 cent units. Shopify therefore owns the displayed price, cart total, checkout, tax configuration, paid order, and refund—not browser JavaScript.

The current development-store defaults are:

- Dollar variant: `8721388634166`
- Cent variant: `8720793665590`

Replace both IDs in the theme settings when installing on another store.

## Theme activation

1. Deploy or copy the entire `extensions/fep-cart-match` directory into the Shopify app project.
2. Add **FEP Movement contribution** to the Cart template where the theme supports app blocks.
3. Open **Theme settings → App embeds** and enable **FEP Movement cart drawer**.
4. Enter the same two contribution variant IDs in both surfaces.
5. Leave `Enable Movement contribution` off until B03 passes G1 and explicit G2 GO authorizes activation.
6. Save and publish the theme only after the checks below pass and explicit human G2 GO is recorded.

The drawer embed looks for common drawer elements, including Prestige-style `cart-drawer`, and inserts the compact card immediately before the drawer footer or checkout action. It listens for drawer replacement and Shopify cart events, and emits `cart:refresh` plus `shopify:cart:lines-update` after mutations.

## Required server configuration

Add both variant IDs to `fepContributionVariantIds` in the Shopify ingestion program. Those variants are automatically excluded from the rewards-earning basis. Only allowlisted variants and their settled Shopify prices count as a contribution; line-item properties are metadata, never amount authority.

Contribution normalization also requires `fepContributionEnabled: true`. When it
is false or absent, the allowlisted variants remain excluded from rewards basis
but no contribution or refund-reversal payload is emitted.

## Acceptance test

1. Add ordinary merchandise and open the side cart.
2. Select 2.5%. Confirm the contribution card reports the exact amount and the cart total increases by the same amount.
3. Change to 5%. Confirm the prior contribution is replaced rather than stacked.
4. Remove it. Confirm both contribution components disappear and the original total returns.
5. After B03 G1 and explicit G2 GO, complete a development-store test order. Confirm the signed `orders/paid` event contains a separate `fepContribution` summary while `basisMinor` excludes the contribution variants.
6. After the same gates, refund one contribution component and confirm the signed refund event emits `fepContributionReversal`.
7. Repeat on mobile, full cart, empty cart, drawer reopen, quantity change, and theme-editor preview.

Steps 5–6 are stop-gated and are not part of this G0 evidence package.

If the add action reports a configuration error, verify that both variants exist, are active, are published to Online Store, are available in the active market, and do not share the same variant ID.
