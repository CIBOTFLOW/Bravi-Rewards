import type { DisbursementPlan, DisbursementPlanInput } from '@/lib/contracts'

const SUPPORTED_DENOMINATIONS = new Set([500, 1000, 1500, 2500, 5000, 10000])
const MAX_PLAN_MINOR = 10_000_000

export class PlanError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function createDisbursementPlan(input: DisbursementPlanInput): DisbursementPlan {
  if (!input.memberSubjectId?.trim()) throw new PlanError('MEMBER_REQUIRED', 'A member is required.')
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new PlanError('INVALID_CURRENCY', 'Currency must be an ISO 4217 code.')
  if (!Number.isSafeInteger(input.totalAmountMinor) || input.totalAmountMinor <= 0) {
    throw new PlanError('INVALID_TOTAL', 'Total amount must be a positive whole number of minor units.')
  }
  if (input.totalAmountMinor > MAX_PLAN_MINOR) {
    throw new PlanError('PLAN_LIMIT_EXCEEDED', 'Planner total exceeds the no-effect preview limit.')
  }
  if (!Number.isSafeInteger(input.denominationMinor) || !SUPPORTED_DENOMINATIONS.has(input.denominationMinor)) {
    throw new PlanError('UNSUPPORTED_DENOMINATION', 'Choose a supported gift-card denomination.')
  }

  const giftCount = Math.floor(input.totalAmountMinor / input.denominationMinor)
  if (giftCount < 1) throw new PlanError('TOTAL_BELOW_DENOMINATION', 'Total must cover at least one gift card.')
  const allocatedAmountMinor = giftCount * input.denominationMinor

  return {
    contractVersion: 'bravi-gift-card-disbursement-plan-v1',
    memberSubjectId: input.memberSubjectId,
    currency: input.currency,
    totalAmountMinor: input.totalAmountMinor,
    denominationMinor: input.denominationMinor,
    giftCount,
    allocatedAmountMinor,
    remainderMinor: input.totalAmountMinor - allocatedAmountMinor,
    effect: 'NONE',
  }
}
