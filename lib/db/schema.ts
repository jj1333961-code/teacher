import { pgTable, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core'

export const quizzes = pgTable('quizzes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  questions: jsonb('questions').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const quizAttempts = pgTable('quiz_attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  quizId: text('quiz_id').notNull(),
  currentQuestion: integer('current_question').default(0).notNull(),
  answers: jsonb('answers').default({}).notNull(),
  completed: boolean('completed').default(false).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const devRequests = pgTable('dev_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').default('queued').notNull(),
  result: text('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const joinRequests = pgTable('join_requests', {
  id: text('id').primaryKey(),
  authUserId: text('auth_user_id'),
  source: text('source').default('phone').notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  phone: text('phone').notNull(),
  nationalId: text('national_id'),
  age: integer('age'),
  guardianName: text('guardian_name'),
  juz: text('juz'),
  surah: text('surah'),
  notes: text('notes'),
  requestCode: text('request_code').notNull(),
  status: text('status').default('pending').notNull(),
  linkedStudentId: text('linked_student_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const adminSettings = pgTable('admin_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  whatsappNumber: text('whatsapp_number').default('201554542019').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const adminNotifications = pgTable('admin_notifications', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type QuizQuestion = { id: string; text: string; options: string[]; answer?: string; hours: number; minutes: number; seconds: number }
export type QuizData = { id: string; title: string; questions: QuizQuestion[] }
