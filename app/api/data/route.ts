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
      'SELECT data, version, updated_at FROM app_snapshots WHERE id = $1',
      [SNAPSHOT_ID],
    )
    return response({ data: result.rows[0]?.data ?? null, version: result.rows[0]?.version ?? 0, updatedAt: result.rows[0]?.updated_at ?? null })
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
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const current = await client.query('SELECT data, version FROM app_snapshots WHERE id = $1 FOR UPDATE', [SNAPSHOT_ID])
      const currentData = current.rows[0]?.data && typeof current.rows[0].data === 'object' ? current.rows[0].data : {}
      const merged = { ...currentData, ...body.data }
      const mergedSerialized = JSON.stringify(merged)
      if (mergedSerialized.length > 5_000_000) throw new Error('PAYLOAD_TOO_LARGE')
      const result = await client.query(
        `INSERT INTO app_snapshots (id, data, version, updated_at)
         VALUES ($1, $2::jsonb, 1, now())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, version = app_snapshots.version + 1, updated_at = now()
         RETURNING version, updated_at`,
        [SNAPSHOT_ID, mergedSerialized],
      )
      await client.query('COMMIT')
      return response({ saved: true, version: result.rows[0].version, updatedAt: result.rows[0].updated_at })
    } catch (error) {
      await client.query('ROLLBACK')
      if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') return response({ error: 'حجم البيانات أكبر من الحد المسموح' }, 413)
      throw error
    } finally {
      client.release()
    }
  } catch {
    return response({ error: 'تعذر حفظ بيانات الموقع في Neon' }, 500)
  }
}
