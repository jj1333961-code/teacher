import path from "node:path"
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas"

export const runtime = "nodejs"
export const maxDuration = 30

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])

// ===== الخط القرآني =====
// نطبع الآية بخط "أميري قرآن" العثماني بدل اقتطاعها من ملف PDF، لأن طبقة النص في
// ملف المصحف مشفّرة بخطوط مخصّصة فتعيد رموزاً غير قابلة للمطابقة، وكان ذلك يسبب
// اقتطاع صفحة خاطئة أو مساحة فارغة.
const FONT_FAMILY = "AmiriQuran"
let fontReady = false
function ensureFont() {
  if (fontReady) return
  try {
    GlobalFonts.registerFromPath(path.join(process.cwd(), "public", "fonts", "AmiriQuran-Regular.ttf"), FONT_FAMILY)
  } catch {}
  fontReady = true
}

// ===== الإطار المزخرف =====
const FRAME_PATH = path.join(process.cwd(), "public", "ayah-frame.png")
// المساحة الفارغة في منتصف الإطار، بعيداً عن القوس والميدالية أعلاه وعن الفاصل أسفله.
const FRAME_CONTENT = { x: 175, y: 300, width: 1190, height: 540 }
const INK = "#1b2a26"
let framePromise: Promise<any> | null = null
function loadFrame() {
  if (!framePromise) framePromise = loadImage(FRAME_PATH).catch(() => null)
  return framePromise
}

async function getAyahText(surah: number, from: number, to: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(10_000),
  })
  const data = await response.json().catch(() => null)
  const ayahs = Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
  const selected = ayahs.filter((entry: any) => {
    const number = Number(entry?.numberInSurah)
    return number >= from && number <= to
  })
  if (!response.ok || !selected.length) throw new Error("تعذر تحديد الآيات المطلوبة")
  return {
    // نضع رقم الآية بين قوسي الآية العثمانيين بعد كل آية كما في المصحف.
    text: selected
      .map((entry: any) => `${String(entry.text || "").trim()} ﴿${toArabicDigits(Number(entry.numberInSurah))}﴾`)
      .join(" ")
      .trim(),
    surahName: String(data?.data?.name || "").trim(),
  }
}

function toArabicDigits(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])
}

// تقسيم النص إلى أسطر تناسب عرض الإطار عند حجم خط معيّن.
function wrapText(context: any, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// نبحث عن أكبر حجم خط يجعل النص كله داخل المساحة الوسطى من الإطار.
function fitText(context: any, text: string, box: { width: number; height: number }) {
  for (let size = 96; size >= 26; size -= 2) {
    context.font = `${size}px "${FONT_FAMILY}"`
    const lineHeight = Math.round(size * 1.72)
    const lines = wrapText(context, text, box.width)
    if (lines.length * lineHeight <= box.height) return { size, lineHeight, lines }
  }
  context.font = `26px "${FONT_FAMILY}"`
  return { size: 26, lineHeight: 45, lines: wrapText(context, text, box.width) }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const surah = Number(url.searchParams.get("surah"))
    const ayah = Number(url.searchParams.get("ayah"))
    const to = Number(url.searchParams.get("to") || ayah)
    const requestedType = url.searchParams.get("type") || "complete"
    const type = QUESTION_TYPES.has(requestedType) ? requestedType : "complete"
    const display = url.searchParams.get("display") === "masked" ? "masked" : "anchor"
    // اختياري: طباعة جزء محدد من الآية فقط (بالكلمات، بدءاً من 1).
    const wordFrom = Number(url.searchParams.get("wordFrom") || 0)
    const wordTo = Number(url.searchParams.get("wordTo") || 0)
    const showLabel = url.searchParams.get("label") === "1"

    if (
      !Number.isInteger(surah) || surah < 1 || surah > 114 ||
      !Number.isInteger(ayah) || ayah < 1 ||
      !Number.isInteger(to) || to < ayah
    ) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    ensureFont()
    const [{ text: fullText, surahName }, frame] = await Promise.all([getAyahText(surah, ayah, to), loadFrame()])

    let text = fullText
    if (wordFrom > 0) {
      const words = fullText.split(/\s+/).filter(Boolean)
      const start = Math.max(0, wordFrom - 1)
      const end = wordTo > 0 ? Math.min(words.length, wordTo) : words.length
      const part = words.slice(start, end).join(" ")
      if (part) text = part
    }
    if (display === "masked") {
      // نُخفي النصف الأخير من المقطع بنقاط الحذف، فيبقى مطلع الآية دليلاً فقط.
      const words = text.split(/\s+/).filter(Boolean)
      const keep = Math.max(1, Math.ceil(words.length / 2))
      text = `${words.slice(0, keep).join(" ")} ⋯⋯⋯⋯`
    }

    const width = frame?.width || 1536
    const height = frame?.height || 1024
    const output = createCanvas(width, height)
    const context = output.getContext("2d")

    if (frame) {
      context.drawImage(frame, 0, 0, width, height)
    } else {
      // احتياط بلون ورق الإطار نفسه إن تعذّر تحميل الصورة.
      context.fillStyle = "#f7f1e4"
      context.fillRect(0, 0, width, height)
    }

    const box = { ...FRAME_CONTENT }
    if (showLabel) box.height -= 70

    context.direction = "rtl"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = INK
    // دمج multiply يجعل النص يبدو مطبوعاً على ورق الإطار لا ملصقاً فوقه.
    context.globalCompositeOperation = "multiply"

    const { lineHeight, lines } = fitText(context, text, box)
    const blockHeight = lines.length * lineHeight
    const centerX = box.x + box.width / 2
    let cursorY = box.y + (box.height - blockHeight) / 2 + lineHeight / 2
    for (const line of lines) {
      context.fillText(line, centerX, cursorY)
      cursorY += lineHeight
    }

    if (showLabel && surahName) {
      context.font = `34px "${FONT_FAMILY}"`
      context.fillStyle = "#8a6c3b"
      const range = to === ayah ? toArabicDigits(ayah) : `${toArabicDigits(ayah)} - ${toArabicDigits(to)}`
      context.fillText(`${surahName} • ${range}`, centerX, FRAME_CONTENT.y + FRAME_CONTENT.height - 24)
    }

    context.globalCompositeOperation = "source-over"

    const png = output.toBuffer("image/png")
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Question-Type": type,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجهيز صورة السؤال"
    return Response.json({ error: message.slice(0, 240) }, { status: 422 })
  }
}
