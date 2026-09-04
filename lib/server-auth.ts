import { NextRequest, NextResponse } from 'next/server'
import { session } from '@/app/api/auth/google/route'
import { LOCAL_SESSION_COOKIE, verifyLocalSession } from '@/lib/local-auth'

export async function requireUser(request: Request) {
  const nextRequest = request instanceof NextRequest ? request : new NextRequest(request.url, { headers: request.headers })
  const googleUser = await session(nextRequest)
  if (googleUser) return { response: null, user: googleUser }

  const localUser = verifyLocalSession(nextRequest.cookies.get(LOCAL_SESSION_COOKIE)?.value)
  if (localUser) {
    return {
      response: null,
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email || localUser.identifier,
        identifier: localUser.identifier,
        role: localUser.role,
      },
    }
  }

  return { response: NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 }), user: null }
}

export async function requireAdmin(request: Request) {
  const result = await requireUser(request)
  if (result.response) return result
  if (result.user?.role === 'admin') return result
  const configured = (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
  if (!configured.includes(String(result.user?.email || '').toLowerCase())) {
    return { response: NextResponse.json({ error: 'لا تملك صلاحية المسؤول' }, { status: 403 }), user: null }
  }
  return result
}
