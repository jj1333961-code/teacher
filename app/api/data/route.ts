import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const SNAPSHOT_ID = 'teacher-platform-v1'

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT data, updated_at FROM app_snapshots WHERE id = $1',
      [SNAPSHOT_ID],
    )
    return response({ data: result.rows[0]?.data ?? null, updatedAt: result.rows[0]?.updated_at ?? null })
  } catch {
    return response({ error: 'تعذر تحميل بيانات الموقع من Neon' }, 500)
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return response({ error: 'صيغة البيانات غير صالحة' }, 400)
    }
    const serialized = JSON.stringify(body.data)
    if (serialized.length > 5_000_000) {
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
  } catch {
    return response({ error: 'تعذر حفظ بيانات الموقع في Neon' }, 500)
  }
}
