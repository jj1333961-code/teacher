import { pool } from '@/lib/db'
import { guardRequest, rateLimit } from '@/lib/request-guards'

export const runtime = 'nodejs'
const MAX_REQUEST_BYTES = 16_000
const MAX_USER_ID_LENGTH = 120

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } })
}

export async function GET(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_REQUEST_BYTES })
  if (guard) return guard
  const limited = rateLimit(request, { bucket: 'tuhfat-read', limit: 90, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')?.trim()
  if (!userId || userId.length > MAX_USER_ID_LENGTH) return json({ error: 'معرف المستخدم غير صالح' }, 400)
  try {
    const [verses, state, assignments, audioSources] = await Promise.all([
      pool.query('SELECT verse_number, chapter_id, text FROM tuhfat_verses ORDER BY verse_number'),
      pool.query('SELECT playback_rate, gap_seconds, last_verse, last_chapter, memorized_verses, review_verses FROM tuhfat_user_state WHERE user_id = $1', [userId]),
      pool.query('SELECT id, student_id, assignment_type, from_verse, to_verse, due_date, status, created_at FROM tuhfat_assignments WHERE student_id = $1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT id, reciter_name, source_url, audio_url, license_name, license_url, distribution_allowed FROM tuhfat_audio_sources WHERE distribution_allowed = true ORDER BY verified_at DESC'),
    ])
    const row = state.rows[0]
    return json({
      verses: verses.rows,
      state: row ? { playbackRate: Number(row.playback_rate), gapSeconds: row.gap_seconds, lastVerse: row.last_verse, lastChapter: row.last_chapter, memorized: row.memorized_verses, review: row.review_verses } : null,
      assignments: assignments.rows,
      audioSources: audioSources.rows,
    })
  } catch {
    return json({ error: 'تعذر تحميل بيانات تحفة الأطفال' }, 503)
  }
}
