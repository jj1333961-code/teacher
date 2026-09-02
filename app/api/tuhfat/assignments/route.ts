import { randomUUID } from 'node:crypto'
import { pool } from '@/lib/db'
import { guardRequest, rateLimit, readJsonBody, RequestBodyError } from '@/lib/request-guards'

export const runtime = 'nodejs'
const MAX_REQUEST_BYTES = 16_000

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } })
}

export async function POST(request: Request) {
  const guard = guardRequest(request, { maxBytes: MAX_REQUEST_BYTES, requireJson: true })
  if (guard) return guard
  const limited = rateLimit(request, { bucket: 'tuhfat-assignment-write', limit: 20, windowMs: 60_000 })
  if (limited) return limited

  try {
    const body = await readJsonBody<Record<string, unknown>>(request, MAX_REQUEST_BYTES)
    const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
    const assignedBy = typeof body?.assignedBy === 'string' ? body.assignedBy.trim() : ''
    const type = typeof body?.assignmentType === 'string' ? body.assignmentType : ''
    const from = Number(body?.fromVerse)
    const to = Number(body?.toVerse)
    const rawDueDate = body?.dueDate
    const dueDate = rawDueDate === null || rawDueDate === undefined || rawDueDate === '' ? null : typeof rawDueDate === 'string' ? rawDueDate.trim() : ''
    if (!studentId || studentId.length > 120 || !assignedBy || assignedBy.length > 120 || !['memorization', 'recitation'].includes(type) || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 61 || from > to || (rawDueDate !== null && rawDueDate !== undefined && rawDueDate !== '' && (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)))) {
      return response({ error: 'بيانات التكليف غير صالحة' }, 400)
    }
    const id = randomUUID()
    await pool.query('INSERT INTO tuhfat_assignments (id, student_id, assigned_by, assignment_type, from_verse, to_verse, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, studentId, assignedBy, type, from, to, dueDate || null])
    return response({ created: true, id }, 201)
  } catch (error) {
    if (error instanceof RequestBodyError) return response({ error: error.message, code: error.code }, error.status)
    return response({ error: 'تعذر إنشاء التكليف' }, 503)
  }
}
