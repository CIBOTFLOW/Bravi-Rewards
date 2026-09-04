import { createHash } from "node:crypto";

import { normalizeVerifiedShopifyWebhook } from "./shopify.js";

export const B05_EVENT_CONTRACT = "bravi-shopify-fep-event/v0.2-draft";

export const B03_COMPATIBILITY_PIN = immutableClone({
  controllerRelease: "b43e5a65c0ae8c8bcef7e015e4a3484877f736b0",
  dependencyRepository: "CIBOTFLOW/FEP-Platform",
  dependencyAssignment: "B03",
  dependencyImplementationSha: "5db6cc8772c40a7127b7514c57787299ddad57a5",
  dependencyFinalSha: "5db6cc8772c40a7127b7514c57787299ddad57a5",
  dependencyContract: "fep-balanced-journal/v0.1-draft",
  dependencyStatus: "G0_EFFECT_DISABLED_DRAFT",
  inputAuthority: "COMMAND_AND_PRECONDITION_ONLY",
  receiptAuthority: "FEP_DERIVED_AFTER_ATOMIC_APPEND",
  readbackAuthority: "EXACT_TENANT_HEAD_POST_COMMIT_QUERY",
  a02ProducerRepository: "CIBOTFLOW/Luzione-API",
  a02ProducerImplementationSha: "12685f46a60edea23aaa0a5403e300bf8858066b",
  a02ProducerFinalSha: "bc43d5db8fe58230d6c3d35e32a73e1e8618b71e",
  a02ContractVersions: [
    "luzione-shared-contracts/v0.2-draft.1",
    "luzione-identity-tenant/v0.2-draft.1",
    "luzione-command-envelope/v0.2-draft.1",
    "luzione-receipt-envelope/v0.2-draft.1",
    "luzione-readback-envelope/v0.2-draft.1",
  ],
  a02ArtifactSha256: {
    "contracts/drafts/luzione-shared-contracts-v0.2-draft.1.manifest.json": "2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7",
    "contracts/drafts/identity-tenant-v0.2-draft.1.schema.json": "38a6f9b89c87df3491cbddbc7bb73e964e86a1afe1917a1751fe67814ed0506e",
    "contracts/drafts/command-envelope-v0.2-draft.1.schema.json": "aaed7baa30a4fc904f15bd8ac7076138442e9a33d8f57a49332a3a68e22cc205",
    "contracts/drafts/receipt-envelope-v0.2-draft.1.schema.json": "ca358428fa144fa10da10d26d67649c76bb6a271171f55501f15cc9cd63123bf",
    "contracts/drafts/readback-envelope-v0.2-draft.1.schema.json": "f40f42640b4c7c8c2149b9845b10e74e59911bc3c610ccaa7195a33c6b014b0c",
  },
  a02ManifestDigests: {
    rawFile: {
      algorithm: "sha256-raw-file-v1",
      sha256: "2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7",
    },
    canonicalJson: {
      algorithm: "sha256-canonical-json-recursive-key-sort-v1",
      sha256: "eaf983e1496187a22688ddfed45b541fe88a3e2b70a2fbc60863fae1a9484208",
    },
  },
  adapter: "bravi-b03-compatibility/v0.3-postcommit-consumer",
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
    domainWritePerformed: false,
    journalWritePerformed: false,
    canonicalReadbackPerformed: false,
    providerCallPerformed: false,
    moneyMovementPerformed: false,
    refundIssued: false,
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

function prepared(kind, details) {
  const expectationBinding = {
    adapter: B03_COMPATIBILITY_PIN.adapter,
    tenantId: details.tenantId,
    sourceEventId: details.sourceEventId,
    sourceSequence: details.sourceSequence,
    kind,
    amountMinor: details.amountMinor,
    currency: details.currency,
  };
  const expectationDigest = fingerprint(expectationBinding);
  return immutableClone({
    status: "prepared_no_effect",
    phase: B03_COMPATIBILITY_PIN.inputAuthority,
    kind,
    ...details,
    contractPin: B03_COMPATIBILITY_PIN,
    fepSubmissionBoundary: {
      contractVersion: B03_COMPATIBILITY_PIN.dependencyContract,
      inputAuthority: B03_COMPATIBILITY_PIN.inputAuthority,
      receiptIncluded: false,
      readbackIncluded: false,
      finalityIncluded: false,
      committedObjectVersionIncluded: false,
      appendRequested: false,
      appendPerformed: false,
    },
    fepEvidenceExpectation: {
      tenantId: details.tenantId,
      sourceEventId: details.sourceEventId,
      commandId: `bravi-b05-command-sha256:${expectationDigest}`,
      correlationId: `bravi-b05-correlation-sha256:${fingerprint(details.sourceEventId)}`,
      idempotencyKey: `${details.tenantId}:${details.sourceEventId}`,
      payloadHash: expectationDigest,
      objectOwner: B03_COMPATIBILITY_PIN.dependencyRepository,
      objectType: "fep-balanced-journal",
      objectId: `fep-balanced-journal/tenant-sha256:${fingerprint(details.tenantId)}`,
    },
    ...noEffectBoundary(),
  });
}

const CALLER_COMMITTED_STATE_KEYS = Object.freeze([
  "receipt",
  "readback",
  "finality",
  "businessFinal",
  "committedObjectVersion",
  "objectVersionTransition",
]);

function includesCallerCommittedState(value) {
  return value && typeof value === "object"
    && CALLER_COMMITTED_STATE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
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
  if (includesCallerCommittedState(shopifyInput)) {
    throw new B03CompatibilityError(
      "CALLER_COMMITTED_STATE_FORBIDDEN",
      "checkout/refund input cannot supply a receipt, readback, finality, or committed object version",
    );
  }
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
      fepProducerFinalSha: B03_COMPATIBILITY_PIN.dependencyFinalSha,
      journalContract: B03_COMPATIBILITY_PIN.dependencyContract,
      a02ProducerImplementationSha: B03_COMPATIBILITY_PIN.a02ProducerImplementationSha,
      a02ProducerFinalSha: B03_COMPATIBILITY_PIN.a02ProducerFinalSha,
      a02ContractVersions: B03_COMPATIBILITY_PIN.a02ContractVersions,
      a02ManifestDigests: B03_COMPATIBILITY_PIN.a02ManifestDigests,
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
    || pins?.fepProducerFinalSha !== B03_COMPATIBILITY_PIN.dependencyFinalSha
    || pins?.journalContract !== B03_COMPATIBILITY_PIN.dependencyContract
    || pins?.a02ProducerImplementationSha !== B03_COMPATIBILITY_PIN.a02ProducerImplementationSha
    || pins?.a02ProducerFinalSha !== B03_COMPATIBILITY_PIN.a02ProducerFinalSha
    || fingerprint(pins?.a02ManifestDigests) !== fingerprint(B03_COMPATIBILITY_PIN.a02ManifestDigests)
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
    if (includesCallerCommittedState(event)) return rejected("caller_committed_state_forbidden");

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
      return prepared("contribution_settled", {
        tenantId: identity.tenantId,
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
      return prepared("contribution_refund", {
        tenantId: identity.tenantId,
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
        domainWritePerformed: false,
        journalWritePerformed: false,
        canonicalReadbackPerformed: false,
        providerCallPerformed: false,
        moneyMovementPerformed: false,
        refundIssued: false,
        seenEventCount: seen.size,
        orders: Array.from(orders, ([orderKey, value]) => ({ orderKey, ...value })),
      });
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isRecord(value)
    && fingerprint(Object.keys(value).sort()) === fingerprint([...expected].sort());
}

function matchesEvidenceId(value, prefix) {
  return typeof value === "string"
    && new RegExp(`^${prefix}[a-f0-9]{64}$`).test(value);
}

function validateFepPostCommitEvidence(preparedEvent, evidence, expectedTenantId, nowMs) {
  if (!isRecord(preparedEvent)
    || preparedEvent.status !== "prepared_no_effect"
    || preparedEvent.phase !== B03_COMPATIBILITY_PIN.inputAuthority
    || preparedEvent.businessFinal !== false
    || ["receipt", "readback", "finality", "committedObjectVersion", "objectVersionTransition"]
      .some((key) => Object.prototype.hasOwnProperty.call(preparedEvent, key))) {
    return "caller_committed_state_forbidden";
  }
  const expectation = preparedEvent.fepEvidenceExpectation;
  if (!hasExactKeys(expectation, [
    "tenantId", "sourceEventId", "commandId", "correlationId", "idempotencyKey", "payloadHash",
    "objectOwner", "objectType", "objectId",
  ])) return "prepared_expectation_invalid";
  if (expectation.tenantId !== expectedTenantId) return "post_commit_tenant_mismatch";

  if (!hasExactKeys(evidence, ["source", "apiCompatibility", "authority", "receipt", "readback"])) {
    return "post_commit_schema_shape_mismatch";
  }
  if (!hasExactKeys(evidence.source, ["repository", "implementationSha", "finalSha", "contractVersion"])
    || evidence.source.repository !== B03_COMPATIBILITY_PIN.dependencyRepository
    || evidence.source.implementationSha !== B03_COMPATIBILITY_PIN.dependencyImplementationSha
    || evidence.source.finalSha !== B03_COMPATIBILITY_PIN.dependencyFinalSha
    || evidence.source.contractVersion !== B03_COMPATIBILITY_PIN.dependencyContract) {
    return "fep_source_pin_mismatch";
  }
  if (!hasExactKeys(evidence.apiCompatibility, [
    "repository", "implementationSha", "finalSha", "contractVersions", "manifestDigests",
  ])
    || evidence.apiCompatibility.repository !== B03_COMPATIBILITY_PIN.a02ProducerRepository
    || evidence.apiCompatibility.implementationSha !== B03_COMPATIBILITY_PIN.a02ProducerImplementationSha
    || evidence.apiCompatibility.finalSha !== B03_COMPATIBILITY_PIN.a02ProducerFinalSha
    || !exactStringSet(evidence.apiCompatibility.contractVersions, B03_COMPATIBILITY_PIN.a02ContractVersions)
    || fingerprint(evidence.apiCompatibility.manifestDigests) !== fingerprint(B03_COMPATIBILITY_PIN.a02ManifestDigests)) {
    return "api_compatibility_pin_mismatch";
  }
  if (!hasExactKeys(evidence.authority, [
    "receiptAuthority", "readbackAuthority", "derivedAfterAtomicAppend", "exactTenantHeadQuery",
    "effectsEnabled", "runtimeActivation", "productionMigration",
  ])
    || evidence.authority.receiptAuthority !== B03_COMPATIBILITY_PIN.receiptAuthority
    || evidence.authority.readbackAuthority !== B03_COMPATIBILITY_PIN.readbackAuthority
    || evidence.authority.derivedAfterAtomicAppend !== true
    || evidence.authority.exactTenantHeadQuery !== true
    || evidence.authority.effectsEnabled !== false
    || evidence.authority.runtimeActivation !== false
    || evidence.authority.productionMigration !== false) {
    return "post_commit_authority_invalid";
  }

  const receipt = evidence.receipt;
  if (!hasExactKeys(receipt, [
    "contractVersion", "receiptId", "commandId", "correlationId", "tenantId", "state",
    "effectAuthority", "idempotency", "object", "evidence",
  ])
    || receipt.contractVersion !== B03_COMPATIBILITY_PIN.a02ContractVersions[3]
    || receipt.state !== "DOMAIN_COMMITTED"
    || receipt.effectAuthority !== "NOT_GRANTED_BY_CONTRACT"
    || !matchesEvidenceId(receipt.receiptId, "fep-receipt-sha256:")
    || receipt.commandId !== expectation.commandId
    || receipt.correlationId !== expectation.correlationId
    || receipt.tenantId !== expectation.tenantId) {
    return "fep_receipt_invalid";
  }
  if (!hasExactKeys(receipt.idempotency, ["key", "payloadHash", "replay"])
    || receipt.idempotency.key !== expectation.idempotencyKey
    || receipt.idempotency.payloadHash !== expectation.payloadHash
    || typeof receipt.idempotency.replay !== "boolean") {
    return "fep_receipt_idempotency_mismatch";
  }
  if (!hasExactKeys(receipt.object, ["ownerProject", "type", "id", "version"])
    || receipt.object.ownerProject !== expectation.objectOwner
    || receipt.object.type !== expectation.objectType
    || receipt.object.id !== expectation.objectId
    || !/^fep-balanced-journal-head\/sha256:[a-f0-9]{64}$/.test(receipt.object.version)) {
    return "fep_receipt_object_mismatch";
  }
  if (!hasExactKeys(receipt.evidence, ["eventId", "outboxMessageId"])
    || receipt.evidence.eventId !== expectation.sourceEventId
    || !matchesEvidenceId(receipt.evidence.outboxMessageId, "fep-no-effect-outbox-sha256:")) {
    return "fep_receipt_evidence_mismatch";
  }

  const readback = evidence.readback;
  if (!hasExactKeys(readback, [
    "contractVersion", "tenantId", "finality", "businessFinal", "freshness", "object", "evidence", "reason",
  ])
    || readback.contractVersion !== B03_COMPATIBILITY_PIN.a02ContractVersions[4]
    || readback.tenantId !== expectation.tenantId
    || readback.finality !== "SOURCE_CONFIRMED"
    || readback.businessFinal !== true
    || typeof readback.reason !== "string"
    || readback.reason.trim().length < 2) {
    return "fep_readback_invalid";
  }
  if (!hasExactKeys(readback.freshness, ["state", "observedAt", "freshUntil"])
    || readback.freshness.state !== "FRESH") return "fep_readback_stale";
  const observedAtMs = Date.parse(readback.freshness.observedAt);
  const freshUntilMs = Date.parse(readback.freshness.freshUntil);
  if (!Number.isFinite(observedAtMs) || !Number.isFinite(freshUntilMs)
    || observedAtMs > nowMs || freshUntilMs < nowMs) return "fep_readback_stale";
  if (fingerprint(readback.object) !== fingerprint(receipt.object)) return "fep_readback_object_mismatch";
  if (!hasExactKeys(readback.evidence, [
    "receiptId", "commandId", "eventId", "providerAcknowledgementRef", "reconciliationId", "sourceReadbackRef",
  ])
    || readback.evidence.receiptId !== receipt.receiptId
    || readback.evidence.commandId !== receipt.commandId
    || readback.evidence.eventId !== receipt.evidence.eventId
    || readback.evidence.providerAcknowledgementRef !== null
    || !matchesEvidenceId(readback.evidence.reconciliationId, "fep-reconciliation-sha256:")
    || !matchesEvidenceId(readback.evidence.sourceReadbackRef, "fep-readback-sha256:")) {
    return "fep_readback_evidence_mismatch";
  }
  return null;
}

/**
 * Consumes a strictly labeled B03 post-commit receipt/readback. The checkout or
 * refund caller can provide command/precondition input only; this separate
 * consumer accepts committed/final state solely from the pinned FEP boundary.
 */
export function createEffectDisabledFepPostCommitConsumer({
  enabled = false,
  expectedTenantId = null,
  clock = () => new Date(),
} = {}) {
  const consumed = new Map();

  function consume(preparedEvent, evidence) {
    if (!enabled) return rejected("post_commit_consumer_kill_switch_disabled");
    if (!expectedTenantId) return rejected("post_commit_consumer_configuration_missing");
    const validationFailure = validateFepPostCommitEvidence(
      preparedEvent,
      evidence,
      expectedTenantId,
      clock().getTime(),
    );
    if (validationFailure) return rejected(validationFailure);

    const receipt = evidence.receipt;
    const key = `${receipt.tenantId}:${receipt.idempotency.key}`;
    const commitBinding = fingerprint({
      source: evidence.source,
      tenantId: receipt.tenantId,
      commandId: receipt.commandId,
      correlationId: receipt.correlationId,
      idempotencyKey: receipt.idempotency.key,
      payloadHash: receipt.idempotency.payloadHash,
      object: receipt.object,
      receiptId: receipt.receiptId,
      eventId: receipt.evidence.eventId,
      outboxMessageId: receipt.evidence.outboxMessageId,
      reconciliationId: evidence.readback.evidence.reconciliationId,
      sourceReadbackRef: evidence.readback.evidence.sourceReadbackRef,
    });
    const prior = consumed.get(key);
    if (prior && prior !== commitBinding) return rejected("fep_post_commit_conflict");
    if (prior === commitBinding) {
      return immutableClone({
        status: "duplicate_fep_post_commit_no_effect",
        tenantId: receipt.tenantId,
        receiptId: receipt.receiptId,
        sourceFinality: evidence.readback.finality,
        fepBusinessFinal: true,
        postCommitEvidenceConsumed: true,
        ...noEffectBoundary(),
      });
    }
    consumed.set(key, commitBinding);
    return immutableClone({
      status: receipt.idempotency.replay
        ? "fep_post_commit_replay_confirmed_no_effect"
        : "fep_post_commit_confirmed_no_effect",
      tenantId: receipt.tenantId,
      receiptId: receipt.receiptId,
      objectVersion: receipt.object.version,
      sourceFinality: evidence.readback.finality,
      fepBusinessFinal: true,
      postCommitEvidenceConsumed: true,
      ...noEffectBoundary(),
    });
  }

  return {
    consume,
    snapshot() {
      return immutableClone({
        enabled,
        expectedTenantId,
        consumedCommitCount: consumed.size,
        effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
        effectApplied: false,
        domainWritePerformed: false,
        journalWritePerformed: false,
        canonicalReadbackPerformed: false,
        providerCallPerformed: false,
        moneyMovementPerformed: false,
        refundIssued: false,
      });
    },
  };
}
