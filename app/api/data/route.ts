import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const SNAPSHOT_ID = 'teacher-platform-v1'
const MAX_BYTES = 5_000_000

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
  const clientUpdatedAt = request.headers.get('if-unmodified-since')
  const client = await pool.connect()
  try {
    const body = await request.json()
    if (!body || typeof body.data !== 'object' || Array.isArray(body.data) || body.data === null) {
      return response({ error: 'صيغة البيانات غير صالحة' }, 400)
    }
    const serialized = JSON.stringify(body.data)
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
      return response({ error: 'حجم البيانات أكبر من الحد المسموح' }, 413)
    }

    await client.query('BEGIN')
    const current = await client.query(
      'SELECT data, updated_at FROM app_snapshots WHERE id = $1 FOR UPDATE',
      [SNAPSHOT_ID],
    )
    if (clientUpdatedAt && current.rows[0]?.updated_at) {
      const serverTime = new Date(current.rows[0].updated_at).getTime()
      const clientTime = new Date(clientUpdatedAt).getTime()
      if (Number.isFinite(clientTime) && serverTime > clientTime + 1000) {
        await client.query('ROLLBACK')
        return response({ error: 'توجد نسخة أحدث', conflict: true, data: current.rows[0].data, updatedAt: current.rows[0].updated_at }, 409)
      }
    }
    if (current.rows[0]) {
      await client.query(
        'INSERT INTO app_snapshot_versions (snapshot_id, data) VALUES ($1, $2::jsonb)',
        [SNAPSHOT_ID, JSON.stringify(current.rows[0].data)],
      )
    }
    const result = await client.query(
      `INSERT INTO app_snapshots (id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING updated_at`,
      [SNAPSHOT_ID, serialized],
    )
    await client.query('COMMIT')
    return response({ saved: true, updatedAt: result.rows[0].updated_at })
  } catch {
    await client.query('ROLLBACK').catch(() => undefined)
    return response({ error: 'تعذر حفظ بيانات الموقع في Neon' }, 500)
  } finally {
    client.release()
  }
}
