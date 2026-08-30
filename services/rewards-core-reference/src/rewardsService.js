import { DomainError, id, nowIso, requireMinor, sha256 } from './canonical.js'
import { MemoryStore } from './store.js'

const WALLET_ACCOUNT_TYPES = new Set(['AVAILABLE', 'PENDING', 'RESERVED'])
const REWARD_ORDER_SELECTION_MODES = new Set([
  'SELF',
  'DIRECT_GIFT',
  'FEP_FAIR_RANDOM',
  'FEP_NEED_PRIORITY',
  'FEP_COMMUNITY_RECOGNITION',
])
const REWARD_ORDER_VISIBILITY = new Set([
  'PRIVATE',
  'GIVER_AND_RECIPIENT',
  'PUBLIC_AGGREGATE',
  'PUBLIC_ATTRIBUTED',
])
const REWARD_DELIVERY_CHANNELS = new Set(['EMAIL', 'PHONE', 'LINK'])

export class RewardsService {
  constructor(store = new MemoryStore()) {
    this.store = store
  }

  createCompany(input) {
    if (!input.code || !input.name) throw new DomainError('INVALID_COMPANY', 'code and name are required')
    if (this.store.companies.has(input.code)) return this.store.companies.get(input.code)
    const company = {
      companyId: id('company'),
      code: input.code,
      name: input.name,
      status: 'ACTIVE',
      createdAt: nowIso(),
    }
    this.store.companies.set(company.code, company)
    return company
  }

  createMember(input) {
    if (!input.subjectId) throw new DomainError('INVALID_MEMBER', 'subjectId is required')
    if (this.store.members.has(input.subjectId)) return this.store.members.get(input.subjectId)
    const member = { memberId: id('member'), subjectId: input.subjectId, status: 'ACTIVE', createdAt: nowIso() }
    this.store.members.set(member.subjectId, member)
    return member
  }

  createProgramVersion(input) {
    const company = this.store.companies.get(input.companyCode)
    if (!company) throw new DomainError('COMPANY_NOT_FOUND', 'company not found', 404)
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new DomainError('INVALID_VERSION', 'version must be positive')
    }
    if (!Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10000) {
      throw new DomainError('INVALID_RATE', 'rateBps must be 0..10000')
    }
    const key = `${input.companyCode}:${input.programCode}:v${input.version}`
    if (this.store.programs.has(key)) return this.store.programs.get(key)
    const program = {
      programVersionId: id('program'),
      key,
      companyCode: input.companyCode,
      programCode: input.programCode,
      version: input.version,
      rateBps: input.rateBps,
      currency: input.currency ?? 'USD',
      status: input.status ?? 'ACTIVE',
      startsAt: input.startsAt ?? nowIso(),
      endsAt: input.endsAt ?? null,
      qualificationRules: input.qualificationRules ?? {},
      contentHash: sha256(input),
      createdAt: nowIso(),
    }
    this.store.programs.set(key, program)
    return program
  }

  findProgram(companyCode, programCode, occurredAt) {
    const timestamp = new Date(occurredAt).getTime()
    const programs = [...this.store.programs.values()]
      .filter((program) =>
        program.companyCode === companyCode &&
        program.programCode === programCode &&
        program.status === 'ACTIVE' &&
        new Date(program.startsAt).getTime() <= timestamp &&
        (program.endsAt == null || new Date(program.endsAt).getTime() > timestamp)
      )
      .sort((a, b) => b.version - a.version)
    if (!programs.length) throw new DomainError('PROGRAM_NOT_ACTIVE', 'no active reward program version')
    return programs[0]
  }

  postJournal({ type, referenceType, referenceId, currency, postings, idempotencyKey, correlationId, metadata = {} }) {
    const request = { type, referenceType, referenceId, currency, postings, idempotencyKey, correlationId, metadata }
    const requestHash = sha256(request)
    const replay = this.store.replay('journal', idempotencyKey, requestHash)
    if (replay) return replay
    if (!postings.length || postings.reduce((sum, posting) => sum + posting.amountMinor, 0) !== 0) {
      throw new DomainError('UNBALANCED_JOURNAL', 'journal postings must sum to zero')
    }
    for (const posting of postings) {
      if (!Number.isSafeInteger(posting.amountMinor) || posting.amountMinor === 0) {
        throw new DomainError('INVALID_POSTING', 'posting amount must be nonzero integer')
      }
      if (posting.memberSubjectId && !this.store.members.has(posting.memberSubjectId)) {
        throw new DomainError('MEMBER_NOT_FOUND', 'member not found', 404)
      }
    }
    const transaction = {
      transactionId: id('rtx'),
      type,
      referenceType,
      referenceId,
      currency,
      idempotencyKey,
      correlationId,
      metadata,
      createdAt: nowIso(),
    }
    this.store.transactions.set(transaction.transactionId, transaction)
    postings.forEach((posting, index) => this.store.postings.push({
      postingId: id('rpost'),
      transactionId: transaction.transactionId,
      line: index + 1,
      ...posting,
      createdAt: transaction.createdAt,
    }))
    this.assertNonnegativeWallets(postings.filter((posting) => posting.memberSubjectId).map((posting) => posting.memberSubjectId))
    return this.store.remember('journal', idempotencyKey, requestHash, transaction)
  }

  assertNonnegativeWallets(subjectIds) {
    for (const subjectId of new Set(subjectIds)) {
      const wallet = this.getWallet(subjectId)
      if (wallet.availableMinor < 0 || wallet.pendingMinor < 0 || wallet.reservedMinor < 0) {
        throw new DomainError('NEGATIVE_WALLET', 'wallet buckets cannot become negative', 409)
      }
    }
  }

  getWallet(subjectId, currency = 'USD') {
    if (!this.store.members.has(subjectId)) throw new DomainError('MEMBER_NOT_FOUND', 'member not found', 404)
    const balances = { AVAILABLE: 0, PENDING: 0, RESERVED: 0 }
    let lifetimeEarned = 0
    let lifetimeGifted = 0
    let lifetimeReceived = 0
    let lifetimeGivenToFep = 0
    for (const posting of this.store.postings) {
      if (posting.memberSubjectId !== subjectId || posting.currency !== currency) continue
      if (WALLET_ACCOUNT_TYPES.has(posting.accountType)) balances[posting.accountType] += posting.amountMinor
      if (posting.reason === 'REWARD_ACCRUAL' && posting.amountMinor > 0) lifetimeEarned += posting.amountMinor
      if (posting.reason === 'GIFT_SENT' && posting.amountMinor < 0) lifetimeGifted += -posting.amountMinor
      if (posting.reason === 'GIFT_RECEIVED' && posting.amountMinor > 0) lifetimeReceived += posting.amountMinor
      if (posting.reason === 'FEP_GIVING_CAPTURE' && posting.amountMinor < 0) lifetimeGivenToFep += -posting.amountMinor
    }
    const projection = {
      memberSubjectId: subjectId,
      currency,
      availableMinor: balances.AVAILABLE,
      pendingMinor: balances.PENDING,
      reservedMinor: balances.RESERVED,
      lifetimeEarnedMinor: lifetimeEarned,
      lifetimeGiftedMinor: lifetimeGifted,
      lifetimeReceivedMinor: lifetimeReceived,
      lifetimeGivenToFepMinor: lifetimeGivenToFep,
      version: this.store.postings.filter((posting) => posting.memberSubjectId === subjectId && posting.currency === currency).length,
      asOf: nowIso(),
    }
    return { ...projection, projectionHash: sha256(projection) }
  }

  ingestSaleEvent(input) {
    const eventHash = sha256(input)
    const replay = this.store.replay('sale', input.idempotencyKey, eventHash)
    if (replay) return replay
    if (!this.store.members.has(input.memberSubjectId)) throw new DomainError('MEMBER_NOT_FOUND', 'member not found', 404)
    requireMinor(input.qualifiedAmountMinor, 'qualifiedAmountMinor')
    const naturalKey = `${input.companyCode}:${input.externalSaleId}:${input.eventType}:${input.refundSequence ?? 0}`
    if (this.store.saleEvents.has(naturalKey)) {
      const existing = this.store.saleEvents.get(naturalKey)
      return this.store.remember('sale', input.idempotencyKey, eventHash, existing.result)
    }
    const event = { saleEventId: id('saleevt'), ...input, eventHash, receivedAt: nowIso(), status: 'VALIDATED' }
    let result = { event, accrual: null, reversal: null }

    if (input.eventType === 'SETTLED') {
      const program = this.findProgram(input.companyCode, input.programCode, input.occurredAt)
      if (program.currency !== input.currency) throw new DomainError('CURRENCY_MISMATCH', 'program and sale currency differ')
      const rewardMinor = Math.floor(input.qualifiedAmountMinor * program.rateBps / 10000)
      const transaction = this.postJournal({
        type: 'REWARD_ACCRUAL',
        referenceType: 'SALE_EVENT',
        referenceId: event.saleEventId,
        currency: input.currency,
        idempotencyKey: `accrual:${naturalKey}`,
        correlationId: input.correlationId,
        metadata: {
          programVersionId: program.programVersionId,
          rateBps: program.rateBps,
          qualifiedAmountMinor: input.qualifiedAmountMinor,
        },
        postings: [
          {
            accountType: 'SYSTEM_REWARD_LIABILITY',
            systemAccount: 'REWARD_LIABILITY',
            amountMinor: -rewardMinor,
            currency: input.currency,
            reason: 'REWARD_ACCRUAL',
          },
          {
            accountType: 'AVAILABLE',
            memberSubjectId: input.memberSubjectId,
            amountMinor: rewardMinor,
            currency: input.currency,
            reason: 'REWARD_ACCRUAL',
          },
        ],
      })
      event.status = 'APPLIED'
      event.rewardMinor = rewardMinor
      event.rateBps = program.rateBps
      event.programVersionId = program.programVersionId
      result = {
        event,
        accrual: transaction,
        reversal: null,
        wallet: this.getWallet(input.memberSubjectId, input.currency),
      }
    } else if (['PARTIALLY_REFUNDED', 'REFUNDED'].includes(input.eventType)) {
      const original = [...this.store.saleEvents.values()].find((saleEvent) =>
        saleEvent.companyCode === input.companyCode &&
        saleEvent.externalSaleId === input.externalSaleId &&
        saleEvent.eventType === 'SETTLED'
      )
      if (!original) throw new DomainError('ORIGINAL_SALE_NOT_FOUND', 'settled sale required before refund', 409)
      const refundQualified = requireMinor(input.refundAmountMinor ?? input.qualifiedAmountMinor, 'refundAmountMinor')
      const rewardToReverse = Math.floor(refundQualified * original.rateBps / 10000)
      const wallet = this.getWallet(input.memberSubjectId, input.currency)
      if (wallet.availableMinor < rewardToReverse) {
        throw new DomainError('REFUND_REQUIRES_REVIEW', 'available rewards are insufficient for automatic reversal', 409)
      }
      const transaction = this.postJournal({
        type: 'REWARD_REVERSAL',
        referenceType: 'SALE_REFUND_EVENT',
        referenceId: event.saleEventId,
        currency: input.currency,
        idempotencyKey: `reversal:${naturalKey}`,
        correlationId: input.correlationId,
        metadata: {
          originalSaleEventId: original.saleEventId,
          refundQualifiedMinor: refundQualified,
          rateBps: original.rateBps,
        },
        postings: [
          {
            accountType: 'AVAILABLE',
            memberSubjectId: input.memberSubjectId,
            amountMinor: -rewardToReverse,
            currency: input.currency,
            reason: 'REWARD_REVERSAL',
          },
          {
            accountType: 'SYSTEM_REWARD_LIABILITY',
            systemAccount: 'REWARD_LIABILITY',
            amountMinor: rewardToReverse,
            currency: input.currency,
            reason: 'REWARD_REVERSAL',
          },
        ],
      })
      event.status = 'APPLIED'
      event.rewardMinor = -rewardToReverse
      result = {
        event,
        accrual: null,
        reversal: transaction,
        wallet: this.getWallet(input.memberSubjectId, input.currency),
      }
    }

    event.result = result
    this.store.saleEvents.set(naturalKey, event)
    return this.store.remember('sale', input.idempotencyKey, eventHash, result)
  }

  gift(input) {
    requireMinor(input.amountMinor)
    if (input.amountMinor <= 0) throw new DomainError('INVALID_GIFT', 'gift must be positive')
    if (input.senderSubjectId === input.recipientSubjectId) {
      throw new DomainError('SELF_GIFT_NOT_ALLOWED', 'sender and recipient must differ')
    }
    const requestHash = sha256(input)
    const replay = this.store.replay('gift', input.idempotencyKey, requestHash)
    if (replay) return replay
    if (this.getWallet(input.senderSubjectId, input.currency).availableMinor < input.amountMinor) {
      throw new DomainError('INSUFFICIENT_REWARDS', 'insufficient available rewards', 409)
    }
    const giftId = id('gift')
    const transaction = this.postJournal({
      type: 'REWARD_GIFT',
      referenceType: 'GIFT',
      referenceId: giftId,
      currency: input.currency,
      idempotencyKey: `journal:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      metadata: { message: input.message ?? null },
      postings: [
        {
          accountType: 'AVAILABLE',
          memberSubjectId: input.senderSubjectId,
          amountMinor: -input.amountMinor,
          currency: input.currency,
          reason: 'GIFT_SENT',
        },
        {
          accountType: 'AVAILABLE',
          memberSubjectId: input.recipientSubjectId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          reason: 'GIFT_RECEIVED',
        },
      ],
    })
    const gift = { giftId, ...input, transactionId: transaction.transactionId, status: 'COMPLETED', createdAt: nowIso() }
    this.store.gifts.set(giftId, gift)
    return this.store.remember('gift', input.idempotencyKey, requestHash, gift)
  }

  createGoal(input) {
    if (!this.store.members.has(input.memberSubjectId)) throw new DomainError('MEMBER_NOT_FOUND', 'member not found', 404)
    requireMinor(input.targetAmountMinor, 'targetAmountMinor')
    const goal = {
      goalId: id('goal'),
      memberSubjectId: input.memberSubjectId,
      name: input.name,
      category: input.category,
      targetAmountMinor: input.targetAmountMinor,
      allocatedAmountMinor: 0,
      currency: input.currency ?? 'USD',
      imageUrl: input.imageUrl ?? null,
      priority: input.priority ?? 1,
      deadlineAt: input.deadlineAt ?? null,
      status: 'ACTIVE',
      createdAt: nowIso(),
    }
    this.store.goals.set(goal.goalId, goal)
    return goal
  }

  reserve(input) {
    requireMinor(input.amountMinor)
    const requestHash = sha256(input)
    const replay = this.store.replay('reserve', input.idempotencyKey, requestHash)
    if (replay) return replay
    if (this.getWallet(input.memberSubjectId, input.currency).availableMinor < input.amountMinor) {
      throw new DomainError('INSUFFICIENT_REWARDS', 'insufficient available rewards', 409)
    }
    const reservation = {
      reservationId: id('rres'),
      memberSubjectId: input.memberSubjectId,
      purpose: input.purpose,
      referenceType: input.referenceType,
      referenceId: input.referenceId ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: 'ACTIVE',
      expiresAt: input.expiresAt,
      correlationId: input.correlationId,
      createdAt: nowIso(),
    }
    const transaction = this.postJournal({
      type: 'REWARD_RESERVATION',
      referenceType: 'RESERVATION',
      referenceId: reservation.reservationId,
      currency: input.currency,
      idempotencyKey: `journal:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      postings: [
        {
          accountType: 'AVAILABLE',
          memberSubjectId: input.memberSubjectId,
          amountMinor: -input.amountMinor,
          currency: input.currency,
          reason: 'RESERVATION_CREATED',
        },
        {
          accountType: 'RESERVED',
          memberSubjectId: input.memberSubjectId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          reason: 'RESERVATION_CREATED',
        },
      ],
    })
    reservation.transactionId = transaction.transactionId
    this.store.reservations.set(reservation.reservationId, reservation)
    return this.store.remember('reserve', input.idempotencyKey, requestHash, reservation)
  }

  releaseReservation(reservationId, { idempotencyKey, correlationId, reason = 'RELEASED' }) {
    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new DomainError('RESERVATION_NOT_FOUND', 'reservation not found', 404)
    const request = { reservationId, idempotencyKey, correlationId, reason }
    const requestHash = sha256(request)
    const replay = this.store.replay('release', idempotencyKey, requestHash)
    if (replay) return replay
    if (reservation.status !== 'ACTIVE') {
      throw new DomainError('RESERVATION_NOT_ACTIVE', 'reservation is not active', 409)
    }
    const transaction = this.postJournal({
      type: 'RESERVATION_RELEASE',
      referenceType: 'RESERVATION',
      referenceId: reservationId,
      currency: reservation.currency,
      idempotencyKey: `journal:${idempotencyKey}`,
      correlationId,
      metadata: { reason },
      postings: [
        {
          accountType: 'RESERVED',
          memberSubjectId: reservation.memberSubjectId,
          amountMinor: -reservation.amountMinor,
          currency: reservation.currency,
          reason: 'RESERVATION_RELEASED',
        },
        {
          accountType: 'AVAILABLE',
          memberSubjectId: reservation.memberSubjectId,
          amountMinor: reservation.amountMinor,
          currency: reservation.currency,
          reason: 'RESERVATION_RELEASED',
        },
      ],
    })
    reservation.status = 'RELEASED'
    reservation.releasedAt = nowIso()
    reservation.releaseTransactionId = transaction.transactionId
    return this.store.remember('release', idempotencyKey, requestHash, reservation)
  }

  captureReservation(reservationId, { idempotencyKey, correlationId, reason = 'REDEMPTION_CAPTURE', externalReference = null }) {
    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new DomainError('RESERVATION_NOT_FOUND', 'reservation not found', 404)
    const request = { reservationId, idempotencyKey, correlationId, reason, externalReference }
    const requestHash = sha256(request)
    const replay = this.store.replay('capture', idempotencyKey, requestHash)
    if (replay) return replay
    if (reservation.status !== 'ACTIVE') {
      throw new DomainError('RESERVATION_NOT_ACTIVE', 'reservation is not active', 409)
    }
    const transaction = this.postJournal({
      type: 'RESERVATION_CAPTURE',
      referenceType: 'RESERVATION',
      referenceId: reservationId,
      currency: reservation.currency,
      idempotencyKey: `journal:${idempotencyKey}`,
      correlationId,
      metadata: { reason, externalReference },
      postings: [
        {
          accountType: 'RESERVED',
          memberSubjectId: reservation.memberSubjectId,
          amountMinor: -reservation.amountMinor,
          currency: reservation.currency,
          reason,
        },
        {
          accountType: 'SYSTEM_REWARD_LIABILITY',
          systemAccount: 'REDEMPTION_CLEARING',
          amountMinor: reservation.amountMinor,
          currency: reservation.currency,
          reason,
        },
      ],
    })
    reservation.status = 'CAPTURED'
    reservation.capturedAt = nowIso()
    reservation.captureTransactionId = transaction.transactionId
    reservation.externalReference = externalReference
    return this.store.remember('capture', idempotencyKey, requestHash, reservation)
  }

  planGiftCardDisbursement(input) {
    const totalMinor = requireMinor(input.totalMinor, 'totalMinor')
    const denominationMinor = requireMinor(input.denominationMinor, 'denominationMinor')
    if (totalMinor <= 0 || denominationMinor <= 0) {
      throw new DomainError('INVALID_DISBURSEMENT', 'total and denomination must be positive')
    }
    const orderCount = Math.floor(totalMinor / denominationMinor)
    if (orderCount > 1000) {
      throw new DomainError('DISBURSEMENT_TOO_LARGE', 'a plan may contain at most 1000 orders')
    }
    return {
      totalMinor,
      denominationMinor,
      orderCount,
      allocatedMinor: orderCount * denominationMinor,
      remainderMinor: totalMinor % denominationMinor,
      currency: input.currency ?? 'USD',
    }
  }

  createGiftCardOrder(input) {
    requireMinor(input.amountMinor)
    if (input.amountMinor <= 0) throw new DomainError('INVALID_REWARD_ORDER', 'amount must be positive')
    if (!input.idempotencyKey || !input.correlationId) {
      throw new DomainError('INVALID_REWARD_ORDER', 'idempotencyKey and correlationId are required')
    }
    if (!input.providerProductId) {
      throw new DomainError('INVALID_REWARD_ORDER', 'providerProductId is required')
    }

    const selectionMode = input.selectionMode ?? 'SELF'
    const visibility = input.visibility ?? 'PRIVATE'
    const deliveryChannel = input.deliveryChannel ?? 'EMAIL'
    const providerEnvironment = input.providerEnvironment ?? 'sandbox'
    if (!REWARD_ORDER_SELECTION_MODES.has(selectionMode)) {
      throw new DomainError('INVALID_SELECTION_MODE', 'unsupported recipient selection mode')
    }
    if (!REWARD_ORDER_VISIBILITY.has(visibility)) {
      throw new DomainError('INVALID_VISIBILITY', 'unsupported impact visibility')
    }
    if (!REWARD_DELIVERY_CHANNELS.has(deliveryChannel)) {
      throw new DomainError('INVALID_DELIVERY_CHANNEL', 'unsupported delivery channel')
    }
    if (!['sandbox', 'production'].includes(providerEnvironment)) {
      throw new DomainError('INVALID_PROVIDER_ENVIRONMENT', 'provider environment must be sandbox or production')
    }
    if (visibility === 'PUBLIC_ATTRIBUTED' &&
        (input.attributionConsent !== true || !input.attributionAlias?.trim())) {
      throw new DomainError(
        'ATTRIBUTION_CONSENT_REQUIRED',
        'public attribution requires explicit consent and an attribution alias',
      )
    }

    const spenderWallet = this.getWallet(input.memberSubjectId, input.currency)
    let recipientSubjectId = input.recipientSubjectId ?? null
    if (selectionMode === 'SELF') {
      recipientSubjectId = recipientSubjectId ?? input.memberSubjectId
      if (recipientSubjectId !== input.memberSubjectId) {
        throw new DomainError('INVALID_SELF_REDEMPTION', 'self redemption must name the spending member')
      }
    }
    if (recipientSubjectId) this.getWallet(recipientSubjectId, input.currency)
    if (selectionMode !== 'SELF' && !recipientSubjectId && !input.deliveryDestination) {
      throw new DomainError(
        'RECIPIENT_REQUIRED',
        'a direct or FEP-selected gift requires an internal recipient or delivery destination',
      )
    }
    if (selectionMode.startsWith('FEP_') && !input.fepAllocationId) {
      throw new DomainError('FEP_ALLOCATION_REQUIRED', 'FEP-selected orders require an allocation reference')
    }
    if (spenderWallet.availableMinor < input.amountMinor) {
      throw new DomainError('INSUFFICIENT_REWARDS', 'insufficient available rewards', 409)
    }

    const requestHash = sha256(input)
    const replay = this.store.replay('reward-order-create', input.idempotencyKey, requestHash)
    if (replay) return replay

    const rewardOrderId = id('rorder')
    const reservation = this.reserve({
      memberSubjectId: input.memberSubjectId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      purpose: 'REDEMPTION',
      referenceType: 'REWARD_ORDER',
      referenceId: rewardOrderId,
      expiresAt: input.expiresAt,
      idempotencyKey: `reward-order-reserve:${input.idempotencyKey}`,
      correlationId: input.correlationId,
    })
    const order = {
      rewardOrderId,
      memberSubjectId: input.memberSubjectId,
      recipientSubjectId,
      selectionMode,
      fepAllocationId: input.fepAllocationId ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      reservationId: reservation.reservationId,
      provider: 'tremendous',
      providerEnvironment,
      providerProductId: input.providerProductId,
      providerExternalId: `bravi:${rewardOrderId}`,
      providerReference: null,
      deliveryChannel,
      deliveryDestinationDigest: input.deliveryDestination
        ? sha256({ channel: deliveryChannel, destination: input.deliveryDestination })
        : null,
      visibility,
      attributionAlias: visibility === 'PUBLIC_ATTRIBUTED' ? input.attributionAlias.trim() : null,
      attributionConsentAt: visibility === 'PUBLIC_ATTRIBUTED' ? nowIso() : null,
      status: 'RESERVED',
      expiresAt: input.expiresAt,
      correlationId: input.correlationId,
      createdAt: nowIso(),
    }
    this.store.rewardOrders.set(rewardOrderId, order)
    return this.store.remember('reward-order-create', input.idempotencyKey, requestHash, order)
  }

  completeGiftCardOrder(rewardOrderId, input) {
    const order = this.store.rewardOrders.get(rewardOrderId)
    if (!order) throw new DomainError('REWARD_ORDER_NOT_FOUND', 'reward order not found', 404)
    if (!input.providerReference) {
      throw new DomainError('PROVIDER_REFERENCE_REQUIRED', 'providerReference is required')
    }
    const request = { rewardOrderId, ...input }
    const requestHash = sha256(request)
    const replay = this.store.replay('reward-order-complete', input.idempotencyKey, requestHash)
    if (replay) return replay
    if (order.status !== 'RESERVED') {
      throw new DomainError('REWARD_ORDER_NOT_COMPLETABLE', 'reward order is not reserved', 409)
    }

    this.captureReservation(order.reservationId, {
      idempotencyKey: `reward-order-capture:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      reason: 'GIFT_CARD_ORDER_CAPTURE',
      externalReference: input.providerReference,
    })
    order.status = 'SUBMITTED'
    order.providerReference = input.providerReference
    order.submittedAt = nowIso()
    return this.store.remember('reward-order-complete', input.idempotencyKey, requestHash, order)
  }

  markGiftCardOrderDelivered(rewardOrderId, input) {
    const order = this.store.rewardOrders.get(rewardOrderId)
    if (!order) throw new DomainError('REWARD_ORDER_NOT_FOUND', 'reward order not found', 404)
    const request = { rewardOrderId, ...input }
    const requestHash = sha256(request)
    const replay = this.store.replay('reward-order-delivered', input.idempotencyKey, requestHash)
    if (replay) return replay
    if (order.status !== 'SUBMITTED') {
      throw new DomainError('REWARD_ORDER_NOT_DELIVERABLE', 'reward order is not submitted', 409)
    }
    order.status = 'DELIVERED'
    order.deliveredAt = input.deliveredAt ?? nowIso()
    return this.store.remember('reward-order-delivered', input.idempotencyKey, requestHash, order)
  }

  cancelGiftCardOrder(rewardOrderId, input) {
    const order = this.store.rewardOrders.get(rewardOrderId)
    if (!order) throw new DomainError('REWARD_ORDER_NOT_FOUND', 'reward order not found', 404)
    const request = { rewardOrderId, ...input }
    const requestHash = sha256(request)
    const replay = this.store.replay('reward-order-cancel', input.idempotencyKey, requestHash)
    if (replay) return replay
    if (order.status !== 'RESERVED') {
      throw new DomainError('REWARD_ORDER_NOT_CANCELLABLE', 'only a reserved order can be cancelled', 409)
    }
    this.releaseReservation(order.reservationId, {
      idempotencyKey: `reward-order-release:${input.idempotencyKey}`,
      correlationId: input.correlationId,
      reason: input.reason ?? 'REWARD_ORDER_CANCELLED',
    })
    order.status = 'CANCELLED'
    order.cancelledAt = nowIso()
    order.cancellationReason = input.reason ?? null
    return this.store.remember('reward-order-cancel', input.idempotencyKey, requestHash, order)
  }

  createFepContributionIntent(input) {
    const requestHash = sha256(input)
    const replay = this.store.replay('fep-intent', input.idempotencyKey, requestHash)
    if (replay) return replay
    const intentId = id('fepintent')
    const reservation = this.reserve({
      memberSubjectId: input.memberSubjectId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      purpose: 'FEP_GIVING',
      referenceType: 'FEP_CONTRIBUTION_INTENT',
      referenceId: intentId,
      expiresAt: input.expiresAt,
      idempotencyKey: `reserve:${input.idempotencyKey}`,
      correlationId: input.correlationId,
    })
    const intent = {
      intentId,
      memberSubjectId: input.memberSubjectId,
      programCode: input.programCode,
      publicCaseCardCode: input.publicCaseCardCode ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      reservationId: reservation.reservationId,
      status: 'RESERVED',
      createdAt: nowIso(),
      expiresAt: input.expiresAt,
      correlationId: input.correlationId,
    }
    this.store.contributionIntents.set(intentId, intent)
    const event = {
      eventId: id('evt'),
      eventType: 'rewards.fep_intent.created',
      eventVersion: 1,
      producer: 'bravi-rewards',
      occurredAt: nowIso(),
      correlationId: input.correlationId,
      idempotencyKey: `outbox:${input.idempotencyKey}`,
      payload: intent,
    }
    event.payloadHash = sha256(event.payload)
    this.store.outbox.set(event.eventId, event)
    return this.store.remember('fep-intent', input.idempotencyKey, requestHash, intent)
  }

  resolveFepContribution(intentId, { accepted, fepContributionId = null, idempotencyKey, correlationId, reason = null }) {
    const intent = this.store.contributionIntents.get(intentId)
    if (!intent) throw new DomainError('INTENT_NOT_FOUND', 'contribution intent not found', 404)
    const request = { intentId, accepted, fepContributionId, idempotencyKey, correlationId, reason }
    const requestHash = sha256(request)
    const replay = this.store.replay('fep-resolution', idempotencyKey, requestHash)
    if (replay) return replay
    if (intent.status !== 'RESERVED' && intent.status !== 'SENT_TO_FEP') {
      throw new DomainError('INTENT_NOT_RESOLVABLE', 'intent is not resolvable', 409)
    }
    if (accepted) {
      this.captureReservation(intent.reservationId, {
        idempotencyKey: `capture:${idempotencyKey}`,
        correlationId,
        reason: 'FEP_GIVING_CAPTURE',
        externalReference: fepContributionId,
      })
      intent.status = 'CAPTURED'
      intent.fepContributionId = fepContributionId
      intent.resolvedAt = nowIso()
    } else {
      this.releaseReservation(intent.reservationId, {
        idempotencyKey: `release:${idempotencyKey}`,
        correlationId,
        reason: reason ?? 'FEP_REJECTED',
      })
      intent.status = 'RELEASED'
      intent.rejectionReason = reason
      intent.resolvedAt = nowIso()
    }
    return this.store.remember('fep-resolution', idempotencyKey, requestHash, intent)
  }
}
