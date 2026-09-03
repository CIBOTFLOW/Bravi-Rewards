import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  B03_COMPATIBILITY_PIN,
  B05_EVENT_CONTRACT,
  createEffectDisabledFepReconciler,
  normalizeEffectDisabledB03ShopifyEvent,
} from "../src/b03Compatibility.js";

const SECRET = "synthetic-secret";
const TENANT_ID = "tenant-synthetic-luzione";
const SHOP_DOMAIN = "synthetic-g0.myshopify.com";
const CLOCK = new Date("2026-09-03T03:20:00.000Z");
const DOLLAR_VARIANT = "8721388634166";
const CENT_VARIANT = "8720793665590";
const PROGRAM = {
  id: "luzione-rewards",
  version: "b05-g0-v0.2",
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

function paidPayload({ orderId = 91, occurredAt = "2026-09-03T03:15:00.000Z" } = {}) {
  return {
    id: orderId,
    currency: "USD",
    created_at: occurredAt,
    line_items: [
      { product_id: 1, variant_id: 2, quantity: 1, price: "100.00", total_discount: "0.00" },
      { variant_id: DOLLAR_VARIANT, quantity: 2, price: "1.00", total_discount: "0.00", properties: properties("dollars") },
      { variant_id: CENT_VARIANT, quantity: 50, price: "0.01", total_discount: "0.00", properties: properties("cents") },
    ],
  };
}

function refundPayload(amountMinor, {
  orderId = 91,
  refundId = 501,
  occurredAt = "2026-09-03T03:17:00.000Z",
} = {}) {
  const dollars = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  const refundLines = [];
  if (dollars) {
    refundLines.push({
      quantity: dollars,
      subtotal: `${dollars}.00`,
      line_item: { variant_id: DOLLAR_VARIANT, price: "1.00" },
    });
  }
  if (cents) {
    refundLines.push({
      quantity: cents,
      subtotal: `0.${String(cents).padStart(2, "0")}`,
      line_item: { variant_id: CENT_VARIANT, price: "0.01" },
    });
  }
  return {
    id: refundId,
    order_id: orderId,
    currency: "USD",
    created_at: occurredAt,
    refund_line_items: refundLines,
  };
}

function signedEnvelope({
  payload = paidPayload(),
  topic = "orders/paid",
  webhookId = "wh_paid_91",
  sourceSequence = 1,
  originalSourceEventId = null,
  program = PROGRAM,
  tenantId = TENANT_ID,
  shopDomain = SHOP_DOMAIN,
  headerShopDomain = shopDomain,
  hmacSecret = SECRET,
  signedWith = SECRET,
  synthetic = true,
} = {}) {
  const rawBody = JSON.stringify(payload);
  return normalizeEffectDisabledB03ShopifyEvent({
    tenantId,
    expectedShopDomain: shopDomain,
    sourceSequence,
    originalSourceEventId,
    synthetic,
    rawBody,
    headers: {
      "x-shopify-hmac-sha256": createHmac("sha256", signedWith).update(rawBody).digest("base64"),
      "x-shopify-webhook-id": webhookId,
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": headerShopDomain,
    },
    secret: hmacSecret,
    program,
  });
}

function reconciler(overrides = {}) {
  return createEffectDisabledFepReconciler({
    enabled: true,
    expectedTenantId: TENANT_ID,
    expectedShopDomain: SHOP_DOMAIN,
    clock: () => CLOCK,
    ...overrides,
  });
}

test("adapter pins the exact B03 candidate, journal draft, A02 producer, and five contracts", () => {
  assert.equal(B03_COMPATIBILITY_PIN.controllerRelease, "b626c665d14a7baf419ec2fef42b1ee98b66a370");
  assert.equal(B03_COMPATIBILITY_PIN.dependencyImplementationSha, "5e9b64528c536b9a5b6b283422a171438f09dd48");
  assert.equal(B03_COMPATIBILITY_PIN.dependencyContract, "fep-balanced-journal/v0.1-draft");
  assert.equal(B03_COMPATIBILITY_PIN.a02ProducerImplementationSha, "f2d643a0913b888809c217adfd9bdcef0385b05a");
  assert.deepEqual(B03_COMPATIBILITY_PIN.a02ContractVersions, [
    "luzione-shared-contracts/v0.2-draft.1",
    "luzione-identity-tenant/v0.2-draft.1",
    "luzione-command-envelope/v0.2-draft.1",
    "luzione-receipt-envelope/v0.2-draft.1",
    "luzione-readback-envelope/v0.2-draft.1",
  ]);
  assert.equal(Object.keys(B03_COMPATIBILITY_PIN.a02ArtifactSha256).length, 5);
  assert.equal(B03_COMPATIBILITY_PIN.adapter, "bravi-b03-compatibility/v0.2");
  assert.equal(B03_COMPATIBILITY_PIN.effectPosture, "NO_EFFECT");
});

test("normalization validates the exact raw-body HMAC and binds a synthetic server identity", () => {
  const event = signedEnvelope();
  assert.equal(event.schemaVersion, B05_EVENT_CONTRACT);
  assert.equal(event.signatureEvidence.verified, true);
  assert.equal(event.signatureEvidence.algorithm, "SHOPIFY_HMAC_SHA256");
  assert.equal(event.signatureEvidence.rawBodySha256.length, 64);
  assert.equal(event.identity.serverDerived, true);
  assert.equal(event.identity.tenantId, TENANT_ID);
  assert.equal(event.identity.shopDomain, SHOP_DOMAIN);
  assert.equal(event.authority.effectMode, "DISABLED");

  assert.throws(
    () => signedEnvelope({ signedWith: "wrong-secret" }),
    /HMAC verification failed/,
  );
  assert.throws(
    () => signedEnvelope({ headerShopDomain: "other-shop.myshopify.com" }),
    /expected synthetic shop/,
  );
  assert.throws(
    () => signedEnvelope({ synthetic: false }),
    (error) => error?.code === "SYNTHETIC_MODE_REQUIRED",
  );
});

test("kill switch and missing adapter identity fail closed before reconciliation", () => {
  const event = signedEnvelope();
  assert.equal(createEffectDisabledFepReconciler().reconcile(event).reason, "kill_switch_disabled");
  assert.equal(createEffectDisabledFepReconciler({ enabled: true }).reconcile(event).reason, "adapter_configuration_missing");
});

test("signed settlement is accepted once and exposes explicit zero-effect journal/readback", () => {
  const adapter = reconciler();
  const event = signedEnvelope();
  const first = adapter.reconcile(event);
  const duplicate = adapter.reconcile(event);

  assert.equal(first.status, "accepted_no_effect");
  assert.equal(first.amountMinor, 250);
  assert.equal(first.effectPosture, "NO_EFFECT");
  assert.equal(first.effectApplied, false);
  assert.equal(first.journalWritePerformed, false);
  assert.equal(first.canonicalReadbackPerformed, false);
  assert.equal(first.syntheticJournal.effectMode, "DISABLED");
  assert.equal(first.syntheticJournal.appendPerformed, false);
  assert.equal(first.syntheticReadback.businessFinal, false);
  assert.equal(duplicate.status, "duplicate_no_effect");
  assert.equal(duplicate.effectApplied, false);
  assert.equal(adapter.snapshot().seenEventCount, 1);
});

test("contract, program, tenant, identity, effect, and source hash drift fail closed", () => {
  const base = signedEnvelope();
  const cases = [
    [() => ({ ...structuredClone(base), schemaVersion: "bravi-shopify-fep-event/v9" }), "event_contract_version_drift"],
    [() => {
      const value = structuredClone(base);
      value.contractPins.fepProducerImplementationSha = "0".repeat(40);
      return value;
    }, "producer_or_contract_version_drift"],
    [() => signedEnvelope({ program: { ...PROGRAM, version: "b05-stale" } }), "program_version_drift"],
    [() => {
      const value = structuredClone(base);
      value.identity.tenantId = "tenant-other";
      return value;
    }, "tenant_mismatch"],
    [() => {
      const value = structuredClone(base);
      value.identity.serverDerived = false;
      return value;
    }, "identity_not_server_derived"],
    [() => {
      const value = structuredClone(base);
      value.authority.effectMode = "ENABLED";
      return value;
    }, "effect_authority_forbidden"],
    [() => {
      const value = structuredClone(base);
      value.sourceEventHash = "0".repeat(64);
      return value;
    }, "source_event_hash_mismatch"],
  ];

  for (const [makeEvent, reason] of cases) {
    assert.equal(reconciler().reconcile(makeEvent()).reason, reason);
  }
});

test("stale timestamps, future timestamps, and stale stream sequences are rejected", () => {
  const adapter = reconciler();
  const stale = signedEnvelope({
    payload: paidPayload({ occurredAt: "2026-09-03T02:00:00.000Z" }),
  });
  const future = signedEnvelope({
    payload: paidPayload({ occurredAt: "2026-09-03T03:22:00.000Z" }),
    webhookId: "wh_future",
  });
  assert.equal(adapter.reconcile(stale).reason, "event_stale");
  assert.equal(adapter.reconcile(future).reason, "event_from_future");

  assert.equal(adapter.reconcile(signedEnvelope({ sourceSequence: 2 })).status, "accepted_no_effect");
  const behind = signedEnvelope({
    payload: paidPayload({ orderId: 92 }),
    webhookId: "wh_paid_92",
    sourceSequence: 1,
  });
  assert.equal(adapter.reconcile(behind).reason, "stale_source_sequence");
});

test("same source identity with changed signed-envelope evidence is a collision", () => {
  const adapter = reconciler();
  const event = signedEnvelope();
  assert.equal(adapter.reconcile(event).status, "accepted_no_effect");
  const collision = structuredClone(event);
  collision.signatureEvidence.rawBodySha256 = "f".repeat(64);
  assert.equal(adapter.reconcile(collision).reason, "source_event_collision");
});

test("refund requires the exact settlement, freshness, currency, and remaining amount", () => {
  const missing = reconciler().reconcile(signedEnvelope({
    payload: refundPayload(100),
    topic: "refunds/create",
    webhookId: "wh_refund_missing",
    sourceSequence: 2,
    originalSourceEventId: "synthetic-g0.myshopify.com:wh_paid_91",
  }));
  assert.equal(missing.reason, "original_settlement_missing");

  const adapter = reconciler();
  const settlement = signedEnvelope();
  assert.equal(adapter.reconcile(settlement).status, "accepted_no_effect");

  const mismatch = signedEnvelope({
    payload: refundPayload(100),
    topic: "refunds/create",
    webhookId: "wh_refund_mismatch",
    sourceSequence: 2,
    originalSourceEventId: "synthetic-g0.myshopify.com:wrong",
  });
  assert.equal(adapter.reconcile(mismatch).reason, "refund_settlement_mismatch");

  const stale = signedEnvelope({
    payload: refundPayload(100, { occurredAt: "2026-09-03T03:14:00.000Z", refundId: 502 }),
    topic: "refunds/create",
    webhookId: "wh_refund_stale",
    sourceSequence: 2,
    originalSourceEventId: settlement.sourceEvent.sourceEventId,
  });
  assert.equal(adapter.reconcile(stale).reason, "refund_stale");

  const partial = signedEnvelope({
    payload: refundPayload(100),
    topic: "refunds/create",
    webhookId: "wh_refund_partial",
    sourceSequence: 2,
    originalSourceEventId: settlement.sourceEvent.sourceEventId,
  });
  const partialResult = adapter.reconcile(partial);
  assert.equal(partialResult.status, "accepted_no_effect");
  assert.equal(partialResult.remainingMinor, 150);
  assert.equal(partialResult.journalWritePerformed, false);

  const excessive = signedEnvelope({
    payload: refundPayload(200, { refundId: 503 }),
    topic: "refunds/create",
    webhookId: "wh_refund_excess",
    sourceSequence: 3,
    originalSourceEventId: settlement.sourceEvent.sourceEventId,
  });
  const excessiveResult = adapter.reconcile(excessive);
  assert.equal(excessiveResult.reason, "reversal_exceeds_settlement");
  assert.equal(excessiveResult.remainingMinor, 150);
  assert.equal(adapter.snapshot().orders[0].refundedMinor, 100);
});
