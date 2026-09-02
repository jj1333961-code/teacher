import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const configured = Boolean(clientId)
  const configuredProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const productionOrigin = configuredProductionHost
    ? (configuredProductionHost.startsWith('http') ? configuredProductionHost.replace(/\/$/, '') : `https://${configuredProductionHost}`)
    : 'https://teacher-nine-blush.vercel.app'
  return NextResponse.json(
    { configured, clientId, redirectUri: `${productionOrigin}/api/auth/google` },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
