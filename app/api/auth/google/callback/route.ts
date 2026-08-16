import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

type GoogleTokenResponse = { id_token?: string }
type GoogleProfile = { sub: string; email: string; email_verified: string; name?: string; picture?: string; aud: string }

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function getOAuthOrigin(request: Request) {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, '')}`
  return new URL(request.url).origin
}

function appUrl(path: string, request: Request) {
  return new URL(path, getOAuthOrigin(request))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('google_oauth_state')?.value
  cookieStore.delete('google_oauth_state')

  if (!code || !returnedState || !expectedState) return NextResponse.redirect(appUrl('/?auth=cancelled', request))
  const stateA = Buffer.from(returnedState)
  const stateB = Buffer.from(expectedState)
  if (stateA.length !== stateB.length || !timingSafeEqual(stateA, stateB)) return NextResponse.redirect(appUrl('/?auth=invalid', request))

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.redirect(appUrl('/?auth=unavailable', request))

  const redirectUri = `${getOAuthOrigin(request)}/api/auth/google/callback`
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    cache: 'no-store',
  })
  if (!tokenResponse.ok) return NextResponse.redirect(appUrl('/?auth=failed', request))
  const tokens = await tokenResponse.json() as GoogleTokenResponse
  if (!tokens.id_token) return NextResponse.redirect(appUrl('/?auth=failed', request))

  const profileResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`, { cache: 'no-store' })
  if (!profileResponse.ok) return NextResponse.redirect(appUrl('/?auth=failed', request))
  const profile = await profileResponse.json() as GoogleProfile
  if (profile.aud !== clientId || profile.email_verified !== 'true') return NextResponse.redirect(appUrl('/?auth=invalid', request))

  const payload = encode({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  const signature = createHmac('sha256', clientSecret).update(payload).digest('base64url')
  cookieStore.set('teacher_google_session', `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
  return NextResponse.redirect(appUrl('/?auth=success', request))
}
