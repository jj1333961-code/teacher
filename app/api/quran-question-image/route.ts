import { readFile } from "node:fs/promises"
import path from "node:path"
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas"
import { normalizeQuranText } from "@/lib/quran-reference"

export const runtime = "nodejs"
export const maxDuration = 30

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])
const FRAME_PATH = path.join(process.cwd(), "public", "images", "ayah-frame.png")
const QURAN_FONT_PATH = path.join(process.cwd(), "node_modules", "@fontsource", "noto-naskh-arabic", "files", "noto-naskh-arabic-arabic-700-normal.woff")
const FRAME_AREA = { left: 0.12, top: 0.25, right: 0.88, bottom: 0.84 }
let framePromise: Promise<Image> | null = null
let fontReady = false

function ensureQuranFont() {
  if (!fontReady) fontReady = GlobalFonts.registerFromPath(QURAN_FONT_PATH, "Quran Naskh")
  return fontReady
}

function loadFrame() {
  if (!framePromise) {
    framePromise = readFile(FRAME_PATH).then((bytes) => loadImage(bytes))
    framePromise.catch(() => {
      framePromise = null
    })
  }
  return framePromise
}

async function getAyah(surah: number, ayah: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  const text = String(data?.data?.text || "").trim()
  if (!response.ok || !text) throw new Error("تعذر تحديد الآية المطلوبة")
  return text
}

function isolatedExcerpt(text: string, edge: "start" | "end", requestedWords: number) {
  const words = text.split(/\s+/u).filter(Boolean)
  const count = Math.max(3, Math.min(7, requestedWords, words.length))
  const selected = edge === "end" ? words.slice(-count) : words.slice(0, count)
  return selected.join(" ")
}

function fitFont(context: any, text: string, maxWidth: number) {
  let size = 92
  while (size > 48) {
    context.font = `700 ${size}px "Quran Naskh", serif`
    if (context.measureText(text).width <= maxWidth) break
    size -= 4
  }
  return size
}

async function renderIsolatedAyah(text: string) {
  ensureQuranFont()
  const frame = await loadFrame()
  const canvas = createCanvas(frame.width, frame.height)
  const context = canvas.getContext("2d")
  context.fillStyle = "#faf6ec"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(frame as any, 0, 0, canvas.width, canvas.height)

  const areaX = Math.round(canvas.width * FRAME_AREA.left)
  const areaY = Math.round(canvas.height * FRAME_AREA.top)
  const areaWidth = Math.round(canvas.width * (FRAME_AREA.right - FRAME_AREA.left))
  const areaHeight = Math.round(canvas.height * (FRAME_AREA.bottom - FRAME_AREA.top))
  const fontSize = fitFont(context as any, text, areaWidth - 36)

  context.save()
  context.direction = "rtl"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "#17211d"
  context.font = `700 ${fontSize}px "Quran Naskh", serif`
  context.fillText(text, areaX + areaWidth / 2, areaY + areaHeight / 2, areaWidth - 36)
  context.restore()
  return canvas
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const surah = Number(url.searchParams.get("surah"))
    const ayah = Number(url.searchParams.get("ayah"))
    const requestedType = url.searchParams.get("type") || "complete"
    const type = QUESTION_TYPES.has(requestedType) ? requestedType : "complete"
    const edge = url.searchParams.get("edge") === "end" ? "end" : "start"
    const requestedWords = Number(url.searchParams.get("words") || 7)

    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    const fullText = await getAyah(surah, ayah)
    const excerpt = isolatedExcerpt(fullText, edge, Number.isFinite(requestedWords) ? requestedWords : 7)
    if (normalizeQuranText(excerpt).split(" ").filter(Boolean).length < 1) throw new Error("تعذر تجهيز مقتطف الآية")

    const canvas = await renderIsolatedAyah(excerpt)
    const png = canvas.toBuffer("image/png")
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "Content-Disposition": `inline; filename="quran-${surah}-${ayah}-${edge}-${type}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجهيز صورة السؤال"
    return Response.json({ error: message.slice(0, 240) }, { status: 422 })
  }
}
