import test from 'node:test'
import assert from 'node:assert/strict'

import { RewardsService } from '../src/rewardsService.js'
import { TremendousClient } from '../src/tremendousClient.js'

function fundedService() {
  const service = new RewardsService()
  service.createCompany({ code: 'BRAVI', name: 'Bravi' })
  service.createMember({ subjectId: 'giver' })
  service.createProgramVersion({
    companyCode: 'BRAVI',
    programCode: 'STANDARD',
    version: 1,
    rateBps: 300,
    currency: 'USD',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00Z',
  })
  service.ingestSaleEvent({
    companyCode: 'BRAVI',
    externalSaleId: 'sale-1',
    memberSubjectId: 'giver',
    programCode: 'STANDARD',
    eventType: 'SETTLED',
    occurredAt: '2026-08-30T00:00:00Z',
    qualifiedAmountMinor: 100_000,
    currency: 'USD',
    idempotencyKey: 'sale-1',
    correlationId: 'corr-sale-1',
  })
  return service
}

function reservedOrder(service, overrides = {}) {
  return service.createGiftCardOrder({
    memberSubjectId: 'giver',
    selectionMode: 'DIRECT_GIFT',
    amountMinor: 1_500,
    currency: 'USD',
    providerProductId: 'OKMHM2X2OHYV',
    providerEnvironment: 'sandbox',
    deliveryChannel: 'EMAIL',
    deliveryDestination: 'recipient@example.test',
    expiresAt: '2026-09-01T00:00:00Z',
    visibility: 'PRIVATE',
    idempotencyKey: 'gift-card-1',
    correlationId: 'corr-gift-card-1',
    ...overrides,
  })
}

function response(status, payload) {
  return { status, json: async () => payload }
}

test('Tremendous submission uses one stable external ID and captures only after acceptance', async () => {
  const service = fundedService()
  const order = reservedOrder(service)
  const calls = []
  const client = new TremendousClient({
    apiKey: 'sandbox-secret',
    environment: 'sandbox',
    fundingSourceId: 'BALANCE',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return response(200, {
        order: {
          id: 'tremendous-order-1',
          status: 'EXECUTED',
          rewards: [{
            id: 'tremendous-reward-1',
            delivery: {
              status: 'SUCCEEDED',
              link: 'https://secret-reward-link.example',
            },
            recipient: { email: 'recipient@example.test' },
          }],
        },
      })
    },
  })

  const submitted = await service.submitGiftCardOrder(order.rewardOrderId, {
    deliveryDestination: 'recipient@example.test',
    recipientName: 'Optional Name',
    correlationId: 'corr-gift-card-1',
  }, client)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://testflight.tremendous.com/api/v2/orders')
  assert.equal(calls[0].init.headers.authorization, 'Bearer sandbox-secret')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.external_id, order.providerExternalId)
  assert.deepEqual(body.reward.products, ['OKMHM2X2OHYV'])
  assert.deepEqual(body.reward.value, { denomination: 15, currency_code: 'USD' })
  assert.deepEqual(body.reward.recipient, {
    name: 'Optional Name',
    email: 'recipient@example.test',
  })
  assert.equal(submitted.status, 'SUBMITTED')
  assert.equal(submitted.providerReference, 'tremendous-order-1')
  assert.equal(JSON.stringify(submitted).includes('recipient@example.test'), false)
  assert.equal(JSON.stringify(submitted).includes('secret-reward-link'), false)
  assert.equal(service.getWallet('giver').reservedMinor, 0)
})

test('Tremendous 201 replay is accepted without exposing a reward link', async () => {
  const service = fundedService()
  const order = reservedOrder(service)
  const bodies = []
  const client = new TremendousClient({
    apiKey: 'sandbox-secret',
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body))
      return response(201, {
        order: {
          id: 'tremendous-order-existing',
          status: 'EXECUTED',
          rewards: [{
            id: 'reward-existing',
            delivery: {
              status: 'SUCCEEDED',
              link: 'https://must-not-leave-adapter.example',
            },
          }],
        },
      })
    },
  })
  const first = await client.createOrder({
    order,
    deliveryDestination: 'recipient@example.test',
  })
  const replay = await client.createOrder({
    order,
    deliveryDestination: 'recipient@example.test',
  })

  assert.equal(first.idempotentReplay, true)
  assert.equal(replay.idempotentReplay, true)
  assert.equal(bodies[0].external_id, bodies[1].external_id)
  assert.equal(JSON.stringify(first).includes('must-not-leave-adapter'), false)
})

test('destination mismatch is rejected before any provider call', async () => {
  const service = fundedService()
  const order = reservedOrder(service)
  let calls = 0
  const client = new TremendousClient({
    apiKey: 'sandbox-secret',
    fetchImpl: async () => {
      calls += 1
      return response(200, {})
    },
  })

  await assert.rejects(
    client.createOrder({
      order,
      deliveryDestination: 'different@example.test',
    }),
    (error) => error.code === 'DELIVERY_DESTINATION_MISMATCH',
  )
  assert.equal(calls, 0)
  assert.equal(order.status, 'RESERVED')
})

test('provider conflict preserves the reservation for reconciliation', async () => {
  const service = fundedService()
  const order = reservedOrder(service)
  const client = new TremendousClient({
    apiKey: 'sandbox-secret',
    fetchImpl: async () => response(409, {
      error: {
        message: 'sensitive provider detail that must not escape',
      },
    }),
  })

  await assert.rejects(
    service.submitGiftCardOrder(order.rewardOrderId, {
      deliveryDestination: 'recipient@example.test',
    }, client),
    (error) => (
      error.code === 'TREMENDOUS_IDEMPOTENCY_CONFLICT' &&
      !error.message.includes('sensitive provider detail')
    ),
  )
  assert.equal(order.status, 'RESERVED')
  assert.equal(service.getWallet('giver').reservedMinor, 1_500)
})

test('ambiguous network failure preserves the reservation', async () => {
  const service = fundedService()
  const order = reservedOrder(service)
  const client = new TremendousClient({
    apiKey: 'sandbox-secret',
    fetchImpl: async () => {
      throw new Error('network detail')
    },
  })

  await assert.rejects(
    service.submitGiftCardOrder(order.rewardOrderId, {
      deliveryDestination: 'recipient@example.test',
    }, client),
    (error) => (
      error.code === 'TREMENDOUS_RECONCILIATION_REQUIRED' &&
      !error.message.includes('network detail')
    ),
  )
  assert.equal(order.status, 'RESERVED')
  assert.equal(service.getWallet('giver').reservedMinor, 1_500)
})
