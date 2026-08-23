import { createHash, randomUUID } from 'node:crypto'

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

export function sha256(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

export function id(prefix) { return `${prefix}_${randomUUID()}` }
export function nowIso() { return new Date().toISOString() }

export function requireMinor(value, field = 'amountMinor') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('INVALID_MINOR_AMOUNT', `${field} must be a nonnegative safe integer`)
  }
  return value
}

export class DomainError extends Error {
  constructor(code, message, status = 422) {
    super(message)
    this.code = code
    this.status = status
  }
}
