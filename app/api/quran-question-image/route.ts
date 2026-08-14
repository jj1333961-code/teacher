import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { getQuranPdfBytes, normalizeQuranText } from "@/lib/quran-reference"

export const runtime = "nodejs"
export const maxDuration = 60

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D })

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])

async function getAyahRange(surah: number, from: number, to: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  const ayahs = Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
  const selected = ayahs.filter((entry: any) => Number(entry?.numberInSurah) >= from && Number(entry?.numberInSurah) <= to)
  if (!response.ok || !selected.length) throw new Error("تعذر تحديد الآيات المطلوبة")
  return {
    text: selected.map((entry: any) => String(entry.text || "")).join(" "),
    page: Number(selected[0]?.page) || 1,
  }
}

async function getPageAyahs(page: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  return Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
}

function itemText(item: any) {
  return typeof item?.str === "string" ? item.str : ""
}

function itemRectangle(item: any, viewport: any) {
  const x = Number(item.transform?.[4] || 0)
  const y = Number(item.transform?.[5] || 0)
  const width = Math.max(Number(item.width || 0), 12)
  const height = Math.max(Math.abs(Number(item.height || item.transform?.[3] || 0)), 12)
  const [left, bottom, right, top] = viewport.convertToViewportRectangle([x, y, x + width, y + height])
  return {
    x: Math.min(left, right),
    y: Math.min(bottom, top),
    width: Math.abs(right - left),
    height: Math.abs(top - bottom),
  }
}

export async function GET(request: Request) {
  let document: any = null
  try {
    const url = new URL(request.url)
    const surah = Number(url.searchParams.get("surah"))
    const ayah = Number(url.searchParams.get("ayah"))
    const to = Number(url.searchParams.get("to") || ayah)
    const requestedType = url.searchParams.get("type") || "complete"
    const type = QUESTION_TYPES.has(requestedType) ? requestedType : "complete"
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || !Number.isInteger(to) || to < ayah) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    const [targetData, pdfBytes] = await Promise.all([getAyahRange(surah, ayah, to), getQuranPdfBytes()])
    const targetWords = normalizeQuranText(targetData.text).split(" ").filter(Boolean)
    if (targetWords.length < 2) throw new Error("تعذر تجهيز نص الآية")

    document = await getDocument({ data: pdfBytes, useSystemFonts: true, isEvalSupported: false }).promise
    let selected: { page: any; items: any[] } | null = null

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = (content.items as any[]).filter((item) => itemText(item))
      const normalizedItems = items.map((item) => normalizeQuranText(itemText(item)))
      const pageText = normalizedItems.join(" ")
      const signature = targetWords.slice(0, Math.min(5, targetWords.length)).join(" ")
      if (!pageText.includes(signature)) continue

      const wanted = new Set(targetWords)
      const matchedItems = items.filter((item) => normalizeQuranText(itemText(item)).split(" ").some((word) => wanted.has(word)))
      if (matchedItems.length >= 2) {
        selected = { page, items: matchedItems }
        break
      }
    }

    let pageAyahs: any[] = []
    if (!selected) {
      const estimatedPage = Math.max(1, Math.min(document.numPages, Math.round(((targetData.page - 1) / 603) * (document.numPages - 1)) + 1))
      selected = { page: await document.getPage(estimatedPage), items: [] }
      pageAyahs = await getPageAyahs(targetData.page)
    }

    const viewport = selected.page.getViewport({ scale: 2 })
    const pageCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = pageCanvas.getContext("2d")
    await selected.page.render({ canvasContext: context as any, viewport, canvas: pageCanvas as any }).promise

    let cropX = Math.round(pageCanvas.width * 0.06)
    let cropY = Math.round(pageCanvas.height * 0.2)
    let cropWidth = Math.round(pageCanvas.width * 0.88)
    let cropHeight = Math.round(pageCanvas.height * 0.28)
    const rectangles = selected.items.map((item) => itemRectangle(item, viewport))

    if (rectangles.length) {
      const left = Math.min(...rectangles.map((rect) => rect.x))
      const top = Math.min(...rectangles.map((rect) => rect.y))
      const right = Math.max(...rectangles.map((rect) => rect.x + rect.width))
      const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height))
      const paddingX = 36
      const paddingY = type === "complete" ? 100 : 48
      cropX = Math.max(0, Math.floor(left - paddingX))
      cropY = Math.max(0, Math.floor(top - paddingY))
      cropWidth = Math.min(pageCanvas.width - cropX, Math.ceil(right - left + paddingX * 2))
      cropHeight = Math.min(pageCanvas.height - cropY, Math.ceil(bottom - top + paddingY * 2))
    } else if (pageAyahs.length) {
      const lengths = pageAyahs.map((entry) => Math.max(1, normalizeQuranText(String(entry?.text || "")).length))
      const targetIndex = Math.max(0, pageAyahs.findIndex((entry) => Number(entry?.numberInSurah) === ayah && Number(entry?.surah?.number) === surah))
      const total = Math.max(1, lengths.reduce((sum, length) => sum + length, 0))
      const before = lengths.slice(0, targetIndex).reduce((sum, length) => sum + length, 0) / total
      const share = Math.max(0.07, (lengths[targetIndex] || targetData.text.length) / total)
      const textTop = pageCanvas.height * (pageAyahs.length <= 12 ? 0.38 : 0.15)
      const textHeight = pageCanvas.height * (pageAyahs.length <= 12 ? 0.54 : 0.7)
      cropY = Math.max(0, Math.round(textTop + before * textHeight - 70))
      cropHeight = Math.min(pageCanvas.height - cropY, Math.max(150, Math.round(textHeight * share + 140)))
    }

    if (type === "complete") {
      context.fillStyle = "#f8f5ec"
      context.strokeStyle = "#204f45"
      context.lineWidth = 2
      if (rectangles.length) {
        for (const rect of rectangles) {
          context.fillRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10)
          context.strokeRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10)
        }
      } else {
        context.fillRect(cropX + 12, cropY + 55, cropWidth - 24, Math.max(48, cropHeight - 110))
        context.strokeRect(cropX + 12, cropY + 55, cropWidth - 24, Math.max(48, cropHeight - 110))
      }
    }

    cropWidth = Math.max(1, Math.min(cropWidth, pageCanvas.width - cropX))
    cropHeight = Math.max(1, Math.min(cropHeight, pageCanvas.height - cropY))
    const output = createCanvas(cropWidth, cropHeight)
    const outputContext = output.getContext("2d")
    outputContext.fillStyle = "#f8f5ec"
    outputContext.fillRect(0, 0, cropWidth, cropHeight)
    outputContext.drawImage(pageCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

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
  } finally {
    await document?.destroy().catch(() => undefined)
  }
}
