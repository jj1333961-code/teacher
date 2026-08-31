import { randomUUID } from 'node:crypto'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim().slice(0, 120) : String(body.studentId ?? '').slice(0, 120)
    const assignedBy = typeof body.assignedBy === 'string' ? body.assignedBy.trim().slice(0, 120) : ''
    const type = body.assignmentType
    const from = Number(body.fromVerse)
    const to = Number(body.toVerse)
    const dueDate = body.dueDate || null
    if (!studentId || !assignedBy || !['memorization', 'recitation'].includes(type) || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 61 || from > to || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
      return Response.json({ error: 'بيانات التكليف غير صالحة' }, { status: 400 })
    }
    const id = randomUUID()
    await pool.query('INSERT INTO tuhfat_assignments (id, student_id, assigned_by, assignment_type, from_verse, to_verse, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, studentId, assignedBy, type, from, to, dueDate])
    return Response.json({ created: true, id }, { status: 201 })
  } catch {
    return Response.json({ error: 'تعذر إنشاء التكليف' }, { status: 503 })
  }
}
