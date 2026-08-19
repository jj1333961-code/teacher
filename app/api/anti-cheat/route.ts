import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { antiCheatEvents, antiCheatItemConfigs, antiCheatSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { defaultAntiCheatConfig } from '@/lib/anti-cheat-engine'

const id = () => crypto.randomUUID()
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, session, event, item } = body ?? {}
    if (action === 'start') {
      if (!session?.studentId || !session?.itemId || !session?.itemType) return NextResponse.json({ error: 'بيانات الجلسة غير مكتملة' }, { status: 400 })
      const created = { id: id(), studentId: String(session.studentId), itemId: String(session.itemId), itemType: String(session.itemType), status: 'active', riskScore: 0, severity: 'NORMAL' }
      await db.insert(antiCheatSessions).values(created)
      return NextResponse.json({ sessionId: created.id, config: { ...defaultAntiCheatConfig, ...(session.config ?? {}) } })
    }
    if (action === 'event') {
      if (!event?.sessionId || !event?.studentId || !event?.itemId || !event?.eventType) return NextResponse.json({ error: 'بيانات الحدث غير مكتملة' }, { status: 400 })
      await db.insert(antiCheatEvents).values({ id: id(), sessionId: String(event.sessionId), studentId: String(event.studentId), itemId: String(event.itemId), eventType: String(event.eventType), riskScore: Math.max(0, Math.min(100, Number(event.riskScore) || 0)), severity: String(event.severity || 'NORMAL'), durationMs: Math.max(0, Number(event.durationMs) || 0), metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {} })
      await db.update(antiCheatSessions).set({ riskScore: Math.max(0, Math.min(100, Number(event.riskScore) || 0)), severity: String(event.severity || 'NORMAL') }).where(eq(antiCheatSessions.id, String(event.sessionId)))
      return NextResponse.json({ ok: true })
    }
    if (action === 'end' && session?.id) { await db.update(antiCheatSessions).set({ status: 'completed', endedAt: new Date(), riskScore: Number(session.riskScore) || 0, severity: String(session.severity || 'NORMAL') }).where(eq(antiCheatSessions.id, String(session.id))); return NextResponse.json({ ok: true }) }
    if (action === 'save-config' && item?.itemId && item?.itemType) { await db.insert(antiCheatItemConfigs).values({ itemId: String(item.itemId), itemType: String(item.itemType), enabled: Boolean(item.enabled), config: item.config ?? {} }).onConflictDoUpdate({ target: antiCheatItemConfigs.itemId, set: { itemType: String(item.itemType), enabled: Boolean(item.enabled), config: item.config ?? {}, updatedAt: new Date() } }); return NextResponse.json({ ok: true }) }
    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'تعذر حفظ بيانات المراقبة' }, { status: 500 }) }
}
