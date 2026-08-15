import { readFile } from "node:fs/promises"
import path from "node:path"
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas"

export const runtime = "nodejs"
export const maxDuration = 60

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])

// ===== الخطوط العربية (مضمّنة داخل المشروع حتى تعمل على Vercel) =====
const FRAME_PATH = path.join(process.cwd(), "public", "images", "ayah-frame.png")
const QURAN_FONT_PATH = path.join(process.cwd(), "public", "fonts", "AmiriQuran-Regular.ttf")
const TITLE_FONT_PATH = path.join(process.cwd(), "public", "fonts", "Amiri-Bold.ttf")

let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  try {
    GlobalFonts.registerFromPath(QURAN_FONT_PATH, "AmiriQuran")
    GlobalFonts.registerFromPath(TITLE_FONT_PATH, "AmiriTitle")
  } catch {
    // إن فشل التسجيل نكمل بالخط الافتراضي بدلاً من إسقاط الصورة بالكامل.
  }
  fontsReady = true
}

// إطار الزخرفة يُقرأ مرة واحدة ويُحفظ في الذاكرة لتسريع بقية الطلبات.
let framePromise: Promise<Awaited<ReturnType<typeof loadImage>>> | null = null
function loadFrame() {
  if (!framePromise) framePromise = readFile(FRAME_PATH).then((bytes) => loadImage(bytes))
  return framePromise
}

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
function arabicNumber(value: number) {
  return String(value)
    .split("")
    .map((digit) => ARABIC_DIGITS[Number(digit)] ?? digit)
    .join("")
}

async function getAyahRange(surah: number, from: number, to: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(10_000),
  })
  const data = await response.json().catch(() => null)
  const ayahs = Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
  const selected = ayahs.filter((entry: any) => Number(entry?.numberInSurah) >= from && Number(entry?.numberInSurah) <= to)
  if (!response.ok || !selected.length) throw new Error("تعذر تحديد الآيات المطلوبة")
  return {
    surahName: String(data?.data?.name || ""),
    verses: selected.map((entry: any) => ({
      number: Number(entry.numberInSurah),
      // بعض السور تبدأ بالبسملة داخل نص الآية الأولى؛ نتركها كما هي بالرسم العثماني.
      text: String(entry.text || "").replace(/\s+/g, " ").trim(),
    })),
  }
}

// نص الآيات مع علامات أرقام الآيات بالرسم العربي.
function buildText(verses: { number: number; text: string }[]) {
  return verses.map((verse) => `${verse.text} ﴿${arabicNumber(verse.number)}﴾`).join(" ")
}

// في العرض المقنّع نُظهر بداية المقطع فقط ثم نقاط مكان الجزء المطلوب إجابته.
function maskText(verses: { number: number; text: string }[]) {
  const first = verses[0]
  const words = first.text.split(" ").filter(Boolean)
  const shown = Math.max(2, Math.min(words.length - 1, Math.ceil(words.length * 0.45)))
  const visible = words.slice(0, shown).join(" ")
  return `${visible} ......................`
}

type Line = { text: string; width: number }

function wrapLines(context: SKRSContext2D, text: string, maxWidth: number): Line[] {
  const words = text.split(" ").filter(Boolean)
  const lines: Line[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
      continue
    }
    lines.push({ text: current, width: context.measureText(current).width })
    current = word
  }
  if (current) lines.push({ text: current, width: context.measureText(current).width })
  return lines
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
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || !Number.isInteger(to) || to < ayah) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    ensureFonts()
    const [range, frame] = await Promise.all([getAyahRange(surah, ayah, to), loadFrame()])
    // في أسئلة الإكمال والتلاوة نستخدم القناع لإخفاء الجزء المطلوب من الطالب.
    const shouldMask = display === "masked" && (type === "complete" || type === "audio" || range.verses.length === 1)
    const text = shouldMask ? maskText(range.verses) : buildText(range.verses)

    const canvas = createCanvas(frame.width, frame.height)
    const context = canvas.getContext("2d")
    context.drawImage(frame, 0, 0, frame.width, frame.height)

    // المحيط الداخلي الفارغ من الإطار الزخرفي: نكتب الآية داخله فقط.
    const areaX = Math.round(frame.width * 0.135)
    const areaWidth = Math.round(frame.width * 0.73)
    const areaY = Math.round(frame.height * 0.29)
    const areaHeight = Math.round(frame.height * 0.55)

    context.direction = "rtl"
    context.textAlign = "center"
    context.textBaseline = "middle"

    // نقلّص حجم الخط تدريجياً حتى يستقر النص كاملاً داخل المحيط.
    let fontSize = 74
    let lines: Line[] = []
    let lineHeight = 0
    for (; fontSize >= 26; fontSize -= 2) {
      context.font = `${fontSize}px AmiriQuran, "Amiri Quran", serif`
      lineHeight = Math.round(fontSize * 1.75)
      lines = wrapLines(context, text, areaWidth)
      if (lines.length * lineHeight <= areaHeight) break
    }
    if (lines.length * lineHeight > areaHeight) lines = lines.slice(0, Math.max(1, Math.floor(areaHeight / lineHeight)))

    // إحساس الطباعة على الورق: حرف داكن بلمسة حِبر وظل رقيق جداً.
    const centerX = areaX + areaWidth / 2
    const blockHeight = lines.length * lineHeight
    let cursorY = areaY + (areaHeight - blockHeight) / 2 + lineHeight / 2

    context.shadowColor = "rgba(32, 79, 69, 0.18)"
    context.shadowBlur = 2
    context.shadowOffsetY = 1
    context.fillStyle = "#1d3b34"
    context.globalAlpha = 0.94
    for (const line of lines) {
      context.fillText(line.text, centerX, cursorY)
      cursorY += lineHeight
    }
    context.globalAlpha = 1
    context.shadowColor = "transparent"
    context.shadowBlur = 0
    context.shadowOffsetY = 0

    // تصغير الناتج قليلاً لتقليل حجم الصورة مع بقاء النص واضحاً على الجوال.
    const outputWidth = Math.min(canvas.width, 1200)
    const outputHeight = Math.round((canvas.height * outputWidth) / canvas.width)
    const output = createCanvas(outputWidth, outputHeight)
    output.getContext("2d").drawImage(canvas, 0, 0, outputWidth, outputHeight)

    const png = output.toBuffer("image/png")
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجهيز صورة السؤال"
    return Response.json({ error: message.slice(0, 240) }, { status: 422 })
  }
}
