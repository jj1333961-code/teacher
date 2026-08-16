import { pool } from '@/lib/db'

export const runtime = 'nodejs'

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function cleanText(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const attemptId = cleanText(body?.attemptId)
    const examId = cleanText(body?.examId)
    const studentId = cleanText(String(body?.studentId ?? ''))
    const reason = cleanText(body?.reason, 40)
    const allowedReasons = new Set(['unexpected_exit', 'proctor_violation'])

    if (!attemptId || !examId || !studentId || !allowedReasons.has(reason)) {
      return Response.json({ error: 'بيانات المحاولة غير صالحة' }, { status: 400, headers: responseHeaders })
    }

    const serialized = JSON.stringify(body?.report ?? {})
    if (serialized.length > 1_500_000) {
      return Response.json({ error: 'تقرير المحاولة أكبر من الحد المسموح' }, { status: 413, headers: responseHeaders })
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_exam_attempts (
        attempt_id text PRIMARY KEY,
        exam_id text NOT NULL,
        student_id text NOT NULL,
        reason text NOT NULL,
        report jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await pool.query(
      `INSERT INTO emergency_exam_attempts (attempt_id, exam_id, student_id, reason, report)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (attempt_id) DO UPDATE
       SET reason = EXCLUDED.reason, report = EXCLUDED.report, updated_at = now()`,
      [attemptId, examId, studentId, reason, serialized],
    )

    return Response.json({ saved: true }, { headers: responseHeaders })
  } catch {
    return Response.json({ error: 'تعذر حفظ محاولة الطوارئ' }, { status: 500, headers: responseHeaders })
  }
}
