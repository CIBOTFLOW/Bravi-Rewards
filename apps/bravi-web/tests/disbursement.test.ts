import assert from 'node:assert/strict'
import test from 'node:test'

import { createDisbursementPlan, PlanError } from '../lib/disbursement.ts'

test('$400 produces 26 $15 cards and a $10 remainder', () => {
  const plan = createDisbursementPlan({
    memberSubjectId: 'member_connor',
    totalAmountMinor: 40000,
    denominationMinor: 1500,
    currency: 'USD',
  })
  assert.equal(plan.giftCount, 26)
  assert.equal(plan.allocatedAmountMinor, 39000)
  assert.equal(plan.remainderMinor, 1000)
  assert.equal(plan.effect, 'NONE')
})

test('planner never accepts recipient names or contacts into its contract', () => {
  const input = {
    memberSubjectId: 'member_connor',
    totalAmountMinor: 2500,
    denominationMinor: 500,
    currency: 'USD',
    recipientEmail: 'private@example.com',
  }
  const plan = createDisbursementPlan(input)
  assert.equal('recipientEmail' in plan, false)
})

test('unsupported denominations fail closed', () => {
  assert.throws(
    () => createDisbursementPlan({
      memberSubjectId: 'member_connor',
      totalAmountMinor: 40000,
      denominationMinor: 1337,
      currency: 'USD',
    }),
    (error) => error instanceof PlanError && error.code === 'UNSUPPORTED_DENOMINATION',
  )
})

test('a total below one card is rejected', () => {
  assert.throws(
    () => createDisbursementPlan({
      memberSubjectId: 'member_connor',
      totalAmountMinor: 499,
      denominationMinor: 500,
      currency: 'USD',
    }),
    (error) => error instanceof PlanError && error.code === 'TOTAL_BELOW_DENOMINATION',
  )
})

test('unsafe and non-integer totals are rejected', () => {
  for (const totalAmountMinor of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => createDisbursementPlan({
      memberSubjectId: 'member_connor',
      totalAmountMinor,
      denominationMinor: 500,
      currency: 'USD',
    }))
  }
})
