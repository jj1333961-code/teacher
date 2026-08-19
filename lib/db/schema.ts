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
export const antiCheatSessions = pgTable('anti_cheat_sessions', {
  id: text('id').primaryKey(), studentId: text('student_id').notNull(), itemId: text('item_id').notNull(), itemType: text('item_type').notNull(), status: text('status').default('active').notNull(), riskScore: integer('risk_score').default(0).notNull(), severity: text('severity').default('NORMAL').notNull(), startedAt: timestamp('started_at').defaultNow().notNull(), endedAt: timestamp('ended_at'),
})

export const antiCheatEvents = pgTable('anti_cheat_events', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull(), studentId: text('student_id').notNull(), itemId: text('item_id').notNull(), eventType: text('event_type').notNull(), riskScore: integer('risk_score').notNull(), severity: text('severity').notNull(), durationMs: integer('duration_ms').default(0).notNull(), occurredAt: timestamp('occurred_at').defaultNow().notNull(), metadata: jsonb('metadata').default({}).notNull(),
})

export const antiCheatItemConfigs = pgTable('anti_cheat_item_configs', {
  itemId: text('item_id').primaryKey(), itemType: text('item_type').notNull(), enabled: boolean('enabled').default(false).notNull(), config: jsonb('config').default({}).notNull(), updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type QuizData = { id: string; title: string; questions: QuizQuestion[] }
