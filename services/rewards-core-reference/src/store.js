export class MemoryStore {
  companies = new Map()
  members = new Map()
  programs = new Map()
  saleEvents = new Map()
  transactions = new Map()
  postings = []
  idempotency = new Map()
  reservations = new Map()
  gifts = new Map()
  goals = new Map()
  contributionIntents = new Map()
  outbox = new Map()

  replay(scope, key, requestHash) {
    const compound = `${scope}:${key}`
    const existing = this.idempotency.get(compound)
    if (!existing) return undefined
    if (existing.requestHash !== requestHash) {
      throw Object.assign(new Error('idempotency key reused with different request'), {
        code: 'IDEMPOTENCY_CONFLICT',
        status: 409,
      })
    }
    return existing.response
  }

  remember(scope, key, requestHash, response) {
    this.idempotency.set(`${scope}:${key}`, { requestHash, response })
    return response
  }
}
