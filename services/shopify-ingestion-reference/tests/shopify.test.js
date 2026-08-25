import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  ShopifyWebhookError,
  computeEligibleOrderBasisMinor,
  normalizeVerifiedShopifyWebhook,
  verifyShopifyHmac,
} from "../src/shopify.js";

const SECRET = "test-shopify-secret";
const PROGRAM = {
  id: "luzione-rewards",
  version: "v3",
  rateBps: 300,
  currency: "USD",
  excludedProductIds: ["999"],
  excludedVariantIds: ["888"],
  excludeGiftCards: true,
};

function signedHeaders(rawBody, topic = "orders/paid", webhookId = "wh_123") {
  return {
    "x-shopify-hmac-sha256": createHmac("sha256", SECRET).update(rawBody).digest("base64"),
    "x-shopify-webhook-id": webhookId,
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": "luzione-dev-store.myshopify.com",
  };
}

function paidOrder(overrides = {}) {
  return {
    id: 12345,
    currency: "USD",
    created_at: "2026-08-25T20:00:00Z",
    line_items: [
      {
        product_id: 101,
        variant_id: 201,
        quantity: 1,
        price: "90000.00",
        total_discount: "0.00",
        gift_card: false,
      },
    ],
    ...overrides,
  };
}

test("HMAC verification uses the exact raw body", () => {
  const raw = JSON.stringify(paidOrder());
  const header = signedHeaders(raw)["x-shopify-hmac-sha256"];
  assert.equal(verifyShopifyHmac(raw, header, SECRET), true);
  assert.equal(verifyShopifyHmac(`${raw} `, header, SECRET), false);
});

test("invalid HMAC fails before economic normalization", () => {
  const raw = JSON.stringify(paidOrder());
  assert.throws(
    () => normalizeVerifiedShopifyWebhook({
      rawBody: raw,
      headers: { ...signedHeaders(raw), "x-shopify-hmac-sha256": "bad" },
      secret: SECRET,
      program: PROGRAM,
    }),
    ShopifyWebhookError,
  );
});

test("$90,000 eligible order at 3% emits $2,700 reward value", () => {
  const raw = JSON.stringify(paidOrder());
  const event = normalizeVerifiedShopifyWebhook({ rawBody: raw, headers: signedHeaders(raw), secret: SECRET, program: PROGRAM });
  assert.equal(event.eventType, "ORDER_SETTLED");
  assert.equal(event.basisMinor, 9_000_000);
  assert.equal(event.rewardMinor, 270_000);
  assert.equal(event.currency, "USD");
  assert.equal(event.signatureVerified, true);
});

test("line discounts reduce the eligible basis", () => {
  const order = paidOrder({
    line_items: [{ product_id: 101, variant_id: 201, quantity: 2, price: "100.00", total_discount: "25.00" }],
  });
  assert.equal(computeEligibleOrderBasisMinor(order, PROGRAM), 17_500);
});

test("excluded products, variants, and gift cards never enter the basis", () => {
  const order = paidOrder({
    line_items: [
      { product_id: 999, variant_id: 1, quantity: 1, price: "500.00", total_discount: "0" },
      { product_id: 1, variant_id: 888, quantity: 1, price: "500.00", total_discount: "0" },
      { product_id: 1, variant_id: 2, quantity: 1, price: "500.00", total_discount: "0", gift_card: true },
      { product_id: 1, variant_id: 3, quantity: 1, price: "100.00", total_discount: "0" },
    ],
  });
  assert.equal(computeEligibleOrderBasisMinor(order, PROGRAM), 10_000);
});

test("same webhook identity produces the same durable source event identity", () => {
  const raw = JSON.stringify(paidOrder());
  const first = normalizeVerifiedShopifyWebhook({ rawBody: raw, headers: signedHeaders(raw), secret: SECRET, program: PROGRAM });
  const second = normalizeVerifiedShopifyWebhook({ rawBody: raw, headers: signedHeaders(raw), secret: SECRET, program: PROGRAM });
  assert.equal(first.sourceEventId, second.sourceEventId);
  assert.equal(first.sourceEventId, "luzione-dev-store.myshopify.com:wh_123");
});

test("refund events are linked to the original order and emit a capped-input reversal intent", () => {
  const refund = {
    id: 7001,
    order_id: 12345,
    created_at: "2026-08-26T10:00:00Z",
    refund_line_items: [
      {
        quantity: 1,
        subtotal: "100.00",
        line_item: { product_id: 101, variant_id: 201, price: "100.00" },
      },
    ],
  };
  const raw = JSON.stringify(refund);
  const event = normalizeVerifiedShopifyWebhook({
    rawBody: raw,
    headers: signedHeaders(raw, "refunds/create", "wh_refund_1"),
    secret: SECRET,
    program: PROGRAM,
  });
  assert.equal(event.eventType, "REFUND_RECORDED");
  assert.deepEqual(event.resource, { refundId: "7001", orderId: "12345" });
  assert.equal(event.basisMinor, 10_000);
  assert.equal(event.rewardReversalMinor, 300);
  assert.equal(event.requiresOriginalAccrualLink, true);
});

test("cancellation alone never fabricates a reward reversal", () => {
  const order = paidOrder();
  const raw = JSON.stringify(order);
  const event = normalizeVerifiedShopifyWebhook({
    rawBody: raw,
    headers: signedHeaders(raw, "orders/cancelled", "wh_cancel_1"),
    secret: SECRET,
    program: PROGRAM,
  });
  assert.equal(event.economic, false);
  assert.equal("rewardReversalMinor" in event, false);
});

test("privacy webhook stays non-economic and excludes customer PII", () => {
  const privacy = { shop_id: 44, customer: { id: 55, email: "private@example.com", phone: "+15555550100" } };
  const raw = JSON.stringify(privacy);
  const event = normalizeVerifiedShopifyWebhook({
    rawBody: raw,
    headers: signedHeaders(raw, "customers/redact", "wh_privacy_1"),
    secret: SECRET,
    program: PROGRAM,
  });
  assert.equal(event.eventType, "PRIVACY_CUSTOMER_REDACT");
  assert.equal(event.economic, false);
  assert.deepEqual(event.resource, { shopId: "44", customerId: "55" });
  assert.equal(JSON.stringify(event).includes("private@example.com"), false);
});

test("wrong currency fails closed", () => {
  const order = paidOrder({ currency: "EUR" });
  const raw = JSON.stringify(order);
  assert.throws(
    () => normalizeVerifiedShopifyWebhook({ rawBody: raw, headers: signedHeaders(raw), secret: SECRET, program: PROGRAM }),
    /currency/,
  );
});
