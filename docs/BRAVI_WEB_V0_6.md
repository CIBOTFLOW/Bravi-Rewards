# Bravi web v0.6 operating boundary

## Product role

Bravi is the member experience for earning, viewing, gifting, and expressing an optional community preference. It owns presentation and consented member actions. It does not own FEP case eligibility, named-recipient selection, reservations, fulfillment authority, or provider delivery truth.

## Implemented surface

- mobile-first Home, Discover, Give, Activity, and You routes;
- server-rendered wallet projection with explicit degraded state;
- no-effect equal-denomination gift-card planning;
- server-only Rewards Core credentials and bounded BFF requests;
- production session and Rewards Core configuration that fail closed;
- explicit UI language distinguishing a plan, preference, reservation, order, and delivery;
- health posture showing disabled effect capabilities.

## End-state flow

1. A verified settled commerce event creates a balanced Rewards Core journal transaction.
2. Bravi reads the member wallet projection from Rewards Core through its BFF.
3. A member previews an equal-value gift-card distribution without entering recipient contacts.
4. A later, consented delivery step may collect each direct-gift recipient through an isolated, one-time channel.
5. An order first reserves the member balance; a provider adapter submits only after explicit confirmation.
6. Provider receipt and webhook reconciliation determine terminal delivery state.
7. If the member chooses a community route, Bravi submits a program/cohort preference to FEP. FEP independently selects cases and retains decision authority.

## Activation gates

- IdP-backed member session and durable membership;
- authenticated Rewards Core deployment and response contract validation;
- provider sandbox catalog, funding, idempotency, webhook, and reconciliation evidence;
- one-time recipient contact handling, retention, and support workflow;
- accessibility and responsive browser verification in a deploy preview;
- legal, privacy, accounting, and production authorization.

No production credential or activation decision belongs in this repository.
