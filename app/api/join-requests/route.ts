import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { adminNotifications, adminSettings, joinRequests } from '@/lib/db/schema'

const normalizePhone = (value: string) => value.replace(/\D/g, '')

export async function GET(request: Request) {
  const phone = normalizePhone(new URL(request.url).searchParams.get('phone') ?? '')
  if (!phone) return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 })
  const [item] = await db.select().from(joinRequests).where(eq(joinRequests.phone, phone)).orderBy(desc(joinRequests.createdAt)).limit(1)
  return NextResponse.json(item ? { status: item.status } : { status: 'not_found' })
}

export async function POST(request: Request) {
  const body = await request.json()
  const phone = normalizePhone(String(body.phone ?? ''))
  const name = String(body.name ?? '').trim()
  const country = String(body.country ?? '').trim()
  if (!name || !country || phone.length < 8) return NextResponse.json({ error: 'يرجى إدخال الاسم والبلد ورقم هاتف صحيح' }, { status: 400 })

  const [existing] = await db.select().from(joinRequests).where(and(eq(joinRequests.phone, phone), eq(joinRequests.name, name))).limit(1)
  if (existing) return NextResponse.json({ status: existing.status, requestCode: existing.requestCode })

  const id = crypto.randomUUID()
  const requestCode = crypto.randomUUID().slice(0, 8).toUpperCase()
  const values = {
    id, authUserId: body.authUserId || null, source: body.source === 'google' ? 'google' : 'phone', name, country, phone,
    nationalId: String(body.nationalId ?? '').trim() || null,
    age: body.age ? Number(body.age) : null,
    guardianName: String(body.guardianName ?? '').trim() || null,
    juz: String(body.juz ?? '').trim() || null,
    surah: String(body.surah ?? '').trim() || null,
    notes: String(body.notes ?? '').trim() || null,
    requestCode,
  }
  await db.insert(joinRequests).values(values)
  const details = `الطالب: ${name}\nالهاتف: ${phone}\nالرقم القومي: ${values.nationalId ?? '-'}\nالسن: ${values.age ?? '-'}\nولي الأمر: ${values.guardianName ?? '-'}\nالجزء: ${values.juz ?? '-'}\nالسورة: ${values.surah ?? '-'}\nملاحظات: ${values.notes ?? '-'}`
  await db.insert(adminNotifications).values({ id: crypto.randomUUID(), requestId: id, title: 'طلب انضمام جديد', message: details })
  const [settings] = await db.select().from(adminSettings).limit(1)
  return NextResponse.json({ status: 'pending', requestCode, whatsappNumber: settings?.whatsappNumber ?? '201554542019', details })
}
