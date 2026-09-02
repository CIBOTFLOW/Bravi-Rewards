import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  B03_COMPATIBILITY_PIN,
  createEffectDisabledFepReconciler,
} from "../src/b03Compatibility.js";
import { normalizeVerifiedShopifyWebhook } from "../src/shopify.js";

const SECRET = "synthetic-secret";
const DOLLAR_VARIANT = "8721388634166";
const CENT_VARIANT = "8720793665590";
const PROGRAM = {
  id: "luzione-rewards",
  version: "b05-g0",
  rateBps: 300,
  currency: "USD",
  fepContributionVariantIds: [DOLLAR_VARIANT, CENT_VARIANT],
  fepContributionEnabled: true,
};

function properties(component, amountMinor = "250") {
  return {
    "_FEP Type": "customer_contribution",
    "_FEP Intent Version": "fep-contribution-v2",
    "_FEP Rate BPS": "250",
    "_FEP Contribution Minor": amountMinor,
    "_FEP Route Code": "where_needed_most",
    "_FEP Source": "synthetic_g0_checkout",
    "_FEP Follow Up": "no",
    "_FEP Component": component,
  };
}

function signedEvent(payload, topic, webhookId) {
  const rawBody = JSON.stringify(payload);
  return normalizeVerifiedShopifyWebhook({
    rawBody,
    headers: {
      "x-shopify-hmac-sha256": createHmac("sha256", SECRET).update(rawBody).digest("base64"),
      "x-shopify-webhook-id": webhookId,
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": "synthetic-g0.myshopify.com",
    },
    secret: SECRET,
    program: PROGRAM,
  });
}

function paidEvent() {
  return signedEvent({
    id: 91,
    currency: "USD",
    created_at: "2026-09-02T21:00:00Z",
    line_items: [
      { product_id: 1, variant_id: 2, quantity: 1, price: "100.00", total_discount: "0.00" },
      { variant_id: DOLLAR_VARIANT, quantity: 2, price: "1.00", total_discount: "0.00", properties: properties("dollars") },
      { variant_id: CENT_VARIANT, quantity: 50, price: "0.01", total_discount: "0.00", properties: properties("cents") },
    ],
  }, "orders/paid", "wh_paid_91");
}

function refundEvent(amountMinor, webhookId = "wh_refund_91") {
  const dollars = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  const refundLines = [];
  if (dollars) refundLines.push({ quantity: dollars, subtotal: `${dollars}.00`, line_item: { variant_id: DOLLAR_VARIANT, price: "1.00" } });
  if (cents) refundLines.push({ quantity: cents, subtotal: `0.${String(cents).padStart(2, "0")}`, line_item: { variant_id: CENT_VARIANT, price: "0.01" } });
  return signedEvent({
    id: webhookId,
    order_id: 91,
    currency: "USD",
    created_at: "2026-09-02T22:00:00Z",
    refund_line_items: refundLines,
  }, "refunds/create", webhookId);
}

test("adapter truthfully pins the unpublished B03 dependency and disables effects", () => {
  assert.deepEqual(B03_COMPATIBILITY_PIN, {
    controllerRelease: "19cf3a752f761a632349ab2581efc2730a557964",
    dependencyRepository: "CIBOTFLOW/FEP-Platform",
    dependencyAssignment: "B03",
    dependencyStatus: "draft_unpublished",
    adapter: "bravi-b03-compatibility/v0.1",
    effectPosture: "NO_EFFECT",
  });
});

test("kill switch fails closed before reconciliation", () => {
  const result = createEffectDisabledFepReconciler().reconcile(paidEvent());
  assert.equal(result.status, "rejected_no_effect");
  assert.equal(result.reason, "kill_switch_disabled");
});

test("signed paid event is accepted once and replay is idempotent", () => {
  const reconciler = createEffectDisabledFepReconciler({ enabled: true });
  const event = paidEvent();
  const first = reconciler.reconcile(event);
  const duplicate = reconciler.reconcile(event);
  assert.equal(first.status, "accepted_no_effect");
  assert.equal(first.amountMinor, 250);
  assert.equal(first.effectPosture, "NO_EFFECT");
  assert.equal(duplicate.status, "duplicate_no_effect");
  assert.equal(reconciler.snapshot().seenEventCount, 1);
});

test("refund requires the original settlement and cannot exceed it", () => {
  const missing = createEffectDisabledFepReconciler({ enabled: true }).reconcile(refundEvent(100));
  assert.equal(missing.reason, "original_settlement_missing");

  const reconciler = createEffectDisabledFepReconciler({ enabled: true });
  reconciler.reconcile(paidEvent());
  const partial = reconciler.reconcile(refundEvent(100));
  const excessive = reconciler.reconcile(refundEvent(200, "wh_refund_excess"));
  assert.equal(partial.status, "accepted_no_effect");
  assert.equal(partial.remainingMinor, 150);
  assert.equal(excessive.reason, "reversal_exceeds_settlement");
  assert.equal(excessive.remainingMinor, 150);
});

test("unverified and source-collision events fail closed", () => {
  const reconciler = createEffectDisabledFepReconciler({ enabled: true });
  const event = paidEvent();
  assert.equal(reconciler.reconcile({ ...event, signatureVerified: false }).reason, "signature_not_verified");
  reconciler.reconcile(event);
  assert.equal(reconciler.reconcile({ ...event, basisMinor: event.basisMinor + 1 }).reason, "source_event_collision");
});
