# L5 Partner Experience handoff — B05

## Identity and writer lock

- Repository: `CIBOTFLOW/Bravi-Rewards`
- Controller release: `CIBOTFLOW/Luzione-platform-program@19cf3a752f761a632349ab2581efc2730a557964`
- Branch: `codex/l5-b05-synthetic-checkout`
- Starting SHA: `5715aee0b04c89aaf80c8174a316d0deb78f8320`
- Exact implementation SHA: `41fe5fd5f40ba7a1d81e300435edd549b10231d9`
- Handoff revision: `SELF` (resolve the commit containing this path)
- Draft PR: `CIBOTFLOW/Bravi-Rewards#10`
- Writer-lock record: `engineering/execution/writer-locks/L5_PARTNER_EXPERIENCE.json`; active exclusively from `2026-09-02T21:57:03Z` until release at `2026-09-02T22:10:21Z`
- Gate truth: G0 evidence only; not integrated and not production-ready

## Completed

- Preserved the existing Shopify-settled two-variant pricing model and added a default-off theme kill switch to both cart and drawer surfaces.
- Added an explicit accessible opt-in. Priced percentage buttons remain disabled until the customer checks it; existing contributions remain removable.
- Added a server-side `fepContributionEnabled` switch. Disabled contribution variants stay excluded from the rewards-earning basis, but no paid or refund-reversal contribution payload is emitted.
- Added a repository-local B03 compatibility harness pinned to the controller release and truthfully marked `draft_unpublished`. It reconciles only signed synthetic normalized events in memory and returns `NO_EFFECT` decisions.
- Added deterministic duplicate, source-collision, original-settlement, refund-cap, currency, signature, and kill-switch decisions.
- Added a local-only browser lab that executes the production theme asset against an in-memory Shopify Cart API. It cannot call Shopify or create checkout, order, payment, refund, provider, or journal effects.

## Changed paths

- `README.md`
- `engineering/execution/writer-locks/L5_PARTNER_EXPERIENCE.json`
- `extensions/fep-cart-match/README.md`
- `extensions/fep-cart-match/assets/fep-match.css`
- `extensions/fep-cart-match/assets/fep-match.js`
- `extensions/fep-cart-match/blocks/fep-cart-drawer.liquid`
- `extensions/fep-cart-match/blocks/fep-match.liquid`
- `extensions/fep-cart-match/evidence/synthetic-checkout.html`
- `extensions/fep-cart-match/evidence/synthetic-shopify.js`
- `extensions/fep-cart-match/tests/intent-contract.test.mjs`
- `services/shopify-ingestion-reference/src/b03Compatibility.js`
- `services/shopify-ingestion-reference/src/shopify.js`
- `services/shopify-ingestion-reference/tests/b03-compatibility.test.js`
- `services/shopify-ingestion-reference/tests/fep-contribution.test.js`

## Pinned versions

| Boundary | Pin | Status |
|---|---|---|
| Controller | `19cf3a752f761a632349ab2581efc2730a557964` | authoritative lane release |
| Dependency repository | `CIBOTFLOW/FEP-Platform` | B03 producer |
| Dependency assignment | `B03` | draft unpublished and unaccepted |
| Local adapter | `bravi-b03-compatibility/v0.1` | repository-local, in-memory, `NO_EFFECT` |
| Theme intent | `fep-contribution-v2` | existing cart metadata only; not amount authority |
| Amount authority | `SHOPIFY_SETTLED_LINE_PRICES` / `SHOPIFY_REFUND_LINE_PRICES` | exercised with signed synthetic payloads only |

No shared journal, contribution, refund, receipt, or allocation contract is authored here. No schema migration is included.

## Tests and exact-SHA evidence

| Command or journey | Result | Immutable evidence |
|---|---|---|
| `node --test extensions/fep-cart-match/tests/*.test.mjs` | 8/8 passed | implementation `41fe5fd5f40ba7a1d81e300435edd549b10231d9` |
| `npm test --prefix services/shopify-ingestion-reference` | 20/20 passed | same exact implementation |
| `npm test --prefix services/rewards-core-reference` | 30/30 passed | same exact implementation |
| GitHub Actions | `Rewards reference validation` succeeded | run `33688836261` at exact implementation SHA |
| Local browser initial state | cart `$100.00`; 2.5% `$2.50` and 5% `$5.00` buttons disabled before opt-in; semantic checkbox/group/live status present | local server from clean exact implementation tree |
| Local browser priced opt-in | explicit opt-in enabled 2.5%; cart became `$102.50` through `$2.00 + $0.50` allowlisted lines | same exact implementation tree |
| Local browser replacement | 5% replaced the previous contribution; cart became `$105.00` with two contribution components, not stacked percentage sets | same exact implementation tree |
| Local browser removal | Remove restored one merchandise line and `$100.00` | same exact implementation tree |
| Local browser kill switch | switch-off removed the contribution region (`0` regions) and preserved cart state; no automatic mutation occurred | same exact implementation tree |
| Preview/development store | intentionally not deployed or activated | no immutable deployment ID exists; B03 and human G2 gates remain open |

The screenshot and DOM inspection were performed against the clean exact implementation after commit. The preview/development-store absence is a recorded blocker, not inferred success.

## Negative paths

- Theme switch missing or false: contribution surface is absent; add/remove handlers refuse mutations.
- Explicit opt-in unchecked: priced controls are disabled and direct handler invocation returns an error without mutation.
- Server switch false or absent: contribution/reversal normalization is suppressed while contribution variants remain excluded from reward basis.
- Shopify HMAC missing or invalid: normalization fails before economic handling.
- Reconciler disabled: `kill_switch_disabled` with `NO_EFFECT`.
- `signatureVerified !== true`: `signature_not_verified`.
- Exact event replay: `duplicate_no_effect`; same source identity with changed payload: `source_event_collision`.
- Refund before paid settlement: `original_settlement_missing`.
- Refund above the remaining synthetic settled contribution: `reversal_exceeds_settlement` and remaining amount is unchanged.
- Wrong currency, missing contribution metadata, inconsistent claimed amount, missing order/event identity, and unsupported event type fail closed.
- Spoofed FEP properties on a non-allowlisted variant never establish contribution value.

## Rollback and recovery proof

- The exact base `5715aee0b04c89aaf80c8174a316d0deb78f8320` was materialized in a disposable clean Git worktree.
- Base verification passed: theme tests 6/6, Shopify ingestion tests 14/14, and Rewards Core tests 30/30.
- The disposable worktree was removed after readback.
- Code rollback is a revert of implementation `41fe5fd5f40ba7a1d81e300435edd549b10231d9` on the non-default branch. No schema, data, Shopify setting, environment, provider, money, or public surface rollback is required because none changed.

## Not completed and risks

- B03 has no published accepted balanced-journal contract. The local adapter cannot become a canonical money/refund or ledger boundary.
- No development-store app installation, theme activation, checkout, signed live webhook, refund, or FEP reconciliation was executed.
- The existing extension defaults include development-store variant IDs. A future store activation must validate market availability and use explicit store-scoped allowlists.
- Theme switch and server switch are independent. An authorized activation runbook must require both and prove their emergency-disable behavior.
- Browser evidence uses an in-memory Cart API, not theme-specific drawer replacement behavior in Prestige or another live Shopify theme.
- Public/theme activation, webhook registration, real money/refund/provider effects, production configuration, default-branch actions, and rollback remain explicit G2 actions.

## One next action

Controller L5/B05 reviewer: validate implementation `41fe5fd5f40ba7a1d81e300435edd549b10231d9` and Actions run `33688836261`; keep money/refund reconciliation and any development-store/public activation blocked until B03 publishes an accepted contract and a human separately grants the required Shopify G2 GO.
