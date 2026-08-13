import type { QuizQuestion } from '@/lib/db/schema'

export const runtime = 'nodejs'

const quran: Record<string, string[]> = {
  الفاتحة: ['بسم الله الرحمن الرحيم', 'الحمد لله رب العالمين', 'الرحمن الرحيم', 'مالك يوم الدين', 'إياك نعبد وإياك نستعين', 'اهدنا الصراط المستقيم', 'صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين'],
  الإخلاص: ['قل هو الله أحد', 'الله الصمد', 'لم يلد ولم يولد', 'ولم يكن له كفوا أحد'],
  الفلق: ['قل أعوذ برب الفلق', 'من شر ما خلق', 'ومن شر غاسق إذا وقب', 'ومن شر النفاثات في العقد', 'ومن شر حاسد إذا حسد'],
  الناس: ['قل أعوذ برب الناس', 'ملك الناس', 'إله الناس', 'من شر الوسواس الخناس', 'الذي يوسوس في صدور الناس', 'من الجنة والناس'],
  الكوثر: ['إنا أعطيناك الكوثر', 'فصل لربك وانحر', 'إن شانئك هو الأبتر'],
  العصر: ['والعصر', 'إن الإنسان لفي خسر', 'إلا الذين آمنوا وعملوا الصالحات وتواصوا بالحق وتواصوا بالصبر'],
  النصر: ['إذا جاء نصر الله والفتح', 'ورأيت الناس يدخلون في دين الله أفواجا', 'فسبح بحمد ربك واستغفره إنه كان توابا'],
  المسد: ['تبت يدا أبي لهب وتب', 'ما أغنى عنه ماله وما كسب', 'سيصلى نارا ذات لهب', 'وامرأته حمالة الحطب', 'في جيدها حبل من مسد'],
}

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

function generateExam(body: Record<string, unknown>) {
  const surah = String(body.surah || 'الفاتحة')
  const verses = quran[surah]
  if (!verses) throw new Error('السورة غير متاحة حاليًا في المكتبة المحلية')
  const from = Math.max(1, Number(body.fromVerse) || 1)
  const to = Math.min(verses.length, Math.max(from, Number(body.toVerse) || verses.length))
  const count = Math.min(12, Math.max(1, Number(body.count) || 5))
  const seconds = Math.min(600, Math.max(15, Number(body.seconds) || 60))
  const questions: QuizQuestion[] = Array.from({ length: count }, (_, index) => {
    const verseIndex = (from - 1 + index) % (to - from + 1)
    const verse = verses[verseIndex]
    const nextVerse = verses[Math.min(verseIndex + 1, verses.length - 1)]
    const type = index % 2 === 0 && verseIndex < verses.length - 1 ? 'choice' : 'text'
    const distractors = verses.filter((item) => item !== nextVerse).slice(0, 2)
    return { id: crypto.randomUUID(), text: type === 'choice' ? `ما الآية التي تلي: «${verse}»؟` : `اكتب الآية رقم ${verseIndex + 1} من سورة ${surah}`, type, options: type === 'choice' ? [nextVerse, ...distractors].sort(() => 0.5 - Math.random()) : [], answer: type === 'choice' ? nextVerse : verse, points: 10, hours: 0, minutes: Math.floor(seconds / 60), seconds: seconds % 60, surah, verseNumber: verseIndex + 1 }
  })
  return { quiz: { id: crypto.randomUUID(), title: `اختبار سورة ${surah}`, questions }, local: true }
}

function developerPlan(prompt: string) {
  const clean = prompt.trim().slice(0, 2000)
  const keywords = clean.split(/\s+/).filter((word) => word.length > 3).slice(0, 6)
  return { message: 'تم إعداد اقتراح محلي للمراجعة، ولن يُطبّق أي تغيير تلقائيًا.', proposal: { summary: clean, files: ['components/teacher-dashboard.tsx', 'app/api/ai/route.ts'], steps: ['مراجعة الهدف ونطاق المستخدمين', `البحث عن المواضع المرتبطة: ${keywords.join('، ') || 'واجهة المنصة'}`, 'تنفيذ التعديل في فرع منفصل', 'فحص البناء وتجربة المسار الأساسي', 'عرض الفرق على المسؤول للموافقة'], risks: ['تأثير التعديل على بيانات الاختبارات', 'ضرورة التحقق من الصلاحيات وإتاحة الاستخدام'] } }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>
    if (body.mode === 'generate_exam') return response(generateExam(body))
    if (body.mode === 'grade_answer') {
      const score = similarity(String(body.answer || ''), String(body.expected || ''))
      return response({ score, correct: score >= 80, feedback: score >= 80 ? 'إجابة صحيحة' : 'راجع ألفاظ الآية وترتيب الكلمات' })
    }
    if (body.mode === 'developer') return response(developerPlan(String(body.prompt || '')))
    if (body.mode === 'status') return response({ ready: true, engine: 'محلي مجاني', externalModels: false })
    return response({ error: 'وضع التشغيل غير مدعوم' }, 400)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'تعذر تنفيذ الطلب محليًا' }, 400)
  }
}
