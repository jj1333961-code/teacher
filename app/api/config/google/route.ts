import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Must match the canonical domain in /api/auth/google exactly: Google
// validates redirect_uri byte-for-byte against what's registered in Cloud
// Console, so this reported value has to be identical to the one actually
// sent during the OAuth handshake.
const CANONICAL_DOMAIN = 'https://teacher-three-ashen.vercel.app'

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const origin = isLocalHost ? new URL(request.url).origin : CANONICAL_DOMAIN
  const redirectUri = `${origin}/api/auth/google`
  const configured = Boolean(clientId && process.env.GOOGLE_CLIENT_SECRET?.trim())
  return NextResponse.json(
    { configured, clientId, redirectUri },
    { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
