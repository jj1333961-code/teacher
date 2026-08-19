import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''

  if (!clientId) {
    return NextResponse.json(
      { configured: false, clientId: '', message: 'GOOGLE_CLIENT_ID is not set' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    { configured: true, clientId },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
