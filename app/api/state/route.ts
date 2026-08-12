import { appState, type SiteState } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATE_ID = "primary"
const MAX_BODY_BYTES = 20 * 1024 * 1024

function isRecord(value: unknown): value is SiteState {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function GET() {
  const [row] = await db.select().from(appState).where(eq(appState.id, STATE_ID)).limit(1)
  return NextResponse.json({
    data: row?.data ?? {},
    version: row?.version ?? 0,
    migratedAt: row?.migratedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  })
}

export async function PUT(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "حجم البيانات أكبر من الحد المسموح" }, { status: 413 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!isRecord(body) || !isRecord(body.data)) {
    return NextResponse.json({ error: "صيغة البيانات غير صحيحة" }, { status: 400 })
  }

  const incomingVersion = Number(body.version || 0)
  const isMigration = body.migrate === true
  const [current] = await db.select().from(appState).where(eq(appState.id, STATE_ID)).limit(1)

  if (!isMigration && current && incomingVersion !== current.version) {
    return NextResponse.json(
      { error: "تم تعديل البيانات من جهاز آخر", conflict: true, data: current.data, version: current.version },
      { status: 409 },
    )
  }

  if (isMigration && current && Object.keys(current.data).length > 0) {
    return NextResponse.json({ data: current.data, version: current.version, migrated: false })
  }

  const now = new Date()
  const nextVersion = (current?.version ?? 0) + 1
  const [saved] = await db
    .insert(appState)
    .values({
      id: STATE_ID,
      data: body.data,
      version: nextVersion,
      migratedAt: isMigration ? now : current?.migratedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appState.id,
      set: {
        data: body.data,
        version: sql`${appState.version} + 1`,
        migratedAt: isMigration ? sql`COALESCE(${appState.migratedAt}, ${now})` : appState.migratedAt,
        updatedAt: now,
      },
    })
    .returning({ version: appState.version, updatedAt: appState.updatedAt, migratedAt: appState.migratedAt })

  return NextResponse.json({ ok: true, ...saved, migrated: isMigration })
}
