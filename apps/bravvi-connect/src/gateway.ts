import { GATEWAY_MODE, IS_DEMO_MODE } from './config'
import type { LocalDraft } from './types'

export class GatewayUnavailableError extends Error {
  constructor(public readonly gateway: 'FEP' | 'REWARDS') {
    super(`${gateway} gateway is not configured for ${GATEWAY_MODE} mode`)
    this.name = 'GatewayUnavailableError'
  }
}

export type FepGateway = {
  saveDraft(draft: LocalDraft): Promise<{ state: 'LOCAL_DRAFT'; draftId: string }>
  submitRequest(): Promise<never>
  publishDream(): Promise<never>
  acceptVolunteerAssignment(): Promise<never>
}

export type RewardsGateway = {
  getSummary(): Promise<{
    source: 'DEMO'
    availableMinor: number
    pendingMinor: number
    reservedMinor: number
    currency: 'USD'
  }>
  giftRewards(): Promise<never>
  createFepContributionIntent(): Promise<never>
  redeemRewards(): Promise<never>
}

const LOCAL_DRAFTS_KEY = 'bravvi.local-drafts.v1'

function readDrafts(): LocalDraft[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) ?? '[]') as LocalDraft[]
  } catch {
    return []
  }
}

export function getLocalDrafts(): LocalDraft[] {
  return readDrafts().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const demoFepGateway: FepGateway = {
  async saveDraft(draft) {
    const current = readDrafts().filter((item) => item.id !== draft.id)
    localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify([draft, ...current]))
    return { state: 'LOCAL_DRAFT', draftId: draft.id }
  },
  async submitRequest() {
    throw new GatewayUnavailableError('FEP')
  },
  async publishDream() {
    throw new GatewayUnavailableError('FEP')
  },
  async acceptVolunteerAssignment() {
    throw new GatewayUnavailableError('FEP')
  },
}

const failClosedFepGateway: FepGateway = {
  async saveDraft() {
    throw new GatewayUnavailableError('FEP')
  },
  async submitRequest() {
    throw new GatewayUnavailableError('FEP')
  },
  async publishDream() {
    throw new GatewayUnavailableError('FEP')
  },
  async acceptVolunteerAssignment() {
    throw new GatewayUnavailableError('FEP')
  },
}

const demoRewardsGateway: RewardsGateway = {
  async getSummary() {
    return {
      source: 'DEMO',
      availableMinor: 18425,
      pendingMinor: 3620,
      reservedMinor: 2500,
      currency: 'USD',
    }
  },
  async giftRewards() {
    throw new GatewayUnavailableError('REWARDS')
  },
  async createFepContributionIntent() {
    throw new GatewayUnavailableError('REWARDS')
  },
  async redeemRewards() {
    throw new GatewayUnavailableError('REWARDS')
  },
}

const failClosedRewardsGateway: RewardsGateway = {
  async getSummary() {
    throw new GatewayUnavailableError('REWARDS')
  },
  async giftRewards() {
    throw new GatewayUnavailableError('REWARDS')
  },
  async createFepContributionIntent() {
    throw new GatewayUnavailableError('REWARDS')
  },
  async redeemRewards() {
    throw new GatewayUnavailableError('REWARDS')
  },
}

export const fepGateway = IS_DEMO_MODE ? demoFepGateway : failClosedFepGateway
export const rewardsGateway = IS_DEMO_MODE ? demoRewardsGateway : failClosedRewardsGateway

export function createStableIntentKey(scope: string, seed: string): string {
  const key = `bravvi:${scope}:${seed}`
  const storageKey = `bravvi.intent-key.${key}`
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const created = `${key}:${crypto.randomUUID()}`
  sessionStorage.setItem(storageKey, created)
  return created
}
