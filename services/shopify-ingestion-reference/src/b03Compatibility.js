import { createHash } from "node:crypto";

export const B03_COMPATIBILITY_PIN = Object.freeze({
  controllerRelease: "19cf3a752f761a632349ab2581efc2730a557964",
  dependencyRepository: "CIBOTFLOW/FEP-Platform",
  dependencyAssignment: "B03",
  dependencyStatus: "draft_unpublished",
  adapter: "bravi-b03-compatibility/v0.1",
  effectPosture: "NO_EFFECT",
});

function fingerprint(event) {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function rejected(reason, details = {}) {
  return {
    status: "rejected_no_effect",
    reason,
    effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
    ...details,
  };
}

/**
 * Deterministic G0-only compatibility harness. It proves ordering, replay and
 * refund-cap behavior in memory; it never writes a journal or calls a provider.
 */
export function createEffectDisabledFepReconciler({ enabled = false } = {}) {
  const seen = new Map();
  const orders = new Map();

  function reconcile(event) {
    if (!enabled) return rejected("kill_switch_disabled");
    if (event?.signatureVerified !== true) return rejected("signature_not_verified");
    if (!event?.sourceEventId || !event?.shopDomain) return rejected("event_identity_missing");

    const digest = fingerprint(event);
    const priorDigest = seen.get(event.sourceEventId);
    if (priorDigest) {
      return priorDigest === digest
        ? { status: "duplicate_no_effect", sourceEventId: event.sourceEventId, effectPosture: B03_COMPATIBILITY_PIN.effectPosture }
        : rejected("source_event_collision", { sourceEventId: event.sourceEventId });
    }

    if (event.eventType === "ORDER_SETTLED") {
      const contribution = event.fepContribution;
      if (!contribution) return rejected("contribution_missing");
      if (contribution.metadataConsistent !== true || contribution.claimMatchesActual !== true) {
        return rejected("contribution_metadata_invalid");
      }
      if (!Number.isSafeInteger(contribution.amountMinor) || contribution.amountMinor <= 0) {
        return rejected("contribution_amount_invalid");
      }
      const orderKey = `${event.shopDomain}:${event.resource?.orderId || ""}`;
      if (orderKey.endsWith(":")) return rejected("order_identity_missing");
      if (orders.has(orderKey)) return rejected("order_already_settled", { orderKey });

      orders.set(orderKey, {
        currency: event.currency,
        settledMinor: contribution.amountMinor,
        refundedMinor: 0,
      });
      seen.set(event.sourceEventId, digest);
      return {
        status: "accepted_no_effect",
        kind: "contribution_settled",
        orderKey,
        amountMinor: contribution.amountMinor,
        currency: event.currency,
        sourceEventId: event.sourceEventId,
        contractPin: B03_COMPATIBILITY_PIN,
        effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
      };
    }

    if (event.eventType === "REFUND_RECORDED") {
      const reversal = event.fepContributionReversal;
      if (!reversal) return rejected("contribution_reversal_missing");
      const orderKey = `${event.shopDomain}:${event.resource?.orderId || ""}`;
      const order = orders.get(orderKey);
      if (!order) return rejected("original_settlement_missing", { orderKey });
      if (event.currency !== order.currency) return rejected("currency_mismatch", { orderKey });
      if (!Number.isSafeInteger(reversal.amountMinor) || reversal.amountMinor <= 0) {
        return rejected("reversal_amount_invalid", { orderKey });
      }
      const remainingMinor = order.settledMinor - order.refundedMinor;
      if (reversal.amountMinor > remainingMinor) {
        return rejected("reversal_exceeds_settlement", { orderKey, remainingMinor });
      }

      order.refundedMinor += reversal.amountMinor;
      seen.set(event.sourceEventId, digest);
      return {
        status: "accepted_no_effect",
        kind: "contribution_refund",
        orderKey,
        amountMinor: reversal.amountMinor,
        remainingMinor: order.settledMinor - order.refundedMinor,
        currency: event.currency,
        sourceEventId: event.sourceEventId,
        contractPin: B03_COMPATIBILITY_PIN,
        effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
      };
    }

    return rejected("unsupported_event_type");
  }

  return {
    reconcile,
    snapshot() {
      return {
        enabled,
        effectPosture: B03_COMPATIBILITY_PIN.effectPosture,
        seenEventCount: seen.size,
        orders: Array.from(orders, ([orderKey, value]) => ({ orderKey, ...value })),
      };
    },
  };
}
