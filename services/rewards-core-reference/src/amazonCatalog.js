import { DomainError } from './canonical.js'

export const AMAZON_CATALOG_IMPORT_VERSION = 'bravi-amazon-catalog-v1'

const CATEGORIES = new Set(['ESSENTIAL', 'WORK_ENABLEMENT'])
const ASIN = /^[A-Z0-9]{10}$/

function requireText(value, field, max = 500) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', `${field} is required`)
  }
  const normalized = value.trim()
  if (normalized.length > max) {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', `${field} is too long`)
  }
  return normalized
}

function verifiedTimestamp(value) {
  const normalized = requireText(value, 'verifiedAt', 80)
  const timestamp = Date.parse(normalized)
  if (Number.isNaN(timestamp)) {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', 'verifiedAt must be an ISO timestamp')
  }
  return new Date(timestamp).toISOString()
}

function verifiedSiteStripeUrl(value) {
  const normalized = requireText(value, 'siteStripeUrl', 2_000)
  let url
  try {
    url = new URL(normalized)
  } catch {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', 'siteStripeUrl must be a valid URL')
  }
  const host = url.hostname.toLowerCase()
  const amazonHost = /(^|\.)amazon\.[a-z.]+$/.test(host)
  if (url.protocol !== 'https:' || (!amazonHost && host !== 'amzn.to')) {
    throw new DomainError(
      'INVALID_AMAZON_CATALOG_ITEM',
      'siteStripeUrl must be an HTTPS Amazon or amzn.to link',
    )
  }
  return url.toString()
}

export function validateAmazonCatalogItem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', 'catalog item must be an object')
  }
  if (input.verificationStatus !== 'VERIFIED') {
    throw new DomainError(
      'AMAZON_ITEM_NOT_VERIFIED',
      'only manually verified workbook rows may enter the catalog',
      409,
    )
  }
  if (input.verificationSource !== 'AMAZON_SITESTRIPE') {
    throw new DomainError(
      'AMAZON_VERIFICATION_SOURCE_REQUIRED',
      'verificationSource must be AMAZON_SITESTRIPE',
      409,
    )
  }

  const category = requireText(input.category, 'category', 80).toUpperCase()
  if (!CATEGORIES.has(category)) {
    throw new DomainError(
      'INVALID_AMAZON_CATALOG_ITEM',
      'category must be ESSENTIAL or WORK_ENABLEMENT',
    )
  }
  const asin = requireText(input.finalAsin, 'finalAsin', 10).toUpperCase()
  if (!ASIN.test(asin)) {
    throw new DomainError('INVALID_AMAZON_CATALOG_ITEM', 'finalAsin must be 10 letters or digits')
  }
  const sourceWorkbookRow = Number(input.sourceWorkbookRow)
  if (!Number.isSafeInteger(sourceWorkbookRow) || sourceWorkbookRow < 2) {
    throw new DomainError(
      'INVALID_AMAZON_CATALOG_ITEM',
      'sourceWorkbookRow must identify a data row',
    )
  }

  return {
    contractVersion: AMAZON_CATALOG_IMPORT_VERSION,
    canonicalId: requireText(input.canonicalId, 'canonicalId', 160),
    title: requireText(input.title, 'title', 300),
    category,
    finalAsin: asin,
    siteStripeUrl: verifiedSiteStripeUrl(input.siteStripeUrl),
    affiliateAccountId: requireText(input.affiliateAccountId, 'affiliateAccountId', 200),
    verificationStatus: 'VERIFIED',
    verificationSource: 'AMAZON_SITESTRIPE',
    verifiedAt: verifiedTimestamp(input.verifiedAt),
    verifiedBy: requireText(input.verifiedBy, 'verifiedBy', 200),
    sourceWorkbook: requireText(input.sourceWorkbook, 'sourceWorkbook', 300),
    sourceWorkbookRow,
    notes: typeof input.notes === 'string' && input.notes.trim()
      ? input.notes.trim().slice(0, 1_000)
      : null,
    attributionMode: 'AGGREGATE_POOL_ONLY',
    memberPointsEligible: false,
    recipientEligibilitySignal: false,
    taxDeductibleClaim: false,
  }
}
