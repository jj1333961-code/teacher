import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { antiCheatEvents, antiCheatGlobalConfig, antiCheatItemConfigs, antiCheatSessions } from '@/lib/db/schema'
import { defaultAntiCheatConfig, type AntiCheatConfig } from '@/lib/anti-cheat-engine'

const id = () => crypto.randomUUID()
const clamp = (value: unknown, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0))
const validType = (value: unknown) => value === 'recitation' || value === 'exam' || value === 'task'
const safeConfig = (value: unknown): AntiCheatConfig => ({ ...defaultAntiCheatConfig, ...(value && typeof value === 'object' ? value : {}) })

async function resolveConfig(itemId: string, itemType: string) {
  const item = await db.select().from(antiCheatItemConfigs).where(and(eq(antiCheatItemConfigs.itemId, itemId), eq(antiCheatItemConfigs.itemType, itemType))).limit(1)
  if (item[0]) return { config: safeConfig({ enabled: item[0].enabled, ...(item[0].config as object) }), source: 'override' as const }
  const global = await db.select().from(antiCheatGlobalConfig).where(eq(antiCheatGlobalConfig.id, true)).limit(1)
  const current = global[0]
  return { config: safeConfig({ enabled: current?.enabled ?? false, ...(current?.config as object ?? {}) }), source: 'global-default' as const }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const itemType = searchParams.get('itemType')
    if (itemId && itemType && validType(itemType)) return NextResponse.json(await resolveConfig(itemId, itemType))
    const [global, items] = await Promise.all([
      db.select().from(antiCheatGlobalConfig).where(eq(antiCheatGlobalConfig.id, true)).limit(1),
      db.select().from(antiCheatItemConfigs).orderBy(desc(antiCheatItemConfigs.updatedAt)),
    ])
    return NextResponse.json({ global: global[0] ?? { id: true, enabled: false, config: {} }, items })
  } catch { return NextResponse.json({ error: 'تعذر تحميل إعدادات مكافحة الغش' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body ?? {}
    if (action === 'save-global') {
      const enabled = Boolean(body.enabled)
      await db.insert(antiCheatGlobalConfig).values({ id: true, enabled, config: body.config ?? {} }).onConflictDoUpdate({ target: antiCheatGlobalConfig.id, set: { enabled, config: body.config ?? {}, updatedAt: new Date() } })
      const saved = await db.select().from(antiCheatGlobalConfig).where(eq(antiCheatGlobalConfig.id, true)).limit(1)
      return NextResponse.json({ ok: true, global: saved[0] })
    }
    if (action === 'save-config') {
      const itemId = String(body.item?.itemId ?? '')
      const itemType = String(body.item?.itemType ?? '')
      if (!itemId || !validType(itemType)) return NextResponse.json({ error: 'هوية العنصر غير صالحة' }, { status: 400 })
      const enabled = Boolean(body.item.enabled)
      await db.insert(antiCheatItemConfigs).values({ itemId, itemType, enabled, isOverride: true, config: body.item.config ?? {} }).onConflictDoUpdate({ target: [antiCheatItemConfigs.itemId, antiCheatItemConfigs.itemType], set: { enabled, isOverride: true, config: body.item.config ?? {}, updatedAt: new Date() } })
      const saved = await db.select().from(antiCheatItemConfigs).where(and(eq(antiCheatItemConfigs.itemId, itemId), eq(antiCheatItemConfigs.itemType, itemType))).limit(1)
      return NextResponse.json({ ok: true, item: saved[0] })
    }
    if (action === 'start') {
      const session = body.session ?? {}
      const itemId = String(session.itemId ?? ''), itemType = String(session.itemType ?? '')
      if (!session.studentId || !itemId || !validType(itemType)) return NextResponse.json({ error: 'بيانات الجلسة غير مكتملة' }, { status: 400 })
      const resolved = await resolveConfig(itemId, itemType)
      if (!resolved.config.enabled) return NextResponse.json({ sessionId: null, config: resolved.config, source: resolved.source, disabled: true })
      const existing = session.sessionId ? await db.select().from(antiCheatSessions).where(eq(antiCheatSessions.id, String(session.sessionId))).limit(1) : []
      if (existing[0]?.status === 'active') return NextResponse.json({ sessionId: existing[0].id, config: resolved.config, source: resolved.source, reused: true })
      const created = { id: id(), studentId: String(session.studentId), itemId, itemType, status: 'active', riskScore: 0, severity: 'NORMAL', currentQuestion: session.currentQuestion == null ? null : Number(session.currentQuestion), attemptId: session.attemptId ? String(session.attemptId) : null }
      await db.insert(antiCheatSessions).values(created)
      return NextResponse.json({ sessionId: created.id, config: resolved.config, source: resolved.source, reused: false })
    }
    if (action === 'event') {
      const event = body.event ?? {}
      if (!event.sessionId || !event.studentId || !event.itemId || !validType(event.itemType) || !event.eventType) return NextResponse.json({ error: 'بيانات الحدث غير مكتملة' }, { status: 400 })
      const riskScore = clamp(event.riskScore), riskDelta = clamp(event.riskDelta, -100, 100), severity = String(event.severity || 'NORMAL')
      await db.insert(antiCheatEvents).values({ id: id(), sessionId: String(event.sessionId), studentId: String(event.studentId), itemId: String(event.itemId), itemType: String(event.itemType), eventType: String(event.eventType), riskScore, riskDelta, severity, decision: String(event.decision || severity), reason: String(event.reason || ''), durationMs: clamp(event.durationMs, 0, 86400000), metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {} })
      await db.update(antiCheatSessions).set({ riskScore, severity, updatedAt: new Date() }).where(eq(antiCheatSessions.id, String(event.sessionId)))
      return NextResponse.json({ ok: true, riskScore, severity })
    }
    if (action === 'end' && body.session?.id) { await db.update(antiCheatSessions).set({ status: 'completed', endedAt: new Date(), updatedAt: new Date(), riskScore: clamp(body.session.riskScore), severity: String(body.session.severity || 'NORMAL') }).where(eq(antiCheatSessions.id, String(body.session.id))); return NextResponse.json({ ok: true }) }
    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'تعذر حفظ بيانات المراقبة' }, { status: 500 }) }
}
