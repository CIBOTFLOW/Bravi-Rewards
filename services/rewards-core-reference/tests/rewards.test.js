import test from 'node:test'
import assert from 'node:assert/strict'
import { RewardsService } from '../src/rewardsService.js'

function fixture() {
  const service = new RewardsService()
  service.createCompany({ code: 'LUZIONE', name: 'Luzione' })
  service.createMember({ subjectId: 'a' })
  service.createMember({ subjectId: 'b' })
  service.createProgramVersion({
    companyCode: 'LUZIONE',
    programCode: 'STANDARD',
    version: 1,
    rateBps: 300,
    currency: 'USD',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
  })
  return service
}

function sale(overrides = {}) {
  return {
    companyCode: 'LUZIONE',
    externalSaleId: 'order-1',
    memberSubjectId: 'a',
    programCode: 'STANDARD',
    eventType: 'SETTLED',
    occurredAt: '2026-08-23T12:00:00Z',
    settledAt: '2026-08-23T12:00:00Z',
    grossAmountMinor: 9_000_000,
    qualifiedAmountMinor: 9_000_000,
    currency: 'USD',
    idempotencyKey: 'sale-1',
    correlationId: 'corr-1',
    ...overrides,
  }
}

test('Luzione $90,000 at 3% accrues $2,700', () => {
  const service = fixture()
  assert.equal(service.ingestSaleEvent(sale()).wallet.availableMinor, 270_000)
})

test('sale replay is idempotent', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  service.ingestSaleEvent(sale())
  assert.equal(service.getWallet('a').availableMinor, 270_000)
  assert.equal(service.store.transactions.size, 1)
})

test('same idempotency key with different input fails', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  assert.throws(() => service.ingestSaleEvent(sale({ qualifiedAmountMinor: 1_000_000 })), /idempotency/i)
})

test('journal remains balanced', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  for (const transaction of service.store.transactions.values()) {
    const total = service.store.postings
      .filter((posting) => posting.transactionId === transaction.transactionId)
      .reduce((sum, posting) => sum + posting.amountMinor, 0)
    assert.equal(total, 0)
  }
})

test('atomic gift debits and credits', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  service.gift({
    senderSubjectId: 'a', recipientSubjectId: 'b', amountMinor: 20_000,
    currency: 'USD', idempotencyKey: 'gift-1', correlationId: 'corr-g',
  })
  assert.equal(service.getWallet('a').availableMinor, 250_000)
  assert.equal(service.getWallet('b').availableMinor, 20_000)
})

test('self gift is blocked', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  assert.throws(() => service.gift({
    senderSubjectId: 'a', recipientSubjectId: 'a', amountMinor: 100,
    currency: 'USD', idempotencyKey: 'g', correlationId: 'c',
  }), /sender and recipient/)
})

test('overspend is blocked', () => {
  const service = fixture()
  assert.throws(() => service.gift({
    senderSubjectId: 'a', recipientSubjectId: 'b', amountMinor: 1,
    currency: 'USD', idempotencyKey: 'g', correlationId: 'c',
  }), /insufficient/i)
})

test('reservation moves available to reserved', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  const reservation = service.reserve({
    memberSubjectId: 'a', amountMinor: 50_000, currency: 'USD', purpose: 'REDEMPTION',
    referenceType: 'ORDER', expiresAt: '2026-09-01T00:00:00Z', idempotencyKey: 'r1', correlationId: 'c',
  })
  assert.equal(reservation.status, 'ACTIVE')
  assert.deepEqual([service.getWallet('a').availableMinor, service.getWallet('a').reservedMinor], [220_000, 50_000])
})

test('release restores available balance', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  const reservation = service.reserve({
    memberSubjectId: 'a', amountMinor: 50_000, currency: 'USD', purpose: 'REDEMPTION',
    referenceType: 'ORDER', expiresAt: '2026-09-01T00:00:00Z', idempotencyKey: 'r1', correlationId: 'c',
  })
  service.releaseReservation(reservation.reservationId, { idempotencyKey: 'rel1', correlationId: 'c' })
  assert.deepEqual([service.getWallet('a').availableMinor, service.getWallet('a').reservedMinor], [270_000, 0])
})

test('FEP acceptance captures reservation', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  const intent = service.createFepContributionIntent({
    memberSubjectId: 'a', programCode: 'WORK_ENABLEMENT', amountMinor: 50_000,
    currency: 'USD', expiresAt: '2026-09-01T00:00:00Z', idempotencyKey: 'fi1', correlationId: 'cf',
  })
  service.resolveFepContribution(intent.intentId, {
    accepted: true, fepContributionId: 'fep-1', idempotencyKey: 'fr1', correlationId: 'cf',
  })
  assert.equal(service.getWallet('a').reservedMinor, 0)
  assert.equal(service.getWallet('a').lifetimeGivenToFepMinor, 50_000)
})

test('FEP rejection releases reservation', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  const intent = service.createFepContributionIntent({
    memberSubjectId: 'a', programCode: 'WORK_ENABLEMENT', amountMinor: 50_000,
    currency: 'USD', expiresAt: '2026-09-01T00:00:00Z', idempotencyKey: 'fi1', correlationId: 'cf',
  })
  service.resolveFepContribution(intent.intentId, {
    accepted: false, idempotencyKey: 'fr1', correlationId: 'cf', reason: 'PROGRAM_CLOSED',
  })
  assert.equal(service.getWallet('a').availableMinor, 270_000)
  assert.equal(service.getWallet('a').reservedMinor, 0)
})

test('full refund reverses reward accrual', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  service.ingestSaleEvent(sale({
    eventType: 'REFUNDED', idempotencyKey: 'refund-1', refundSequence: 1, refundAmountMinor: 9_000_000,
  }))
  assert.equal(service.getWallet('a').availableMinor, 0)
})

test('refund requiring spent rewards goes to review', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  service.gift({
    senderSubjectId: 'a', recipientSubjectId: 'b', amountMinor: 20_000,
    currency: 'USD', idempotencyKey: 'gift-1', correlationId: 'c',
  })
  assert.throws(() => service.ingestSaleEvent(sale({
    eventType: 'REFUNDED', idempotencyKey: 'refund-1', refundSequence: 1, refundAmountMinor: 9_000_000,
  })), /review|insufficient for automatic reversal/i)
})

test('goals do not mutate authoritative wallet', () => {
  const service = fixture()
  service.ingestSaleEvent(sale())
  service.createGoal({ memberSubjectId: 'a', name: 'Italy', category: 'TRAVEL', targetAmountMinor: 500_000, currency: 'USD' })
  assert.equal(service.getWallet('a').availableMinor, 270_000)
})
