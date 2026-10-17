import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appSnapshots } from '@/lib/db/schema'
import { createLocalSession, LOCAL_SESSION_COOKIE, LOCAL_SESSION_MAX_AGE } from '@/lib/local-auth'
import { rejectCrossOrigin } from '@/lib/request-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SNAPSHOT_ID = 'teacher-platform-v1'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function normalizeDigits(value: unknown) {
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

function compact(value: unknown) {
  return normalizeDigits(value).trim().replace(/[\s-]/g, '').toLowerCase()
}

function phoneKeys(value: unknown) {
  const normalized = compact(value)
  const digits = normalized.replace(/\D/g, '')
  return new Set([
    normalized,
    digits,
    digits.replace(/^00/, ''),
    digits.replace(/^0+/, ''),
    digits.slice(-10),
  ].filter(Boolean))
}

function phoneMatches(left: unknown, right: unknown) {
  const rightKeys = phoneKeys(right)
  return [...phoneKeys(left)].some((key) => rightKeys.has(key))
}

function defaultAdmin() {
  return { id: 1, name: 'المسؤول', mobile: '00000000000', password: '1234', mobileCountry: 'EG', isMain: true }
}

function defaultStudent() {
  return { id: 'student_othman_local', name: 'عثمان', username: 'عثمان', studentPass: 'واحد', national: '778888889999999900', nationalId: '778888889999999900', parent: 'شعبان', parentPass: 'واحد' }
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

function setSessionCookie(result: NextResponse, request: Request, token: string) {
  result.cookies.set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: LOCAL_SESSION_MAX_AGE,
  })
  return result
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  try {
    const body = await request.json()
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!identifier || !password || identifier.length > 240 || password.length > 240) {
      return response({ error: 'بيانات الدخول غير مكتملة' }, 400)
    }

    const snapshot = await db.select({ data: appSnapshots.data })
      .from(appSnapshots)
      .where(eq(appSnapshots.id, SNAPSHOT_ID))
      .limit(1)
    const data = record(snapshot[0]?.data) || {}
    const admins = Array.isArray(data.admins) && data.admins.length ? data.admins.map(record).filter(Boolean) as Record<string, unknown>[] : [defaultAdmin()]
    const students = Array.isArray(data.students) && data.students.length ? data.students.map(record).filter(Boolean) as Record<string, unknown>[] : [defaultStudent()]

    const admin = admins.find((candidate) => phoneMatches(candidate.mobile, identifier) && candidate.password === password)
    if (admin) {
      const id = String(admin.id ?? identifier)
      const name = String(admin.name || 'المسؤول')
      const email = String(admin.email || admin.googleEmail || '')
      const token = createLocalSession({ id, name, email, identifier, role: 'admin' })
      return setSessionCookie(response({ authenticated: true, user: { id, name, email, identifier, role: 'admin' } }), request, token)
    }

    const student = students.find((candidate) => compact(candidate.username) === compact(identifier) && candidate.studentPass === password)
    if (student) {
      const id = String(student.id ?? student.username ?? identifier)
      const name = String(student.name || student.username || identifier)
      const email = String(student.email || student.googleEmail || '')
      const token = createLocalSession({ id, name, email, identifier, role: 'student' })
      return setSessionCookie(response({ authenticated: true, user: { id, name, email, identifier, role: 'student' } }), request, token)
    }

    const children = students.filter((candidate) => {
      const parentName = compact(candidate.parent || candidate.parentName)
      const parentPhone = candidate.parentPhone
      const studentPhone = candidate.phone
      const matchesIdentifier = parentName === compact(identifier) || phoneMatches(parentPhone, identifier) || phoneMatches(studentPhone, identifier)
      return matchesIdentifier && candidate.parentPass === password
    })
    if (children.length) {
      const first = children[0]
      const id = compact(identifier)
      const name = String(first.parentName || first.parent || identifier)
      const email = String(first.parentEmail || first.parentGoogleEmail || '')
      const token = createLocalSession({ id, name, email, identifier, role: 'parent' })
      return setSessionCookie(response({ authenticated: true, user: { id, name, email, identifier, role: 'parent' } }), request, token)
    }

    return response({ error: 'اسم المستخدم أو الرقم السري غير صحيح' }, 401)
  } catch (error) {
    console.error('[v0] POST /api/auth/local failed', error)
    return response({ error: 'تعذر الاتصال بقاعدة البيانات' }, 503)
  }
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  const result = response({ authenticated: false })
  result.cookies.set(LOCAL_SESSION_COOKIE, '', { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 0 })
  return result
}
