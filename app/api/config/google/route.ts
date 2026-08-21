import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  // Match the origin logic in /api/auth/google: behind Vercel's proxy,
  // request.url can report an internal http:// origin (and sometimes an
  // internal hostname) even though the public-facing URL is
  // https://<the real domain>, which would make this reported redirectUri
  // disagree with the one actually sent to Google. Trust the Host /
  // X-Forwarded-Host header instead, falling back to request.url only for
  // local dev.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const isLocalHost = !host || host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const origin = isLocalHost ? new URL(request.url).origin : `https://${host}`
  const redirectUri = `${origin}/api/auth/google`
  const configured = Boolean(clientId && process.env.GOOGLE_CLIENT_SECRET?.trim())
  return NextResponse.json(
    { configured, clientId, redirectUri },
    { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
