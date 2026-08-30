import 'server-only'

import type { DisbursementPlan, DisbursementPlanInput, WalletView } from '@/lib/contracts'
import { createDisbursementPlan, PlanError } from '@/lib/disbursement'

const REQUEST_TIMEOUT_MS = 3500

type CoreConfig = { baseUrl: string; token: string }

function coreConfig(): CoreConfig | null {
  const baseUrl = process.env.BRAVI_REWARDS_CORE_URL?.trim()
  const token = process.env.BRAVI_REWARDS_BFF_TOKEN?.trim()
  if (!baseUrl || !token) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), token }
}

async function coreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = coreConfig()
  if (!config) throw new PlanError('REWARDS_CORE_NOT_CONFIGURED', 'Rewards Core is not configured.', 503)
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${config.token}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new PlanError(
      typeof body?.error === 'string' ? body.error : 'REWARDS_CORE_ERROR',
      typeof body?.message === 'string' ? body.message : 'Rewards Core rejected the request.',
      response.status,
    )
  }
  return body as T
}

function demoWallet(memberSubjectId: string): WalletView {
  return {
    memberSubjectId,
    currency: 'USD',
    availableMinor: 40000,
    pendingMinor: 2700,
    reservedMinor: 0,
    lifetimeEarnedMinor: 81700,
    lifetimeGiftedMinor: 25500,
    lifetimeReceivedMinor: 9800,
    lifetimeGivenToFepMinor: 15800,
    version: 12,
    asOf: '2026-08-30T00:00:00.000Z',
    source: 'demo',
  }
}

function normalizeWallet(input: Omit<WalletView, 'source'>): WalletView {
  const minorFields = [
    'availableMinor', 'pendingMinor', 'reservedMinor', 'lifetimeEarnedMinor',
    'lifetimeGiftedMinor', 'lifetimeReceivedMinor', 'lifetimeGivenToFepMinor',
  ] as const
  if (!input?.memberSubjectId || !/^[A-Z]{3}$/.test(input.currency)) {
    throw new PlanError('INVALID_WALLET_PROJECTION', 'Rewards Core returned an invalid wallet projection.', 502)
  }
  for (const field of minorFields) {
    if (!Number.isSafeInteger(input[field]) || input[field] < 0) {
      throw new PlanError('INVALID_WALLET_PROJECTION', 'Rewards Core returned an invalid wallet projection.', 502)
    }
  }
  return { ...input, source: 'rewards-core' }
}

export async function getWallet(memberSubjectId: string): Promise<WalletView> {
  if (!coreConfig()) {
    if (process.env.NODE_ENV !== 'production') return demoWallet(memberSubjectId)
    throw new PlanError('REWARDS_CORE_NOT_CONFIGURED', 'Rewards Core is not configured.', 503)
  }
  const projection = await coreRequest<Omit<WalletView, 'source'>>(
    `/v1/wallet?memberSubjectId=${encodeURIComponent(memberSubjectId)}&currency=USD`,
  )
  return normalizeWallet(projection)
}

export async function planGiftCardDisbursement(input: DisbursementPlanInput): Promise<DisbursementPlan> {
  const wallet = await getWallet(input.memberSubjectId)
  if (input.totalAmountMinor > wallet.availableMinor) {
    throw new PlanError('INSUFFICIENT_AVAILABLE_REWARDS', 'The plan exceeds available rewards.', 409)
  }

  if (!coreConfig()) return createDisbursementPlan(input)
  const result = await coreRequest<{
    totalMinor: number
    denominationMinor: number
    orderCount: number
    allocatedMinor: number
    remainderMinor: number
    currency: string
  }>('/v1/gift-card-disbursement-plans', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      totalMinor: input.totalAmountMinor,
      denominationMinor: input.denominationMinor,
      currency: input.currency,
    }),
  })
  if (
    result.totalMinor !== input.totalAmountMinor ||
    result.denominationMinor !== input.denominationMinor ||
    result.currency !== input.currency ||
    !Number.isSafeInteger(result.orderCount) ||
    !Number.isSafeInteger(result.allocatedMinor) ||
    !Number.isSafeInteger(result.remainderMinor)
  ) {
    throw new PlanError('INVALID_PLAN_RESPONSE', 'Rewards Core returned an invalid planning response.', 502)
  }
  return {
    contractVersion: 'bravi-gift-card-disbursement-plan-v1',
    memberSubjectId: input.memberSubjectId,
    currency: result.currency,
    totalAmountMinor: result.totalMinor,
    denominationMinor: result.denominationMinor,
    giftCount: result.orderCount,
    allocatedAmountMinor: result.allocatedMinor,
    remainderMinor: result.remainderMinor,
    effect: 'NONE',
  }
}
