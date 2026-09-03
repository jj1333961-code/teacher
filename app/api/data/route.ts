import { pool } from '@/lib/db'
import { rejectCrossOrigin } from '@/lib/request-security'
import { requireAdmin, requireUser } from '@/lib/server-auth'

export const runtime = 'nodejs'
const SNAPSHOT_ID = 'teacher-platform-v1'
const ALLOWED_DATA_KEYS = new Set(['subjects', 'students', 'messages', 'devices', 'admins', 'files', 'devAuditLog', 'proctoringIncidents', 'recordElements', 'extraElements', 'adminWhatsapp', 'joinRequests', 'notifications', 'aiQuestionHistory'])

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (auth.response) return auth.response
  try {
    const result = await pool.query(
      'SELECT data, updated_at FROM app_snapshots WHERE id = $1',
      [SNAPSHOT_ID],
    )
    return response({ data: result.rows[0]?.data ?? null, updatedAt: result.rows[0]?.updated_at ?? null })
  } catch (error) {
    console.error('[v0] GET /api/data failed', error)
    return response({ error: 'تعذر الاتصال بقاعدة البيانات' }, 503)
  }
}

export async function PUT(request: Request) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const body = await request.json()
    if (!body || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return response({ error: 'صيغة البيانات غير صالحة' }, 400)
    }
    const sanitizedData = Object.fromEntries(Object.entries(body.data).filter(([key]) => ALLOWED_DATA_KEYS.has(key)))
    const serialized = JSON.stringify(sanitizedData)
    if (serialized.length > 5_000_000) {
      return response({ error: 'حجم البيانات أكبر من الحد المسموح' }, 413)
    }
    const result = await pool.query(
      `INSERT INTO app_snapshots (id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = app_snapshots.data || EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [SNAPSHOT_ID, serialized],
    )
    return response({ saved: true, updatedAt: result.rows[0].updated_at })
  } catch (error) {
    console.error('[v0] PUT /api/data failed', error)
    return response({ error: 'تعذر حفظ البيانات في قاعدة البيانات' }, 503)
  }
}
