import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  B03_COMPATIBILITY_PIN,
  B05_EVENT_CONTRACT,
  createEffectDisabledFepPostCommitConsumer,
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
  preMinted = {},
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
    ...preMinted,
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

function fepOwnedPostCommitEvidence(prepared, { replay = false } = {}) {
  const expected = prepared.fepEvidenceExpectation;
  const object = {
    ownerProject: expected.objectOwner,
    type: expected.objectType,
    id: expected.objectId,
    version: "fep-balanced-journal-head/sha256:" + "b".repeat(64),
  };
  const receipt = {
    contractVersion: "luzione-receipt-envelope/v0.2-draft.1",
    receiptId: "fep-receipt-sha256:" + "1".repeat(64),
    commandId: expected.commandId,
    correlationId: expected.correlationId,
    tenantId: expected.tenantId,
    state: "DOMAIN_COMMITTED",
    effectAuthority: "NOT_GRANTED_BY_CONTRACT",
    idempotency: {
      key: expected.idempotencyKey,
      payloadHash: expected.payloadHash,
      replay,
    },
    object,
    evidence: {
      eventId: expected.sourceEventId,
      outboxMessageId: "fep-no-effect-outbox-sha256:" + "2".repeat(64),
    },
  };
  return {
    source: {
      repository: B03_COMPATIBILITY_PIN.dependencyRepository,
      implementationSha: B03_COMPATIBILITY_PIN.dependencyImplementationSha,
      finalSha: B03_COMPATIBILITY_PIN.dependencyFinalSha,
      contractVersion: B03_COMPATIBILITY_PIN.dependencyContract,
    },
    apiCompatibility: {
      repository: B03_COMPATIBILITY_PIN.a02ProducerRepository,
      implementationSha: B03_COMPATIBILITY_PIN.a02ProducerImplementationSha,
      finalSha: B03_COMPATIBILITY_PIN.a02ProducerFinalSha,
      contractVersions: [...B03_COMPATIBILITY_PIN.a02ContractVersions],
      manifestDigests: structuredClone(B03_COMPATIBILITY_PIN.a02ManifestDigests),
    },
    authority: {
      receiptAuthority: B03_COMPATIBILITY_PIN.receiptAuthority,
      readbackAuthority: B03_COMPATIBILITY_PIN.readbackAuthority,
      derivedAfterAtomicAppend: true,
      exactTenantHeadQuery: true,
      effectsEnabled: false,
      runtimeActivation: false,
      productionMigration: false,
    },
    receipt,
    readback: {
      contractVersion: "luzione-readback-envelope/v0.2-draft.1",
      tenantId: expected.tenantId,
      finality: "SOURCE_CONFIRMED",
      businessFinal: true,
      freshness: {
        state: "FRESH",
        observedAt: "2026-09-03T03:19:59.000Z",
        freshUntil: "2026-09-03T03:21:00.000Z",
      },
      object: { ...object },
      evidence: {
        receiptId: receipt.receiptId,
        commandId: receipt.commandId,
        eventId: receipt.evidence.eventId,
        providerAcknowledgementRef: null,
        reconciliationId: "fep-reconciliation-sha256:" + "3".repeat(64),
        sourceReadbackRef: "fep-readback-sha256:" + "4".repeat(64),
      },
      reason: "FEP-owned journal commit was confirmed by an exact tenant/head post-commit readback.",
    },
  };
}

test("adapter pins corrected B03, exact A02 implementation/final, five contracts, and distinct manifest digests", () => {
  assert.equal(B03_COMPATIBILITY_PIN.controllerRelease, "b43e5a65c0ae8c8bcef7e015e4a3484877f736b0");
  assert.equal(B03_COMPATIBILITY_PIN.dependencyImplementationSha, "5db6cc8772c40a7127b7514c57787299ddad57a5");
  assert.equal(B03_COMPATIBILITY_PIN.dependencyFinalSha, "5db6cc8772c40a7127b7514c57787299ddad57a5");
  assert.equal(B03_COMPATIBILITY_PIN.dependencyContract, "fep-balanced-journal/v0.1-draft");
  assert.equal(B03_COMPATIBILITY_PIN.inputAuthority, "COMMAND_AND_PRECONDITION_ONLY");
  assert.equal(B03_COMPATIBILITY_PIN.receiptAuthority, "FEP_DERIVED_AFTER_ATOMIC_APPEND");
  assert.equal(B03_COMPATIBILITY_PIN.readbackAuthority, "EXACT_TENANT_HEAD_POST_COMMIT_QUERY");
  assert.equal(B03_COMPATIBILITY_PIN.a02ProducerImplementationSha, "12685f46a60edea23aaa0a5403e300bf8858066b");
  assert.equal(B03_COMPATIBILITY_PIN.a02ProducerFinalSha, "bc43d5db8fe58230d6c3d35e32a73e1e8618b71e");
  assert.deepEqual(B03_COMPATIBILITY_PIN.a02ContractVersions, [
    "luzione-shared-contracts/v0.2-draft.1",
    "luzione-identity-tenant/v0.2-draft.1",
    "luzione-command-envelope/v0.2-draft.1",
    "luzione-receipt-envelope/v0.2-draft.1",
    "luzione-readback-envelope/v0.2-draft.1",
  ]);
  assert.equal(Object.keys(B03_COMPATIBILITY_PIN.a02ArtifactSha256).length, 5);
  assert.equal(
    B03_COMPATIBILITY_PIN.a02ArtifactSha256["contracts/drafts/luzione-shared-contracts-v0.2-draft.1.manifest.json"],
    "2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7",
  );
  assert.deepEqual(B03_COMPATIBILITY_PIN.a02ManifestDigests, {
    rawFile: {
      algorithm: "sha256-raw-file-v1",
      sha256: "2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7",
    },
    canonicalJson: {
      algorithm: "sha256-canonical-json-recursive-key-sort-v1",
      sha256: "eaf983e1496187a22688ddfed45b541fe88a3e2b70a2fbc60863fae1a9484208",
    },
  });
  assert.equal(B03_COMPATIBILITY_PIN.adapter, "bravi-b03-compatibility/v0.3-postcommit-consumer");
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
  for (const preMinted of [
    { receipt: { state: "DOMAIN_COMMITTED" } },
    { readback: { finality: "SOURCE_CONFIRMED" } },
    { finality: "SOURCE_CONFIRMED" },
    { businessFinal: true },
    { committedObjectVersion: "fep-balanced-journal-head/sha256:" + "a".repeat(64) },
  ]) {
    assert.throws(
      () => signedEnvelope({ preMinted }),
      (error) => error?.code === "CALLER_COMMITTED_STATE_FORBIDDEN",
    );
  }
});

test("kill switch and missing adapter identity fail closed before reconciliation", () => {
  const event = signedEnvelope();
  assert.equal(createEffectDisabledFepReconciler().reconcile(event).reason, "kill_switch_disabled");
  assert.equal(createEffectDisabledFepReconciler({ enabled: true }).reconcile(event).reason, "adapter_configuration_missing");
});

test("signed settlement prepares command-only input and exposes explicit zero effects", () => {
  const adapter = reconciler();
  const event = signedEnvelope();
  const first = adapter.reconcile(event);
  const duplicate = adapter.reconcile(event);

  assert.equal(first.status, "prepared_no_effect");
  assert.equal(first.phase, "COMMAND_AND_PRECONDITION_ONLY");
  assert.equal(first.amountMinor, 250);
  assert.equal(first.effectPosture, "NO_EFFECT");
  assert.equal(first.effectApplied, false);
  assert.equal(first.journalWritePerformed, false);
  assert.equal(first.canonicalReadbackPerformed, false);
  assert.equal(first.domainWritePerformed, false);
  assert.equal(first.providerCallPerformed, false);
  assert.equal(first.moneyMovementPerformed, false);
  assert.equal(first.refundIssued, false);
  assert.equal(first.fepSubmissionBoundary.receiptIncluded, false);
  assert.equal(first.fepSubmissionBoundary.readbackIncluded, false);
  assert.equal(first.fepSubmissionBoundary.finalityIncluded, false);
  assert.equal(first.fepSubmissionBoundary.committedObjectVersionIncluded, false);
  assert.equal("receipt" in first, false);
  assert.equal("readback" in first, false);
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

  assert.equal(adapter.reconcile(signedEnvelope({ sourceSequence: 2 })).status, "prepared_no_effect");
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
  assert.equal(adapter.reconcile(event).status, "prepared_no_effect");
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
  assert.equal(adapter.reconcile(settlement).status, "prepared_no_effect");

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
  assert.equal(partialResult.status, "prepared_no_effect");
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

test("checkout and refund envelopes cannot smuggle committed or final state", () => {
  const event = signedEnvelope();
  const preMinted = structuredClone(event);
  preMinted.receipt = { state: "DOMAIN_COMMITTED" };
  assert.equal(reconciler().reconcile(preMinted).reason, "caller_committed_state_forbidden");

  assert.throws(
    () => signedEnvelope({
      payload: refundPayload(100),
      topic: "refunds/create",
      webhookId: "wh_refund_preminted",
      sourceSequence: 2,
      preMinted: { readback: { finality: "SOURCE_CONFIRMED", businessFinal: true } },
    }),
    (error) => error?.code === "CALLER_COMMITTED_STATE_FORBIDDEN",
  );
});

test("separate consumer accepts only pinned FEP-owned post-commit receipt/readback with zero local effects", () => {
  const prepared = reconciler().reconcile(signedEnvelope());
  const evidence = fepOwnedPostCommitEvidence(prepared);
  const consumer = createEffectDisabledFepPostCommitConsumer({
    enabled: true,
    expectedTenantId: TENANT_ID,
    clock: () => CLOCK,
  });
  const confirmed = consumer.consume(prepared, evidence);
  assert.equal(confirmed.status, "fep_post_commit_confirmed_no_effect");
  assert.equal(confirmed.sourceFinality, "SOURCE_CONFIRMED");
  assert.equal(confirmed.fepBusinessFinal, true);
  assert.equal(confirmed.businessFinal, false);
  assert.equal(confirmed.postCommitEvidenceConsumed, true);
  assert.equal(confirmed.effectApplied, false);
  assert.equal(confirmed.domainWritePerformed, false);
  assert.equal(confirmed.journalWritePerformed, false);
  assert.equal(confirmed.canonicalReadbackPerformed, false);
  assert.equal(confirmed.providerCallPerformed, false);
  assert.equal(confirmed.moneyMovementPerformed, false);
  assert.equal(confirmed.refundIssued, false);

  const duplicate = consumer.consume(prepared, evidence);
  assert.equal(duplicate.status, "duplicate_fep_post_commit_no_effect");
  assert.equal(consumer.snapshot().consumedCommitCount, 1);

  const recoveredConsumer = createEffectDisabledFepPostCommitConsumer({
    enabled: true,
    expectedTenantId: TENANT_ID,
    clock: () => CLOCK,
  });
  const recovered = recoveredConsumer.consume(prepared, fepOwnedPostCommitEvidence(prepared, { replay: true }));
  assert.equal(recovered.status, "fep_post_commit_replay_confirmed_no_effect");
  assert.equal(recovered.fepBusinessFinal, true);
  assert.equal(recovered.domainWritePerformed, false);
});

test("post-commit consumer fails closed on tenant, pin, authority, freshness, provider, and schema drift", () => {
  const prepared = reconciler().reconcile(signedEnvelope());
  const consume = (evidence, preparedValue = prepared) => createEffectDisabledFepPostCommitConsumer({
    enabled: true,
    expectedTenantId: TENANT_ID,
    clock: () => CLOCK,
  }).consume(preparedValue, evidence);

  const crossTenantPrepared = structuredClone(prepared);
  crossTenantPrepared.fepEvidenceExpectation.tenantId = "tenant-other";
  assert.equal(consume(fepOwnedPostCommitEvidence(prepared), crossTenantPrepared).reason, "post_commit_tenant_mismatch");

  const sourceDrift = fepOwnedPostCommitEvidence(prepared);
  sourceDrift.source.implementationSha = "0".repeat(40);
  assert.equal(consume(sourceDrift).reason, "fep_source_pin_mismatch");

  const apiDrift = fepOwnedPostCommitEvidence(prepared);
  apiDrift.apiCompatibility.manifestDigests.canonicalJson.sha256 = "0".repeat(64);
  assert.equal(consume(apiDrift).reason, "api_compatibility_pin_mismatch");

  const effectSmuggling = fepOwnedPostCommitEvidence(prepared);
  effectSmuggling.authority.effectsEnabled = true;
  assert.equal(consume(effectSmuggling).reason, "post_commit_authority_invalid");

  const uncommittedReceipt = fepOwnedPostCommitEvidence(prepared);
  uncommittedReceipt.receipt.state = "DISPATCH_PENDING";
  assert.equal(consume(uncommittedReceipt).reason, "fep_receipt_invalid");

  const idempotencyDrift = fepOwnedPostCommitEvidence(prepared);
  idempotencyDrift.receipt.idempotency.payloadHash = "0".repeat(64);
  assert.equal(consume(idempotencyDrift).reason, "fep_receipt_idempotency_mismatch");

  const staleReadback = fepOwnedPostCommitEvidence(prepared);
  staleReadback.readback.freshness.freshUntil = "2026-09-03T03:19:00.000Z";
  assert.equal(consume(staleReadback).reason, "fep_readback_stale");

  const providerEvidence = fepOwnedPostCommitEvidence(prepared);
  providerEvidence.readback.evidence.providerAcknowledgementRef = "provider-smuggling";
  assert.equal(consume(providerEvidence).reason, "fep_readback_evidence_mismatch");

  const extraRootState = fepOwnedPostCommitEvidence(prepared);
  extraRootState.providerEffect = true;
  assert.equal(consume(extraRootState).reason, "post_commit_schema_shape_mismatch");
});

test("post-commit consumer detects changed evidence under one tenant/idempotency binding", () => {
  const prepared = reconciler().reconcile(signedEnvelope());
  const consumer = createEffectDisabledFepPostCommitConsumer({
    enabled: true,
    expectedTenantId: TENANT_ID,
    clock: () => CLOCK,
  });
  assert.equal(
    consumer.consume(prepared, fepOwnedPostCommitEvidence(prepared)).status,
    "fep_post_commit_confirmed_no_effect",
  );
  const conflict = fepOwnedPostCommitEvidence(prepared);
  conflict.receipt.object.version = "fep-balanced-journal-head/sha256:" + "c".repeat(64);
  conflict.readback.object.version = conflict.receipt.object.version;
  assert.equal(consumer.consume(prepared, conflict).reason, "fep_post_commit_conflict");
  assert.equal(consumer.snapshot().consumedCommitCount, 1);
});

test("post-commit consumer kill switch and missing tenant configuration fail closed", () => {
  const prepared = reconciler().reconcile(signedEnvelope());
  const evidence = fepOwnedPostCommitEvidence(prepared);
  assert.equal(
    createEffectDisabledFepPostCommitConsumer().consume(prepared, evidence).reason,
    "post_commit_consumer_kill_switch_disabled",
  );
  assert.equal(
    createEffectDisabledFepPostCommitConsumer({ enabled: true }).consume(prepared, evidence).reason,
    "post_commit_consumer_configuration_missing",
  );
});
