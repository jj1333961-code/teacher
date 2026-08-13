export const runtime = 'nodejs'

type ExamPlan = {
  count?: number
  level?: 'easy' | 'medium' | 'hard'
  type?: 'mcq' | 'truefalse' | 'complete' | 'audio'
  timeLimit?: number
  completeAyahs?: number
  reciteAyahs?: number
  audioShareWithParent?: boolean
  optionsCount?: number
}

type VerseSource = { surah?: string; from?: number; to?: number; text?: string }

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

function normalizeArabic(value: string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, '').replace(/\s+/g, ' ').trim()
}

function similarity(left: string, right: string) {
  const a = new Set(normalizeArabic(left).split(' ').filter(Boolean))
  const b = new Set(normalizeArabic(right).split(' ').filter(Boolean))
  if (!a.size || !b.size) return 0
  const shared = [...a].filter((word) => b.has(word)).length
  return Math.round((2 * shared * 100) / (a.size + b.size))
}

function cleanSources(value: unknown): Required<VerseSource>[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).map((item) => {
    const source = (item || {}) as VerseSource
    return {
      surah: String(source.surah || '').trim().slice(0, 80),
      from: Math.max(1, Number(source.from) || 1),
      to: Math.max(1, Number(source.to) || Number(source.from) || 1),
      text: String(source.text || '').trim().slice(0, 12000),
    }
  }).filter((source) => source.surah && source.text)
}

function shuffled<T>(items: T[], seed: number) {
  return [...items].sort((a, b) => {
    const left = JSON.stringify(a).length * 31 + seed
    const right = JSON.stringify(b).length * 17 + seed
    return (left % 97) - (right % 97)
  })
}

function generateLegacyExam(payload: Record<string, unknown>) {
  const plans = Array.isArray(payload.plans) ? payload.plans.slice(0, 20) as ExamPlan[] : []
  const sources = cleanSources(payload.sourceVerses)
  if (!plans.length) throw new Error('أضف خطة سؤال واحدة على الأقل')
  if (!sources.length) throw new Error('تعذر العثور على نصوص آيات موثوقة للتوليد')

  const questions: Record<string, unknown>[] = []
  let cursor = 0
  plans.forEach((plan) => {
    const count = Math.min(50, Math.max(1, Number(plan.count) || 1))
    for (let index = 0; index < count; index += 1) {
      const source = sources[cursor % sources.length]
      const type = ['mcq', 'truefalse', 'complete', 'audio'].includes(String(plan.type)) ? String(plan.type) : 'mcq'
      const points = plan.level === 'hard' ? 3 : plan.level === 'easy' ? 1 : 2
      const base = { surah: source.surah, from: source.from, to: source.to, points }

      if (type === 'mcq') {
        const optionCount = Math.min(6, Math.max(2, Number(plan.optionsCount) || 4))
        const otherSurahs = sources.map((item) => item.surah).filter((name) => name !== source.surah)
        const fallback = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة'].filter((name) => name !== source.surah)
        const options = shuffled([source.surah, ...new Set([...otherSurahs, ...fallback])].slice(0, optionCount), cursor)
        questions.push({ ...base, prompt: 'إلى أي سورة تنتمي الآيات المعروضة؟', stem: source.text, options, correct: source.surah })
      } else if (type === 'truefalse') {
        questions.push({ ...base, prompt: `صح أم خطأ: النص المعروض من سورة ${source.surah}.`, stem: source.text, options: ['صح', 'خطأ'], correct: 'صح' })
      } else if (type === 'complete') {
        questions.push({ ...base, prompt: `أكمل تلاوة سورة ${source.surah} من الآية ${source.from} إلى الآية ${source.to}.`, stem: source.text, options: [], correct: source.text })
      } else {
        questions.push({ ...base, prompt: `سجّل تلاوتك لسورة ${source.surah} من الآية ${source.from} إلى الآية ${source.to}.`, stem: source.text, options: [], correct: source.text })
      }
      cursor += 1
    }
  })
  return questions
}

function developerPlan(prompt: string) {
  const clean = prompt.trim().slice(0, 2000)
  return { message: 'تم إعداد اقتراح محلي للمراجعة، ولن يُطبّق أي تغيير تلقائيًا.', proposal: { summary: clean, steps: ['مراجعة الهدف', 'تحديد الملفات المتأثرة', 'تنفيذ التعديل في فرع منفصل', 'اختبار المسار', 'عرض الفرق للموافقة'] } }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>
    const payload = body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : body
    if (body.mode === 'generate_exam') return response({ result: generateLegacyExam(payload), local: true })
    if (body.mode === 'grade_answer') {
      const score = similarity(String(payload.answer || ''), String(payload.expected || ''))
      return response({ result: { score, correct: score >= 80, feedback: score >= 80 ? 'إجابة صحيحة' : 'راجع ألفاظ الآية وترتيب الكلمات' } })
    }
    if (body.mode === 'developer') return response({ result: developerPlan(String(body.prompt || payload.prompt || '')) })
    if (body.mode === 'assistant') return response({ result: 'المساعد المحلي مخصص حاليًا لتوليد الاختبارات القرآنية داخل خانة التسميع.' })
    if (body.mode === 'status') return response({ result: { ready: true, engine: 'محلي مجاني', externalModels: false } })
    return response({ error: 'وضع التشغيل غير مدعوم' }, 400)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'تعذر تنفيذ الطلب محليًا' }, 400)
  }
}
