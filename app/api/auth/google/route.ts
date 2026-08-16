import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getOAuthOrigin(request: Request) {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, '')}`
  return new URL(request.url).origin
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google OAuth is not configured' }, { status: 503 })

  const state = randomBytes(24).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri = `${getOAuthOrigin(request)}/api/auth/google/callback`
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizationUrl.searchParams.set('client_id', clientId)
  authorizationUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', 'openid email profile')
  authorizationUrl.searchParams.set('state', state)
  authorizationUrl.searchParams.set('prompt', 'select_account')

  return NextResponse.redirect(authorizationUrl)
}
