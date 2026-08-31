import { pool } from '@/lib/db'

export const runtime = 'nodejs'
const rates = new Set([0.5, 0.75, 1, 1.25, 1.5, 2])
const gaps = new Set([0, 1, 2, 3, 5, 10])
const cleanVerses = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 61))].sort((a, b) => a - b) : []

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const userId = typeof body.userId === 'string' ? body.userId.trim().slice(0, 120) : ''
    const state = body.state ?? {}
    const rate = Number(state.playbackRate)
    const gap = Number(state.gapSeconds)
    const lastVerse = Number(state.lastVerse)
    const lastChapter = Number(state.lastChapter)
    if (!userId || !rates.has(rate) || !gaps.has(gap) || !Number.isInteger(lastVerse) || lastVerse < 1 || lastVerse > 61 || !Number.isInteger(lastChapter) || lastChapter < 1 || lastChapter > 10) {
      return Response.json({ error: 'بيانات التقدم غير صالحة' }, { status: 400 })
    }
    await pool.query(`INSERT INTO tuhfat_user_state (user_id, playback_rate, gap_seconds, last_verse, last_chapter, memorized_verses, review_verses, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT (user_id) DO UPDATE SET playback_rate=EXCLUDED.playback_rate,gap_seconds=EXCLUDED.gap_seconds,last_verse=EXCLUDED.last_verse,last_chapter=EXCLUDED.last_chapter,memorized_verses=EXCLUDED.memorized_verses,review_verses=EXCLUDED.review_verses,updated_at=now()`,
    [userId, rate, gap, lastVerse, lastChapter, cleanVerses(state.memorized), cleanVerses(state.review)])
    return Response.json({ saved: true })
  } catch {
    return Response.json({ error: 'تعذر حفظ التقدم' }, { status: 503 })
  }
}
