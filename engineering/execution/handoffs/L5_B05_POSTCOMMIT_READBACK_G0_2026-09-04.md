# L5 Partner Experience handoff — B05 FEP-owned post-commit evidence G0

## Identity and repository reconciliation

- Repository: `CIBOTFLOW/Bravi-Rewards`
- Controller release: `CIBOTFLOW/Luzione-platform-program@b43e5a65c0ae8c8bcef7e015e4a3484877f736b0`
- Remote default branch: `main@5715aee0b04c89aaf80c8174a316d0deb78f8320` (unchanged)
- Preserved B05 handoff and draft PR #10: `codex/l5-b05-synthetic-checkout@dda60df9382771d03f29398926f6d5404e072abc`
- Successor branch: `codex/l5-b05-postcommit-readback-g0`
- Successor base: `codex/l5-b05-synthetic-checkout@dda60df9382771d03f29398926f6d5404e072abc`
- Exact implementation SHA: `ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb`
- Handoff/final revision: `SELF` (resolve the commit containing this file)
- Draft successor PR #11: `https://github.com/CIBOTFLOW/Bravi-Rewards/pull/11`; open, unmerged, base `codex/l5-b05-synthetic-checkout`, implementation head `ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb`
- Writer lock: held only for `CIBOTFLOW/Bravi-Rewards` from `2026-09-04T00:03:35Z`; released at `2026-09-04T00:15:59Z`
- Gate truth: G0 evidence only; not integrated, not G1, and not production-ready

X01 remains preserved at exact `72174faa`; B06 and every other partner repository were left unwritten. No Shopify, production, public, credential, provider, money, refund, domain, default-branch, merge, deployment, promotion, or production-rollback action occurred.

## Delivered behavior

- Replaced the prior B03 consumer pin with corrected producer `CIBOTFLOW/FEP-Platform@5db6cc8772c40a7127b7514c57787299ddad57a5`.
- Split the boundary into command preparation and post-commit evidence consumption. Bravi can prepare only a command/precondition request and cannot pre-mint a receipt, readback, finality, committed object version, or object-version transition.
- Accepts only strictly shaped, FEP-owned post-commit receipt/readback evidence with exact producer, API, contract, digest, tenant, head, authority, freshness, finality, and deterministic identifier bindings.
- Labels the FEP source readback separately while every local B05 result remains `businessFinal:false` and `NO_EFFECT`.
- Handles an exact duplicate as no effect, an upstream FEP replay recovery as no effect, and changed evidence under the same tenant/idempotency key as a conflict.
- Keeps checkout/refund validation, kill switches, signed-event validation, and all prior zero-effect controls intact.

## Exact dependency compatibility

| Boundary | Exact pin |
|---|---|
| Controller | `b43e5a65c0ae8c8bcef7e015e4a3484877f736b0` |
| FEP B03 implementation/final | `CIBOTFLOW/FEP-Platform@5db6cc8772c40a7127b7514c57787299ddad57a5` |
| B03 journal | `fep-balanced-journal/v0.1-draft` |
| Command-input authority | `COMMAND_AND_PRECONDITION_ONLY` |
| Receipt authority | `FEP_DERIVED_AFTER_ATOMIC_APPEND` |
| Readback authority | `EXACT_TENANT_HEAD_POST_COMMIT_QUERY` |
| API implementation | `CIBOTFLOW/Luzione-API@12685f46a60edea23aaa0a5403e300bf8858066b` |
| API final | `CIBOTFLOW/Luzione-API@bc43d5db8fe58230d6c3d35e32a73e1e8618b71e` |
| Shared manifest | `luzione-shared-contracts/v0.2-draft.1` |
| Identity/tenant | `luzione-identity-tenant/v0.2-draft.1` |
| Command | `luzione-command-envelope/v0.2-draft.1` |
| Receipt | `luzione-receipt-envelope/v0.2-draft.1` |
| Readback | `luzione-readback-envelope/v0.2-draft.1` |
| Raw API manifest SHA-256 | `2d7479019d04d24344b1d4bf4d953abee2d3382ed56b8201ebb49289253e00b7` (`sha256-raw-file-v1`) |
| Canonical JSON API manifest SHA-256 | `eaf983e1496187a22688ddfed45b541fe88a3e2b70a2fbc60863fae1a9484208` (`sha256-canonical-json-recursive-key-sort-v1`) |
| Identity artifact SHA-256 | `38a6f9b89c87df3491cbddbc7bb73e964e86a1afe1917a1751fe67814ed0506e` |
| Command artifact SHA-256 | `aaed7baa30a4fc904f15bd8ac7076138442e9a33d8f57a49332a3a68e22cc205` |
| Receipt artifact SHA-256 | `ca358428fa144fa10da10d26d67649c76bb6a271171f55501f15cc9cd63123bf` |
| Readback artifact SHA-256 | `f40f42640b4c7c8c2149b9845b10e74e59911bc3c610ccaa7195a33c6b014b0c` |
| Local adapter | `bravi-b03-compatibility/v0.3-postcommit-consumer` |

The raw-file digest and canonical-JSON digest are deliberately separate labels and are not interchangeable.

## Changed paths

Implementation `dda60df9382771d03f29398926f6d5404e072abc..ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb`:

- `.github/workflows/rewards-reference-validation.yml`
- `engineering/execution/writer-locks/L5_PARTNER_EXPERIENCE.json`
- `extensions/fep-cart-match/README.md`
- `extensions/fep-cart-match/evidence/synthetic-checkout.html`
- `extensions/fep-cart-match/tests/intent-contract.test.mjs`
- `services/shopify-ingestion-reference/scripts/write-b05-postcommit-proof.mjs`
- `services/shopify-ingestion-reference/src/b03Compatibility.js`
- `services/shopify-ingestion-reference/tests/b03-compatibility.test.js`

Final metadata-only revision additionally changes this handoff, `engineering/execution/CURRENT_HANDOFF.json`, and the writer-lock release record. No application behavior changes after the implementation SHA.

## Automated CI and artifact evidence

Implementation CI is exact-SHA bound by both workflow checkout and an explicit SHA assertion:

| Evidence | Result |
|---|---|
| Workflow | `Rewards reference validation` run `33820768363` (#86), success at exact `ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb` |
| Rewards Core job | `100862735703`, success; 30/30 tests |
| Shopify ingestion job | `100862735762`, success; 28/28 tests; exact proof written and uploaded |
| Theme contract job | `100862735782`, success; 12/12 tests |
| Total | 70/70 tests passed |
| Proof artifact | ID `9918171719`, `b05-postcommit-proof-ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb` |
| Artifact digest | `sha256:c22f47f6633ea8b640e83bc6f0bfd7e048d872599bff27c9bb7f196a84cdd110` |
| Artifact lifetime | created `2026-09-04T00:11:43Z`; expires `2026-09-18T00:11:42Z`; 1,606 bytes |

Local checks at the same implementation SHA also passed Node syntax checks, workflow YAML parsing, and `git diff --check`.

The metadata-only final SHA must receive its own exact-SHA workflow run and proof artifact. Those immutable identifiers are recorded on PR #11 after the final commit because a commit cannot truthfully contain the identifiers generated only after it exists.

## Browser and preview truth

The browser evidence is local, isolated, synthetic, and bound to implementation `ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb`; it is not Shopify or production evidence. At a 390×844 viewport:

- exact controller `b43e5a65c0ae8c8bcef7e015e4a3484877f736b0`, FEP producer `5db6cc8772c40a7127b7514c57787299ddad57a5`, adapter v0.3, and `NO_EFFECT` were visible/DOM-bound;
- both cart and drawer controls were disabled before explicit opt-in;
- 2.5% produced `$102.50` from a `$100.00` merchandise baseline and the two surfaces agreed on `$2.50`;
- an injected 422 replacement failure retained `$102.50`, restored the prior contribution, and exposed an accessible recovery status;
- retrying 5% produced `$105.00` without stacking;
- the kill switch removed all add controls while retaining two removal controls and the `$105.00` recoverable cart;
- removal restored `$100.00`;
- `Provider calls 0 · journal writes 0 · canonical readbacks 0` remained visible throughout;
- horizontal overflow was `0px`; the only console error was the deliberately injected synthetic 422 path.

Preview truth: the Vercel team has no Git-linked `Bravi-Rewards` project, and the implementation commit has no GitHub deployment/combined-status entry. Therefore there is no new Git-bound preview or development-store evidence, and none is claimed. No manual deployment was attempted.

The earlier protected B05 preview `dpl_2ZXzkzuT8TYiYydbREys1tSnhhMJ` and anomalous first-deployment records `dpl_BrG35ohXZtQKN35XFss6p3WiHK3d` and `dpl_7yQeAZbqxCKuGLri5Y89ysYMPDUS` belong to the preserved prior handoff, not this successor. They were not inspected as new evidence or changed; their disposition remains human G2.

## Negative, conflict, and zero-effect evidence

- Caller-supplied `receipt`, `readback`, `finality`, `businessFinal`, `committedObjectVersion`, or `objectVersionTransition` fails with `CALLER_COMMITTED_STATE_FORBIDDEN` before reconciliation.
- Tenant, API implementation/final, FEP producer, contract/version, raw-manifest digest, canonical-manifest digest, authority, committed-state, effect-posture, deterministic-ID, head binding, freshness, and schema drift fail closed.
- Uncommitted receipt state, stale/future readback, a mismatched receipt/readback tenant or head, provider evidence in a `NO_EFFECT` result, and unknown root fields fail closed.
- Exact tenant/idempotency/payload duplication returns `duplicate_no_effect`; an FEP-declared replay recovery remains no effect; a changed evidence payload under the same tenant/idempotency key returns a conflict.
- Invalid signed events, stale events, non-increasing source sequences, source collisions, disabled or incomplete adapters, tenant/shop/identity drift, and source hash drift fail closed.
- Refund without the exact settlement, wrong original event, currency mismatch, invalid authority, excessive amount, stale order/sequence, or changed idempotency payload fails closed.
- Checkout replacement failure restores the prior synthetic line; the kill switch permits removal/recovery but no add.
- All accepted, rejected, duplicate, replay, and conflict results prove `effectApplied:false`, `domainWritePerformed:false`, `journalWritePerformed:false`, `canonicalReadbackPerformed:false`, `providerCallPerformed:false`, `moneyMovementPerformed:false`, and `refundIssued:false`.

Bravi only consumes fixture-shaped post-commit evidence. It performs no FEP append or authoritative query itself, and it makes no canonical-domain or provider call.

## Rollback proof

- Exact rollback target: parent handoff `dda60df9382771d03f29398926f6d5404e072abc`.
- That SHA was materialized in a detached disposable worktree: Shopify ingestion passed 23/23, Rewards Core passed 30/30, and theme contract passed 12/12 (65/65 total).
- A code-only rollback is a non-default-branch revert of implementation commit `ed72e7d5ee92f2f88c0572aa1f1ec82531c6f7cb` back to exact `dda60df9382771d03f29398926f6d5404e072abc`.
- No data, database, Shopify, provider, money, refund, domain, deployment, or credential rollback is required because none changed.
- No production rollback was performed.

## Evidence limits, risks, and true stop gates

- B03 `5db6cc8772c40a7127b7514c57787299ddad57a5` is a corrected G0 producer candidate, not G1. B05 receipt/readback tests consume synthetic local evidence; they do not prove live FEP transport, authentication, atomic append, or canonical readback.
- There is no Git-bound Bravi-Rewards preview and no Shopify development-store evidence for this successor.
- Money/refund reconciliation, any real B03 append/readback, and any provider effect remain stopped until B03 achieves G1 and the applicable cross-lane evidence is accepted.
- Shopify/public/app-proxy activation, production data or migration, credentials/secrets, domains/DNS, money/refunds/provider effects, merge/default-branch action, deployment/promotion, and production rollback remain explicit human G2 stops.
- The preserved prior Vercel deployment records remain a human G2 disposition item and are not successor evidence.

## One next action

Controller: independently verify PR #11's final exact-SHA CI proof artifact against FEP producer `5db6cc8772c40a7127b7514c57787299ddad57a5`, then record this as isolated B05 G0 evidence while keeping money/refund and all G2 paths stopped.
