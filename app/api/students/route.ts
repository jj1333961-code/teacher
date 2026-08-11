import { NextResponse } from "next/server"
import { getNeonPool } from "@/lib/neon"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Student = Record<string, unknown> & { id: number }

async function ensureStudentsTable() {
  await getNeonPool().query(`
    CREATE TABLE IF NOT EXISTS students (
      id BIGINT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

function isStudent(value: unknown): value is Student {
  if (!value || typeof value !== "object") return false
  const id = (value as { id?: unknown }).id
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
}

export async function GET() {
  try {
    await ensureStudentsTable()
    const result = await getNeonPool().query<{ data: Student }>(
      "SELECT data FROM students ORDER BY id ASC",
    )
    return NextResponse.json({ students: result.rows.map((row) => row.data) })
  } catch (error) {
    console.error("Failed to load students from Neon", error)
    return NextResponse.json(
      { error: "تعذر تحميل بيانات الطلاب" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { students?: unknown }
    if (!Array.isArray(body.students) || !body.students.every(isStudent)) {
      return NextResponse.json({ error: "بيانات الطلاب غير صالحة" }, { status: 400 })
    }

    await ensureStudentsTable()
    const client = await getNeonPool().connect()
    try {
      await client.query("BEGIN")
      for (const student of body.students) {
        await client.query(
          `INSERT INTO students (id, data)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = NOW()`,
          [student.id, JSON.stringify(student)],
        )
      }

      const ids = body.students.map((student) => student.id)
      if (ids.length === 0) {
        await client.query("DELETE FROM students")
      } else {
        await client.query("DELETE FROM students WHERE NOT (id = ANY($1::bigint[]))", [ids])
      }
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to save students to Neon", error)
    return NextResponse.json(
      { error: "تعذر حفظ بيانات الطلاب" },
      { status: 500 },
    )
  }
}
