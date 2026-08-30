import test from 'node:test'
import assert from 'node:assert/strict'

import { RewardsService } from '../src/rewardsService.js'

function verifiedItem(overrides = {}) {
  return {
    canonicalId: 'work-boots-001',
    title: 'Work boots',
    category: 'WORK_ENABLEMENT',
    finalAsin: 'B0ABC12345',
    siteStripeUrl: 'https://amzn.to/example',
    affiliateAccountId: 'bravi-20',
    verificationStatus: 'VERIFIED',
    verificationSource: 'AMAZON_SITESTRIPE',
    verifiedAt: '2026-08-30T00:00:00Z',
    verifiedBy: 'catalog-reviewer',
    sourceWorkbook: 'Bravi_Amazon_SiteStripe_Link_Workbook.xlsx',
    sourceWorkbookRow: 2,
    ...overrides,
  }
}

function importRequest(items, overrides = {}) {
  return {
    items,
    idempotencyKey: 'amazon-import-1',
    correlationId: 'corr-amazon-import-1',
    ...overrides,
  }
}

test('verified SiteStripe row enters an aggregate-pool-only catalog', () => {
  const service = new RewardsService()
  const result = service.importAmazonCatalog(importRequest([verifiedItem()]))

  assert.equal(result.importedCount, 1)
  assert.equal(result.items[0].finalAsin, 'B0ABC12345')
  assert.equal(result.items[0].attributionMode, 'AGGREGATE_POOL_ONLY')
  assert.equal(result.items[0].memberPointsEligible, false)
  assert.equal(result.items[0].recipientEligibilitySignal, false)
  assert.equal(service.store.amazonCatalogItems.size, 1)
})

test('pending or review workbook rows cannot enter the catalog', () => {
  const service = new RewardsService()
  assert.throws(
    () => service.importAmazonCatalog(importRequest([
      verifiedItem({ verificationStatus: 'REVIEW' }),
    ])),
    (error) => error.code === 'AMAZON_ITEM_NOT_VERIFIED',
  )
  assert.equal(service.store.amazonCatalogItems.size, 0)
})

test('candidate URL without a final ASIN fails closed', () => {
  const service = new RewardsService()
  assert.throws(
    () => service.importAmazonCatalog(importRequest([
      verifiedItem({ finalAsin: '', siteStripeUrl: 'https://amazon.com/s?k=work+boots' }),
    ])),
    (error) => error.code === 'INVALID_AMAZON_CATALOG_ITEM',
  )
  assert.equal(service.store.amazonCatalogItems.size, 0)
})

test('duplicate ASIN rejects the whole batch before mutation', () => {
  const service = new RewardsService()
  assert.throws(
    () => service.importAmazonCatalog(importRequest([
      verifiedItem(),
      verifiedItem({
        canonicalId: 'work-boots-002',
        title: 'Second boots entry',
        sourceWorkbookRow: 3,
      }),
    ])),
    (error) => error.code === 'DUPLICATE_AMAZON_CATALOG_ITEM',
  )
  assert.equal(service.store.amazonCatalogItems.size, 0)
})

test('identical catalog import replay is idempotent', () => {
  const service = new RewardsService()
  const request = importRequest([verifiedItem()])
  const first = service.importAmazonCatalog(request)
  const replay = service.importAmazonCatalog(request)

  assert.deepEqual(replay, first)
  assert.equal(service.store.amazonCatalogItems.size, 1)
})
