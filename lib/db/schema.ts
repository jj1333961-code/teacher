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

export type QuizQuestion = { id: string; text: string; options: string[]; answer?: string; hours: number; minutes: number; seconds: number }
export type QuizData = { id: string; title: string; questions: QuizQuestion[] }
