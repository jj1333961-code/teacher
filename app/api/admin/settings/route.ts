import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminSettings } from '@/lib/db/schema'

export async function GET() {
  const [settings] = await db.select().from(adminSettings).limit(1)
  return NextResponse.json({ whatsappNumber: settings?.whatsappNumber ?? '201554542019' })
}

export async function PUT(request: Request) {
  const phone = String((await request.json()).whatsappNumber ?? '').replace(/\D/g, '')
  if (phone.length < 8) return NextResponse.json({ error: 'رقم غير صحيح' }, { status: 400 })
  const [existing] = await db.select().from(adminSettings).limit(1)
  if (existing) await db.update(adminSettings).set({ whatsappNumber: phone, updatedAt: new Date() })
  else await db.insert(adminSettings).values({ id: crypto.randomUUID(), userId: 'primary-admin', whatsappNumber: phone })
  return NextResponse.json({ ok: true })
}
