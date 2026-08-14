import { generateText } from "ai"

export const maxDuration = 300

// ===== Gemini عبر مفتاح Google عند صلاحيته، وإلا عبر Vercel AI Gateway المتصل بالمشروع =====
const GEMINI = {
  label: "Gemini",
  get key() {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ""
    ).trim()
  },
  get model() {
    return (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim()
  },
}
const speakerVerificationConfigured = !!(process.env.SPEAKER_VERIFICATION_API_KEY || "").trim()
const isGeminiConfigured = () => Boolean(GEMINI.key)
let resolvedGeminiModel: string | null = null
const unavailableGeminiModels = new Set<string>()

async function resolveGeminiModel(forceRefresh = false): Promise<string> {
  if (resolvedGeminiModel && !forceRefresh && !unavailableGeminiModels.has(resolvedGeminiModel)) return resolvedGeminiModel

  const configured = GEMINI.model.replace(/^models\//, "")
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": GEMINI.key },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Gemini models HTTP ${response.status}: ${String(data?.error?.message || response.statusText).slice(0, 300)}`)
  }

  const available = (Array.isArray(data?.models) ? data.models : [])
    .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
    .map((model: any) => String(model?.name || "").replace(/^models\//, ""))
    .filter(Boolean)

  const preferred = [
    configured,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    ...available.filter((name: string) => name.includes("flash") && !name.includes("image") && !name.includes("tts")),
    ...available,
  ]
  resolvedGeminiModel = preferred.find(
    (name, index) => preferred.indexOf(name) === index && available.includes(name) && !unavailableGeminiModels.has(name),
  ) || null
  if (!resolvedGeminiModel) throw new Error("Gemini: لا يوجد نموذج يدعم generateContent لهذا المفتاح")
  return resolvedGeminiModel
}

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
const GITHUB_OWNER = "jj1333961-code"
const GITHUB_REPO = "teacher"
// إن لم يُضبط GITHUB_BRANCH نستخدم الفرع الافتراضي الفعلي للمستودع (يُحلّ وقت التشغيل)، لا نفترض "main".
const GITHUB_BRANCH_ENV = pickEnv("GITHUB_BRANCH_3", "GITHUB_BRANCH_2", "GITHUB_BRANCH")
const AUTO_DEV_ENABLED = true
const githubConfigured = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO)
const GITHUB_API = "https://api.github.com"
const VERCEL_DEPLOY_HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL

// الفرع المُحلّ يُخزّن مؤقتاً بعد أول استعلام لتفادي استعلامات متكررة.
let resolvedBranch: string | null = null

const GATEWAY_GEMINI_MODEL = "google/gemini-3.7-flash"

async function gatewayGeminiText(prompt: string, system: string, temperature: number, inlineData?: { mimeType: string; data: string }): Promise<string> {
  const content: any[] = [{ type: "text", text: prompt }]
  if (inlineData) content.push({ type: "file", mediaType: inlineData.mimeType, data: inlineData.data })
  const result = await generateText({
    model: GATEWAY_GEMINI_MODEL,
    system,
    messages: [{ role: "user", content }],
    temperature,
    abortSignal: AbortSignal.timeout(70_000),
  })
  if (!result.text?.trim()) throw new Error("Gemini عبر AI Gateway: وصل رد فارغ")
  return result.text.trim()
}

async function geminiText(prompt: string, system: string, temperature: number, inlineData?: { mimeType: string; data: string }): Promise<string> {
  if (!GEMINI.key) return gatewayGeminiText(prompt, system, temperature, inlineData)
  const parts: any[] = [{ text: prompt }]
  if (inlineData) parts.unshift({ inlineData })
  const requestBody = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: { temperature } })
  let data: any = null

  for (let attempt = 0; attempt < 3; attempt++) {
    let model: string
    try {
      model = await resolveGeminiModel(attempt > 0 && resolvedGeminiModel === null)
    } catch (error: any) {
      const message = String(error?.message || "")
      if (/HTTP (401|403)|API key|PERMISSION_DENIED|unregistered callers/i.test(message)) {
        return gatewayGeminiText(prompt, system, temperature, inlineData)
      }
      throw error
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI.key,
        },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(70_000),
      })
      data = await response.json().catch(() => null)
      if (response.ok) break

      if (response.status === 401 || response.status === 403) {
        return gatewayGeminiText(prompt, system, temperature, inlineData)
      }
      if (response.status === 404 && attempt < 2) {
        unavailableGeminiModels.add(model)
        resolvedGeminiModel = null
        await resolveGeminiModel(true)
        continue
      }
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === 2) {
        throw new Error(`Gemini HTTP ${response.status}: ${String(data?.error?.message || data?.message || response.statusText).slice(0, 300)}`)
      }
    } catch (error: any) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("aborted")
      if (!timedOut || attempt === 2) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("")
  if (typeof text !== "string" || !text.trim()) throw new Error("Gemini: وصل رد فارغ")
  return text.trim()
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
  return geminiText(prompt, system, temperature)
}

async function transcribeAudio(audioBase64: string, audioFormat: string): Promise<string> {
  const mimeType = audioFormat === "mp3" ? "audio/mpeg" : "audio/wav"
  return geminiText("فرّغ هذا التسجيل الصوتي العربي حرفياً فقط. أعد النص دون شرح.", "أنت محرك تفريغ صوتي عربي دقيق، ومتخصص في تلاوة القرآن.", 0.05, { mimeType, data: audioBase64 })
}

// ===== أنظمة التعليمات لكل وضع =====

const SYS_EXAM = `أنت خبير متخصص في القرآن الكريم واختبارات الحفظ لطلاب التحفيظ.
مهمتك توليد أسئلة اختبار قرآنية فقط، دقيقة ومبنية حصراً على نصوص الآيات المرسلة في sourceVerses.

قواعد صارمة:
- ممنوع اختراع آية أو عبارة قرآنية غير موجودة في sourceVerses.
- كل سؤال يجب أن يكون متعلقاً مباشرة بحفظ القرآن أو نص الآية أو السورة.
- لا تنشئ أسئلة ثقافة عامة أو دين عام أو معلومات خارج نصوص القرآن.
- التزم تماماً بعدد الأسئلة count المطلوب لكل plan، وبالنوع والمستوى وموضع السؤال position المحددين في كل plan.
  - position=start: اختر من الثلث الأول للسورة، position=middle: الثلث الأوسط، position=end: الثلث الأخير، position=random: نوّع بين جميع المواضع.
- إذا كان type=mcq فعدد الخيارات يجب أن يساوي optionsCount لذلك plan، مع إجابة صحيحة واحدة فقط.
- إذا كان type=truefalse فاجعل options=["صح","خطأ"] فقط، وبدّل بين العبارات الصحيحة والخاطئة بذكاء. مثال: "الآية ... من سورة الناس، صح أم خطأ؟"
- إذا كان type=complete فاختر بداية آية حقيقية، ثم اجعل الطالب يكمل عدداً يساوي completeAyahs بالضبط. يجب أن يكون from/to صحيحين وفي السورة نفسها.
- إذا كان type=audio فحدد مقطعاً حقيقياً من السورة، ويجب أن يساوي عدد الآيات من from إلى to قيمة reciteAyahs بالضبط.
- level=easy: سؤال مباشر من النص.
- level=medium: تمييز وربط أدق بين الآية والسورة أو موضعها.
- level=hard: مواضع متشا��هة وتمييز دقيق دون غموض أو معلومات من خارج النص.
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
الهدف من هذا الوضع: مساعد تطوير فعلي للمسؤول. يحلل المشروع، يحدد الملفات المطلوبة، ثم يمكنه إنشاء كود كامل وتطبيق�� تلقائياً على مستودع المشروع من الخادم فقط. لا تنتظر موافقة بشرية بعد إرسال الطلب إذا كان التطبيق التلقائي مفعلاً.
البنية والملفات الرئيسية:
- "public/index.html": التطبيق كامل (واجهة عربية RTL + كل منطق JavaScript). يحتوي على:
  • صفحات معرّفة كـ <div class="page hidden" id="..."> وتُعرض عبر showPage('id') وا��رجوع عبر goBack().
  • لوحة المسؤول (adminDashboard) وبها menu-grid فيها أزرار menu-btn.
  • صفحات الطالب وولي الأمر، الرسائل، الملفات، إدارة المسؤولي��، إعدادات المسؤول (adminSettings).
  • تخزين البيانات محلياً عبر getData(key)/setData(key,value) على localStorage (مفاتيح مثل students, admins, messages, files).
  • حالة الجلسة: currentUser, currentType ('admin'|'student'|'parent'), currentAdminId.
  • الذكاء الاصطناعي عبر callStudentAI(mode,payload,temperature) الذي يناد�� /api/ai.
  • بناء الاختبارات: examPlanRows, renderExamPlanRows(), أنواع الأسئلة mcq/truefalse/complete/audio.
  • التسجيل الصوتي والبصمة الصوتية: computeVoicePrint(), voiceMatchPercent(), blobToWav().
- "app/api/ai/route.ts": نقطة النهاية الآمنة على الخادم. تستخدم OpenRouter (OPENROUTER_API_KEY) وتدعم الأوضاع: generate_exam, grade_text, grade_recitation, transcribe_and_grade, dev_assistant, بالإضافة إلى وضع النص الحر (prompt).
- "app/layout.tsx": تخطيط الجذر.
- "app/page.tsx": صفحة Next.js احتياطية؛ الجذر يعاد توجيهه إلى public/index.html عبر next.config.mjs.
- "app/globals.css": الأنماط العامة لـNext.js.
- "next.config.mjs": rewrite للجذر إلى public/index.html.
- "package.json": تبعيات وسكربتات المشروع.
- "components/ui/button.tsx" ��"lib/utils.ts": مكونات/أدوات مساعدة موجودة في المشروع.

المسارات الموجودة في النسخة الحالية: public/index.html, app/api/ai/route.ts, app/page.tsx, app/layout.tsx, app/globals.css, next.config.mjs, package.json, components/ui/button.tsx, lib/utils.ts, .env.example, DEPLOY.md.
قيود مهمة يجب احترامها في أي خطة: لا حذف الملفات، لا إعادة بناء المشروع، لا وضع مفتاح API في المتصفح، الحف��ظ على التصميم العربي RTL الحا��ي، وتعديل الموجود فقط أو إضافة م�� يلزم.`

const SYS_DEV_ASSISTANT = `أنت مهندس برمجيات Senior ومساعد تطوير تلقائي لمشروع Student System AI. يفهم TypeScript وJavaScript وHTML وCSS وNext.js وواجهات API وGitHub وVercel. المستخدم هنا هو المسؤول ويعطيك طلباً بالعربية لتعديل الموقع.
مهمتك: فهم ال��لب، فحص قائمة ملفات المشروع الحالية، تحديد الملفات التي يجب تعديلها أو إنشاؤها، ووضع خطة تنفيذ دقيقة. لا تكتب المحتوى الكامل للملفات في مرحلة الخطة؛ مرحلة التطبيق المنفصلة ستقرأ الملفات الحقيقية وتولّد الكود الكامل. يجب أن تكون قادراً على اقتراح تغييرات برمجية حقيقية، وليس مجرد وصف عام.
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
  if (!GITHUB_OWNER || !GITHUB_REPO) throw new Error("إعدادات مستودع GitHub غير مكتملة")
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

// حذف ملف وا��د من المستودع عبر Contents API (ينشئ commit ويحافظ على كامل تاريخ الإصدارات — لا force push).
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
    // روابط عامة (ليست أسراراً) لعرض سجل ال��عديلات على GitHub الخاص بالمسؤول.
    historyUrl: `https://github.com/${fullName}/commits/${branch}`,
    repoUrl: `https://github.com/${fullName}`,
  }
}

// فحص مسبق تفصيلي قبل أي تطبيق تلقائي. يعيد ok=false مع سبب محدد جداً (أي متغير ناقص/أي صلاحية).
// لا ي��شف أبداً قيمة أي رمز مميز، فقط اسم ��لمتغير الناقص أو نوع المشكلة.
async function preflightAutoApply(): Promise<{ ok: boolean; reason?: string; details?: any }> {
  const missing: string[] = []
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
  // التحقق من الشبكة + وجود المستودع فعلياً + صلاحية الرمز.
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
  // التحقق من أن الفرع المُحدد/الافتراضي قا��ل ��لحل.
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

async function buildDevPatches(request: string, plan: any, files: Array<{path:string,content:string}>) {
  const source = files.map(f => `\n===== FILE: ${f.path} =====\n${f.content}\n===== END FILE =====`).join("\n")
  const system = `أنت مبرمج ومطوّر ويب محترف (Senior Software Engineer) خبير في HTML وCSS وJavaScript وTypeScript وNext.js وReact وواجهات API. أنت مسؤول عن تعديل مشروع ويب موجود بشكل مباشر. سيُطبّق ناتجك تلقائياً على مستودع GitHub بعد التحقق منه، لذا يجب أن يكون الكود كاملاً وصحيحاً وجاهزاً للتشغيل فوراً.

منهجية العمل الإلزامية قبل الكتابة:
1) اقرأ محتوى كل ملف مُعطى وافهم بنيته وأسلوبه ووظائفه الحالية قبل أي تعديل.
2) حدد بدقة أصغر جز�� يجب تغييره لتحقيق الطلب، دون المساس ببقية الكود.
3) اكتب التعديل بنفس أسلوب وبنية المشروع (نفس التسمية، ن��س المسافات البادئة، نفس نمط الدوال، اتجاه RTL العربي، ومتغيرات الأنماط الموجودة مثل var(--primary)).
4) بعد الكتابة راجع الكود ذهنياً وتأكد من خلوه من أخطاء بناء الجملة (syntax)، وأن الأقواس {} () [] والوسوم <tag></tag> والاقتباسات متوازنة ومغلقة، وأن أي دالة أ�� معرّف استُخدم معرّف فعلاً.

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
  const patches = Array.isArray(patchResult?.patches) ? patchResult.patches : []
  if (!patches.length) throw new Error("لم ينتج الذكاء الاصطناعي ��عديلات قابلة للتطبيق")
  if (patches.length > 12) throw new Error("عدد التعديلات المقترحة يتجاوز ال��د الآمن")
  const currentMap = new Map(current.map(x => [x.path, x]))
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
    return json({ error: "طلب غير صالح", diagnostics: { executedOn: "server", keyConfigured: isGeminiConfigured() } }, 400)
  }

  const diagnostics = { executedOn: "server", keyConfigured: isGeminiConfigured(), providerStatus: 200, provider: "gemini", providerLabel: GEMINI.label }

  try {
    // 1) وضع ��لنص الحر (صندوق اختبار الذكاء الاصطناعي)
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

    // 1.ب) المساعد الذكي لل��الب/ولي الأمر (نص حر مع سياق بيانات الطالب)
    if (mode === "assistant") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) return json({ error: "لم يصل نص السؤال", diagnostics }, 400)
      const text = await runText(
        prompt.slice(0, 6000),
        "أنت مساعد عربي مفيد. أعطِ الأولوية لبيانات منصة التحفيظ والقرآن ومتابعة الطالب عندما تكون مرتبطة بالسؤال، ويمكنك أيضاً الإجابة عن الموضوعات العامة باختصار ودقة واقتراح أفكار وخطوات متابعة جديدة. لا تخترع بيانات طالب أو نصوصاً قرآنية، ولا تدّعِ الاطلاع على معلومات غير مرفقة.",
        typeof body.temperature === "number" ? body.temperature : 0.4,
      )
      return json({ result: text, diagnostics })
    }

    // 2) جلب نطاق السور المحدد كاملاً ثم توليد الأسئلة عبر Gemini.
    if (mode === "generate_exam") {
      const startSurahNumber = Number(payload.surahNumber)
      const endSurahNumber = payload.endSurahNumber == null ? 114 : Number(payload.endSurahNumber)
      if (!Number.isInteger(startSurahNumber) || startSurahNumber < 1 || startSurahNumber > 114) return json({ error: "رقم أول سورة غير صالح", diagnostics }, 400)
      if (!Number.isInteger(endSurahNumber) || endSurahNumber < startSurahNumber || endSurahNumber > 114) return json({ error: "آخر سورة يجب أن تكون بعد أول سورة داخل النطاق", diagnostics }, 400)

      const plan = (Array.isArray(payload.plan) ? payload.plan : []).map((item: any) => ({
        ...item,
        position: ["start", "middle", "end", "random"].includes(item?.position) ? item.position : "random",
      }))
      const requestedCount = Math.max(1, plan.reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.count) || 0), 0))
      const allNumbers = Array.from({ length: endSurahNumber - startSurahNumber + 1 }, (_, index) => startSurahNumber + index)
      const selectedNumbers = allNumbers.length <= 12
        ? allNumbers
        : Array.from(new Set(Array.from({ length: Math.min(12, requestedCount) }, (_, index) => allNumbers[Math.round(index * (allNumbers.length - 1) / Math.max(1, Math.min(12, requestedCount) - 1))])))
      const sourceSurahs = await Promise.all(selectedNumbers.map(async (number) => {
        const quranResponse = await fetch(`https://api.alquran.cloud/v1/surah/${number}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) })
        const quran = await quranResponse.json().catch(() => null)
        if (!quranResponse.ok || quran?.code !== 200 || !Array.isArray(quran?.data?.ayahs)) throw new Error(`تعذر جلب السورة رقم ${number} من المصدر القرآني`)
        return {
          surah: String(quran.data.name || ""),
          surahNumber: number,
          verses: quran.data.ayahs.map((ayah: any) => ({ number: Number(ayah.numberInSurah), text: String(ayah.text || "") })),
        }
      }))
      const safePayload = { plan, startSurahNumber, endSurahNumber, sourceSurahs }
      const text = await runText(JSON.stringify(safePayload), SYS_EXAM + "\nالتزم بالسور الموجودة في sourceSurahs فقط. position=start يعني الثلث الأول، وmiddle الثلث الأوسط، وend الثلث الأخير، وrandom يوزع المواضع. ممنوع إعادة كتابة أو تعديل نص أي آية.", temperature)
      const parsed = extractJson(text)
      const questions = Array.isArray(parsed) ? parsed : parsed?.questions
      if (!Array.isArray(questions)) return json({ error: "تعذر توليد أسئلة صالحة", diagnostics }, 502)
      const sourcesByName = new Map(sourceSurahs.map((source) => [source.surah, source]))
      const safeQuestions = questions.map((question: any) => {
        const source = sourcesByName.get(String(question?.surah || "")) || sourceSurahs[0]
        const from = Math.max(1, Math.min(source.verses.length, Number(question?.from) || 1))
        const to = Math.max(from, Math.min(source.verses.length, Number(question?.to) || from))
        return { ...question, surah: source.surah, from, to, stem: source.verses[from - 1]?.text || "" }
      })
      return json({ result: safeQuestions, diagnostics, source: "Al Quran Cloud", range: { startSurahNumber, endSurahNumber } })
    }

    if (mode === "admin_assistant") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 3000) : ""
      if (!message) return json({ error: "اكتب رسالتك أولاً", diagnostics }, 400)
      const context = JSON.stringify(payload.context || {}).slice(0, 18_000)
      const result = await runText(`بيانات الموقع المنقحة:\n${context}\n\nسؤال المسؤول:\n${message}`, "أنت مساعد إداري عربي داخل منصة تحفيظ قرآن. أعطِ الأولوية القصوى لبيانات الموقع المرفقة عن الطلاب وأولياء الأمور والاختبارات والنتائج والملفات، ثم أجب أيضاً عن الأسئلة ��لعامة وقدم اقتراحات وأفكاراً عملية جديدة عند فائدتها. ميّز بوضوح بين بيانات الموقع والمعلومات العامة، ولا تكشف أسراراً ولا تخترع بيانات.", 0.25)
      return json({ result, diagnostics })
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
      if (!audioBase64) {
        return json({ error: "لم يصل ملف صوتي للتحليل", diagnostics }, 400)
      }
      // OpenRouter يقبل الصوت بصيغة wav أو mp3 فقط (input_audio).
      // المتصفح يحوّل التسجيل إلى wav قبل الإرسال؛ نستنتج الصيغة من mimeType.
      let audioFormat = "wav"
      const mt = (typeof mimeType === "string" ? mimeType : "").toLowerCase()
      if (mt.includes("mpeg") || mt.includes("mp3")) audioFormat = "mp3"
      else if (mt.includes("wav")) audioFormat = "wav"

      // المرحلة الأولى: تفريغ صوتي متخصص (مزوّد خارجي عند ضبطه، وإلا OpenRouter).
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

    // 6.أ) فحص جاهزية مساعد التطوير (للمس��ول) — يتحقق من المتغيرات والشبكة والمستودع والصلاحيات دون كشف أي سرّ.
    if (mode === "dev_preflight") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const pf = await preflightAutoApply()
      return json({
        result: {
          ready: pf.ok,
          reason: pf.reason || "",
          checks: {
            aiProviders: { gemini: !!GEMINI.key },
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

    // 6) م��اعد تطوير الموقع — تحليل فقط أو تطبيق تلقائي عند طلب المسؤول
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
    let friendly = `فشل الاتصال بنموذج ${GEMINI.label}`
    let status = 502
    if (raw.includes("مفتاح API غير مهيأ")) {
      friendly = "مفتاح Gemini غير متاح في بيئة الخادم"
      status = 503
    } else if (raw.includes("429")) {
      friendly = `تم تجاوز حد طلبات نموذج ${GEMINI.label}، حاول لاحقاً`
      status = 429
    } else if (raw.includes("401") || raw.includes("403") || raw.toLowerCase().includes("api key")) {
      friendly = `تعذر توثيق نموذج ${GEMINI.label}؛ تحقق من صلاحية المفتاح وواجهة Generative Language API`
      status = 502
    } else if (raw.includes("لا يوجد نموذج يدعم")) {
      friendly = "لا يتوفر نموذج Gemini نصي متوافق مع هذا المفتاح"
      status = 503
    } else if (raw.includes("404")) {
      friendly = "تعذر الوصول إلى نموذج Gemini المتاح؛ أعد المحاولة"
    } else if (
      err?.name === "TimeoutError" ||
      err?.name === "AbortError" ||
      raw.includes("TimeoutError") ||
      raw.toLowerCase().includes("timed out") ||
      raw.toLowerCase().includes("aborted")
    ) {
      friendly = `استغرق نموذج ${GEMINI.label} وقتاً أطول من المتوقع بعد إعادة المحاولة`
      status = 504
    } else if (raw.toLowerCase().includes("empty") || raw.includes("رد فارغ")) {
      friendly = `أعاد نموذج ${GEMINI.label} رداً فارغاً`
    }
    return json(
      {
        error: friendly,
        diagnostics: {
          executedOn: "server",
          keyConfigured: isGeminiConfigured(),
          reason: raw.slice(0, 300),
        },
      },
      status,
    )
  }
}
