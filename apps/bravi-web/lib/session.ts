import 'server-only'

import { cookies } from 'next/headers'

type SessionResult =
  | { status: 'authenticated'; memberSubjectId: string; source: 'demo' | 'session-map' }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; reason: string }

type SessionMap = Record<string, { memberSubjectId: string; status?: 'ACTIVE' | 'REVOKED' }>

function configuredSessions(): SessionMap | null {
  const raw = process.env.BRAVI_WEB_SESSIONS_JSON?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as SessionMap
  } catch {
    return null
  }
}

export async function getMemberSession(): Promise<SessionResult> {
  if (process.env.NODE_ENV !== 'production') {
    return { status: 'authenticated', memberSubjectId: 'member_connor', source: 'demo' }
  }

  const sessions = configuredSessions()
  if (!sessions) {
    return {
      status: 'unavailable',
      reason: 'Production member sessions are not configured. BRAVI_WEB_SESSIONS_JSON is required.',
    }
  }

  const token = (await cookies()).get('bravi_session')?.value
  if (!token) return { status: 'unauthenticated' }
  const record = sessions[token]
  if (!record?.memberSubjectId?.trim() || record.status === 'REVOKED') return { status: 'unauthenticated' }
  return { status: 'authenticated', memberSubjectId: record.memberSubjectId, source: 'session-map' }
}
