# ADR 0001: Shared Supabase project with isolated Rewards schemas

- Status: Accepted for MVP
- Date: 2026-08-30

## Decision

Bravi Rewards and FEP will use the existing FEP Supabase project for the MVP.
Rewards remains a separate authority boundary through dedicated schemas, roles,
migrations, service credentials, idempotency namespaces, and audit records.

Browser roles do not receive direct table authority in `rewards_core`,
`rewards_integration`, `rewards_audit`, or `bravi_private`. Public API access
must go through narrow functions with explicit grants. Tremendous webhook traffic
is verified at the Edge Function, then reduced to provider, environment, event ID,
event type, and a SHA-256 payload digest before persistence.

## Why

A second physical project is not required to validate the first gift-card flow.
Logical isolation avoids the additional project cost while retaining a clear
future extraction seam.

## Authority boundaries

- Bravi Rewards owns points, wallets, reservations, gifts, and reward orders.
- FEP owns programs, funding policy, eligibility, allocations, and public impact.
- Sultan-FEP may return recommendations only. It cannot approve, reserve, spend,
  select a final recipient, call a provider, contact a recipient, or publish.
- Tremendous is a delivery provider and never the system of record for balances.

No shared table may make helping activity, public popularity, sponsor preference,
or affiliate clicks an essential-needs eligibility signal.

## Data handling

- Provider secrets stay in server-side secret storage.
- Raw webhook payloads are not retained by the receipt boundary.
- Recipient delivery details must be encrypted or provider-tokenized and kept out
  of public impact projections.
- Public impact is aggregate by default; attributed activity requires explicit
  consent and never includes need scores or delivery links.

## Extraction trigger

Move Rewards to a separate Supabase project before broad production rollout if
any of these occur: independent operational ownership, materially different data
residency requirements, provider volume requiring separate scaling, or inability
to maintain least-privilege grants in the shared project.
