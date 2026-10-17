import { createHmac, timingSafeEqual } from 'node:crypto'

export const LOCAL_SESSION_COOKIE = 'teacher_local_session'
export const LOCAL_SESSION_MAX_AGE = 60 * 60 * 24 * 7

type LocalSessionPayload = {
  id: string
  name: string
  email: string
  identifier: string
  role: 'admin' | 'student' | 'parent'
  issuedAt: number
}

function sessionSecret() {
  return process.env.DATABASE_URL?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || ''
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function createLocalSession(payload: Omit<LocalSessionPayload, 'issuedAt'>) {
  const secret = sessionSecret()
  if (!secret) throw new Error('جلسة الدخول المحلية غير مهيأة')
  const encoded = Buffer.from(JSON.stringify({ ...payload, issuedAt: Date.now() })).toString('base64url')
  return `${encoded}.${sign(encoded, secret)}`
}

export function verifyLocalSession(value: string | undefined): LocalSessionPayload | null {
  const secret = sessionSecret()
  if (!secret || !value) return null
  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null
  const encoded = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  const expected = sign(encoded, secret)
  if (signature.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<LocalSessionPayload>
    const issuedAt = Number(payload.issuedAt)
    if (!payload.id || !payload.name || !payload.identifier || !payload.role || !Number.isFinite(issuedAt)) return null
    if (Date.now() - issuedAt < 0 || Date.now() - issuedAt > LOCAL_SESSION_MAX_AGE * 1000) return null
    if (!['admin', 'student', 'parent'].includes(payload.role)) return null
    return payload as LocalSessionPayload
  } catch {
    return null
  }
}
