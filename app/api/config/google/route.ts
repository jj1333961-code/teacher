import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const redirectUri = `${new URL(request.url).origin}/api/auth/google`
  const configured = Boolean(clientId && process.env.GOOGLE_CLIENT_SECRET?.trim())
  return NextResponse.json(
    { configured, clientId, redirectUri },
    { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
