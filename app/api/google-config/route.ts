export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    { clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null },
    { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  )
}
