import { NextResponse } from 'next/server'

import { planGiftCardDisbursement } from '@/lib/rewards-core'
import { getMemberSession } from '@/lib/session'

export async function POST(request: Request) {
  const session = await getMemberSession()
  if (session.status !== 'authenticated') {
    return NextResponse.json({
      error: session.status === 'unavailable' ? 'SESSION_UNAVAILABLE' : 'UNAUTHENTICATED',
      message: session.status === 'unavailable' ? session.reason : 'A verified member session is required.',
    }, { status: session.status === 'unavailable' ? 503 : 401 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 8192) {
    return NextResponse.json({ error: 'REQUEST_TOO_LARGE', message: 'Planner requests are limited to 8 KB.' }, { status: 413 })
  }

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'INVALID_PLAN', message: 'Planner body must be an object.' }, { status: 400 })
    }
    const allowedFields = new Set(['totalAmountMinor', 'denominationMinor', 'currency'])
    const unsupportedField = Object.keys(body).find((field) => !allowedFields.has(field))
    if (unsupportedField) {
      return NextResponse.json({
        error: 'UNSUPPORTED_PLAN_FIELD',
        message: `Planner field ${unsupportedField} is not accepted. Recipient identity belongs to a later consented delivery step.`,
      }, { status: 400 })
    }
    const plan = await planGiftCardDisbursement({
      memberSubjectId: session.memberSubjectId,
      totalAmountMinor: body.totalAmountMinor,
      denominationMinor: body.denominationMinor,
      currency: body.currency ?? 'USD',
    })
    return NextResponse.json(plan, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'INVALID_PLAN'
    const status = error instanceof Error && 'status' in error && Number.isInteger(error.status)
      ? Number(error.status)
      : 400
    return NextResponse.json({
      error: code,
      message: error instanceof Error ? error.message : 'The plan is invalid.',
    }, { status })
  }
}
