# FEP Movement Shopify cart surface

This theme extension adds an optional, priced Fulfillment Economics Movement contribution to both the cart page and a supported side-cart drawer.

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
5. Save and publish the theme only after the checks below pass.

The drawer embed looks for common drawer elements, including Prestige-style `cart-drawer`, and inserts the compact card immediately before the drawer footer or checkout action. It listens for drawer replacement and Shopify cart events, and emits `cart:refresh` plus `shopify:cart:lines-update` after mutations.

## Required server configuration

Add both variant IDs to `fepContributionVariantIds` in the Shopify ingestion program. Those variants are automatically excluded from the rewards-earning basis. Only allowlisted variants and their settled Shopify prices count as a contribution; line-item properties are metadata, never amount authority.

## Acceptance test

1. Add ordinary merchandise and open the side cart.
2. Select 2.5%. Confirm the contribution card reports the exact amount and the cart total increases by the same amount.
3. Change to 5%. Confirm the prior contribution is replaced rather than stacked.
4. Remove it. Confirm both contribution components disappear and the original total returns.
5. Complete a development-store test order. Confirm the signed `orders/paid` event contains a separate `fepContribution` summary while `basisMinor` excludes the contribution variants.
6. Refund one contribution component. Confirm the signed refund event emits `fepContributionReversal`.
7. Repeat on mobile, full cart, empty cart, drawer reopen, quantity change, and theme-editor preview.

If the add action reports a configuration error, verify that both variants exist, are active, are published to Online Store, are available in the active market, and do not share the same variant ID.
