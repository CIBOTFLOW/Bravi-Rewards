import { createHash } from "node:crypto";

import { normalizeVerifiedShopifyWebhook } from "./shopify.js";

export const B05_EVENT_CONTRACT = "bravi-shopify-fep-event/v0.2-draft";

export const B03_COMPATIBILITY_PIN = immutableClone({
  controllerRelease: "b626c665d14a7baf419ec2fef42b1ee98b66a370",
  dependencyRepository: "CIBOTFLOW/FEP-Platform",
  dependencyAssignment: "B03",
  dependencyImplementationSha: "5e9b64528c536b9a5b6b283422a171438f09dd48",
  dependencyContract: "fep-balanced-journal/v0.1-draft",
  dependencyStatus: "G0_EFFECT_DISABLED_DRAFT",
  a02ProducerRepository: "CIBOTFLOW/Luzione-API",
  a02ProducerImplementationSha: "f2d643a0913b888809c217adfd9bdcef0385b05a",
  a02ContractVersions: [
    "luzione-shared-contracts/v0.2-draft.1",
    "luzione-identity-tenant/v0.2-draft.1",
    "luzione-command-envelope/v0.2-draft.1",
    "luzione-receipt-envelope/v0.2-draft.1",
    "luzione-readback-envelope/v0.2-draft.1",
  ],
  a02ArtifactSha256: {
    "contracts/drafts/luzione-shared-contracts-v0.2-draft.1.manifest.json": "d0971d0cf9aaf3f1037ef0165de4960f16aa93e13db4e033e9602a4c7a265f41",
    "contracts/drafts/identity-tenant-v0.2-draft.1.schema.json": "38a6f9b89c87df3491cbddbc7bb73e964e86a1afe1917a1751fe67814ed0506e",
    "contracts/drafts/command-envelope-v0.2-draft.1.schema.json": "aaed7baa30a4fc904f15bd8ac7076138442e9a33d8f57a49332a3a68e22cc205",
    "contracts/drafts/receipt-envelope-v0.2-draft.1.schema.json": "ca358428fa144fa10da10d26d67649c76bb6a271171f55501f15cc9cd63123bf",
    "contracts/drafts/readback-envelope-v0.2-draft.1.schema.json": "f40f42640b4c7c8c2149b9845b10e74e59911bc3c610ccaa7195a33c6b014b0c",
  },
  adapter: "bravi-b03-compatibility/v0.2",
  eventContract: B05_EVENT_CONTRACT,
  effectPosture: "NO_EFFECT",
  runtimeActivation: false,
  productionMigration: false,
});

export class B03CompatibilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "B03CompatibilityError";
    this.code = code;
  }
}

function immutableClone(value) {
  const cloned = structuredClone(value);
  const freeze = (candidate) => {
    if (!candidate || typeof candidate !== "object" || Object.isFrozen(candidate)) return;
    for (const child of Object.values(candidate)) freeze(child);
    Object.freeze(candidate);
  };
  freeze(cloned);
  return cloned;
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertText(value, code, message) {
  if (typeof value !== "string" || value.trim().length < 2 || value.length > 512) {
    throw new B03CompatibilityError(code, message);
  }
}

function exactStringSet(actual, expected) {
  return Array.isArray(actual)
    && new Set(actual).size === actual.length
    && fingerprint([...actual].sort()) === fingerprint([...expected].sort());
}

function noEffectBoundary() {
  return {
    effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
    effectApplied: false,
    journalWritePerformed: false,
    canonicalReadbackPerformed: false,
    businessFinal: false,
  };
}

function rejected(reason, details = {}) {
  return immutableClone({
    status: "rejected_no_effect",
    reason,
    ...details,
    ...noEffectBoundary(),
  });
}

function accepted(kind, details) {
  return immutableClone({
    status: "accepted_no_effect",
    kind,
    ...details,
    contractPin: B03_COMPATIBILITY_PIN,
    syntheticJournal: {
      contractVersion: B03_COMPATIBILITY_PIN.dependencyContract,
      effectMode: "DISABLED",
      appendRequested: false,
      appendPerformed: false,
    },
    syntheticReadback: {
      contractVersion: B03_COMPATIBILITY_PIN.a02ContractVersions[4],
      requested: false,
      finality: "NOT_APPLICABLE",
      businessFinal: false,
    },
    ...noEffectBoundary(),
  });
}

/**
 * Runs Shopify HMAC verification, then binds the normalized event to the exact
 * B03/A02 G0 pins and a server-derived synthetic tenant identity. Raw request
 * bodies and secrets are not retained in the resulting envelope.
 */
export function normalizeEffectDisabledB03ShopifyEvent({
  tenantId,
  expectedShopDomain,
  sourceSequence,
  originalSourceEventId = null,
  synthetic = false,
  ...shopifyInput
}) {
  if (synthetic !== true) {
    throw new B03CompatibilityError("SYNTHETIC_MODE_REQUIRED", "B05 compatibility accepts synthetic events only");
  }
  assertText(tenantId, "TENANT_ID_REQUIRED", "a synthetic tenant id is required");
  assertText(expectedShopDomain, "SHOP_DOMAIN_REQUIRED", "an allowlisted synthetic shop domain is required");
  if (!Number.isSafeInteger(sourceSequence) || sourceSequence < 1) {
    throw new B03CompatibilityError("SOURCE_SEQUENCE_INVALID", "source sequence must be a positive safe integer");
  }

  const sourceEvent = normalizeVerifiedShopifyWebhook(shopifyInput);
  if (sourceEvent.shopDomain !== expectedShopDomain) {
    throw new B03CompatibilityError("SHOP_IDENTITY_MISMATCH", "verified webhook shop does not match the expected synthetic shop");
  }

  const rawBody = Buffer.isBuffer(shopifyInput.rawBody)
    ? shopifyInput.rawBody
    : Buffer.from(String(shopifyInput.rawBody));
  const sourceEventHash = fingerprint(sourceEvent);

  return immutableClone({
    schemaVersion: B05_EVENT_CONTRACT,
    simulationMode: "SYNTHETIC_ONLY",
    contractPins: {
      controllerRelease: B03_COMPATIBILITY_PIN.controllerRelease,
      fepProducerImplementationSha: B03_COMPATIBILITY_PIN.dependencyImplementationSha,
      journalContract: B03_COMPATIBILITY_PIN.dependencyContract,
      a02ProducerImplementationSha: B03_COMPATIBILITY_PIN.a02ProducerImplementationSha,
      a02ContractVersions: B03_COMPATIBILITY_PIN.a02ContractVersions,
    },
    identity: {
      serverDerived: true,
      tenantId,
      actorType: "service",
      actorId: `shopify-webhook:${sourceEvent.shopDomain}`,
      credentialSource: "shopify-hmac",
      sourceVersion: "shopify-hmac/v1",
      shopDomain: sourceEvent.shopDomain,
    },
    signatureEvidence: {
      verified: true,
      algorithm: "SHOPIFY_HMAC_SHA256",
      rawBodySha256: createHash("sha256").update(rawBody).digest("hex"),
    },
    sourceSequence,
    originalSourceEventId,
    sourceEventHash,
    sourceEvent,
    authority: {
      isolated: true,
      syntheticOnly: true,
      effectMode: "DISABLED",
      journalAppendRequested: false,
      canonicalReadbackRequested: false,
    },
  });
}

function validatePins(event) {
  const pins = event?.contractPins;
  if (event?.schemaVersion !== B05_EVENT_CONTRACT || event?.simulationMode !== "SYNTHETIC_ONLY") {
    return "event_contract_version_drift";
  }
  if (pins?.controllerRelease !== B03_COMPATIBILITY_PIN.controllerRelease
    || pins?.fepProducerImplementationSha !== B03_COMPATIBILITY_PIN.dependencyImplementationSha
    || pins?.journalContract !== B03_COMPATIBILITY_PIN.dependencyContract
    || pins?.a02ProducerImplementationSha !== B03_COMPATIBILITY_PIN.a02ProducerImplementationSha
    || !exactStringSet(pins?.a02ContractVersions, B03_COMPATIBILITY_PIN.a02ContractVersions)) {
    return "producer_or_contract_version_drift";
  }
  return null;
}

function validateAuthority(event) {
  const authority = event?.authority;
  return authority?.isolated === true
    && authority?.syntheticOnly === true
    && authority?.effectMode === "DISABLED"
    && authority?.journalAppendRequested === false
    && authority?.canonicalReadbackRequested === false;
}

/**
 * Deterministic G0-only compatibility adapter. It validates signed synthetic
 * event envelopes and simulates settlement/refund ordering in memory. It never
 * appends the B03 journal, requests canonical readback, or calls a provider.
 */
export function createEffectDisabledFepReconciler({
  enabled = false,
  expectedTenantId = null,
  expectedShopDomain = null,
  expectedProgramVersion = "b05-g0-v0.2",
  maxEventAgeMs = 15 * 60 * 1000,
  maxFutureSkewMs = 60 * 1000,
  clock = () => new Date(),
} = {}) {
  const seen = new Map();
  const orders = new Map();
  const streams = new Map();

  function reconcile(event) {
    if (!enabled) return rejected("kill_switch_disabled");
    if (!expectedTenantId || !expectedShopDomain) return rejected("adapter_configuration_missing");

    const pinFailure = validatePins(event);
    if (pinFailure) return rejected(pinFailure);
    if (!validateAuthority(event)) return rejected("effect_authority_forbidden");
    if (event?.signatureEvidence?.verified !== true
      || event?.signatureEvidence?.algorithm !== "SHOPIFY_HMAC_SHA256"
      || !/^[a-f0-9]{64}$/.test(event?.signatureEvidence?.rawBodySha256 ?? "")
      || event?.sourceEvent?.signatureVerified !== true) {
      return rejected("signature_not_verified");
    }

    const identity = event?.identity;
    if (identity?.serverDerived !== true
      || identity?.actorType !== "service"
      || identity?.credentialSource !== "shopify-hmac"
      || identity?.sourceVersion !== "shopify-hmac/v1") {
      return rejected("identity_not_server_derived");
    }
    if (identity?.tenantId !== expectedTenantId) return rejected("tenant_mismatch");
    if (identity?.shopDomain !== expectedShopDomain
      || event?.sourceEvent?.shopDomain !== expectedShopDomain
      || identity?.actorId !== `shopify-webhook:${expectedShopDomain}`) {
      return rejected("shop_identity_mismatch");
    }
    if (!Number.isSafeInteger(event?.sourceSequence) || event.sourceSequence < 1) {
      return rejected("source_sequence_invalid");
    }
    if (!event?.sourceEvent?.sourceEventId || fingerprint(event.sourceEvent) !== event.sourceEventHash) {
      return rejected("source_event_hash_mismatch");
    }
    if (event.sourceEvent.program?.version !== expectedProgramVersion) {
      return rejected("program_version_drift");
    }

    const eventKey = `${identity.tenantId}:${event.sourceEvent.sourceEventId}`;
    const envelopeDigest = fingerprint(event);
    const priorDigest = seen.get(eventKey);
    if (priorDigest) {
      return priorDigest === envelopeDigest
        ? immutableClone({
          status: "duplicate_no_effect",
          sourceEventId: event.sourceEvent.sourceEventId,
          ...noEffectBoundary(),
        })
        : rejected("source_event_collision", { sourceEventId: event.sourceEvent.sourceEventId });
    }

    const occurredAtMs = Date.parse(event.sourceEvent.occurredAt);
    const nowMs = clock().getTime();
    if (!Number.isFinite(occurredAtMs)) return rejected("event_timestamp_invalid");
    if (occurredAtMs > nowMs + maxFutureSkewMs) return rejected("event_from_future");
    if (nowMs - occurredAtMs > maxEventAgeMs) return rejected("event_stale");

    const streamKey = `${identity.tenantId}:${expectedShopDomain}`;
    const priorSequence = streams.get(streamKey) ?? 0;
    if (event.sourceSequence <= priorSequence) {
      return rejected("stale_source_sequence", { priorSequence });
    }

    if (event.sourceEvent.eventType === "ORDER_SETTLED") {
      const contribution = event.sourceEvent.fepContribution;
      if (!contribution) return rejected("contribution_missing");
      if (contribution.metadataConsistent !== true
        || contribution.claimMatchesActual !== true
        || contribution.amountAuthority !== "SHOPIFY_SETTLED_LINE_PRICES"
        || contribution.intentVersion !== "fep-contribution-v2") {
        return rejected("contribution_metadata_invalid");
      }
      if (!Number.isSafeInteger(contribution.amountMinor) || contribution.amountMinor <= 0) {
        return rejected("contribution_amount_invalid");
      }
      const orderKey = `${identity.tenantId}:${expectedShopDomain}:${event.sourceEvent.resource?.orderId || ""}`;
      if (orderKey.endsWith(":")) return rejected("order_identity_missing");
      if (orders.has(orderKey)) return rejected("order_already_settled", { orderKey });

      orders.set(orderKey, {
        currency: event.sourceEvent.currency,
        settledMinor: contribution.amountMinor,
        refundedMinor: 0,
        settlementSourceEventId: event.sourceEvent.sourceEventId,
        settledAt: event.sourceEvent.occurredAt,
        lastSequence: event.sourceSequence,
      });
      streams.set(streamKey, event.sourceSequence);
      seen.set(eventKey, envelopeDigest);
      return accepted("contribution_settled", {
        orderKey,
        amountMinor: contribution.amountMinor,
        currency: event.sourceEvent.currency,
        sourceEventId: event.sourceEvent.sourceEventId,
        sourceSequence: event.sourceSequence,
      });
    }

    if (event.sourceEvent.eventType === "REFUND_RECORDED") {
      const reversal = event.sourceEvent.fepContributionReversal;
      if (!reversal) return rejected("contribution_reversal_missing");
      const orderKey = `${identity.tenantId}:${expectedShopDomain}:${event.sourceEvent.resource?.orderId || ""}`;
      const order = orders.get(orderKey);
      if (!order) return rejected("original_settlement_missing", { orderKey });
      if (event.originalSourceEventId !== order.settlementSourceEventId) {
        return rejected("refund_settlement_mismatch", { orderKey });
      }
      if (event.sourceEvent.currency !== order.currency) return rejected("currency_mismatch", { orderKey });
      if (event.sourceSequence <= order.lastSequence || Date.parse(event.sourceEvent.occurredAt) < Date.parse(order.settledAt)) {
        return rejected("refund_stale", { orderKey });
      }
      if (reversal.amountAuthority !== "SHOPIFY_REFUND_LINE_PRICES"
        || !Number.isSafeInteger(reversal.amountMinor)
        || reversal.amountMinor <= 0) {
        return rejected("reversal_amount_invalid", { orderKey });
      }
      const remainingMinor = order.settledMinor - order.refundedMinor;
      if (reversal.amountMinor > remainingMinor) {
        return rejected("reversal_exceeds_settlement", { orderKey, remainingMinor });
      }

      order.refundedMinor += reversal.amountMinor;
      order.lastSequence = event.sourceSequence;
      streams.set(streamKey, event.sourceSequence);
      seen.set(eventKey, envelopeDigest);
      return accepted("contribution_refund", {
        orderKey,
        amountMinor: reversal.amountMinor,
        remainingMinor: order.settledMinor - order.refundedMinor,
        currency: event.sourceEvent.currency,
        sourceEventId: event.sourceEvent.sourceEventId,
        sourceSequence: event.sourceSequence,
      });
    }

    return rejected("unsupported_event_type");
  }

  return {
    reconcile,
    snapshot() {
      return immutableClone({
        enabled,
        expectedTenantId,
        expectedShopDomain,
        effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
        effectApplied: false,
        journalWritePerformed: false,
        canonicalReadbackPerformed: false,
        seenEventCount: seen.size,
        orders: Array.from(orders, ([orderKey, value]) => ({ orderKey, ...value })),
      });
    },
  };
}
