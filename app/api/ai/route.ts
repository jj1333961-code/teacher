import { generateText } from "ai"
import { getReferenceContext, normalizeQuranText } from "@/lib/quran-reference"

export const maxDuration = 300

// ===== اتصال OpenRouter من الخادم فقط =====
const OPENROUTER = {
  label: "OpenRouter",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  get key() {
    return (process.env.OPENROUTER_API_KEY || "").trim()
  },
  get model() {
    return (process.env.OPENROUTER_MODEL || "openrouter/auto").trim()
  },
}
const GEMINI = {
  label: "Google Gemini",
  endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  get key() {
    return (process.env.GEMINI_API_KEY || "").trim()
  },
  get model() {
    return (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim()
  },
}
const speakerVerificationConfigured = !!(process.env.SPEAKER_VERIFICATION_API_KEY || "").trim()
const isOpenRouterConfigured = () => Boolean(OPENROUTER.key)
const isGeminiConfigured = () => Boolean(GEMINI.key)

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

function isRetryableOpenRouterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /408|409|429|5\d\d|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network|TimeoutError|AbortError|aborted|رد فارغ|empty/i.test(message)
}

function classifyAiFailure(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "خطأ غير معروف")
  if (/OPENROUTER_API_KEY.*(?:غير موجود|missing|not set)/i.test(raw)) {
    return { status: 503, code: "OPENROUTER_KEY_MISSING", retryable: false, message: "مفتاح OpenRouter غير متاح على الخادم. أضف OPENROUTER_API_KEY إلى متغيرات البيئة.", raw }
  }
  if (/401|403|API key|unauthorized|forbidden/i.test(raw)) {
    return { status: 503, code: "AI_PROVIDERS_UNAUTHORIZED", retryable: false, message: "تعذر اعتماد خدمة Gemini على الخادم.", raw }
  }
  if (/Gemini HTTP 404|model.*(?:not found|no longer available)/i.test(raw)) {
    return { status: 502, code: "GEMINI_MODEL_UNAVAILABLE", retryable: false, message: "نموذج Gemini الصوتي غير متاح حالياً.", raw }
  }
  if (/402|insufficient credits|payment required|credit card|free credits/i.test(raw)) {
    return { status: 402, code: "AI_CREDITS_REQUIRED", retryable: false, message: "جُرّبت مزوّدات الذكاء الاصطناعي المتاحة، لكن المزوّد الأخير يحتاج رصيداً أو تفعيل فوترة.", raw }
  }
  if (/AUDIO_PAYLOAD_TOO_LARGE|payload too large|request entity too large|413/i.test(raw)) {
    return { status: 413, code: "AUDIO_PAYLOAD_TOO_LARGE", retryable: false, message: "التسجيل طويل جداً للتحليل. سجّل مقطعاً أقصر من دقيقة ونصف ثم أعد المحاولة.", raw }
  }
  if (/429|rate.?limit|quota/i.test(raw)) {
    return { status: 429, code: "OPENROUTER_RATE_LIMITED", retryable: true, message: "بلغ OpenRouter حد الطلبات مؤقتاً. انتظر قليلاً ثم أعد المحاولة.", raw }
  }
  if (/TimeoutError|AbortError|timed out|aborted/i.test(raw)) {
    return { status: 504, code: "OPENROUTER_TIMEOUT", retryable: true, message: "استغرق OpenRouter وقتاً أطول من المتوقع. أعد المحاولة، وسيحتفظ الموقع ببياناتك الحالية.", raw }
  }
  if (/404|no endpoints found|not found|not supported/i.test(raw)) {
    return { status: 502, code: "OPENROUTER_MODEL_UNAVAILABLE", retryable: false, message: "تعذر على OpenRouter Auto اختيار نموذج يدعم هذا الطلب حالياً.", raw }
  }
  return { status: 502, code: "OPENROUTER_PROVIDER_ERROR", retryable: isRetryableOpenRouterError(error), message: "تعذر الاتصال بخدمة OpenRouter حالياً.", raw }
}

function openRouterTimeout(system: string, audio?: { mimeType: string; data: string }) {
  if (audio) return 90_000
  if (/اختبار|JSON|تطوير|برمج/i.test(system)) return 120_000
  return 35_000
}

function readOpenRouterText(content: unknown): string {
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return ""
  return content.map(part => typeof part === "string" ? part : String(part?.text || "")).join("").trim()
}

async function openRouterText(prompt: string, system: string, temperature: number, audio?: { mimeType: string; data: string }): Promise<string> {
  if (!OPENROUTER.key) throw new Error("OPENROUTER_API_KEY غير موجود على الخادم")
  if (audio && audio.data.length > 4_050_000) throw new Error("AUDIO_PAYLOAD_TOO_LARGE: التسجيل طويل جداً للتحليل")
  const normalizedMime = audio?.mimeType.toLowerCase().split(";")[0]
  const audioFormat = normalizedMime === "audio/mpeg" || normalizedMime === "audio/mp3" ? "mp3"
    : normalizedMime === "audio/ogg" ? "ogg"
    : normalizedMime === "audio/mp4" || normalizedMime === "audio/m4a" ? "m4a"
    : "wav"
  const userContent = audio
    ? [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: audio.data, format: audioFormat } },
      ]
    : prompt
  const requestBody = JSON.stringify({
    model: OPENROUTER.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature,
  })
  let lastError: unknown = new Error("تعذر بدء اتصال OpenRouter")

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(OPENROUTER.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER.key}`,
          "HTTP-Referer": process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://v0.app",
          "X-OpenRouter-Title": "Teacher Quran Platform",
        },
        body: requestBody,
        cache: "no-store",
        signal: AbortSignal.timeout(openRouterTimeout(system, audio)),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const providerMessage = String(data?.error?.message || data?.message || response.statusText).slice(0, 300)
        const providerError = new Error(`OpenRouter HTTP ${response.status}: ${providerMessage}`)
        lastError = providerError
        if ([408, 409, 429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 750 * (2 ** attempt)))
          continue
        }
        throw providerError
      }
      const text = readOpenRouterText(data?.choices?.[0]?.message?.content)
      if (!text) throw new Error("OpenRouter: وصل رد فارغ")
      return text
    } catch (error) {
      lastError = error
      if (!isRetryableOpenRouterError(error) || attempt === 2) break
      await new Promise(resolve => setTimeout(resolve, 750 * (2 ** attempt)))
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

async function geminiText(prompt: string, system: string, temperature: number, audio?: { mimeType: string; data: string }): Promise<string> {
  if (!GEMINI.key) throw new Error("GEMINI_API_KEY غير موجود على الخادم")
  const parts: any[] = [{ text: prompt }]
  if (audio) parts.unshift({ inlineData: { mimeType: audio.mimeType, data: audio.data } })
  // نموذج 2.5 لم يعد متاحاً للحسابات الجديدة؛ نستخدم نموذج Gemini الحديث للصوت.
  const model = audio ? "gemini-3.6-flash" : GEMINI.model
  const response = await fetch(`${GEMINI.endpoint}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI.key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { temperature },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(audio ? 90_000 : 120_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${String(data?.error?.message || response.statusText).slice(0, 300)}`)
  const text = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.map((part: any) => String(part?.text || "")).join("").trim()
    : ""
  if (!text) throw new Error("Gemini: وصل رد فارغ")
  return text
}

async function gatewayText(prompt: string, system: string, temperature: number): Promise<string> {
  const result = await generateText({ model: "google/gemini-3.5-flash", system, prompt, temperature })
  const text = String(result.text || "").trim()
  if (!text) throw new Error("Vercel AI Gateway: وصل رد فارغ")
  return text
}

async function runText(prompt: string, system: string, temperature: number) {
  const errors: unknown[] = []
  if (isOpenRouterConfigured()) {
    try { return await openRouterText(prompt, system, temperature) } catch (error) { errors.push(error) }
  }
  if (isGeminiConfigured()) {
    try { return await geminiText(prompt, system, temperature) } catch (error) { errors.push(error) }
  }
  try { return await gatewayText(prompt, system, temperature) } catch (error) { errors.push(error) }
  throw errors.at(-1) || new Error("لا يوجد مزوّد ذكاء اصطناعي صالح على الخادم")
}

// ===== جميناي هو المزوّد الوحيد المسؤول عن كل ما يتعلق بالصوت =====
// التفريغ الصوتي، البصمة الصوتية، مطابقة المتحدث، وملء البيانات من الإملاء الصوتي.
const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3",
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/ogg", "audio/opus",
])

function normalizeAudioMimeType(value: unknown) {
  const mimeType = String(value || "audio/webm").toLowerCase().split(";")[0].trim()
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(mimeType)) throw new Error("صيغة التسجيل غير مدعومة بواسطة جميناي")
  if (mimeType === "audio/x-wav") return "audio/wav"
  if (mimeType === "audio/mp3") return "audio/mpeg"
  if (mimeType === "audio/x-m4a" || mimeType === "audio/m4a") return "audio/mp4"
  return mimeType
}

function audioMimeType(audioFormat: string) {
  return normalizeAudioMimeType(audioFormat.includes("/") ? audioFormat : audioFormat === "mp3" ? "audio/mpeg" : audioFormat === "ogg" ? "audio/ogg" : audioFormat === "m4a" ? "audio/mp4" : audioFormat === "webm" ? "audio/webm" : "audio/wav")
}

async function geminiAudio(prompt: string, system: string, temperature: number, audio: { mimeType: string; data: string }): Promise<string> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY غير موجود على الخادم: جميناي هو المسؤول عن معالجة الصوت")
  let lastError: unknown = new Error("تعذر بدء اتصال جميناي الصوتي")
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await geminiText(prompt, system, temperature, audio)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error || "")
      if (!/408|429|5\d\d|fetch failed|Timeout|Abort|aborted|رد فارغ|network|ECONN|ETIMEDOUT/i.test(message) || attempt === 2) break
      await new Promise(resolve => setTimeout(resolve, 800 * (2 ** attempt)))
    }
  }
  throw lastError
}

const SYS_AUDIO_TRANSCRIBE = "أنت محرك تفريغ صوتي عربي دقيق، ومتخصص في تلاوة القرآن الكريم بالرسم العثماني."

async function transcribeAudio(audioBase64: string, audioFormat: string): Promise<string> {
  const mimeType = audioMimeType(audioFormat)
  const prompt = "فرّغ هذ التسجيل الصوتي العربي حرفياً فقط. أعد النص دون شرح."
  return geminiAudio(prompt, SYS_AUDIO_TRANSCRIBE, 0.05, { mimeType, data: audioBase64 })
}

const SYS_VOICE_PRINT = `أنت محرك بصمة صوتية. تستمع إلى تسجيل عربي وتصف خصائص صوت المتحدث وصفاً رقمياً ثابتاً يمكن مقارنته لاحقاً.
لا تعتمد على الكلمات المنطوقة، بل على خصائص الصوت نفسه.
أعد JSON فقط بلا markdown:
{"speaker":{"gender":"male|female|unknown","ageRange":"child|teen|adult|senior|unknown","pitch":"very-low|low|medium|high|very-high","pitchHz":number,"timbre":"وصف موجز","speed":"slow|medium|fast","nasality":"low|medium|high","breathiness":"low|medium|high","accent":"وصف موجز","distinctiveTraits":["سمات مميزة موجزة"]},"quality":"good|noisy|too-short","usable":true/false,"reason":"سبب موجز بالعربية"}`

const SYS_VOICE_MATCH = `أنت محرك تحقق من هوية المتحدث بالبصمة الصوتية. لديك تسجيل صوتي حديث، ووصف بصمة صوتية مرجعية محفوظة لنفس الشخص المتوقع (referenceProfile)، وقد يصلك تسجيل مرجعي أيضاً.
حلّل خصائص الصوت في التسجيل الحديث ثم قارنها بالمرجع: الطبقة، اللون الصوتي، الجرس، الأنفية، السرعة، اللكنة.
تجاهل اختلاف الكلمات أو النص المقروء تماماً؛ المقارنة على الصوت فقط. راعِ اختلاف الميكروفون والضجيج.
أعد JSON فقط بلا markdown:
{"sameSpeaker":true/false,"matchPercent":number,"confidence":"low|medium|high","quality":"good|noisy|too-short","reason":"سبب موجز بالعربية","profile":{"gender":"male|female|unknown","pitch":"very-low|low|medium|high|very-high","pitchHz":number,"timbre":"وصف موجز","speed":"slow|medium|fast"}}`

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
- level=hard: اجعل السؤال شديد الصعوبة من المتشابهات اللفظية الموثقة: فروق الواو والفاء، الزيادة والنقص، اختلاف الضمائر والمفرد والجمع، اختلاف بداية الآية أو خاتمتها، والتمييز بين آيتين متقاربتين. يجب أن يبقى له جواب واحد قطعي.
- في الاختياري اجعل المشتتات من ألفاظ أو سور أو تكملات قرآنية شديدة التقارب، ولا تستخدم مشتتاً واضح البطلان أو بعيداً عن الصحيح.
- أعط الماضي القريب أولوية مقدارها نحو 70% عند pastScope=both، مع إبقاء 30% للماضي البعيد، ودوّر المواضع بين أول السورة ووسطها وآخرها.
- لا تكرر أي بصمة واردة في previousQuestionFingerprints، ولا تكرر السؤال نفسه داخل الدفعة، ووزّع الاختيارات على سور ومواضع مختلفة قدر ما يسمح النطاق.
- points=1 دائماً.
- timeLimit لا يخرج عن الوقت الذي حدده المسؤول في plan؛ إذا كان موجوداً فاستخدمه كما هو.
- لا تضع إجابة صحيحة خارج الخيارات.
- prompt توجيه قصير فقط؛ لا تذكر فيه الإجابة، ولا كلمات منها، ولا نص الآية ولا بدايتها أو نهايتها، ولا اسم السورة إذا كان هو الإجابة، ولا أي تلميح يكشف الحل. اجعل stem فارغاً دائماً لأن المقطع سيظهر بصورة مقتطعة من ملف المصحف، وسيحجب الخادم نطاق الإجابة داخل الصورة لجميع الأنواع.
- في أسئلة الاختيار والصح/الخطأ اختر مشتتات معقولة وغير ملتبسة، وإجابة واحدة قابلة للتحقق فقط. لا تجعل الخيارات نسخاً من نصوص الآيات.
- للمستوى الصعب، استفد من referenceContext لاختيار متشابهات صحيحة ومميزة، ثم تحقق من المرجع القرآني المنظم. المرجعان مساعدان وليسا قيداً على معرفتك.
- أعد مصفوفة JSON فقط، دون Markdown أو شرح.

شكل كل عنصر:
{"type":"mcq|truefalse|complete|audio","level":"easy|medium|hard","surah":"اسم السور","prompt":"نص السؤال","stem":"الآية أو النص القرآني المرجعي عند الحاجة","options":[],"correct":"الإجابة الصحيحة","from":1,"to":1,"timeLimit":60,"completeAyahs":1,"reciteAyahs":1,"points":1}

تحقق قبل الإخراج من أن عدد العناصر لكل plan يساوي count تماماً، وأن الآيات المتخدمة موجودة فعلاً في sourceVerses.`

const SYS_GRADE_TEXT = `أنت مصحّح متسامح لاختبارات حفظ القرآن. صحّح إجابة الطالب في نوع "أكمل".
كن متساهلاً مع الأخطاء الميسورة: الأخطاء الإملائية البسيطة، اختلاف التشكيل، الهمزات، التاء المربوطة/المفتوحة، حذف/إضافة الألف. هذه لا تُنقص الدرجة.
احسب matchedPercent (0-100) لمدى مطابقة المعنى والألفاظ للنص المرجعي.
score: 1 إذا كان صحيحاً (ولو بأخطاء ميسورة)، 0.5 إذا نصت آية واحدة أو خطأ جوهي بسيط، 0 إذا كان مختلفاً أو ناقصاً كثيراً.
أعد JSON فقط: {"accepted":true/false,"score":1|0.5|0,"matchedPercent":number,"reason":"سبب مختصر بالعربية","missingAyahs":[]}`

const SYS_GRADE_RECITATION = `أنت مصحّح متسامح لتلاوة القرآن اعتماداً على تفريغ نصي (transcript) قد يكون غير دقيق بسبب التعرف الآلي.
قارن ما تلاه الطالب بالنص المتوقع expectedText للمقطع المطلوب (surah ن from إلى to).
كن متساهلاً: يكفي وجود القليل من الآيات أو الكلمات الصحيحة المطابقة للمقع المطلوب لقبول أن الطالب يتلو نفس المقطع. تجاوز أخطاء التعرف الآلي ولتشكيل.
score: 1 إذا تلا المقطع المطلوب بشكل مقبول (ولو بأخطاء)، 0.5 إذا نسي آية واحدة فقط، 0 إذا نسي أكثر من آية أو تلا مقطعاً مختلفاً تماماً.
أعد JSON فقط: {"accepted":true/false,"score":1|0.5|0,"matchedPercent":number,"reason":"سبب مختصر بالعربية","missingAyahs":["أرقام أو نصوص الآيات الناقصة"]}`

const SYS_TRANSCRIBE = `أنت خبير في تصحيح تلاوة القرآن الكريم اعتماداً على تفريغ صوتي عربي.
مهمتك:
1) افحص transcript الناتج عن التعرف الصوتي وحدد هل هو تلاوة قرآن أم كلام/صوت غير مناسب.
2) قارن transcript بالنص المتوقع expectedText للمقطع: سورة surah من الآية from إلى الآية to.
3) تجاهل أخطاء التعرف الآلي والتشكيل والأخطاء الإملائية البسيطة، ولا تعتبرها نقصاً في الآيات.
4) حدد الآات الناقصة فعلياً فقط.
قواعد الدرجة:
- احسب score أساساً من نسبة الآيات المكتملة: (عدد الآيات الكلية - الآيات الناقصة) / عدد الآيات الكلية.
- score=1 عند اكتمال المقطع، و0 عند فقد كل المقطع أو اختلافه جذرياً.
- matchedPercent نسبة تقريبية لمطابقة المحتوى 0-100.
أعد JSON فقط بدون أي شرح خارجه:
{"transcript":"النص المفرغ","accepted":true/false,"score":number,"matchedPercent":number,"isRecitation":true/false,"reason":"سبب مختصر بالعربية","missingAyahs":["أرقام أو نصوص الآيات الناقصة"]}`

// ===== مساعد تطوير الموقع (للمسؤول فقط) =====
// وصف مختصر وحقيقي لبنية المشروع يُرسل للنموذج سياق للتحليل.
const PROJECT_MANIFEST = `المشروع الحالي: Student System AI — منصة إدارة طلاب تحفيظ القرآن واختبارهم (Next.js + صفحة SPA واحدة).
الهدف من هذا الوضع: مساعد تطوير فعلي للمسؤول. يحلل المشروع، يحدد الملفات المطلوبة، ثم يمكنه إنشاء كود كامل وتطبيق تلقائياً على مستودع المشروع من الخادم فقط. لا تنتظر موافقة بشرية بعد إرسال الطلب إذا كان التطبيق التلقائي مفعلاً.
البنية والملفات الرئيسية:
- "public/index.html": التطبيق كامل (واجهة عربية RTL + كل منطق JavaScript). يحتوي على:
  • صفحات معرّفة كـ <div class="page hidden" id="..."> وتُعرض عبر showPage('id') وارجوع عبر goBack().
  • لوحة المسؤول (adminDashboard) وبها menu-grid فيها أزرار menu-btn.
  • صفحات الطالب وولي الأمر، الرسائل، الملفات، إدارة المسؤولي، إعدادات المسؤول (adminSettings).
  • تخزين البيانات محلياً عبر getData(key)/setData(key,value) على localStorage (مفاتيح مثل students, admins, messages, files).
  • حالة الجلسة: currentUser, currentType ('admin'|'student'|'parent'), currentAdminId.
  • الذكاء الاصطناعي عبر callStudentAI(mode,payload,temperature) الذي يناد /api/ai.
  • بناء الاختبارات: examPlanRows, renderExamPlanRows(), أنواع الأسئلة mcq/truefalse/complete/audio.
  • التسجيل الصوتي والبصمة الصوتية: computeVoicePrint(), voiceMatchPercent(), blobToWav().
- "app/api/ai/route.ts": نقطة النهاية الآمنة على الخادم. تستخدم OpenRouter مباشرةً وحصرياً عبر OPENROUTER_API_KEY، وتدعم الأوضاع: assistant, admin_assistant, generate_exam, grade_text, grade_recitation, transcribe_and_grade, dev_assistant، بالإضافة إلى وضع النص الحر (prompt).
- "app/layout.tsx": تخطيط الجذر.
- "app/page.tsx": صفحة Next.js احتياطية؛ الجذر يعاد توجيهه إلى public/index.html عبر next.config.mjs.
- "app/globals.css": الأنماط العامة لـNext.js.
- "next.config.mjs": rewrite للجذر إلى public/index.html.
- "package.json": تبعيات وسكربتات المشروع.
- "components/ui/button.tsx" "lib/utils.ts": مكونات/أدوات مساعدة موجودة في المشروع.

المسارات الموجودة في النسخة الحالية: public/index.html, app/api/ai/route.ts, app/page.tsx, app/layout.tsx, app/globals.css, next.config.mjs, package.json, components/ui/button.tsx, lib/utils.ts, .env.example, DEPLOY.md.
قيود مهمة يجب احترامها في أي خطة: لا حذف الملفات، لا إعادة بناء المشروع، لا وضع مفتاح API في المتصفح، الحفظ على التصميم العربي RTL الحاي، وتعديل الموجود فقط أو إضافة م يلزم.`

const SYS_DEV_ASSISTANT = `أنت مهندس برمجيات Senior ومساعد تطوير تلقائي لمشروع Student System AI. يفهم TypeScript وJavaScript وHTML وCSS وNext.js وواجهات API وGitHub وVercel. المستخدم نا هو المسؤول ويعطيك طلباً بالعربية لتعديل الموقع.
مهمتك: فهم اللب، فحص قائمة ملفات المشروع الحالية، تحديد الملفات التي يجب تعيلها أو إنشاؤها، ووضع خطة تنفيذ دقيقة. لا تكتب المحتوى الكامل للملفات في مرحلة الخطة؛ مرحلة التطبيق المنفصلة ستقرأ الملفات الحقيقية وتولّد الكود الكامل. يجب أن تكون قادراً على اقتراح تغييرات برمجية حقيقية، وليس مجرد وصف عام.
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
قواعد إضافية مهمة: لا تقترح حذف أو إعادة تسمية أي ملف. لا تضع أسراراً أو مفاتيح API في public أو كود المتصفح. يمكنك اختيار أي ملف موجود ف قائمة المستودع الي نرسلها لك، ويمكن إنشاء ملف جديد فقط عند الحاجة الواضحة. إذا احتاج الطلب خدمة خارجية غير مضبوطة، اذكر ذلك في risks أو clarifications. لا تضع أسراراً أو مفاتيح API في ملفات public أو كود المتصفح. إن كان الطلب مخالفاً للقيود (مثل حذف المشروع أو إعادة بنائه) اجعل feasible=false واشرح السبب في summary.`


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
  if (res.status === 404) throw new Error(`المسودع ${GITHUB_OWNER}/${GITHUB_REPO} غير موجود أو لا يملك الرمز صلاحية الوصول إليه`)
  if (res.status === 401) throw new Error("GITHUB_TOKEN غير صالح (401 Unauthorized)")
  if (res.status === 403) throw new Error("الرمز GITHUB_TOKEN ممنوع من الوصول (403) — تحقق من صلاحياته")
  if (!res.ok) throw new Error(`GitHub ${res.status}: تذر قراءة بيانات المستودع`)
  return await res.json()
}

// يحل الفرع الفعلي: يستخدم GITHUB_BRANCH إن ضُبط، وإلا الفرع الافتراضي احقيقي للمستودع.
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

// حذف ملف واد من المستودع عبر Contents API (ينشئ commit ويحافظ على كامل تاريخ الإصدارات — لا force push).
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
      return { connected: false, reason: "تعذر الاتصال بخوادم GitHub (مشكلة في اشكة)." }
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
    // روابط عامة (ليست أسراراً) لعرض سجل العديلات على GitHub الخاص بالمسؤول.
    historyUrl: `https://github.com/${fullName}/commits/${branch}`,
    repoUrl: `https://github.com/${fullName}`,
  }
}

// فحص مسبق تفصيلي قبل أي تطبيق تلقائي. يعيد ok=false مع سبب محدد جداً (أي متغير ناقص/أي صلاحية).
// لا يشف أبداً قيمة أي رمز مميز، فقط اسم لمتغير الناقص أو نوع المشكلة.
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
  // التحقق من أن الفرع المُحدد/الافتراضي قال لحل.
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
  const system = `أنت مبرمج ومطوّر ويب محترف (Senior Software Engineer) خبير في HTML وCSS وJavaScript وTypeScript وNext.js وReact وواجهات API. أنت مسؤول عن تعديل مشروع ويب موجود بشكل مباشر. سيُبّق ناتجك تلقائياً على مستودع GitHub بعد التحقق منه، لذا يجب أن يكون الكود كاملاً وصحيحاً وجاهزاً للتشغيل فوراً.

منهجية العمل الإلزامية قبل الكتابة:
1) ارأ محتوى كل ملف مُعطى وافهم بنيته وأسلوبه ووظائفه الحالية قبل أي تعديل.
2) حدد بدقة أصغر جز يجب تغييره لتحقيق الطلب، دون المساس ببقية الكود.
3) اكتب التعديل بنفس أسلوب بنية المشروع (نفس التسمية، نس المسافات البادئة، نفس نمط الدوال، اتجاه RTL العربي، ومتغيرات الأنماط الموجودة مثل var(--primary)).
4) بعد الكتابة راجع الكود ذهنياً وتأكد من خلوه من أخطاء ناء الجملة (syntax)، وأن الأقواس {} () [] والوسوم <tag></tag> والاقتباسات متوازنة ومغلقة، وأن أي دالة أ معرّف استُخدم معرّف فعلاً.

قواعد صرمة:
- لا تحذف ملفات ولا تعيد بناء المشروع من الصفر.
- عدّل أقل عدد ممكن من الملفات، وحافظ على كل الوظائف والتصميم الحالي وسلوك الصفحات القائمة.
- لا تضع أي سرّ أو API key أو Token في public أو في أي JavaScript يصل إل المتصفح؛ الأسرار تبقى على الخادم فقط.
- content يجب أن يكون المحتوى الكامل والنهائي للملف بعد التعديل، وليس diff، ودون اقتطاع أو حذف أجزاء لم تكن مقصودة بالتعديل.
- لا تُرجع ملفاً لم يتغير فعلاً.
- لا تُرجع أي مسار غير موجود في الملفات المعطاة إلا إذا كانت الخطة تقول create وكان إنشاء الملف ضرورياً.
- لا تنشئ أو تعل ملفات الأسرار مثل .env.
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
  if (!patches.length) throw new Error("لم ينتج الذكاء الاصطناعي عديلات قابلة للتطبيق")
  if (patches.length > 12) throw new Error("عدد التعديلات المقترحة يتجاوز الد الآمن")
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
    return json({ error: "طلب غير صالح", diagnostics: { executedOn: "server", keyConfigured: isOpenRouterConfigured() } }, 400)
  }

  const audioModes = new Set(["voice_print", "voice_match", "student_voice_intake", "grade_recitation"])
  const isAudioMode = typeof body?.mode === "string" && audioModes.has(body.mode)
  const diagnostics = {
  executedOn: "server",
  keyConfigured: isAudioMode ? isGeminiConfigured() : (isOpenRouterConfigured() || isGeminiConfigured()),
  providerStatus: 200,
  provider: isAudioMode ? "google-gemini" : "automatic",
  providerLabel: isAudioMode ? GEMINI.label : "Automatic AI provider",
  configuredModel: isAudioMode ? "gemini-3.6-flash" : (isOpenRouterConfigured() ? OPENROUTER.model : GEMINI.model),
  }

  try {
    // 1) وضع لنص الحر (صندوق اختبار الذاء الاصطناعي)
    if (typeof body.prompt === "string" && body.prompt.trim() && !body.mode) {
      const prompt = body.prompt.trim().slice(0, 6000)
      const reference = await getReferenceContext(prompt).catch(() => "")
      const text = await runText(
        `${reference ? `${reference}\n\n` : ""}السؤال:\n${prompt}`,
        "أجب عن أي سؤال مسموح، داخل موضوع المنصة أو خارجه. اجعل طول الإجابة على قدر السؤال فقط: إن كان بسيطاً فأجب بجمة قصيرة، ولا تضف تفصيلاً أو أمثلة إلا إذا طُلبت. استخدم المرجعين المرفقين عند فائدتهما في الأسئلة القرآنية للتحقق من الدقة، لكن لا تعتبرهما حدوداً لمعرفتك ولا المصدر الوحيد لإجابتك. لا تختلق نصاً قرآنياً. أعد الجواب مباشرة بلا تحية أو مقدمة أو عنوان أو خاتمة أو ذكر للنموذج أو للمرجع.",
        typeof body.temperature === "number" ? body.temperature : 0.35,
      )
      return json({ result: text.trim(), diagnostics })
    }

    const mode = body.mode as string
    const payload = body.payload || {}
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.15

    // 1.ب) المساعد الذكي للالب/ولي الأمر (ص حر مع سياق بيانات الطالب)
    if (mode === "assistant") {
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
      if (!prompt) return json({ error: "لم يصل نص السؤال", diagnostics }, 400)
      const reference = await getReferenceContext(prompt).catch(() => "")
      const text = await runText(
        `${reference ? `${reference}\n\n` : ""}السؤال:\n${prompt.slice(0, 6000)}`,
        "أنت OpenRouter، مساعد عربي طبيعي ودقيق. أجب عن أي سؤال مسموح داخل المنصة أو خارجها، وأعط الأولوية لبيانات المنصة فقط عندما تكون ذات صلة. اجعل طول الجواب على قدر السؤال: جواب مباشر وقصير للسؤال البسيط، وتفصيل منظم فقط عند طلبه. تعامل مع التحيات والعبارات الاجتماعية بصورة طبيعية؛ مثال: إذا قال المستخدم السلام عليكم فرد: وعليكم السلام ورحمة الله وبركاته 🥰 هل لديك سؤال؟ أنا في خدمتك! استخدم الرموز التعبيرية باعتدال في الحديث الودي فقط، وتجنبها في الإجابات العلمية أو الحساسة. استخدم لغة عربية بسيطة واحترافية ولا تكرر السؤال. في القرآن والمتشابهات استخدم مقتطفات المرجعين للتحقق عند توفها، لكن لا تحصر معرفتك فيهما، ولا تختلق آية أو معلومة.",
        typeof body.temperature === "number" ? body.temperature : 0.35,
      )
      return json({ result: text.trim(), diagnostics })
    }

    // 2) جلب نطاق السر المحدد كاملاً ثم توليد الأسئلة عبر OpenRouter.
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
      const useReferenceFiles = payload.useReferenceFiles !== false
      const referenceContext = useReferenceFiles
        ? await getReferenceContext(
            sourceSurahs.map((source) => source.surah).join(" "),
            sourceSurahs.flatMap((source) => source.verses.slice(0, 2).map((verse: { text: string }) => verse.text)),
          ).catch(() => "")
        : ""
      const pastScope = ["near", "far", "both"].includes(payload.pastScope) ? payload.pastScope : "both"
      const nearSurahs = Array.isArray(payload.nearSurahs) ? payload.nearSurahs.map(String).slice(0, 114) : []
      const farSurahs = Array.isArray(payload.farSurahs) ? payload.farSurahs.map(String).slice(0, 114) : []
      const previousQuestionFingerprints = Array.isArray(payload.previousQuestionFingerprints)
        ? payload.previousQuestionFingerprints.map(String).map((value: string) => value.slice(0, 240)).slice(0, 500)
        : []
      const safePayload = { plan, startSurahNumber, endSurahNumber, pastScope, nearSurahs, farSurahs, sourceSurahs, referenceContext, useReferenceFiles, previousQuestionFingerprints }
      const text = await runText(JSON.stringify(safePayload), SYS_EXAM + "\nالتزم بالسور الموجودة في sourceSurahs فقط. pastScope يحدد الماضي القريب أو البعيد أو كليهما؛ وعند both اجعل قرابة 70% من الأسئلة من nearSurahs و30% من farSurahs. استفد من referenceContext لصياغة أصعب المتشابهات والفروق اللفظية الدقيقة. نوّع صيغ الاختيار بين الآية التالية والتكملة واسم السورة والفارق اللفظي، وصيغ الصح والخطأ بين صحة التكملة وصحة نسبة الآية للسورة. لا تستخدم السورة والموضع نفسيهما مرتين قبل المرور على بقية السور. استبعد تماماً previousQuestionFingerprints. في complete وaudio لا تضع كلمات الإجابة في prompt أو stem؛ سيعرض النظام صورتي البداية والنهاية منفصلتين حتى إن كانتا من الآية نفسها. ممنوع إعادة كتابة أو تعديل نص أي آية.", temperature)
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
          .replace(/(?:الإجابة|الجواب)\s*(?:الصحية)?\s*[:：].*$/giu, "")
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
      let mimeType: string
      try { mimeType = normalizeAudioMimeType(payload.mimeType) } catch (error) { return json({ error: error instanceof Error ? error.message : "صيغة التسجيل غير مدعومة بواسطة جميناي", diagnostics }, 415) }
      if (!audioBase64) return json({ error: "لم يصل التسجيل الصوتي", diagnostics }, 400)
      if (audioBase64.length > 12_000_000) return json({ error: "التسجيل أكبر من الحد المسموح", diagnostics }, 413)

      const system = `أنت تستخرج بيانات طالب من إملاء عربي لمسؤول مدرسة. أعد JSON فقط بلا markdown بهذه المفاتيح حصراً:
transcript,name,username,national,phone,birth,studentPass,parent,parentPass,subjects,juz,surah,notes.
subjects مصفوفة نصوص، وبقية القيم نصوص. لا تخمّن أي قيمة لم تُذكر بوضوح؛ استخدم نصاً فارغاً أو مصفوفة فارغة. حوّل الأرقام العربية إلى إنجليزية. birth يجب أن يكون YYYY-MM-DD فقط إن أمكن فهم تاريخ كامل. national حدّه 14 رقماً وphone حدّه 11 رقماً. juz رقم من 1 إلى 30 كنص. انسخ كلمات المرور فقط إذا نطقها المسؤول صراحة. transcript هو التفريغ الكامل المسموع.`
      // جميناي يستمع للتسجيل ويملأ الحقول في خطوة واحدة، دون أي مزوّد بديل.
      const direct = await geminiAudio("استمع إلى هذا الإملاء العربي واستخرج بيانات الطالب منه. أعد JSON فقط.", system, 0.05, { mimeType, data: audioBase64 })
      const parsed = extractJson(direct)
      if (!parsed || typeof parsed !== "object") throw new Error("Gemini: تعذر فهم بيانات الطالب من التسجيل")
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

    // البصمة الصوتية: إنشاؤها بجميناي عند التسجيل الأول للطالب.
    if (mode === "voice_print" || mode === "voice_match") {
      const audioBase64 = typeof payload.audioBase64 === "string" ? payload.audioBase64 : ""
      let mimeType: string
      try { mimeType = normalizeAudioMimeType(payload.mimeType || "audio/wav") } catch (error) { return json({ error: error instanceof Error ? error.message : "صيغة التسجيل غير مدعومة بواسطة جميناي", diagnostics }, 415) }
      if (!audioBase64) return json({ error: "لم يصل التسجيل الصوتي", diagnostics }, 400)
      if (audioBase64.length > 12_000_000) return json({ error: "التسجيل أكبر من الحد المسموح", diagnostics }, 413)
      const audio = { mimeType, data: audioBase64 }

      if (mode === "voice_print") {
        const text = await geminiAudio("حلّل خصائص صوت المتحدث في هذا التسجيل وأنشئ بصمة صوتية وصفية. أعد JSON فقط.", SYS_VOICE_PRINT, 0.05, audio)
        const parsed = extractJson(text) || {}
        const speaker = parsed.speaker && typeof parsed.speaker === "object" ? parsed.speaker : {}
        return json({ result: {
          engine: "gemini",
          model: "gemini-3.6-flash",
          createdAt: new Date().toISOString(),
          speaker,
          quality: typeof parsed.quality === "string" ? parsed.quality : "good",
          usable: parsed.usable !== false,
          reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
        }, diagnostics })
      }

      const referenceProfile = payload.referenceProfile && typeof payload.referenceProfile === "object" ? payload.referenceProfile : null
      if (!referenceProfile) return json({ error: "لا توجد بصمة صوتية مرجعية محفوظة لهذا الحساب", diagnostics }, 400)
      const text = await geminiAudio(
        `البصمة المرجعية المحفوظة:\n${JSON.stringify(referenceProfile).slice(0, 4000)}\n\nقارن صوت هذا التسجيل بالبصمة المرجعية. أعد JSON فقط.`,
        SYS_VOICE_MATCH,
        0.05,
        audio,
      )
      const parsed = extractJson(text) || {}
      const matchPercent = Math.max(0, Math.min(100, Math.round(Number(parsed.matchPercent) || 0)))
      return json({ result: {
        engine: "gemini",
        sameSpeaker: parsed.sameSpeaker === true || (parsed.sameSpeaker !== false && matchPercent >= 70),
        matchPercent,
        confidence: typeof parsed.confidence === "string" ? parsed.confidence : "medium",
        quality: typeof parsed.quality === "string" ? parsed.quality : "good",
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "",
        profile: parsed.profile && typeof parsed.profile === "object" ? parsed.profile : {},
      }, diagnostics })
    }

    if (mode === "admin_assistant") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 3000) : ""
      if (!message) return json({ error: "اكتب رسالتك أولاً", diagnostics }, 400)
      const context = JSON.stringify(payload.context || {}).slice(0, 18_000)
      const reference = await getReferenceContext(message).catch(() => "")
      const result = await runText(`بيانات الموقع المنقحة:\n${context}\n\n${reference ? `${reference}\n\n` : ""}سؤال المسؤول:\n${message}`, "أنت OpenRouter، مساعد عربي دقيق واحترافي وطبيعي. أجب عن أي سؤال مسموح داخل الموقع أو خارجه، واستخدم بيانات الموقع عند صلتها فقط. افهم مقصد المستخدم قبل الرد، وميّز بوضوح بين الحقيقة والاقتراح، ولا تختلق بيانات أو آيات. اجعل الرد مبسطاً ومهذباً وعلى قدر السؤال، مع تنظيم الخطوات عند الحاجة فقط. رد على التحيات بصورة ودودة وطبيعية؛ فإذا قال المستخدم السلام عليكم فابدأ بـ: وعليكم السلام ورحمة الله وبركاته 🥰 هل لديك سؤال؟ 🤔 أنا في خدمتك! 🫡. استخدم الرموز التعبيرية باعتدال لتوضيح الحالة في الحديث الودي، وتجنبها في الردود العلمية والحساسة. استخدم المرجعين للمسائل القرآنية والمتشابهات للتحقق دون حصر معرفتك فيهما.", 0.2)
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
      let normalizedMimeType: string
      try { normalizedMimeType = normalizeAudioMimeType(mimeType) } catch (error) { return json({ error: error instanceof Error ? error.message : "صيغة التسجيل غير مدعومة بواسطة جميناي", diagnostics }, 415) }
      if (audioBase64.length > 12_000_000) return json({ error: "التسجيل أكبر من الحد المسموح", diagnostics }, 413)

      // جميناي وحده يستمع للتلاوة ويفرّغها ويقارنها بالمقطع المطلوب في خطوة واحدة.
      const direct = await geminiAudio(
        `المقطع المطلوب:\n${JSON.stringify({ surah, from, to, expectedText }).slice(0, 12_000)}\n\nاستمع إلى تلاوة الطالب، فرّغها ثم صححها مقابل المقطع المطلوب. أعد JSON فقط.`,
        SYS_TRANSCRIBE,
        0.05,
        { mimeType: normalizedMimeType, data: audioBase64 },
      )
      const parsed = extractJson(direct)
      if (!parsed || typeof parsed !== "object") throw new Error("Gemini: تعذر تحليل التلاوة")
      const transcript = typeof parsed.transcript === "string" ? parsed.transcript.trim() : ""
      const totalAyahs = Math.max(1, Number(to || from || 1) - Number(from || 1) + 1)
      const missingCount = Array.isArray(parsed.missingAyahs) ? Math.min(totalAyahs, parsed.missingAyahs.length) : 0
      const calculatedScore = Math.max(0, Math.min(1, (totalAyahs - missingCount) / totalAyahs))
      const modelScore = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : calculatedScore
      const score = missingCount > 0 ? Math.min(modelScore, calculatedScore) : modelScore
      return json({
        result: {
          transcript: transcript || String(parsed.transcript || ""),
          audioEngine: "gemini",
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

    // 6.أ) فحص جاهزية مساعد التطوير (للمسول) — يتحقق من المتغيرات والشبكة والمستودع والصلاحيات دون كش أي سرّ.
    if (mode === "dev_preflight") {
      if (payload?.role !== "admin") return json({ error: "هذه الميزة متاحة للمسؤول فقط", diagnostics }, 403)
      const pf = await preflightAutoApply()
      return json({
        result: {
          ready: pf.ok,
          reason: pf.reason || "",
          checks: {
            aiProviders: { openrouter: !!OPENROUTER.key, gemini: !!GEMINI.key, speechToText: !!(process.env.SPEECH_TO_TEXT_API_KEY || "").trim() },
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

    // 6) ماعد تطوير الموقع — تحليل فقط أو تطبيق تلقائي عند طلب المسؤول
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
      const userPrompt = `بنية المشروع الحالية:\n${PROJECT_MANIFEST}\n\nقائمة الملفات الفعلية في المسودع:\n${tree.files.join("\n")}\n\nطلب المسؤول:\n${request}\n\nحلّل الطلب وأعد خطة التعديل بصيغة JSON فقط كما هو محدد. اختر الملفات الفعلية من قائمة المستودع كلما أمكن.`
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
          const isProviderFailure = /OpenRouter|openrouter\.ai|rate.?limit|insufficient credits/i.test(failure.raw)
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
      if (!st.connected) return json({ error: st.reason || "لمزامنة مع GitHub غير متصلة", diagnostics }, 400)
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
          provider: ["voice_print", "voice_match", "student_voice_intake", "grade_recitation"].includes(mode) ? "google-gemini" : "automatic",
          keyConfigured: ["voice_print", "voice_match", "student_voice_intake", "grade_recitation"].includes(mode) ? isGeminiConfigured() : (isOpenRouterConfigured() || isGeminiConfigured()),
          stage,
          reason: failure.raw.slice(0, 300),
        },
      },
      failure.status,
    )
  }
}
