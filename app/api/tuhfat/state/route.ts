import { pool } from '@/lib/db'
import { guardRequest, rateLimit, readJsonBody, RequestBodyError } from '@/lib/request-guards'

export const runtime = 'nodejs'
const MAX_REQUEST_BYTES = 32_000
const rates = new Set([0.5, 0.75, 1, 1.25, 1.5, 2])
const gaps = new Set([0, 1, 2, 3, 5, 10])
const cleanVerses = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 61))].sort((a, b) => a - b) : []

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } })
}

export async function PUT(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_REQUEST_BYTES, requireJson: true })
  if (guard) return guard
  const limited = rateLimit(request, { bucket: 'tuhfat-state-write', limit: 30, windowMs: 60_000 })

  if (limited) return limited
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, MAX_REQUEST_BYTES)
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const rawState = body?.state
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState) || userId.length > 120) return response({ error: 'بيانات التقدم غير صالحة' }, 400)
    const state = rawState as Record<string, unknown>
    const rate = Number(state.playbackRate)
    const gap = Number(state.gapSeconds)
    const lastVerse = Number(state.lastVerse)
    const lastChapter = Number(state.lastChapter)
    if (!userId || !rates.has(rate) || !gaps.has(gap) || !Number.isInteger(lastVerse) || lastVerse < 1 || lastVerse > 61 || !Number.isInteger(lastChapter) || lastChapter < 1 || lastChapter > 10) {
      return response({ error: 'بيانات التقدم غير صالحة' }, 400)
    }
    await pool.query(`INSERT INTO tuhfat_user_state (user_id, playback_rate, gap_seconds, last_verse, last_chapter, memorized_verses, review_verses, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT (user_id) DO UPDATE SET playback_rate=EXCLUDED.playback_rate,gap_seconds=EXCLUDED.gap_seconds,last_verse=EXCLUDED.last_verse,last_chapter=EXCLUDED.last_chapter,memorized_verses=EXCLUDED.memorized_verses,review_verses=EXCLUDED.review_verses,updated_at=now()`,
    [userId, rate, gap, lastVerse, lastChapter, cleanVerses(state.memorized), cleanVerses(state.review)])
    return response({ saved: true })
  } catch (error) {
    if (error instanceof RequestBodyError) return response({ error: error.message, code: error.code }, error.status)
    return response({ error: 'تعذر حفظ التقدم' }, 503)
  }
}
