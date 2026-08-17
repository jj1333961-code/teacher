import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { joinRequests } from '@/lib/db/schema'

export async function GET() {
  const requests = await db.select().from(joinRequests).orderBy(desc(joinRequests.createdAt))
  return NextResponse.json({ requests })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  if (!body.id || !['pending', 'approved', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  await db.update(joinRequests).set({ status: body.status, linkedStudentId: body.linkedStudentId || null, updatedAt: new Date() }).where(eq(joinRequests.id, body.id))
  return NextResponse.json({ ok: true })
}
