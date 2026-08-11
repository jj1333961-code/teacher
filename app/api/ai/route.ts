export const maxDuration = 60

// ===== مزوّد الذكاء الاصطناعي: Groq =====
// المفتاح يُقرأ من متغيّر البيئة على الخادم فقط ولا يُرسل أبداً إلى المتصفح.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
// نموذج نصي احترافي (production) + نموذج تفريغ صوتي، كلاهما عبر Groq.
// النماذج قابلة للضبط عبر متغيرات البيئة لتفادي أي إيقاف مستقبلي دون تعديل الكود.
// الافتراضي gpt-oss-120b لأنه نموذج production مستقر وهو البديل الرسمي لـ llama-3.3-70b-versatile الموقوف.
const TEXT_MODEL = (process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b").trim()
const TRANSCRIBE_MODEL = (process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3").trim()
const GROQ_AUDIO_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

// ===== مزوّد تحويل الصوت إلى نص (Speech-to-Text) قابل للتبديل عبر متغيرات البيئة =====
// افتراضياً نستخدم Groq (Whisper). عند ضبط SPEECH_TO_TEXT_API_KEY يُستخدم مزوّد خارجي متوافق مع OpenAI
// (مثل OpenAI Whisper). كل هذه القيم Server-side فقط ولا تصل أبداً إلى المتصفح.
const STT_API_KEY = (process.env.SPEECH_TO_TEXT_API_KEY || "").trim()
const STT_URL = (process.env.SPEECH_TO_TEXT_URL || "https://api.openai.com/v1/audio/transcriptions").trim()
const STT_MODEL = (process.env.SPEECH_TO_TEXT_MODEL || "whisper-1").trim()
const sttProviderConfigured = !!STT_API_KEY
// مزوّد التحقق من هوية المتحدث (Speaker Verification) — نقطة توسعة اختيارية عبر البيئة.
const speakerVerificationConfigured = !!(process.env.SPEAKER_VERIFICATION_API_KEY || "").trim()

const keyConfigured = !!process.env.GROQ_API_KEY

// إعدادات التطبيق التلقائي عبر GitHub. جميعها Server-side فقط ولا تُرسل أبداً إلى المتصفح.
// نفضّل المتغيرات الأحدث (‎*_2‎) عند وجودها، ثم نعود إلى المتغيرات الأصلية.
const pickEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = (process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

// تنظيف اسم المالك: يزيل أي رابط أو مسافات ويُبقي اسم المستخدم فقط.
function sanitizeOwner(raw: string): string {
  let v = (raw || "").trim()
  if (!v) return ""
  // إن أُدخِل رابط كامل مثل https://github.com/owner/repo نستخرج المالك منه.
  const m = v.match(/github\.com[/:]+([^/]+)/i)
  if (m) return m[1].replace(/\.git$/i, "").trim()
  // إن أُدخِل بصيغة owner/repo نأخذ الجزء الأول فقط.
  if (v.includes("/")) return v.split("/")[0].replace(/\.git$/i, "").trim()
  return v.replace(/\.git$/i, "").trim()
}

// تنظيف اسم المستودع: يُبقي اسم المستودع فقط (بدون https، بدون .git، بدون اسم المالك).
function sanitizeRepo(raw: string): string {
  let v = (raw || "").trim()
  if (!v) return ""
  // إزالة أي رابط GitHub كامل والإبقاء على owner/repo.
  const m = v.match(/github\.com[/:]+(.+)$/i)
  if (m) v = m[1]
  v = v.replace(/^https?:\/\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "").trim()
  // إن بقيت الصيغة owner/repo نأخذ آخر جزء (اسم المستودع فقط).
  if (v.includes("/")) v = v.split("/").filter(Boolean).pop() as string
  return (v || "").trim()
}

const GITHUB_TOKEN = pickEnv("GITHUB_TOKEN")
const GITHUB_OWNER = sanitizeOwner(pickEnv("GITHUB_OWNER_3", "GITHUB_OWNER_2", "GITHUB_OWNER"))
const GITHUB_REPO = sanitizeRepo(pickEnv("GITHUB_REPO_3", "GITHUB_REPO_2", "GITHUB_REPO"))
// إن لم يُضبط GITHUB_BRANCH نستخدم الفرع الافتراضي الفعلي للمستودع (يُحلّ وقت التشغيل)، لا نفترض "main".
const GITHUB_BRANCH_ENV = pickEnv("GITHUB_BRANCH_3", "GITHUB_BRANCH_2", "GITHUB_BRANCH")
const AUTO_DEV_ENABLED = process.env.DEV_ASSISTANT_AUTO_APPLY === "true"
const githubConfigured = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO)
const GITHUB_API = "https://api.github.com"
const VERCEL_DEPLOY_HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL

// الفرع المُحلّ يُخزّن مؤقتاً بعد أول استعلام لتفادي استعلامات متكررة.
let resolvedBranch: string | null = null

// نداء موحّد إلى Groq (chat/completions). يُرجع نص الرد.
async function groqChat(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("GROQ_API_KEY غير مُهيّأ على الخادم")
  }
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 300)}`)
  }
  const data = await res.json().catch(() => null)
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== "string") {
    throw new Error("رد غير متوقع من Groq")
  }
  return text
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  })
}

// استخراج JSON بشكل متسامح من رد النموذج (يزيل أسوار الأكواد ويقتطع أول كائن/مصفوفة)
function extractJson(text: string): any {
  if (!text) return null
  let t = text.trim()
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  // محاولة مباشرة
  try {
    return JSON.parse(t)
  } catch {}
  // اقتطاع أول [ ... ] أو { ... }
  const firstArr = t.indexOf("[")
  const firstObj = t.indexOf("{")
  let start = -1
  if (firstArr === -1) start = firstObj
  else if (firstObj === -1) start = firstArr
  else start = Math.min(firstArr, firstObj)
  if (start === -1) return null
  const open = t[start]
  const close = open === "[" ? "]" : "}"
  let depth = 0
  for (let i = start; i < t.length; i++) {
    if (t[i] === open) depth++
    else if (t[i] === close) {
      depth--
      if (depth === 0) {
        const slice = t.slice(start, i + 1)
        try {
          return JSON.parse(slice)
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function runText(prompt: string, system: string, temperature: number) {
  return groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature,
    4000,
  )
}

// تحويل الصوت إلى نص مع دعم مزوّد خارجي قابل للتبديل عبر البيئة.
// إن ضُبط SPEECH_TO_TEXT_API_KEY نستخدم مزوّداً متوافقاً مع OpenAI (multipart)،
// وإلا نعود تلقائياً إلى Groq (Whisper). لا يتعطّل النظام إذا لم يُضبط مزوّد خارجي.
async function transcribeAudio(audioBase64: string, audioFormat: string): Promise<string> {
  const bytes = Buffer.from(audioBase64, "base64")
  const mime = audioFormat === "mp3" ? "audio/mpeg" : "audio/wav"

  // المزوّد الخارجي المخصّص (OpenAI-compatible) عند توفّر مفتاحه.
  if (sttProviderConfigured) {
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: mime }), `recording.${audioFormat}`)
    form.append("model", STT_MODEL)
    form.append("language", "ar")
    const res = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${STT_API_KEY}` },
      body: form,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`STT provider ${res.status}: ${errText.slice(0, 300)}`)
    }
    const data = await res.json().catch(() => null)
    return typeof data?.text === "string" ? data.text.trim() : ""
  }
  // الافتراضي: Groq (تفريغ صوتي عبر Whisper بصيغة multipart/form-data).
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY غير مُهيّأ على الخادم")
  const form = new FormData()
  form.append("file", new Blob([bytes], { type: mime }), `recording.${audioFormat}`)
  form.append("model", TRANSCRIBE_MODEL)
  form.append("language", "ar")
  form.append("response_format", "json")
  const res = await fetch(GROQ_AUDIO_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Groq transcription ${res.status}: ${errText.slice(0, 300)}`)
  }
  const data = await res.json().catch(() => null)
  return typeof data?.text === "string" ? data.text.trim() : ""
}

// ===== أنظمة التعليمات لكل وضع =====

const SYS_EXAM = `أنت خبير متخصص في القرآن الكريم واختبارات الحفظ لطلاب التحفيظ.
مهمتك توليد أسئلة اختبار قرآنية فقط، دقيقة ومبنية حصراً على نصوص الآيات المرسلة في sourceVerses.

قواعد صارمة:
- ممنوع اختراع آية أو عبارة قرآنية غير موجودة في sourceVerses.
- كل سؤال يجب أن يكون متعلقاً مباشرة بحفظ القرآن أو نص الآية أو السورة.
- لا تنشئ أسئلة ثقافة عامة أو دين عام أو معلومات خارج نصوص القرآن.
- التزم تماماً بعدد الأسئلة count المطلوب لكل plan، وبالنوع والمستوى المحددين في كل plan.
- إذا كان type=mcq فعدد الخيارات يجب أن يساوي optionsCount لذلك plan، مع إجابة صحيحة واحدة فقط.
- إذا كان type=truefalse فاجعل options=["صح","خطأ"] فقط، وبدّل بين العبارات الصحيحة والخاطئة بذكاء. مثال: "الآية ... من سورة الناس، صح أم خطأ؟"
- إذا كان type=complete فاختر بداية آية حقيقية، ثم اجعل الطالب يكمل عدداً يساوي completeAyahs بالضبط. يجب أن يكون from/to صحيحين وفي السورة نفسها.
- إذا كان type=audio فحدد مقطعاً حقيقياً من السورة، ويجب أن يساوي عدد الآيات من from إلى to قيمة reciteAyahs بالضبط.
- level=easy: سؤال مباشر من النص.
- level=medium: تمييز وربط أدق بين الآية والسورة أو موضعها.
- level=hard: مواضع متشابهة وتمييز دقيق دون غموض أو معلومات من خارج النص.
- لا تكرر السؤال نفسه.
- points=1 دائماً.
- timeLimit لا يخرج عن الوقت الذي حدده المسؤول في plan؛ إذا كان موجوداً فاستخدمه كما هو.
- لا تضع إجابة صحيحة خارج الخيارات.
- أعد مصفوفة JSON فقط، دون Markdown أو شرح.

شكل كل عنصر:
{"type":"mcq|truefalse|complete|audio","level":"easy|medium|hard","surah":"اسم السورة","prompt":"نص السؤال","stem":"الآية أو النص القرآني المرجعي عند الحاجة","options":[],"correct":"الإجابة الصحيحة","from":1,"to":1,"timeLimit":60,"completeAyahs":1,"reciteAyahs":1,"points":1}

تحقق قبل الإخراج من أن عدد العناصر لكل plan يساوي count تماماً، وأن الآيات المستخدمة موجودة فعلاً في sourceVerses.`

const SYS_GRADE_TEXT = `أنت مصحّح متسامح لاختبارات حفظ القرآن. صحّح إجابة الطالب في نوع "أكمل".
كن متساهلاً مع الأخطاء الميسورة: الأخطاء الإملائية البسيطة، اختلاف التشكيل، الهمزات، التاء المربوطة/المفتوحة، حذف/إضافة الألف. هذه لا تُنقص الدرجة.
احسب matchedPercent (0-100) لمدى مطابقة المعنى والألفاظ للنص المرجعي.
score: 1 إذا كان صحيحاً (ولو بأخطاء ميسورة)، 0.5 إذا نقصت آية واحدة أو خطأ جوه����ي بسيط، 0 إذا كان مختلفاً أو ناقصاً كثيراً.
أعد JSON فقط: {"accepted":true/false,"score":1|0.5|0,"matchedPercent":number,"reason":"سبب مختصر بالعربية","missingAyahs":[]}`

const SYS_GRADE_RECITATION = `أنت مصحّح متسامح لتلاوة القرآن اعتماداً على تفريغ نصي (transcript) قد يكون غير دقيق بسبب التعرف الآلي.
قارن ما تلاه الطالب بالنص المتوقع expectedText للمقطع المطلوب (surah من from إلى to).
كن متساهلاً: يكفي وجود القليل من الآيات أو الكلمات الصحيحة المطابقة للمق��ع المطلوب لقبول أن الطالب يتلو نفس المقطع. تجاوز أخطاء التعرف الآلي والتشكيل.
score: 1 إذا تلا المقطع المطلوب بشكل مقبول (ولو بأخطاء)، 0.5 إذا نسي آية واحدة فقط، 0 إذا نسي أكثر من آية أو تلا مقطعاً مختلفاً تماماً.
أعد JSON فقط: {"accepted":true/false,"score":1|0.5|0,"matchedPercent":number,"reason":"سبب مختصر بالعربية","missingAyahs":["أرقام أو نصوص الآيات الناقصة"]}`

const SYS_TRANSCRIBE = `أنت خبير في تصحيح تلاوة القرآن الكريم اعتماداً على تفريغ صوتي عربي.
مهمتك:
1) افحص transcript الناتج عن التعرف الصوتي وحدد هل هو تلاوة قرآن أم كلام/صوت غير مناسب.
2) قارن transcript بالنص المتوقع expectedText للمقطع: سورة surah من الآية from إلى الآية to.
3) تجاهل أخطاء التعرف الآلي والتشكيل والأخطاء الإملائية البسيطة، ولا تعتبرها نقصاً في الآيات.
4) حدد الآيات الناقصة فعلياً فقط.
قواعد الدرجة:
- احسب score أساساً من نسبة الآيات المكتملة: (عدد الآيات الكلية - الآيات الناقصة) / عدد الآيات الكلية.
- score=1 عند اكتمال المقطع، و0 عند فقد كل المقطع أو اختلافه جذرياً.
- matchedPercent نسبة تقريبية لمطابقة المحتوى 0-100.
أعد JSON فقط بدون أي شرح خارجه:
{"transcript":"النص المفرغ","accepted":true/false,"score":number,"matchedPercent":number,"isRecitation":true/false,"reason":"سبب مختصر بالعربية","missingAyahs":["أرقام أو نصوص الآيات الناقصة"]}`

// ===== مساعد تطوير الموقع (للمسؤول فقط) =====
// وصف مختصر وحقيقي لبنية المشروع يُرسل للنموذج ��سياق للتحليل.
const PROJECT_MANIFEST = `المشروع الحالي: Student System AI — منصة إدارة طلاب تحفيظ القرآن واختبارهم (Next.js + صفحة SPA واحدة).
الهدف من هذا الوضع: مساعد تطوير فعلي للمسؤول. يحلل المشروع، يحدد الملفات المطلوبة، ثم يمكنه إنشاء كود كامل وتطبيقه تلقائياً على مستودع المشروع من الخادم فقط. لا تنتظر مو��فقة بشرية بعد إرسال الطلب إذا كان التطبيق التلقائي مفعلاً.
البنية والملفات الرئيسية:
- "public/index.html": التطبيق كامل (واجهة عربية RTL + كل منطق JavaScript). يحتوي على:
  • صفحات معرّفة كـ <div class="page hidden" id="..."> وتُعرض عبر showPage('id') والرجوع عبر goBack().
  • لوحة المسؤول (adminDashboard) وبها menu-grid فيها أزرار menu-btn.
  • صفحات الطالب وولي الأمر، الرسائل، الملفات، إدارة المسؤولين، إعدادات المسؤول (adminSettings).
  • تخزين البيانات محلياً عبر getData(key)/setData(key,value) على localStorage (مفاتيح مثل students, admins, messages, files).
  • حالة الجلسة: currentUser, currentType ('admin'|'student'|'parent'), currentAdminId.
  • الذكاء الاصطناعي عبر callStudentAI(mode,payload,temperature) الذي ينادي /api/ai.
  • بناء الاختبارات: examPlanRows, renderExamPlanRows(), أنواع الأسئلة mcq/truefalse/complete/audio.
  • التسجيل الصوتي والبصمة الصوتية: computeVoicePrint(), voiceMatchPercent(), blobToWav().
- "app/api/ai/route.ts": نقطة النهاية الآمنة على الخادم. تستخدم Groq (GROQ_API_KEY) وتدعم الأوضاع: generate_exam, grade_text, grade_recitation, transcribe_and_grade, dev_assistant, بالإضافة إلى وضع النص الحر (prompt).
- "app/layout.tsx": تخطيط الجذر.
- "app/page.tsx": صفحة Next.js احتياطية؛ الجذر يعاد توجيهه إلى public/index.html عبر next.config.mjs.
- "app/globals.css": الأنماط العامة لـNext.js.
- "next.config.mjs": rewrite للجذر إلى public/index.html.
- "package.json": تبعيات وسكربتات المشروع.
- "components/ui/button.tsx" و"lib/utils.ts": مكونات/أدوات مساعدة موجودة في المشروع.

المسارات الموجودة في النسخة الحالية: public/index.html, app/api/ai/route.ts, app/page.tsx, app/layout.tsx, app/globals.css, next.config.mjs, package.json, components/ui/button.tsx, lib/utils.ts, .env.example, DEPLOY.md.
قيود مهمة يجب احترامها في أي خطة: لا حذف الملفات، لا إعادة بناء المشروع، لا وضع مفتاح API في المتصفح، الحفاظ على التصميم العربي RTL الحا��ي، وتعديل الموجود فقط أو إضافة م�� يلزم.`

const SYS_DEV_ASSISTANT = `أنت مهندس برمجيات Senior ومساعد تطوير تلقائي لمشروع Student System AI. يفهم TypeScript وJavaScript وHTML وCSS وNext.js وواجهات API وGitHub وVercel. المستخدم هنا هو المسؤول ويعطيك طلباً بالعربية لتعديل الموقع.
مهمتك: فهم الطلب، فحص قائمة ملفات المشروع الحالية، تحديد الملفات التي يجب تعديلها أو إنشاؤها، ووضع خطة تنفيذ دقيقة. لا تكتب المحتوى الكامل للملفات في مرحلة الخطة؛ مرحلة التطبيق المنفصلة ستقرأ الملفات الحقيقية وتولّد الكود الكامل. يجب أن تكون قادراً على اقتراح تغييرات برمجية حقيقية، وليس مجرد وصف عام.
احترم دائماً: عدم حذف الملفات، عدم إعادة بناء المشروع، عدم وضع أي API key في المتصفح، والحفاظ على التصميم العربي RTL.
أعد النتيجة حصراً ككائن JSON صالح بالعربية بالحقول التالية (بدون أي نص خارجه):
{
 "understanding": "إعادة صياغة موجزة لفهمك للطلب",
 "feasible": true/false,
 "summary": "ملخص عام للخطة في جملة أو جملتين",
 "files": [ { "path": "مسار الملف", "action": "modify"|"create", "reason": "لماذا يُعدّل هذا الملف", "changes": ["تغيير مقترح 1","تغيير مقترح 2"] } ],
 "steps": ["خطوة تنفيذ 1","خطوة 2"],
 "risks": ["مخاطرة أو أثر جانبي محتمل"],
 "clarifications": ["سؤال توضيحي إن كان الطلب غامضاً"]
}
قواعد إضافية مهمة: لا تقترح حذف أو إعادة تسمية أي ملف. لا تضع أسراراً أو مفاتيح API في public أو كود المتصفح. يمكنك اختيار أي ملف موجود ف�� قائمة المستودع التي نرسلها لك، ويمكن إنشاء ملف جديد فقط عند الحاجة الواضحة. إذا احتاج الطلب خدمة خارجية غير مضبوطة، اذكر ذلك في risks أو clarifications. لا تضع أسراراً أو مفاتيح API في ملفات public أو كود المتصفح. إن كان الطلب مخالفاً للقيود (مثل حذف المشروع أو إعادة بنائه) اجعل feasible=false واشرح السبب في summary.`


function githubHeaders() {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN غير موجود على الخادم")
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  }
}

// قراءة بيانات المستودع (تُستخدم للتحقق من وجوده، صلاحيات الرمز، والفرع الافتراضي).
async function githubGetRepo() {
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات مستودع GitHub غير مكتملة")
  const url = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}`
  const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" })
  if (res.status === 404) throw new Error(`المستودع ${GITHUB_OWNER}/${GITHUB_REPO} غير موجود أو لا يملك الرمز صلاحية الوصول إليه`)
  if (res.status === 401) throw new Error("GITHUB_TOKEN غير صالح (401 Unauthorized)")
  if (res.status === 403) throw new Error("الرمز GITHUB_TOKEN ممنوع من الوصول (403) — تحقق من صلاحياته")
  if (!res.ok) throw new Error(`GitHub ${res.status}: تعذر قراءة بيانات المستودع`)
  return await res.json()
}

// يحل الفرع الفعلي: يستخدم GITHUB_BRANCH إن ضُبط، وإلا الفرع الافتراضي الحقيقي للمستودع.
async function resolveBranch(): Promise<string> {
  if (resolvedBranch) return resolvedBranch
  if (GITHUB_BRANCH_ENV) {
    resolvedBranch = GITHUB_BRANCH_ENV as string
    return resolvedBranch
  }
  const repo = await githubGetRepo()
  resolvedBranch = (repo?.default_branch as string) || "main"
  return resolvedBranch
}

async function githubGetFile(path: string, ref?: string) {
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات مستودع GitHub غير مكتملة")
  const branch = ref || (await resolveBranch())
  const url = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" })
  if (!res.ok) throw new Error(`GitHub ${res.status}: تعذر قراءة ${path}`)
  const data = await res.json()
  if (Array.isArray(data)) throw new Error(`المسار ${path} مجلد وليس ملفاً`)
  const content = typeof data.content === "string" ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8") : ""
  return { path, sha: data.sha, content }
}

async function githubListTree(ref?: string) {
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات مستودع GitHub غير مكتملة")
  const branch = ref || (await resolveBranch())
  const refUrl = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/ref/heads/${encodeURIComponent(branch)}`
  const refRes = await fetch(refUrl, { headers: githubHeaders(), cache: "no-store" })
  if (!refRes.ok) throw new Error(`GitHub ${refRes.status}: تعذر قراءة الفرع ${branch}`)
  const refData = await refRes.json()
  const commitSha = refData?.object?.sha
  const commitUrl = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/commits/${commitSha}`
  const commitRes = await fetch(commitUrl, { headers: githubHeaders(), cache: "no-store" })
  if (!commitRes.ok) throw new Error(`GitHub ${commitRes.status}: تعذر قراءة آخر commit`)
  const commit = await commitRes.json()
  const treeUrl = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/git/trees/${commit.tree.sha}?recursive=1`
  const treeRes = await fetch(treeUrl, { headers: githubHeaders(), cache: "no-store" })
  if (!treeRes.ok) throw new Error(`GitHub ${treeRes.status}: تعذر قراءة شجرة المشروع`)
  const tree = await treeRes.json()
  const files = Array.isArray(tree.tree) ? tree.tree.filter((x:any) => x.type === "blob").map((x:any) => x.path).filter(safeProjectPath).slice(0, 500) : []
  return { files, commitSha }
}

async function githubPutFile(path: string, content: string, sha?: string, message = "chore: apply AI development assistant change") {
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات ��ستودع GitHub غير مكتملة")
  const url = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`
  const body: any = { message, content: Buffer.from(content, "utf8").toString("base64"), branch: await resolveBranch() }
  if (sha) body.sha = sha
  const res = await fetch(url, { method: "PUT", headers: githubHeaders(), body: JSON.stringify(body), cache: "no-store" })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`GitHub ${res.status}: تعذر حفظ ${path} ${detail.slice(0, 200)}`)
  }
  return await res.json()
}

// ملفات حسّاسة يُمنع حذفها تلقائياً لحماية المشروع من الأعطال (يتطلب تعديلها لا حذفها).
const PROTECTED_PATHS = new Set([
  "public/index.html", "app/api/ai/route.ts", "app/layout.tsx", "app/page.tsx",
  "app/globals.css", "next.config.mjs", "package.json", "package-lock.json",
  "pnpm-lock.yaml", "tsconfig.json",
])

// حذف ملف واحد من المستودع عبر Contents API (ينشئ commit ويحافظ على كامل تاريخ الإصدارات — لا force push).
async function githubDeleteFile(path: string, message: string) {
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات مستودع GitHub غير مكتملة")
  if (!safeProjectPath(path)) throw new Error(`المسار ${path} غير مسموح`)
  if (PROTECTED_PATHS.has(path)) throw new Error(`الملف ${path} محمي ولا يمكن حذفه تلقائياً لأنه أساسي لعمل المشروع`)
  // نقرأ الملف أولاً للحصول على sha ولنتأكد أنه موجود فعلاً.
  const file = await githubGetFile(path)
  const url = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`
  const body = { message, sha: file.sha, branch: await resolveBranch() }
  const res = await fetch(url, { method: "DELETE", headers: githubHeaders(), body: JSON.stringify(body), cache: "no-store" })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`GitHub ${res.status}: تعذر حذف ${path} ${detail.slice(0, 200)}`)
  }
  return await res.json()
}

// حالة المزامنة: يتحقق من الاتصال بمستودع المسؤول ويعيد آخر commit ورابط سجل التعديلات.
// لا يكشف أبداً قيمة أي رمز مميز. عند أي فشل يعيد connected=false مع سبب واضح.
async function getGithubSyncStatus() {
  const missing: string[] = []
  if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN")
  if (!GITHUB_OWNER) missing.push("GITHUB_OWNER")
  if (!GITHUB_REPO) missing.push("GITHUB_REPO")
  if (missing.length) {
    return { connected: false, reason: `متغيرات البيئة التالية غير مهيأة على الخادم: ${missing.join("، ")}`, missing }
  }
  let repo: any
  try {
    repo = await githubGetRepo()
  } catch (e: any) {
    const msg = String(e?.message || "")
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|getaddrinfo/i.test(msg)) {
      return { connected: false, reason: "تعذر الاتصال بخوادم GitHub (مشكلة في الشبكة)." }
    }
    return { connected: false, reason: msg }
  }
  const perms = repo?.permissions
  const canWrite = !!(perms && (perms.push === true || perms.admin === true || perms.maintain === true))
  let branch = ""
  try { branch = await resolveBranch() } catch (e: any) {
    return { connected: false, reason: String(e?.message || "تعذر تحديد الفرع") }
  }
  // آخر commit على الفرع.
  let lastCommit: any = null
  try {
    const url = `${GITHUB_API}/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/commits/${encodeURIComponent(branch)}`
    const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" })
    if (res.ok) {
      const c = await res.json()
      lastCommit = {
        sha: (c?.sha || "").slice(0, 7),
        message: c?.commit?.message || "",
        author: c?.commit?.author?.name || c?.author?.login || "",
        date: c?.commit?.author?.date || "",
        url: c?.html_url || "",
      }
    }
  } catch { /* آخر commit اختياري */ }
  const fullName = `${GITHUB_OWNER}/${GITHUB_REPO}`
  return {
    connected: true,
    canWrite,
    autoSync: AUTO_DEV_ENABLED,
    repo: fullName,
    branch,
    lastCommit,
    // روابط عامة (ليست أسراراً) لعرض سجل التعديلات على GitHub الخاص بالمسؤول.
    historyUrl: `https://github.com/${fullName}/commits/${branch}`,
    repoUrl: `https://github.com/${fullName}`,
  }
}

// فحص مسبق تفصيلي قبل أي تطبيق تلقائي. يعيد ok=false مع سبب محدد جداً (أي متغير ناقص/أي صلاحية).
// لا ي��شف أبداً قيمة أي رمز مميز، فقط اسم ��لمتغير الناقص أو نوع المشكلة.
async function preflightAutoApply(): Promise<{ ok: boolean; reason?: string; details?: any }> {
  const missing: string[] = []
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY")
  if (!GITHUB_TOKEN) missing.push("GITHUB_TOKEN")
  if (!GITHUB_OWNER) missing.push("GITHUB_OWNER")
  if (!GITHUB_REPO) missing.push("GITHUB_REPO")
  if (missing.length) {
    return {
      ok: false,
      reason: `متغيرات البيئة التالية غير موجودة على الخادم: ${missing.join("، ")}. أضِفها في إعدادات المشروع (Environment Variables) على Vercel ثم أعد المحاولة.`,
      details: { missing },
    }
  }
  if (!AUTO_DEV_ENABLED) {
    return { ok: false, reason: "التطبيق التلقائي غير مفعّل. اضبط DEV_ASSISTANT_AUTO_APPLY=true على الخادم." }
  }
  // التحقق من ��لشبكة + وجود المستودع فعلياً + صلاحية الرمز.
  let repo: any
  try {
    repo = await githubGetRepo()
  } catch (e: any) {
    const msg = String(e?.message || "")
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|getaddrinfo/i.test(msg)) {
      return { ok: false, reason: "تعذر الاتصال بخوادم GitHub (مشكلة في الشبكة). يرجى المحاولة مرة أخرى." }
    }
    return { ok: false, reason: msg }
  }
  // التحقق من صلاحية الكتابة على محتوى المستودع (Contents: Read and write).
  const perms = repo?.permissions
  if (perms && perms.push !== true && perms.admin !== true && perms.maintain !== true) {
    return {
      ok: false,
      reason: `الرمز GITHUB_TOKEN لا يملك صلاحية الكتابة على المستودع ${GITHUB_OWNER}/${GITHUB_REPO}. امنح الرمز صلاحية Contents: Read and write ثم أعد المحاولة.`,
    }
  }
  // التحقق من أن الفرع المُحدد/الافتراضي قابل للحل.
  let branch = ""
  try {
    branch = await resolveBranch()
  } catch (e: any) {
    return { ok: false, reason: String(e?.message || "تعذر تحديد فرع المستودع") }
  }
  return { ok: true, details: { repo: `${GITHUB_OWNER}/${GITHUB_REPO}`, branch } }
}

function safeProjectPath(path: string) {
  const normalized = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.includes("..") || normalized.startsWith(".git/")) return false
  if (normalized === ".env" || normalized.startsWith(".env.") && !normalized.endsWith(".example")) return false
  return true
}

// ===== طبقة الاختبار والتحقق الذاتي للوكيل =====
// فحص ثابت (static analysis) لكل ملف مُعدّل للتأكد من سلامته البنيوية قبل الحفظ في المستودع.
// يكتشف: JSON غير صالح، أقواس/وسوم غير متوازنة، ملف فارغ بالخطأ، وبقايا علامات دمج Git.
// لا يشغّل الكود، لكنه يمنع تطبيق تعديلات مكسورة بناءً على تحليل النص.

// يوازن الأقواس {} () [] مع تجاهل ما يقع داخل السلاسل النصية والتعليقات في ملفات JS/TS.
function checkBracketBalance(content: string, isCode: boolean): string[] {
  const errors: string[] = []
  const stack: Array<{ ch: string; line: number }> = []
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" }
  const openers = new Set(["(", "[", "{"])
  const closers = new Set([")", "]", "}"])
  let line = 1
  let inStr: string | null = null
  let inLineComment = false
  let inBlockComment = false
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    const next = content[i + 1]
    if (c === "\n") {
      line++
      inLineComment = false
      continue
    }
    if (inLineComment) continue
    if (inBlockComment) {
      if (c === "*" && next === "/") { inBlockComment = false; i++ }
      continue
    }
    if (inStr) {
      if (c === "\\") { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (isCode) {
      if (c === "/" && next === "/") { inLineComment = true; i++; continue }
      if (c === "/" && next === "*") { inBlockComment = true; i++; continue }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue }
    }
    if (openers.has(c)) stack.push({ ch: c, line })
    else if (closers.has(c)) {
      const top = stack.pop()
      if (!top || top.ch !== pairs[c]) {
        errors.push(`قوس إغلاق غير متطابق '${c}' عند السطر ${line}`)
        if (errors.length > 5) break
      }
    }
  }
  if (stack.length && errors.length <= 5) {
    const t = stack[stack.length - 1]
    errors.push(`قوس '${t.ch}' مفتوح ولم يُغلق (بدأ عند السطر ${t.line})`)
  }
  return errors
}

// فحص شامل لملف واحد حسب امتداده. old هو المحتوى السابق (للكشف عن الإفراغ بالخطأ).
function validatePatchContent(path: string, content: string, old?: string): string[] {
  const errors: string[] = []
  const lower = path.toLowerCase()
  if (typeof content !== "string") return [`محتوى الملف ${path} غير نصّي`]
  if (old && old.trim() && !content.trim()) errors.push(`الملف ${path} أصبح فارغاً بينما لم يكن فارغاً — يُرجّح أنه حذف بالخطأ`)
  if (/^(<{7}|={7}|>{7})/m.test(content)) errors.push(`الملف ${path} يحتوي على علامات دمج Git غير محلولة (<<<<<<< أو =======)`)
  if (lower.endsWith(".json")) {
    try { JSON.parse(content) } catch (e: any) { errors.push(`JSON غير صالح في ${path}: ${String(e?.message || "").slice(0, 120)}`) }
    return errors
  }
  const isCode = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/.test(lower)
  const isHtml = lower.endsWith(".html") || lower.endsWith(".htm")
  if (isCode || isHtml) errors.push(...checkBracketBalance(content, isCode))
  return errors
}

// يفحص كل الرقع ويعيد خريطة الأخطاء لكل مسار (المسارات السليمة لا تظهر).
function validatePatches(patches: any[], currentMap: Map<string, { content: string }>): Record<string, string[]> {
  const report: Record<string, string[]> = {}
  for (const patch of patches) {
    const path = String(patch?.path || "")
    const content = typeof patch?.content === "string" ? patch.content : ""
    const old = currentMap.get(path)?.content
    const errs = validatePatchContent(path, content, old)
    if (errs.length) report[path] = errs
  }
  return report
}

// جولة إصلاح ذاتي: يعيد إرسال الملفات المكسورة مع أخطائها للنموذج لإصلاحها فقط.
async function repairDevPatches(request: string, brokenPatches: any[], report: Record<string, string[]>) {
  const source = brokenPatches
    .map((p) => {
      const errs = (report[String(p?.path || "")] || []).join("؛ ")
      return `\n===== FILE: ${p.path} (أخطاء يجب إصلاحها: ${errs}) =====\n${p.content}\n===== END FILE =====`
    })
    .join("\n")
  const system = `أنت مبرمج ويب محترف. الملفات التالية فشلت في فحص السلامة البنيوية (أقواس/وسوم غير متوازنة أو JSON غير صالح أو بقايا دمج). أصلح كل ملف بحيث يصبح صحيحاً بناء الجملة ومتوازن الأقواس والوسوم، مع الحفاظ التام على المنطق والوظيفة والتصميم المقصود من التعديل الأصلي. لا تغيّر السلوك المطلوب، فقط أصلح الخطأ البنيوي.
أعد JSON فقط: {"patches":[{"path":"...","content":"المحتوى الكامل الصحيح للملف","reason":"ما تم إصلاحه"}]}`
  const prompt = `طلب المسؤول الأصلي:\n${request}\n\nالملفات المكسورة مع أخطائها:\n${source}`
  const text = await runText(prompt, system, 0.05)
  const parsed = extractJson(text) || {}
  return Array.isArray(parsed?.patches) ? parsed.patches : []
}

async function buildDevPatches(request: string, plan: any, files: Array<{path:string,content:string}>) {
  const source = files.map(f => `\n===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`).join("\n")
  const system = `أنت مبرمج ومطوّر ويب محترف (Senior Software Engineer) خبير في HTML وCSS وJavaScript وTypeScript وNext.js وReact وواجهات API. أنت مسؤول عن تعديل مشروع ويب موجود بشكل مباشر. سيُطبّق ناتجك تلقائياً على مستودع GitHub بعد التحقق منه، لذا يجب أن يكون الكود كاملاً وصحيحاً وجاهزاً للتشغيل فوراً.

منهجية العمل الإلزامية قبل الكتابة:
1) اقرأ محتوى كل ملف مُعطى وافهم بنيته وأسلوبه ووظائفه الحالية قبل أي تعديل.
2) حدد بدقة أصغر جزء يجب تغييره لتحقيق الطلب، دون المساس ببقية الكود.
3) اكتب التعديل بنفس أسلوب وبنية المشروع (نفس التسمية، نفس المسافات البادئة، نفس نمط الدوال، اتجاه RTL العربي، ومتغيرات الأنماط الموجودة مثل var(--primary)).
4) بعد الكتابة راجع الكود ذهنياً وتأكد من خلوه من أخطاء بناء الجملة (syntax)، وأن الأقواس {} () [] والوسوم <tag></tag> والاقتباسات متوازنة ومغلقة، وأن أي دالة أو معرّف استُخدم معرّف فعلاً.

قواعد صارمة:
- لا تحذف ملفات ولا تعيد بناء المشروع من الصفر.
- عدّل أقل عدد ممكن من الملفات، وحافظ على كل الوظائف والتصميم الحالي وسلوك الصفحات القائمة.
- لا تضع أي سرّ أو API key أو Token في public أو في أي JavaScript يصل إل�� المتصفح؛ الأسرار تبقى على الخادم فقط.
- content يجب أن يكون المحتوى الكامل والنهائي للملف بعد التعديل، وليس diff، ودون اقتطاع أو حذف أجزاء لم تكن مقصودة بالتعديل.
- لا تُرجع ملفاً لم يتغير فعلاً.
- لا تُرجع أي مسار غير موجود في الملفات المعطاة إلا إذا كانت الخطة تقول create وكان إنشاء الملف ضرورياً.
- لا تنشئ أو تعدل ملفات الأسرار مثل .env.
- إذا كان الطلب غير آمن أو غير واضح أو يخالف القيود، أعد patches=[] واشرح السبب في summary.

أعد JSON فقط بالشكل التالي (بدون أي نص خارجه):
{"summary":"وصف عربي واضح لما تم تعديله فعلياً وكيف","patches":[{"path":"...","content":"المحتوى الكامل الجديد للملف","reason":"سبب التعديل وما تغيّر في هذا الملف بالتحديد"}],"tests":["ملاحظة تحقق أو خطوة اختبار يدوي مقترحة"]}`
  const prompt = `طلب المسؤول:\n${request}\n\nخطة التحليل السابقة:\n${JSON.stringify(plan)}\n\nمحتويات الملفات التي يمكن تعديلها:\n${source}`
  const text = await runText(prompt, system, 0.1)
  return extractJson(text) || {}
}

async function autoApplyDevRequest(request: string, plan: any) {
  // فحص مسبق شامل: متغيرات البيئة، الشبكة، وجود المستودع، صلاحية الكتابة، والفرع.
  const pf = await preflightAutoApply()
  if (!pf.ok) throw new Error(pf.reason || "فشل الفحص المسبق لإعدادات التطبيق التلقائي")
  const tree = await githubListTree()
  const repoFiles = new Set(tree.files)
  const selected = Array.isArray(plan?.files) ? plan.files.map((f:any) => String(f?.path || "")).filter((p:string) => safeProjectPath(p)) : []
  if (!selected.length) throw new Error("لم يحدد الذكاء الاصطناعي ملفات صالحة للتعديل")
  if (selected.length > 12) throw new Error("الطلب يحتاج تعديل عدد كبير من الملفات؛ الحد التلقائي 12 ملفاً")
  for (const path of selected) {
    const action = plan.files.find((f:any) => String(f?.path || "") === path)?.action
    if (action !== "create" && !repoFiles.has(path)) throw new Error(`الملف ${path} غير موجود في المستودع`)
  }
  const current = []
  for (const path of selected) {
    try { current.push(await githubGetFile(path)) } catch (e:any) {
      const action = plan.files.find((f:any) => f.path === path)?.action
      if (action === "create") current.push({ path, sha: undefined, content: "" })
      else throw e
    }
  }
  const patchResult = await buildDevPatches(request, plan, current)
  let patches = Array.isArray(patchResult?.patches) ? patchResult.patches : []
  if (!patches.length) throw new Error("لم ينتج الذكاء الاصطناعي ��عديلات قابلة للتطبيق")
  if (patches.length > 12) throw new Error("عدد التعديلات المقترحة يتجاوز ال��د الآمن")
  const currentMap = new Map(current.map(x => [x.path, x]))

  // ===== مرحلة الاختبار والإصلاح الذاتي قبل الحفظ =====
  // نفحص سلامة كل ملف بنيوياً، وإذا وُجدت أخطاء نطلب من النموذج إصلاح الملفات المكسورة فقط،
  // ونعيد الفحص حتى نجاحه أو استنفاد المحاولات. لا يُحفظ أي ملف مكسور في المستودع.
  const patchMap = new Map<string, any>(patches.map((p: any) => [String(p?.path || ""), p]))
  const repairLog: string[] = []
  let report = validatePatches(patches, currentMap)
  for (let attempt = 1; attempt <= 2 && Object.keys(report).length; attempt++) {
    const brokenPaths = Object.keys(report)
    repairLog.push(`المحاولة ${attempt}: أخطاء بنيوية في ${brokenPaths.join("، ")} — جارٍ الإصلاح الذاتي.`)
    const brokenPatches = brokenPaths.map((p) => patchMap.get(p)).filter(Boolean)
    let fixed: any[] = []
    try {
      fixed = await repairDevPatches(request, brokenPatches, report)
    } catch (e: any) {
      repairLog.push(`تعذّر الإصلاح الذاتي: ${String(e?.message || "").slice(0, 120)}`)
      break
    }
    for (const f of fixed) {
      const fp = String(f?.path || "")
      if (fp && typeof f?.content === "string" && patchMap.has(fp)) {
        patchMap.set(fp, { ...patchMap.get(fp), content: f.content, reason: f.reason || patchMap.get(fp).reason })
      }
    }
    patches = Array.from(patchMap.values())
    report = validatePatches(patches, currentMap)
  }
  if (Object.keys(report).length) {
    const summary = Object.entries(report)
      .map(([p, errs]) => `${p}: ${(errs as string[]).join("؛ ")}`)
      .join(" | ")
    throw new Error(`فشل اختبار سلامة الكود بعد محاولات الإصلاح الذاتي، ولم يُحفظ أي ملف حفاظاً على استقرار المشروع. التفاصيل: ${summary.slice(0, 400)}`)
  }

  const applied = []
  for (const patch of patches) {
    const path = String(patch?.path || "")
    const content = typeof patch?.content === "string" ? patch.content : null
    if (!safeProjectPath(path) || content === null || content.length > 500_000) continue
    const old = currentMap.get(path)
    // منع الحذف المقنّع: الملف الجديد لا يمكن أن يكون فارغاً إذا كان الملف القديم غير فارغاً.
    if (old && old.content && !content.trim()) continue
    const result = await githubPutFile(path, content, old?.sha, `chore: AI assistant - ${request.slice(0, 70)}`)
    applied.push({ path, reason: patch.reason || "", commitUrl: result?.commit?.html_url || null })
  }
  if (!applied.length) throw new Error("لم يتم تطبيق أي ملف بعد التحقق من التعديلات")
  let deployTriggered = false
  let deployError = ""
  if (VERCEL_DEPLOY_HOOK_URL) {
    try {
      const hookRes = await fetch(VERCEL_DEPLOY_HOOK_URL, { method: "POST", cache: "no-store" })
      deployTriggered = hookRes.ok
      if (!hookRes.ok) deployError = `Vercel Deploy Hook ${hookRes.status}`
    } catch (e: any) {
      deployError = e?.message ? String(e.message).slice(0, 200) : "تعذّر الاتصال بـ Vercel Deploy Hook"
    }
  }
  // حالة النشر بصيغة عربية واضحة تُعرض للمسؤول مباشرة في صفحة المساعد.
  const deploymentMode = VERCEL_DEPLOY_HOOK_URL ? "vercel-hook" : "github-auto-deploy"
  let deployStatus = ""
  if (deployTriggered) {
    deployStatus = "🚀 تم تشغيل النشر على Vercel تلقائياً عبر Deploy Hook."
  } else if (deployError) {
    deployStatus = `⚠️ حُفظت التعديلات على GitHub لكن تعذّر تشغيل Deploy Hook (${deployError}). سيبدأ النشر تلقائياً إذا كان المستودع مربوطاً بـ Vercel.`
  } else {
    deployStatus = "🚀 حُفظت التعديلات على GitHub؛ سيبدأ Vercel النشر تلقائياً إذا كان المستودع مربوطاً بالمشروع."
  }
  return {
    applied,
    summary: patchResult.summary || "تم تطبيق التعديلات المطلوبة",
    tests: Array.isArray(patchResult.tests) ? patchResult.tests : [],
    // سجل الاختبار الذاتي: يوضّح ما اكتُشف من أخطاء بنيوية وكيف أُصلح قبل الحفظ.
    selfCheck: repairLog.length ? repairLog : ["اجتاز الكود فحص السلامة البنيوية من المحاولة الأولى دون أخطاء."],
    deployTriggered,
    deployStatus,
    deploymentMode,
  }
}

export async function POST(req: Request) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: "طلب غير صالح", diagnostics: { executedOn: "server", keyConfigured } }, 400)
  }

  const diagnostics = { executedOn: "server", keyConfigured, providerStatus: 200 }

  try {
    // 1) وضع النص الحر (صندوق اختبار الذكاء الاصطناعي)
    if (typeof body.prompt === "string" && body.prompt.trim() && !body.mode) {
      const text = await runText(
        body.prompt.trim(),
        "أنت مساعد ذكاء اصطناعي خبير في القرآن الكريم وعلومه. أجب بالعربية الفصحى بدقة وإيجاز.",
        typeof body.temperature === "number" ? body.temperature : 0.4,
      )
      return json({ result: text, diagnostics })
    }

    const mode = body.mode as string
    const payload = body.payload || {}
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.15

    // 1.ب) المساعد الذكي للطالب/ولي الأمر (نص حر مع سياق بيانات الطالب)
    if (mode === "assistant") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) return json({ error: "لم يصل نص السؤال", diagnostics }, 400)
      const text = await runText(
        prompt.slice(0, 6000),
        "أنت مساعد ذكاء اصطناعي خبير في القرآن الكريم وعلومه ومساعد لمتابعة الطالب في التحفيظ. أجب بالعربية الفصحى بدقة وإيجاز وبأسلوب مشجّع. اعتمد على بيانات الطالب المرفقة عند وجودها، ولا تخترع نصوصاً قرآنية.",
        typeof body.temperature === "number" ? body.temperature : 0.4,
      )
      return json({ result: text, diagnostics })
    }

    // 2) توليد أسئلة الاختبار
    if (mode === "generate_exam") {
      const text = await runText(JSON.stringify(payload), SYS_EXAM, temperature)
      const parsed = extractJson(text)
      const questions = Array.isArray(parsed) ? parsed : parsed?.questions
      if (!Array.isArray(questions)) {
        return json({ error: "تعذر توليد أسئلة صالحة", diagnostics }, 502)
      }
      return json({ result: questions, diagnostics })
    }

    // 3) تصحيح نص (أكمل)
    if (mode === "grade_text") {
      const text = await runText(JSON.stringify(payload), SYS_GRADE_TEXT, temperature)
      const parsed = extractJson(text) || {}
      return json({
        result: {
          accepted: !!parsed.accepted,
          score: typeof parsed.score === "number" ? parsed.score : parsed.accepted ? 1 : 0,
          matchedPercent: typeof parsed.matchedPercent === "number" ? parsed.matchedPercent : 0,
          reason: parsed.reason || "",
          missingAyahs: Array.isArray(parsed.missingAyahs) ? parsed.missingAyahs : [],
        },
        diagnostics,
      })
    }

    // 4) تصحيح تلاوة من تفريغ نصي
    if (mode === "grade_recitation") {
      const text = await runText(JSON.stringify(payload), SYS_GRADE_RECITATION, temperature)
      const parsed = extractJson(text) || {}
      return json({
        result: {
          accepted: !!parsed.accepted,
          score: typeof parsed.score === "number" ? parsed.score : parsed.accepted ? 1 : 0,
          matchedPercent: typeof parsed.matchedPercent === "number" ? parsed.matchedPercent : 0,
          reason: parsed.reason || "",
          missingAyahs: Array.isArray(parsed.missingAyahs) ? parsed.missingAyahs : [],
        },
        diagnostics,
      })
    }

    // 5) تفريغ صوت حقيقي + تصحيح (تحليل الصوت على الخادم)
    if (mode === "transcribe_and_grade") {
      const { audioBase64, mimeType, surah, from, to, expectedText } = payload
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) throw new Error("GROQ_API_KEY غير مُهيّأ على الخادم")
      if (!audioBase64) {
        return json({ error: "لم يصل ملف صوتي للتحليل", diagnostics }, 400)
      }
      // Groq يقبل الصوت بصيغة wav أو mp3 (تفريغ Whisper).
      // المتصفح يحوّل التسجيل إلى wav قبل الإرسال؛ نستنتج الصيغة من mimeType.
      let audioFormat = "wav"
      const mt = (typeof mimeType === "string" ? mimeType : "").toLowerCase()
      if (mt.includes("mpeg") || mt.includes("mp3")) audioFormat = "mp3"
      else if (mt.includes("wav")) audioFormat = "wav"

      // المرحلة الأولى: تفريغ صوتي متخصص (مزوّد خارجي عند ضبطه، وإلا Groq).
      const transcript = await transcribeAudio(audioBase64, audioFormat)

      // المرحلة الثانية: مقارنة التفريغ بالنص القرآني المطلوب وحساب الدرجة.
      const gradeText = await runText(
        JSON.stringify({ surah, from, to, expectedText, studentTranscript: transcript }),
        SYS_TRANSCRIBE,
        0.05,
      )
      const parsed = extractJson(gradeText) || {}
      const totalAyahs = Math.max(1, Number(to || from || 1) - Number(from || 1) + 1)
      const missingCount = Array.isArray(parsed.missingAyahs) ? Math.min(totalAyahs, parsed.missingAyahs.length) : 0
      const calculatedScore = Math.max(0, Math.min(1, (totalAyahs - missingCount) / totalAyahs))
      const modelScore = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : calculatedScore
      const score = missingCount > 0 ? Math.min(modelScore, calculatedScore) : modelScore
      return json({
        result: {
          transcript,
          accepted: parsed.isRecitation !== false && score >= 0.5,
          score,
          matchedPercent: typeof parsed.matchedPercent === "number" ? Math.max(0, Math.min(100, parsed.matchedPercent)) : Math.round(score * 100),
          isRecitation: parsed.isRecitation !== false,
          reason: parsed.reason || "",
          missingAyahs: Array.isArray(parsed.missingAyahs) ? parsed.missingAyahs : [],
          scoring: { totalAyahs, missingAyahs: missingCount, method: "(total-missing)/total" },
        },
        diagnostics,
      })
    }

    // 6.أ) فحص جاهزية مساعد التطوير (للمسؤول) — يتحقق من المتغيرات والشبكة والمستودع والصلاحيات دون كشف أي سرّ.
    if (mode === "dev_preflight") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const pf = await preflightAutoApply()
      return json({
        result: {
          ready: pf.ok,
          reason: pf.reason || "",
          checks: {
            groq: !!process.env.GROQ_API_KEY,
            githubToken: !!GITHUB_TOKEN,
            githubOwner: !!GITHUB_OWNER,
            githubRepo: !!GITHUB_REPO,
            autoApplyEnabled: AUTO_DEV_ENABLED,
          },
          // أسماء عامة (ليست أسراراً) لتأكيد المسؤول أن القيم مضبوطة بشكل صحيح.
          resolved: {
            owner: GITHUB_OWNER || null,
            repo: GITHUB_REPO || null,
            branch: GITHUB_BRANCH_ENV || null,
          },
          ...(pf.details || {}),
        },
        diagnostics: { ...diagnostics, githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED },
      })
    }

    // 6) مساعد تطوير الموقع — تحليل فقط أو تطبيق تلقائي عند طلب المسؤول
    if (mode === "dev_assistant") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const request = typeof payload.request === "string" ? payload.request.trim() : ""
      if (!request) return json({ error: "يرجى كتابة طلب التطوير", diagnostics }, 400)
      if (request.length > 4000) return json({ error: "طلب التطوير طويل جداً (الحد الأقصى 4000 حرف)", diagnostics }, 400)
      const tree = githubConfigured ? await githubListTree() : { files: [
        "public/index.html", "app/api/ai/route.ts", "app/page.tsx", "app/layout.tsx",
        "app/globals.css", "next.config.mjs", "package.json", "components/ui/button.tsx",
        "lib/utils.ts", ".env.example", "DEPLOY.md",
      ] }
      const userPrompt = `بنية المشروع الحالية:\n${PROJECT_MANIFEST}\n\nقائمة الملفات الفعلية في المستودع:\n${tree.files.join("\n")}\n\nطلب المسؤول:\n${request}\n\nحلّل الطلب وأعد خطة التعديل بصيغة JSON فقط كما هو محدد. اختر الملفات الفعلية من قائمة المستودع كلما أمكن.`
      const text = await runText(userPrompt, SYS_DEV_ASSISTANT, 0.2)
      const parsed = extractJson(text) || {}
      const knownPaths = new Set(tree.files)
      const files = Array.isArray(parsed.files) ? parsed.files.map((f: any) => ({
        path: typeof f?.path === "string" ? f.path.trim() : "",
        action: f?.action === "create" ? "create" : "modify",
        reason: typeof f?.reason === "string" ? f.reason : "",
        changes: Array.isArray(f?.changes) ? f.changes.filter((x: any) => typeof x === "string").slice(0, 8) : [],
      })).filter((f: any) => f.path && (knownPaths.has(f.path) || f.action === "create")) : []
      const plan = {
        understanding: typeof parsed.understanding === "string" ? parsed.understanding : "",
        feasible: parsed.feasible !== false,
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        files,
        steps: Array.isArray(parsed.steps) ? parsed.steps.filter((x: any) => typeof x === "string").slice(0, 12) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.filter((x: any) => typeof x === "string").slice(0, 12) : [],
        clarifications: Array.isArray(parsed.clarifications) ? parsed.clarifications.filter((x: any) => typeof x === "string").slice(0, 8) : [],
        applied: false,
      }
      if (payload.autoApply === true && plan.feasible !== false) {
        try {
          const applied = await autoApplyDevRequest(request, plan)
          return json({ result: { ...plan, ...applied, applied: true, autoApplied: true, note: "تم تطبيق التعديلات تلقائياً على المشروع من الخادم. إذا كان Vercel مربوطاً بالمستودع فسيبدأ النشر تلقائياً، أو يمكن استخدام VERCEL_DEPLOY_HOOK_URL." }, diagnostics: { ...diagnostics, githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED } })
        } catch (e:any) {
          return json({ error: e?.message || "تعذر التطبيق التلقائي", result: { ...plan, applied: false, autoApplied: false }, diagnostics: { ...diagnostics, githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED } }, 500)
        }
      }
      return json({ result: { ...plan, note: "الخطة فقط — لم يتم تطبيق أي تعديل.", autoApplied: false }, diagnostics: { ...diagnostics, githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED } })
    }

    // 7) حالة مزامنة GitHub — للمسؤول فقط. يتحقق من الاتصال بمستودع المسؤول ويعرض آخر commit وسجل التعديلات.
    if (mode === "github_status") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const status = await getGithubSyncStatus()
      return json({ result: status, diagnostics: { ...diagnostics, githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED } })
    }

    // 8) حذف ملف من المستودع — للمسؤول فقط، بتأكيد صريح، مع حماية الملفات الأساسية. ينشئ commit ويحافظ على التاريخ.
    if (mode === "github_delete") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      if (payload?.confirm !== true) return json({ error: "الحذف يتطلب تأكيداً صريحاً من المسؤول", diagnostics }, 400)
      const path = typeof payload.path === "string" ? payload.path.trim() : ""
      if (!path) return json({ error: "يرجى تحديد مسار الملف المراد حذفه", diagnostics }, 400)
      // الحذف عملية يدوية صريحة بتأكيد المسؤول، لا تتطلب تفعيل الدفع التلقائي — يكفي اتصال المستودع وصلاحية الكتابة.
      const st = await getGithubSyncStatus()
      if (!st.connected) return json({ error: st.reason || "المزامنة مع GitHub غير متصلة", diagnostics }, 400)
      if (!st.canWrite) return json({ error: `الرمز GITHUB_TOKEN لا يملك صلاحية الكتابة على ${st.repo}`, diagnostics }, 400)
      try {
        const message = `chore: delete ${path} (admin request via sync panel)`
        const result = await githubDeleteFile(path, message)
        return json({
          result: {
            deleted: true,
            path,
            commitUrl: result?.commit?.html_url || null,
            note: "تم حذف الملف وإنشاء commit في مستودعك. الإصدارات السابقة محفوظة في سجل GitHub.",
          },
          diagnostics: { ...diagnostics, githubConfigured },
        })
      } catch (e: any) {
        return json({ error: e?.message || "تعذر حذف الملف", diagnostics: { ...diagnostics, githubConfigured } }, 500)
      }
    }

    return json({ error: "وضع غير معروف", diagnostics }, 400)
  } catch (err: any) {
    const raw = err?.message ? String(err.message) : "خطأ غير معروف"
    // رسائل عربية أوضح لحالات Groq الشائعة
    let friendly = "تعذر تنفيذ طلب الذكاء الاصطناعي على الخادم"
    if (raw.includes("GROQ_API_KEY")) {
      friendly = "مفتاح Groq غير مُهيّأ على الخادم"
    } else if (raw.includes("402") || raw.toLowerCase().includes("balance") || raw.toLowerCase().includes("credit")) {
      friendly = "رصيد حساب Groq غير كافٍ لتحليل الصوت — يرجى التحقق من الحساب"
    } else if (raw.includes("401")) {
      friendly = "مفتاح Groq غير صالح"
    } else if (raw.includes("429")) {
      friendly = "تم ��جاوز حد الطلبات على Groq، حاول لاحقاً"
    }
    return json(
      {
        error: friendly,
        diagnostics: {
          executedOn: "server",
          keyConfigured,
          reason: raw.slice(0, 300),
        },
      },
      500,
    )
  }
}
