import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const coreConfigured = Boolean(
    process.env.BRAVI_REWARDS_CORE_URL?.trim() &&
    process.env.BRAVI_REWARDS_BFF_TOKEN?.trim(),
  )
  const productionSessionsConfigured = Boolean(process.env.BRAVI_WEB_SESSIONS_JSON?.trim())

  return NextResponse.json({
    status: coreConfigured ? 'ready' : 'degraded',
    service: 'bravi-web',
    version: '0.6.0',
    dependencies: { rewardsCore: coreConfigured },
    authentication: { productionSessionsConfigured },
    effects: {
      walletJournalAuthority: false,
      giftCardOrderCreation: false,
      providerSubmission: false,
      fepRecipientSelection: false,
    },
  }, { headers: { 'cache-control': 'no-store' } })
}
