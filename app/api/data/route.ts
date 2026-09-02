import { pool } from '@/lib/db'
import { guardRequest, readJsonBody, RequestBodyError } from '@/lib/request-guards'

export const runtime = 'nodejs'
const SNAPSHOT_ID = 'teacher-platform-v1'
const MAX_SNAPSHOT_BYTES = 5_000_000
const SNAPSHOT_KEYS = new Set([
  'subjects', 'students', 'messages', 'devices', 'admins', 'files', 'devAuditLog',
  'proctoringIncidents', 'recordElements', 'extraElements', 'adminWhatsapp', 'joinRequests',
  'notifications', 'aiQuestionHistory',
])

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}

function bodyError(error: unknown) {
  return error instanceof RequestBodyError
    ? response({ error: error.message, code: error.code }, error.status)
    : null
}

export async function GET(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_SNAPSHOT_BYTES })
  if (guard) return guard

  try {
    const result = await pool.query(
      'SELECT data, updated_at FROM app_snapshots WHERE id = $1',
      [SNAPSHOT_ID],
    )
    return response({ data: result.rows[0]?.data ?? null, updatedAt: result.rows[0]?.updated_at ?? null })
  } catch (error) {
    // التخزين السحابي اختياري؛ لا نحول تعذر Neon إلى خطأ يعطل الواجهة.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[v0] GET /api/data unavailable; continuing with local data')
    }
    return response({ data: null, unavailable: true })
  }
}

export async function PUT(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_SNAPSHOT_BYTES, requireJson: true })
  if (guard) return guard

  try {
    const body = await readJsonBody<{ data?: unknown }>(request, MAX_SNAPSHOT_BYTES)
    if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
      return response({ error: 'صيغة البيانات غير صالحة' }, 400)
    }
    const snapshotData = body.data as Record<string, unknown>
    const unknownKeys = Object.keys(snapshotData).filter((key) => !SNAPSHOT_KEYS.has(key))
    if (unknownKeys.length) {
      return response({ error: 'تحتوي البيانات على مفاتيح غير مسموحة' }, 400)
    }
    const serialized = JSON.stringify(body.data)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SNAPSHOT_BYTES) {
      return response({ error: 'حجم البيانات أكبر من الحد المسموح' }, 413)
    }
    const result = await pool.query(
      `INSERT INTO app_snapshots (id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [SNAPSHOT_ID, serialized],
    )
    return response({ saved: true, updatedAt: result.rows[0].updated_at })
  } catch (error) {
    const invalidBody = bodyError(error)
    if (invalidBody) return invalidBody
    // تبقى البيانات المحلية هي المصدر الاحتياطي عند غياب قاعدة البيانات.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[v0] PUT /api/data unavailable; local data was retained')
    }
    return response({ saved: false, unavailable: true }, 200)
  }
}
