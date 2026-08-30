import { NextResponse } from 'next/server'

import { getWallet } from '@/lib/rewards-core'
import { getMemberSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getMemberSession()
  if (session.status !== 'authenticated') {
    return NextResponse.json({
      error: session.status === 'unavailable' ? 'SESSION_UNAVAILABLE' : 'UNAUTHENTICATED',
      message: session.status === 'unavailable' ? session.reason : 'A verified member session is required.',
    }, { status: session.status === 'unavailable' ? 503 : 401 })
  }

  try {
    return NextResponse.json(await getWallet(session.memberSubjectId), {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      error: 'REWARDS_CORE_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Rewards Core is unavailable.',
    }, { status: 503 })
  }
}
