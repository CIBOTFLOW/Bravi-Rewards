import { DomainError, sha256 } from './canonical.js'

const BASE_URLS = {
  sandbox: 'https://testflight.tremendous.com',
  production: 'https://api.tremendous.com',
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('INVALID_TREMENDOUS_REQUEST', `${field} is required`)
  }
  return value.trim()
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export class TremendousClient {
  constructor({
    apiKey,
    environment = 'sandbox',
    fundingSourceId = 'BALANCE',
    campaignId = null,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15_000,
  }) {
    if (!BASE_URLS[environment]) {
      throw new DomainError(
        'INVALID_TREMENDOUS_ENVIRONMENT',
        'Tremendous environment must be sandbox or production',
      )
    }
    if (typeof fetchImpl !== 'function') {
      throw new DomainError('TREMENDOUS_FETCH_UNAVAILABLE', 'a fetch implementation is required', 503)
    }
    this.apiKey = requireText(apiKey, 'apiKey')
    this.environment = environment
    this.fundingSourceId = requireText(fundingSourceId, 'fundingSourceId')
    this.campaignId = campaignId?.trim() || null
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  buildCreateOrderRequest({ order, deliveryDestination, recipientName = null }) {
    if (!order || order.provider !== 'tremendous' || order.status !== 'RESERVED') {
      throw new DomainError(
        'REWARD_ORDER_NOT_SUBMITTABLE',
        'a reserved Tremendous reward order is required',
        409,
      )
    }
    if (order.providerEnvironment !== this.environment) {
      throw new DomainError(
        'TREMENDOUS_ENVIRONMENT_MISMATCH',
        'reward order and Tremendous client environments differ',
        409,
      )
    }
    if (order.currency !== 'USD') {
      throw new DomainError(
        'TREMENDOUS_CURRENCY_UNSUPPORTED',
        'the reference adapter currently supports USD minor units only',
      )
    }

    const destination = requireText(deliveryDestination, 'deliveryDestination')
    const destinationDigest = sha256({
      channel: order.deliveryChannel,
      destination,
    })
    if (!order.deliveryDestinationDigest || destinationDigest !== order.deliveryDestinationDigest) {
      throw new DomainError(
        'DELIVERY_DESTINATION_MISMATCH',
        'delivery destination does not match the reserved reward order',
        409,
      )
    }

    const recipient = {}
    const normalizedName = recipientName?.trim()
    if (normalizedName) recipient.name = normalizedName
    if (order.deliveryChannel === 'EMAIL') recipient.email = destination
    if (order.deliveryChannel === 'PHONE') recipient.phone = destination

    const reward = {
      value: {
        denomination: order.amountMinor / 100,
        currency_code: order.currency,
      },
      delivery: {
        method: order.deliveryChannel,
      },
      recipient,
    }
    if (this.campaignId) reward.campaign_id = this.campaignId
    else reward.products = [requireText(order.providerProductId, 'providerProductId')]

    return {
      external_id: requireText(order.providerExternalId, 'providerExternalId'),
      payment: {
        funding_source_id: this.fundingSourceId,
      },
      reward,
    }
  }

  async createOrder(input) {
    const request = this.buildCreateOrderRequest(input)
    let response
    try {
      response = await this.fetchImpl(`${BASE_URLS[this.environment]}/api/v2/orders`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new DomainError(
        'TREMENDOUS_RECONCILIATION_REQUIRED',
        'Tremendous response was not confirmed; reconcile by external ID before changing the reservation',
        503,
      )
    }

    const payload = await readJson(response)
    if (response.status === 409) {
      throw new DomainError(
        'TREMENDOUS_IDEMPOTENCY_CONFLICT',
        'Tremendous rejected the stable external ID because the payload differs',
        409,
      )
    }
    if (![200, 201].includes(response.status)) {
      const status = [400, 401, 402, 422].includes(response.status) ? response.status : 503
      throw new DomainError(
        'TREMENDOUS_ORDER_REJECTED',
        `Tremendous did not accept the order (HTTP ${response.status})`,
        status,
      )
    }

    const providerOrder = payload?.order
    if (typeof providerOrder?.id !== 'string' || providerOrder.id.trim() === '') {
      throw new DomainError(
        'TREMENDOUS_RESPONSE_INVALID',
        'Tremendous accepted the request without a usable order reference',
        502,
      )
    }
    const reward = Array.isArray(providerOrder.rewards) ? providerOrder.rewards[0] : null
    return {
      providerOrderId: providerOrder.id,
      providerRewardId: typeof reward?.id === 'string' ? reward.id : null,
      providerStatus: typeof providerOrder.status === 'string' ? providerOrder.status : null,
      deliveryStatus: typeof reward?.delivery?.status === 'string' ? reward.delivery.status : null,
      idempotentReplay: response.status === 201,
    }
  }
}
