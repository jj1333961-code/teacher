import { createCanvas } from "@napi-rs/canvas"

export const runtime = "nodejs"
export const maxDuration = 30

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])
const BACKGROUND = "#f8f5ec"
const INK = "#173f37"

async function getAyahRange(surah: number, from: number, to: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  const ayahs = Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
  const selected = ayahs.filter((entry: any) => Number(entry?.numberInSurah) >= from && Number(entry?.numberInSurah) <= to)
  if (!response.ok || !selected.length) throw new Error("تعذر تحديد الآيات المطلوبة")
  return selected.map((entry: any) => String(entry.text || "").trim()).filter(Boolean).join(" ")
}

function wrapArabicText(context: any, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  if (current) lines.push(current)
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

    const text = await getAyahRange(surah, ayah, to)
    const measureCanvas = createCanvas(1200, 300)
    const measureContext = measureCanvas.getContext("2d")
    measureContext.font = "58px serif"
    const lines = wrapArabicText(measureContext, text, 1040)
    const width = 1200
    const height = Math.max(250, 105 + lines.length * 92)
    const canvas = createCanvas(width, height)
    const context = canvas.getContext("2d")

    context.fillStyle = BACKGROUND
    context.fillRect(0, 0, width, height)
    context.strokeStyle = "#b8aa83"
    context.lineWidth = 3
    context.strokeRect(18, 18, width - 36, height - 36)
    context.strokeStyle = "#d8cda9"
    context.lineWidth = 1
    context.strokeRect(30, 30, width - 60, height - 60)

    if (display === "masked") {
      context.fillStyle = "#eee8d8"
      context.fillRect(64, 64, width - 128, height - 128)
      context.strokeStyle = INK
      context.setLineDash([14, 10])
      context.strokeRect(64, 64, width - 128, height - 128)
    } else {
      context.fillStyle = INK
      context.textAlign = "center"
      context.direction = "rtl"
      context.font = "58px serif"
      lines.forEach((line, index) => context.fillText(line, width / 2, 102 + index * 92, width - 140))
    }

    const png = canvas.toBuffer("image/png")
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="quran-${surah}-${ayah}-${to}-${type}.png"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجهيز صورة السؤال"
    return Response.json({ error: message.slice(0, 240) }, { status: 422 })
  }
}
