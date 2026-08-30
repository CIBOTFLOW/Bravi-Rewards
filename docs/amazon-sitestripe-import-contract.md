# Amazon SiteStripe catalog import contract

Version: `bravi-amazon-catalog-v1`

This boundary converts manually reviewed rows from
`Bravi_Amazon_SiteStripe_Link_Workbook.xlsx` into catalog items that Bravi can
show as essentials or work-enablement options. It does not verify Amazon pages
automatically and does not convert research candidates into approved products.

## Accepted runtime format

The service accepts normalized JSON at:

`POST /v1/amazon-catalog/import`

The JSON envelope contains `idempotencyKey`, `correlationId`, and a non-empty
`items` array. CSV is a convenient editing/export format, but must be
normalized into this JSON envelope before calling the API. The original XLSX
remains the research and manual-review workbook.

## Workbook mapping

| Workbook field | Import field | Gate |
| --- | --- | --- |
| Product Links → Bravi Item | `title` | Required |
| Product Links → Category | `category` | Normalize to `ESSENTIAL` or `WORK_ENABLEMENT` |
| Product Links → Final ASIN / FEP Import Ready → external_item_ref | `finalAsin` | Required, exactly 10 letters/digits |
| Product Links → SiteStripe URL / FEP Import Ready → attribution_url | `siteStripeUrl` | Required HTTPS Amazon or amzn.to URL |
| FEP Import Ready → attribution_tag | `affiliateAccountId` | Required |
| Product Links → FEP Link Status | `verificationStatus` | Must be `VERIFIED` |
| Manual review record | `verificationSource` | Must be `AMAZON_SITESTRIPE` |
| Manual review record | `verifiedAt`, `verifiedBy` | Both required |
| Workbook filename and row | `sourceWorkbook`, `sourceWorkbookRow` | Both required for provenance |
| Stable Bravi slug/ID | `canonicalId` | Required and unique |

Candidate URL, Candidate ASIN, Amazon Precision Search, and Google Source Search
are research inputs only. They are never accepted as substitutes for Final ASIN
or SiteStripe URL.

## Fixed controls

Every accepted item is stamped with:

- `attributionMode: AGGREGATE_POOL_ONLY`
- `memberPointsEligible: false`
- `recipientEligibilitySignal: false`
- `taxDeductibleClaim: false`

The import rejects the whole batch before mutation when any row is unverified,
malformed, duplicated by canonical ID/ASIN, or already exists. An identical
request replay is idempotent.
