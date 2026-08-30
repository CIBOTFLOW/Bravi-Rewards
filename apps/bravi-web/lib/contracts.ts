export type WalletView = {
  memberSubjectId: string
  currency: string
  availableMinor: number
  pendingMinor: number
  reservedMinor: number
  lifetimeEarnedMinor: number
  lifetimeGiftedMinor: number
  lifetimeReceivedMinor: number
  lifetimeGivenToFepMinor: number
  version: number
  asOf: string
  source: 'rewards-core' | 'demo'
}

export type DisbursementPlanInput = {
  memberSubjectId: string
  totalAmountMinor: number
  denominationMinor: number
  currency: string
}

export type DisbursementPlan = {
  contractVersion: 'bravi-gift-card-disbursement-plan-v1'
  memberSubjectId: string
  currency: string
  totalAmountMinor: number
  denominationMinor: number
  giftCount: number
  allocatedAmountMinor: number
  remainderMinor: number
  effect: 'NONE'
}
