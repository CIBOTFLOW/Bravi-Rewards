import http from 'node:http'
import { URL } from 'node:url'
import { createDemoService } from './bootstrap.js'
import { DomainError } from './canonical.js'
import { TremendousClient } from './tremendousClient.js'

const service = createDemoService()
const tremendousClient = process.env.TREMENDOUS_API_KEY
  ? new TremendousClient({
      apiKey: process.env.TREMENDOUS_API_KEY,
      environment: process.env.TREMENDOUS_ENVIRONMENT ?? 'sandbox',
      fundingSourceId: process.env.TREMENDOUS_FUNDING_SOURCE_ID ?? 'BALANCE',
      campaignId: process.env.TREMENDOUS_CAMPAIGN_ID ?? null,
    })
  : null
const port = Number(process.env.PORT ?? 8090)

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body, null, 2))
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (request.method === 'GET' && url.pathname === '/health') {
      return send(response, 200, { status: 'ok', service: 'bravi-rewards', version: '0.5.0', authoritative: true })
    }
    if (request.method === 'GET' && url.pathname === '/v1/wallet') {
      return send(response, 200, service.getWallet(
        url.searchParams.get('memberSubjectId') ?? 'member_connor',
        url.searchParams.get('currency') ?? 'USD',
      ))
    }
    if (request.method === 'POST' && url.pathname === '/v1/sales/events') {
      return send(response, 202, service.ingestSaleEvent(await readBody(request)))
    }
    if (request.method === 'POST' && url.pathname === '/v1/gifts') {
      return send(response, 201, service.gift(await readBody(request)))
    }
    if (request.method === 'POST' && url.pathname === '/v1/goals') {
      return send(response, 201, service.createGoal(await readBody(request)))
    }
    if (request.method === 'POST' && url.pathname === '/v1/amazon-catalog/import') {
      return send(response, 201, service.importAmazonCatalog(await readBody(request)))
    }
    if (request.method === 'POST' && url.pathname === '/v1/gift-card-disbursement-plans') {
      return send(response, 200, service.planGiftCardDisbursement(await readBody(request)))
    }
    if (request.method === 'POST' && url.pathname === '/v1/gift-card-orders') {
      return send(response, 201, service.createGiftCardOrder(await readBody(request)))
    }
    const submitGiftCardOrder = url.pathname.match(/^\/v1\/gift-card-orders\/([^/]+)\/submit$/)
    if (request.method === 'POST' && submitGiftCardOrder) {
      if (!tremendousClient) {
        throw new DomainError(
          'TREMENDOUS_NOT_CONFIGURED',
          'Tremendous API credentials are not configured',
          503,
        )
      }
      return send(
        response,
        200,
        await service.submitGiftCardOrder(
          submitGiftCardOrder[1],
          await readBody(request),
          tremendousClient,
        ),
      )
    }
    const completeGiftCardOrder = url.pathname.match(/^\/v1\/gift-card-orders\/([^/]+)\/complete$/)
    if (request.method === 'POST' && completeGiftCardOrder) {
      return send(
        response,
        200,
        service.completeGiftCardOrder(completeGiftCardOrder[1], await readBody(request)),
      )
    }
    const deliverGiftCardOrder = url.pathname.match(/^\/v1\/gift-card-orders\/([^/]+)\/delivered$/)
    if (request.method === 'POST' && deliverGiftCardOrder) {
      return send(
        response,
        200,
        service.markGiftCardOrderDelivered(deliverGiftCardOrder[1], await readBody(request)),
      )
    }
    const cancelGiftCardOrder = url.pathname.match(/^\/v1\/gift-card-orders\/([^/]+)\/cancel$/)
    if (request.method === 'POST' && cancelGiftCardOrder) {
      return send(
        response,
        200,
        service.cancelGiftCardOrder(cancelGiftCardOrder[1], await readBody(request)),
      )
    }
    if (request.method === 'POST' && url.pathname === '/v1/fep-contribution-intents') {
      return send(response, 201, service.createFepContributionIntent(await readBody(request)))
    }
    const match = url.pathname.match(/^\/v1\/fep-contribution-intents\/([^/]+)\/resolve$/)
    if (request.method === 'POST' && match) {
      return send(response, 200, service.resolveFepContribution(match[1], await readBody(request)))
    }
    return send(response, 404, { error: 'not found' })
  } catch (error) {
    const status = error instanceof DomainError ? error.status : (error.status ?? 500)
    return send(response, status, { error: error.code ?? 'INTERNAL_ERROR', message: error.message })
  }
})

server.listen(port, () => console.log(`bravi-rewards listening on ${port}`))
