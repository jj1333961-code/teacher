import { getReferenceContext, normalizeQuranText } from "@/lib/quran-reference"

export const maxDuration = 300

// ===== اتصال Gemini المباشر من الخادم فقط =====
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
    return (process.env.GEMINI_MODEL || "gemini-3-flash-preview").trim()
  },
}
const speakerVerificationConfigured = !!(process.env.SPEAKER_VERIFICATION_API_KEY || "").trim()
const isGeminiConfigured = () => Boolean(GEMINI.key)
let resolvedGeminiModel: string | null = null
const geminiModelCooldowns = new Map<string, number>()

function isGeminiModelCoolingDown(model: string) {
  const until = geminiModelCooldowns.get(model) || 0
  if (until <= Date.now()) {
    geminiModelCooldowns.delete(model)
    return false
  }
  return true
}

function coolDownGeminiModel(model: string, durationMs: number) {
  geminiModelCooldowns.set(model, Date.now() + durationMs)
  if (resolvedGeminiModel === model) resolvedGeminiModel = null
}

async function resolveGeminiModel(forceRefresh = false): Promise<string> {
  if (resolvedGeminiModel && !forceRefresh && !isGeminiModelCoolingDown(resolvedGeminiModel)) return resolvedGeminiModel

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
    "gemini-3-flash-preview",
    "gemini-3-flash",
    ...available.filter((name: string) => name.includes("flash") && !name.includes("image") && !name.includes("tts")),
    ...available,
  ]
  resolvedGeminiModel = preferred.find(
    (name, index) => preferred.indexOf(name) === index && available.includes(name) && !isGeminiModelCoolingDown(name),
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

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /404|408|409|429|5\d\d|RESOURCE_EXHAUSTED|UNAVAILABLE|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network|TimeoutError|AbortError|aborted|رد فارغ|empty/i.test(message)
}

function classifyAiFailure(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "خطأ غير معروف")
  if (/GEMINI_API_KEY.*(?:غير موجود|missing|not set)/i.test(raw)) {
    return { status: 503, code: "GEMINI_KEY_MISSING", retryable: false, message: "مفتاح Gemini المباشر غير متاح على الخادم. لا يستخدم هذا المسار AI Gateway.", raw }
  }
  if (/401|403|API key|API_KEY_INVALID|PERMISSION_DENIED/i.test(raw)) {
    return { status: 401, code: "GEMINI_KEY_INVALID", retryable: false, message: "مفتاح Gemini غير صالح أو لا يملك صلاحية الاستخدام. تحقق من GEMINI_API_KEY.", raw }
  }
  if (/429|RESOURCE_EXHAUSTED|exceeded your current quota|rate.?limit/i.test(raw)) {
    return { status: 429, code: "GEMINI_QUOTA_EXCEEDED", retryable: true, message: "حصة Gemini المباشرة مستنفدة مؤقتاً. انتظر تجدد الحصة أو راجع حدود مشروع Google ثم أعد المحاولة.", raw }
  }
  if (/TimeoutError|AbortError|timed out|aborted/i.test(raw)) {
    return { status: 504, code: "GEMINI_TIMEOUT", retryable: true, message: "استغرق Gemini وقتاً أطول من المتوقع. أعد المحاولة، وسيحتفظ الموقع ببياناتك الحالية.", raw }
  }
  if (/404|not found|not supported/i.test(raw)) {
    return { status: 502, code: "GEMINI_MODEL_UNAVAILABLE", retryable: true, message: "نموذج Gemini المحدد غير متاح حالياً؛ حاول مرة أخرى ليختار النظام نموذجاً متاحاً.", raw }
  }
  return { status: 502, code: "GEMINI_PROVIDER_ERROR", retryable: isRetryableGeminiError(error), message: "تعذر الاتصال بخدمة Gemini المباشرة حالياً.", raw }
}

function geminiTimeout(system: string, inlineData?: { mimeType: string; data: string }) {
  if (inlineData) return 90_000
  if (/اختبار|JSON|تطوير|برمج/i.test(system)) return 120_000
  return 35_000
}

async function geminiText(prompt: string, system: string, temperature: number, inlineData?: { mimeType: string; data: string }): Promise<string> {
  if (!GEMINI.key) throw new Error("GEMINI_API_KEY غير موجود على الخادم")
  const parts: any[] = [{ text: prompt }]
  if (inlineData) parts.unshift({ inlineData })
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature },
  })
  let lastError: unknown = new Error("تعذر بدء اتصال Gemini المباشر")

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const model = await resolveGeminiModel(attempt > 0)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI.key },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(geminiTimeout(system, inlineData)),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const modelError = new Error(`Gemini HTTP ${response.status}: ${String(data?.error?.message || data?.message || response.statusText).slice(0, 300)}`)
        lastError = modelError
        if ([404, 408, 429, 500, 502, 503, 504].includes(response.status)) {
          const cooldown = response.status === 404 ? 10 * 60_000 : response.status === 429 ? 90_000 : 5_000
          coolDownGeminiModel(model, cooldown)
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 750 * (2 ** attempt)))
          continue
        }
        throw modelError
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("")
      if (typeof text !== "string" || !text.trim()) throw new Error("Gemini: وصل رد فارغ")
      resolvedGeminiModel = model
      return text.trim()
    } catch (error) {
      lastError = error
      if (!isRetryableGeminiError(error) || attempt === 2) break
    }
  }
  throw lastError
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
مهمتك انتقاء أسئلة اختبار قرآنية احترافية ومتنوعة، والتحقق من مواضعها من الآيات المرسلة داخل sourceSurahs. استخدم مقتطفات دليل إعداد الاختبارات وملف المتشابهات داخل referenceContext مرجعاً لأسلوب السؤال وتنوعه ودرجة صعوبته. ملف المصحف مخصص لإنتاج صور الآيات فقط ولا يُستخدم لاستخراج نص الأسئلة. يظل sourceSurahs المصدر الحاكم لصحة نص الآية والإجابة.

قواعد صارمة:
- ممنوع اختراع آية أو عبارة قرآنية غير موجودة في sourceSurahs.
- كل سؤال يجب أن يكون متعلقاً مباشرة بحفظ القرآن أو نص الآية أو السورة.
- لا تنشئ أسئلة ثقافة عامة أو دين عام أو معلومات خارج نصوص القرآن.
- التزم تماماً بعدد الأسئلة count المطلوب لكل plan، وبالنوع والمستوى وموضع السؤال position المحددين في كل plan.
  - position=start: اختر من الثلث الأول للسورة، position=middle: الثلث الأوسط، position=end: الثلث الأخير، position=random: نوّع بين جميع المواضع.
- إذا كان type=mcq فعدد الخيارات يجب أن يساوي optionsCount لذلك plan، مع إجابة صحيحة واحدة فقط. نوّع عشوائياً بين: اختيار الآية التالية، اختيار تكملة الآية، واختيار اسم السورة التي ينتمي إليها المقطع.
- إذا كان type=truefalse فاجعل options=["صح","خطأ"] فقط، وبدّل بين: صحة تكملة الآية، وصحة نسبة الآية إلى سورة محددة. وازن بين الإجابات الصحيحة والخاطئة.
- إذا كان type=complete فاختر حد بداية وحد نهاية حقيقيين لصيغة «أكمل من قوله تعالى … إلى قوله تعالى …»، واجعل from/to صحيحين وفي السورة نفسها، وعدد الآيات المطلوب يساوي completeAyahs قدر الإمكان.
- إذا كان type=audio فحدد حد بداية وحد نهاية حقيقيين لصيغة «اقرأ من قوله تعالى … إلى قوله تعالى …»، ويجب أن يساوي عدد الآيات من from إلى to قيمة reciteAyahs بالضبط.
- صور حد البداية وحد النهاية ستُعرض منفصلة وقابلة للتكبير، لذلك لا تنسخ نصهما داخل prompt ولا تكشف الجزء المطلوب إجابته.
- level=easy: سؤال مباشر من النص.
- level=medium: تمييز وربط أدق بين الآية والسورة أو موضعها.
- level=hard: مواضع متشا��هة وتمييز دقيق دون غموض أو معلومات من خارج النص.
- لا تكرر السؤال نفسه، ووزّع الاختيارات على سور ومواضع مختلفة قدر ما ي��مح النطاق.
- points=1 دائماً.
- timeLimit لا يخرج عن الوقت الذي حدده المسؤول في plan؛ إذا كان موجوداً فاستخدمه كما هو.
- لا تضع إجابة صحيحة خارج الخيارات.
- prompt توجيه قصير فقط؛ لا تذكر فيه الإجابة، ولا كلمات منها، ولا نص الآية ولا بدايتها أو نهايتها، ولا اسم السورة إذا كان هو الإجابة، ولا أي تلميح يكشف الحل. اجعل stem فارغاً دائماً لأن المقطع سيظهر بصورة مقتطعة من ملف المصحف، وسيحجب الخادم نطاق الإجابة داخل الصورة لجميع الأنواع.
- في أسئلة الاختيار والصح/الخطأ اختر مشتتات معقولة وغير ملتبسة، وإجابة واحدة قابلة للتحقق فقط. لا تجعل الخيارات نسخاً من نصوص الآيات.
- للمستوى الصعب، استفد من referenceContext لاختيار متشابهات صحيحة ومميزة، ثم تحقق من المرجع القرآني المنظم. المرجعان مساعدان وليسا قيداً على معرفتك.
- أعد مصفوفة JSON فقط، دون Markdown أو شرح.

شكل كل عنصر:
{"type":"mcq|truefalse|complete|audio","level":"easy|medium|hard","surah":"اسم السورة","prompt":"نص السؤال","stem":"الآية أو النص القرآني المرجعي عند الحاجة","options":[],"correct":"الإجابة الصحيحة","from":1,"to":1,"timeLimit":60,"completeAyahs":1,"reciteAyahs":1,"points":1}

تحقق قبل الإخراج من أن عدد العناصر لكل plan يساوي count تماماً، وأن الآيات الم��تخدمة موجودة فعلاً في sourceVerses.`

const SYS_GRADE_TEXT = `أنت مصحّح متسامح لاختبارات حفظ القرآن. صحّح إجابة الطالب في نوع "أكمل".
كن متساهلاً مع الأخطاء الميسورة: الأخطاء الإملائية البسيطة، اختلاف التشكيل، الهمزات، التاء المربوطة/المفتوحة، حذف/إضافة الألف. هذه لا تُنقص الدرجة.
احسب matchedPercent (0-100) لمدى مطابقة المعنى والألفاظ للنص المرجعي.
score: 1 إذا كان صحيحاً (ولو بأخطاء ميسورة)، 0.5 إذا ن��صت آية واحدة أو خطأ جوه����ي بسيط، 0 إذا كان مختلفاً أو ناقصاً كثيراً.
أعد JSON فقط: {"accepted":true/false,"score":1|0.5|0,"matchedPercent":number,"reason":"سبب مختصر بالعربية","missingAyahs":[]}`

const SYS_GRADE_RECITATION = `أنت مصحّح متسامح لتلاوة القرآن اعتماداً على تفريغ نصي (transcript) قد يكون غير دقيق بسبب التعرف الآلي.
قارن ما تلاه الطالب بالنص المتوقع expectedText للمقطع المطلوب (surah ����ن from إلى to).
كن متساهلاً: يكفي وجود القليل من الآيات أو الكلمات الصحيحة المطابقة للمق��ع المطلوب لقبول أن الطالب يتلو نفس المقطع. تجاوز أخطاء التعرف الآلي و��لتشكيل.
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
- "app/api/ai/route.ts": نقطة النهاية الآمنة على الخادم. تستخدم Gemini مباشرةً وحصرياً عبر GEMINI_API_KEY، وتدعم الأوضاع: assistant, admin_assistant, generate_exam, grade_text, grade_recitation, transcribe_and_grade, dev_assistant، بالإضافة إلى وضع النص الحر (prompt).
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
قواعد إضافية مهمة: لا تقترح حذف أو إعادة تسمية أي ملف. لا تضع أسراراً أو مفاتيح API في public أو كود المتصفح. يمكنك اختيار أي ملف موجود ف�� قائمة المستودع ال��ي نرسلها لك، ويمكن إنشاء ملف جديد فقط عند الحاجة الواضحة. إذا احتاج الطلب خدمة خارجية غير مضبوطة، اذكر ذلك في risks أو clarifications. لا تضع أسراراً أو مفاتيح API في ملفات public أو كود المتصفح. إن كان الطلب مخالفاً للقيود (مثل حذف المشروع أو إعادة بنائه) اجعل feasible=false واشرح السبب في summary.`


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
  if (res.status === 404) throw new Error(`المس��ودع ${GITHUB_OWNER}/${GITHUB_REPO} غير موجود أو لا يملك الرمز صلاحية الوصول إليه`)
  if (res.status === 401) throw new Error("GITHUB_TOKEN غير صالح (401 Unauthorized)")
  if (res.status === 403) throw new Error("الرمز GITHUB_TOKEN ممنوع من الوصول (403) — تحقق من صلاحياته")
  if (!res.ok) throw new Error(`GitHub ${res.status}: تعذر قراءة بيانات المستودع`)
  return await res.json()
}

// يحل الفرع الفعلي: يستخدم GITHUB_BRANCH إن ضُبط، وإلا الفرع الافتراضي ا��حقيقي للمستودع.
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
      return { connected: false, reason: "تعذر الاتصال بخوادم GitHub (مشكلة في ا��ش��كة)." }
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
1) ا��رأ محتوى كل ملف مُعطى وافهم بنيته وأسلوبه ووظائفه الحالية قبل أي تعديل.
2) حدد بدقة أصغر جز�� يجب تغييره لتحقيق الطلب، دون المساس ببقية الكود.
3) اكتب التعديل بنفس أسلوب ��بنية المشروع (نفس التسمية، ن��س المسافات البادئة، نفس نمط الدوال، اتجاه RTL العربي، ومتغيرات الأنماط الموجودة مثل var(--primary)).
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
  const parsed = extractJson(text)
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.patches)) {
    throw new Error("مرحلة إنشاء التعديلات: أعاد النموذج JSON غير صالح، ولم يُكتب أي ملف")
  }
  return parsed
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
  // نتحقق من جميع الملفات قبل أول كتابة، حتى لا يبدأ التطبيق برد ناقص أو مسار غير مصرح به.
  const validatedPatches = patches.map((patch: any) => {
    const path = String(patch?.path || "")
    const content = typeof patch?.content === "string" ? patch.content : null
    if (!safeProjectPath(path) || content === null || content.length > 500_000 || !selected.includes(path)) {
      throw new Error(`مرحلة التحقق: تعديل غير صالح للملف ${path || "غير المحدد"}، ولم يُكتب أي ملف`)
    }
    const old = currentMap.get(path)
    if (old && old.content && !content.trim()) throw new Error(`مرحلة التحقق: رُفض تفريغ الملف ${path}، ولم يُكتب أي ملف`)
    return { path, content, reason: typeof patch?.reason === "string" ? patch.reason : "", old }
  })
  if (!validatedPatches.length) throw new Error("لم يتم تطبيق أي ملف بعد التحقق من التعديلات")

  const applied = []
  for (const patch of validatedPatches) {
    const result = await githubPutFile(patch.path, patch.content, patch.old?.sha, `chore: AI assistant - ${request.slice(0, 70)}`)
    applied.push({ path: patch.path, reason: patch.reason, commitUrl: result?.commit?.html_url || null })
  }
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

  const diagnostics = {
    executedOn: "server",
    keyConfigured: isGeminiConfigured(),
    providerStatus: 200,
    provider: "gemini",
    providerLabel: GEMINI.label,
    configuredModel: GEMINI.model.replace(/^models\//, ""),
  }

  try {
    // 1) وضع ��لنص الحر (صندوق اختبار الذ��اء الاصطناعي)
    if (typeof body.prompt === "string" && body.prompt.trim() && !body.mode) {
      const prompt = body.prompt.trim().slice(0, 6000)
      const reference = await getReferenceContext(prompt).catch(() => "")
      const text = await runText(
        `${reference ? `${reference}\n\n` : ""}السؤال:\n${prompt}`,
        "أجب عن أي سؤال مسموح، داخل موضوع المنصة أو خارجه. اجعل طول الإجابة على قدر السؤال فقط: إن كان بسيطاً فأجب بجملة قصيرة، ولا تضف تفصيلاً أو أمثلة إلا إذا طُلبت. استخدم المرجعين المرفقين عند فائدتهما في الأسئلة القرآنية للتحقق من الدقة، لكن لا تعتبرهما حدوداً لمعرفتك ولا المصدر الوحيد لإجابتك. لا تختلق نصاً قرآنياً. أعد الجواب مباشرة بلا تحية أو مقدمة أو عنوان أو خاتمة أو ذكر للنموذج أو للمرجع.",
        typeof body.temperature === "number" ? body.temperature : 0.35,
      )
      return json({ result: text.trim(), diagnostics })
    }

    const mode = body.mode as string
    const payload = body.payload || {}
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.15

    // 1.ب) المساعد الذكي لل��الب/ولي الأمر (نص حر مع سياق بيانات الطالب)
    if (mode === "assistant") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) return json({ error: "لم يصل نص السؤال", diagnostics }, 400)
      const reference = await getReferenceContext(prompt).catch(() => "")
      const text = await runText(
        `${reference ? `${reference}\n\n` : ""}السؤال:\n${prompt.slice(0, 6000)}`,
        "أنت Gemini، مساعد عربي طبيعي ودقيق. أجب عن أي سؤال مسموح داخل المنصة أو خارجها، وأعط الأولوية لبيانات المنصة فقط عندما تكون ذات صلة. اجعل طول الجواب على قدر السؤال: جواب مباشر وقصير للسؤال البسيط، وتفصيل منظم فقط عند طلبه. تعامل مع التحيات والعبارات الاجتماعية بصورة طبيعية؛ مثال: إذا قال المستخدم السلام عليكم فرد: وعليكم السلام ورحمة الله وبركاته 🥰 هل لديك سؤال؟ أنا في خدمتك! استخدم الرموز التعبيرية باعتدال في الحديث الودي فقط، وتجنبها في الإجابات العلمية أو الحساسة. استخدم لغة عربية بسيطة واحترافية ولا تكرر السؤال. في القرآن والمتشابهات استخدم مقتطفات المرجعين للتحقق عند توفرها، لكن لا تحصر معرفتك فيهما، ولا تختلق آية أو معلومة.",
        typeof body.temperature === "number" ? body.temperature : 0.35,
      )
      return json({ result: text.trim(), diagnostics })
    }

    // 2) جلب نطاق الس��ر المحدد كاملاً ثم توليد الأسئلة عبر Gemini.
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
      const alternatingNumbers: number[] = []
      for (let left = 0, right = allNumbers.length - 1; left <= right; left++, right--) {
        alternatingNumbers.push(allNumbers[left])
        if (right !== left) alternatingNumbers.push(allNumbers[right])
      }
      const selectedNumbers = alternatingNumbers.slice(0, Math.min(12, Math.max(requestedCount, 6), alternatingNumbers.length))
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
      const referenceContext = await getReferenceContext(
        sourceSurahs.map((source) => source.surah).join(" "),
        sourceSurahs.flatMap((source) => source.verses.slice(0, 2).map((verse: { text: string }) => verse.text)),
      ).catch(() => "")
      const safePayload = { plan, startSurahNumber, endSurahNumber, sourceSurahs, referenceContext }
      const text = await runText(JSON.stringify(safePayload), SYS_EXAM + "\nالتزم بالسور الموجودة في sourceSurahs فقط، واستفد من referenceContext لصياغة أسئلة متشابهات ومواضع أكثر احترافية. وزّع الأسئلة بالتتابع ولا تستخدم السورة نفسها مرتين قبل المرور على بقية السور. في سؤال complete لا تضع كلمات الإجابة في prompt أو stem مطلقاً؛ سيعرض النظام صورة المصحف مع إخفاء الآية المطلوبة. ممنوع إعادة كتابة أو تعديل نص أي آية.", temperature)
      const parsed = extractJson(text)
      const questions = Array.isArray(parsed) ? parsed : parsed?.questions
      if (!Array.isArray(questions)) return json({ error: "تعذر توليد أسئلة صالحة", diagnostics }, 502)
      const sourcesByName = new Map(sourceSurahs.map((source) => [source.surah, source]))
      const safeQuestions = questions.slice(0, requestedCount).map((question: any) => {
        const source = sourcesByName.get(String(question?.surah || "")) || sourceSurahs[0]
        const from = Math.max(1, Math.min(source.verses.length, Number(question?.from) || 1))
        const to = Math.max(from, Math.min(source.verses.length, Number(question?.to) || from))
        const type = ["mcq", "truefalse", "complete", "audio"].includes(question?.type) ? question.type : "mcq"
        const complete = type === "complete"
        const correct = complete
          ? source.verses.slice(from - 1, to).map((verse: { text: string }) => verse.text).join(" ")
          : String(question?.correct || "")
        const defaultPrompts: Record<string, string> = {
          mcq: "اختر الإجابة الصحيحة اعتماداً على المقطع المصور من المصحف",
          truefalse: "حدد صحة العبارة اعتماداً على المقطع المصور من المصحف",
          complete: "أكمل المقطع المخفي في صورة المصحف",
          audio: "سجّل تلاوة المقطع المعروض من المصحف",
        }
        let prompt = String(question?.prompt || defaultPrompts[type])
          .replace(/(?:الإجابة|الجواب)\s*(?:الصحيحة)?\s*[:：].*$/giu, "")
          .replace(/\s+/g, " ")
          .trim()
        const verseTexts = source.verses.slice(from - 1, to).map((verse: { text: string }) => normalizeQuranText(verse.text)).filter(Boolean)
        const normalizedPrompt = normalizeQuranText(prompt)
        const normalizedCorrect = normalizeQuranText(correct)
        const answerWords = normalizedCorrect.split(" ").filter((word) => word.length > 2)
        const leaksVerse = verseTexts.some((verse: string) => verse.length > 5 && (normalizedPrompt.includes(verse) || verse.includes(normalizedPrompt)))
        const leaksAnswer = normalizedCorrect.length > 2 && (normalizedPrompt.includes(normalizedCorrect) || answerWords.filter((word) => normalizedPrompt.includes(word)).length >= Math.min(2, answerWords.length))
        if (!prompt || leaksVerse || leaksAnswer) prompt = defaultPrompts[type]

        let options = Array.isArray(question?.options)
          ? question.options.map((option: unknown) => String(option || "").trim()).filter(Boolean)
          : []
        if (type === "truefalse") options = ["صح", "خطأ"]
        if (type === "mcq") {
          options = Array.from(new Set(options))
          if (correct && !options.includes(correct)) options.unshift(correct)
        }

        return {
          ...question,
          type,
          surah: source.surah,
          surahNumber: source.surahNumber,
          from,
          to,
          prompt,
          stem: "",
          options,
          correct,
          questionImage: `/api/quran-question-image?surah=${source.surahNumber}&ayah=${from}&to=${to}&type=${type}`,
          source: "مرجع قرآني موثوق",
        }
      })
      return json({ result: safeQuestions, diagnostics, source: "Al Quran Cloud", range: { startSurahNumber, endSurahNumber } })
    }

    if (mode === "student_voice_intake") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const audioBase64 = typeof payload.audioBase64 === "string" ? payload.audioBase64 : ""
      const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.slice(0, 80) : "audio/webm"
      if (!audioBase64) return json({ error: "لم يصل التسجيل الصوتي", diagnostics }, 400)
      if (audioBase64.length > 12_000_000) return json({ error: "التسجيل أكبر من ��لحد المسموح", diagnostics }, 413)
      if (!/^audio\/(webm|wav|mpeg|mp4|ogg)/i.test(mimeType)) return json({ error: "صيغة التسجيل غير مدعومة", diagnostics }, 415)

      const system = `أنت تستخرج بيانات طالب من إملاء عربي لمسؤول مدرسة. أعد JSON فقط بلا markdown بهذه المفاتيح حصراً:
transcript,name,username,national,phone,birth,studentPass,parent,parentPass,subjects,juz,surah,notes.
subjects مصفوفة نصوص، وبقية القيم نصوص. لا تخمّن أي قيمة لم تُذكر بوضوح؛ استخدم نصاً فارغاً أو مصفوفة فارغة. حوّل الأرقام العربية إلى إنجليزية. birth يجب أن يكون YYYY-MM-DD فقط إن أمكن فهم تاريخ كامل. national حدّه 14 رقماً وphone حدّه 11 رقماً. juz رقم من 1 إلى 30 كنص. انسخ كلمات المرور فقط إذا نطقها المسؤول صراحة. transcript هو التفريغ الكامل المسموع.`
      const text = await geminiText("استخرج بيانات الطالب من هذا التسجيل الصوتي.", system, 0.05, { mimeType, data: audioBase64 })
      const parsed = extractJson(text) || {}
      const clean = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : ""
      const digits = (value: unknown, max: number) => clean(value, max * 2).replace(/[^0-9]/g, "").slice(0, max)
      const birth = /^\d{4}-\d{2}-\d{2}$/.test(clean(parsed.birth, 10)) ? clean(parsed.birth, 10) : ""
      const juzNumber = Math.min(30, Math.max(0, Number.parseInt(digits(parsed.juz, 2), 10) || 0))
      return json({ result: {
        transcript: clean(parsed.transcript, 4000),
        fields: {
          name: clean(parsed.name, 120), username: clean(parsed.username, 80),
          national: digits(parsed.national, 14), phone: digits(parsed.phone, 11), birth,
          studentPass: clean(parsed.studentPass, 100), parent: clean(parsed.parent, 120),
          parentPass: clean(parsed.parentPass, 100),
          subjects: Array.isArray(parsed.subjects) ? parsed.subjects.map((x: unknown) => clean(x, 80)).filter(Boolean).slice(0, 12) : [],
          juz: juzNumber ? String(juzNumber) : "", surah: clean(parsed.surah, 80), notes: clean(parsed.notes, 1000),
        },
      }, diagnostics })
    }

    if (mode === "admin_assistant") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 3000) : ""
      if (!message) return json({ error: "اكتب رسالتك أولاً", diagnostics }, 400)
      const context = JSON.stringify(payload.context || {}).slice(0, 18_000)
      const reference = await getReferenceContext(message).catch(() => "")
      const result = await runText(`بيانات الموقع المنقحة:\n${context}\n\n${reference ? `${reference}\n\n` : ""}سؤال المسؤول:\n${message}`, "أنت Gemini، مساعد إداري عربي دقيق وطبيعي. أجب عن أي سؤال مسموح داخل الموقع أو خارجه، واستخدم بيانات الموقع عند صلتها فقط. اجعل الرد على قدر السؤال، مباشراً ومبسطاً، ولا تضف اقتراحات أو تفاصيل لم تُطلب. رد على التحيات والمجاملات بود وباختصار، ويمكنك استخدام رمز تعبيري مناسب باعتدال، وتجنبه في الردود العلمية والحساسة. استخدم المرجعين للمسائل القرآنية والمتشابهات دون حصر معرفتك فيهما، ولا تختلق بيانات أو آيات.", 0.25)
      return json({ result: result.trim(), diagnostics })
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
      // OpenRouter يقبل الصو�� بصيغة wav أو mp3 فقط (input_audio).
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

    // 6.أ) فحص جاهزية مساعد التطوير (للمس��ول) — يتحقق من المتغيرات والشبكة والمستودع والصلاحيات دون كش�� أي سرّ.
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
      const userPrompt = `بنية المشروع الحالية:\n${PROJECT_MANIFEST}\n\nقائمة الملفات الفعلية في المس��ودع:\n${tree.files.join("\n")}\n\nطلب المسؤول:\n${request}\n\nحلّل الطلب وأعد خطة التعديل بصيغة JSON فقط كما هو محدد. اختر الملفات الفعلية من قائمة المستودع كلما أمكن.`
      const text = await runText(userPrompt, SYS_DEV_ASSISTANT, 0.2)
      const parsed = extractJson(text)
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.files)) {
        return json({ error: "مرحلة تحليل الطلب: أعاد النموذج JSON غير صالح، ولم يُكتب أي ملف", diagnostics: { ...diagnostics, stage: "planning", githubConfigured, autoDevEnabled: AUTO_DEV_ENABLED } }, 502)
      }
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
          const failure = classifyAiFailure(e)
          const isProviderFailure = /Gemini|generativelanguage|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(failure.raw)
          return json({
            error: isProviderFailure ? failure.message : (e?.message || "تعذر التطبيق التلقائي"),
            result: { ...plan, applied: false, autoApplied: false },
            retryable: isProviderFailure ? failure.retryable : false,
            code: isProviderFailure ? failure.code : "DEV_APPLY_ERROR",
            diagnostics: {
              ...diagnostics,
              stage: "apply",
              githubConfigured,
              autoDevEnabled: AUTO_DEV_ENABLED,
              reason: failure.raw.slice(0, 300),
            },
          }, isProviderFailure ? failure.status : 500)
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
      if (!st.connected) return json({ error: st.reason || "��لمزامنة مع GitHub غير متصلة", diagnostics }, 400)
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
    const failure = classifyAiFailure(err)
    const mode = typeof body?.mode === "string" ? body.mode : "prompt"
    const stage = mode === "dev_assistant" ? "analysis" : mode === "generate_exam" ? "exam-generation" : "response"
    return json(
      {
        error: failure.message,
        code: failure.code,
        retryable: failure.retryable,
        diagnostics: {
          executedOn: "server",
          provider: "gemini-direct",
          keyConfigured: isGeminiConfigured(),
          stage,
          reason: failure.raw.slice(0, 300),
        },
      },
      failure.status,
    )
  }
}
