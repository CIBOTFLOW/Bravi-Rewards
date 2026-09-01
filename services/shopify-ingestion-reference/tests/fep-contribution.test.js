import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { normalizeVerifiedShopifyWebhook } from "../src/shopify.js";
import {
  summarizeFepContributionOrder,
  summarizeFepContributionRefund,
} from "../src/fepContribution.js";

const DOLLAR_VARIANT = "8721388634166";
const CENT_VARIANT = "8720793665590";
const VARIANTS = new Set([DOLLAR_VARIANT, CENT_VARIANT]);

function properties(component) {
  return [
    { name: "_FEP Type", value: "customer_contribution" },
    { name: "_FEP Intent Version", value: "fep-contribution-v2" },
    { name: "_FEP Rate BPS", value: "250" },
    { name: "_FEP Contribution Minor", value: "2180" },
    { name: "_FEP Route Code", value: "where_needed_most" },
    { name: "_FEP Source", value: "shopify_theme_cart" },
    { name: "_FEP Follow Up", value: "yes" },
    { name: "_FEP Component", value: component },
  ];
}

function contributionLines() {
  return [
    { variant_id: DOLLAR_VARIANT, quantity: 21, price: "1.00", total_discount: "0.00", properties: properties("dollars") },
    { variant_id: CENT_VARIANT, quantity: 80, price: "0.01", total_discount: "0.00", properties: properties("cents") },
  ];
}

test("settled Shopify prices, not browser claims, establish contribution value", () => {
  const summary = summarizeFepContributionOrder({ line_items: contributionLines() }, VARIANTS);
  assert.equal(summary.amountMinor, 2180);
  assert.equal(summary.claimedMinor, 2180);
  assert.equal(summary.claimMatchesActual, true);
  assert.equal(summary.metadataConsistent, true);
  assert.equal(summary.amountAuthority, "SHOPIFY_SETTLED_LINE_PRICES");
});

test("spoofed FEP properties on a normal product do not count", () => {
  const lines = [{ variant_id: "ordinary", quantity: 1, price: "99.00", properties: properties("dollars") }];
  assert.equal(summarizeFepContributionOrder({ line_items: lines }, VARIANTS), null);
});

test("refund summary uses allowlisted refunded contribution variants", () => {
  const refund = {
    refund_line_items: [
      { quantity: 5, subtotal: "5.00", line_item: { variant_id: DOLLAR_VARIANT, price: "1.00" } },
      { quantity: 1, subtotal: "25.00", line_item: { variant_id: "ordinary", price: "25.00" } },
    ],
  };
  assert.deepEqual(summarizeFepContributionRefund(refund, VARIANTS), {
    amountMinor: 500,
    lineCount: 1,
    amountAuthority: "SHOPIFY_REFUND_LINE_PRICES",
  });
});

test("paid-order normalization separates contribution from rewards basis", () => {
  const secret = "secret";
  const order = {
    id: 42,
    currency: "USD",
    created_at: "2026-09-01T00:00:00Z",
    line_items: [
      { product_id: 1, variant_id: 10, quantity: 1, price: "100.00", total_discount: "0.00" },
      ...contributionLines(),
    ],
  };
  const rawBody = JSON.stringify(order);
  const headers = {
    "x-shopify-hmac-sha256": createHmac("sha256", secret).update(rawBody).digest("base64"),
    "x-shopify-webhook-id": "wh_fep_1",
    "x-shopify-topic": "orders/paid",
    "x-shopify-shop-domain": "luzione-dev-store.myshopify.com",
  };
  const event = normalizeVerifiedShopifyWebhook({
    rawBody,
    headers,
    secret,
    program: {
      id: "luzione-rewards",
      version: "v4",
      rateBps: 300,
      currency: "USD",
      fepContributionVariantIds: VARIANTS,
    },
  });
  assert.equal(event.basisMinor, 10_000);
  assert.equal(event.rewardMinor, 300);
  assert.equal(event.fepContribution.amountMinor, 2180);
});
