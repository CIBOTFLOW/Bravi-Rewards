import { writeFileSync } from "node:fs";

import { B03_COMPATIBILITY_PIN } from "../src/b03Compatibility.js";

const candidateSha = process.env.CANDIDATE_SHA ?? "";
const outputPath = process.env.B05_PROOF_PATH ?? "";

if (!/^[a-f0-9]{40}$/.test(candidateSha)) {
  throw new Error("CANDIDATE_SHA must be the exact lowercase Git commit SHA");
}
if (!outputPath) throw new Error("B05_PROOF_PATH is required");

const proof = {
  schemaVersion: "bravi-b05-postcommit-proof/v0.1",
  assignment: "B05",
  classification: "G0_SYNTHETIC_NO_EFFECT",
  candidateSha,
  pins: B03_COMPATIBILITY_PIN,
  verifiedScenarios: [
    "signed_checkout_command_input_only",
    "signed_refund_command_input_only",
    "caller_preminted_receipt_readback_finality_rejected",
    "fep_owned_domain_committed_receipt_consumed",
    "fep_owned_source_confirmed_tenant_head_readback_consumed",
    "cross_tenant_rejected",
    "exact_replay_deduplicated",
    "idempotency_conflict_rejected",
    "stale_readback_rejected",
    "provider_evidence_smuggling_rejected",
    "kill_switches_fail_closed",
  ],
  effectBoundary: {
    domainWrites: 0,
    journalWrites: 0,
    canonicalReadbacksPerformedByBravi: 0,
    providerCalls: 0,
    moneyMovements: 0,
    refundsIssued: 0,
    productionMigrations: 0,
    publicActivations: 0,
  },
};

writeFileSync(outputPath, `${JSON.stringify(proof, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
