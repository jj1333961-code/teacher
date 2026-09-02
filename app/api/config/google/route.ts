import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const configured = Boolean(clientId)
  const productionOrigin = 'https://teacher-three-ashen.vercel.app'
  return NextResponse.json(
    { configured, clientId, redirectUri: `${productionOrigin}/api/auth/google` },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
