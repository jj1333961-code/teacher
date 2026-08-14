import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { getQuranPdfBytes, normalizeQuranText } from "@/lib/quran-reference"

export const runtime = "nodejs"
export const maxDuration = 60

// PDF.js expects these browser canvas globals even when rendering through napi-rs/canvas.
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D })

async function getAyah(surah: number, ayah: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.data?.text) throw new Error("تعذر تحديد الآية المطلوبة")
  return { text: String(data.data.text), page: Number(data.data.page) || 1 }
}

function itemText(item: any) {
  return typeof item?.str === "string" ? item.str : ""
}

async function getPageAyahs(page: number) {
  const response = await fetch(`https://api.alquran.cloud/v1/page/${page}/quran-uthmani`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(8_000),
  })
  const data = await response.json().catch(() => null)
  return Array.isArray(data?.data?.ayahs) ? data.data.ayahs : []
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const surah = Number(url.searchParams.get("surah"))
    const ayah = Number(url.searchParams.get("ayah"))
    const to = Number(url.searchParams.get("to") || ayah)
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || !Number.isInteger(to) || to < ayah || to - ayah > 20) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    const [targetAyahs, pdfBytes] = await Promise.all([Promise.all(Array.from({ length: to - ayah + 1 }, (_, index) => getAyah(surah, ayah + index))), getQuranPdfBytes()])
    const targetData = targetAyahs[0]
    const target = targetAyahs.map((entry) => entry.text).join(" ")
    const targetWords = normalizeQuranText(target).split(" ").filter(Boolean)
    if (targetWords.length < 2) throw new Error("تعذر تجهيز نص الآية")

    const document = await getDocument({ data: pdfBytes, useSystemFonts: true, isEvalSupported: false }).promise
    let selected: { page: any; items: any[] } | null = null

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = (content.items as any[]).filter((item) => itemText(item))
      const words = items.map((item) => normalizeQuranText(itemText(item)))
      const pageText = words.join(" ")
      const signature = targetWords.slice(0, Math.min(5, targetWords.length)).join(" ")
      if (!pageText.includes(signature)) continue

      const wanted = new Set(targetWords)
      const matchedItems = items.filter((item) => {
        const normalized = normalizeQuranText(itemText(item))
        const parts = normalized.split(" ")
        return parts.some((word) => wanted.has(word))
      })
      if (matchedItems.length >= 2) {
        selected = { page, items: matchedItems }
        break
      }
    }

    let pageAyahs: any[] = []
    if (!selected) {
      const estimatedPdfPage = Math.max(1, Math.min(document.numPages, Math.round(((targetData.page - 1) / 603) * (document.numPages - 1)) + 1))
      selected = { page: await document.getPage(estimatedPdfPage), items: [] }
      pageAyahs = await getPageAyahs(targetData.page)
    }

    const viewport = selected.page.getViewport({ scale: 1.7 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext("2d")
    await selected.page.render({ canvasContext: context as any, viewport, canvas: canvas as any }).promise

    context.fillStyle = "#f8f5ec"
    context.strokeStyle = "#204f45"
    context.lineWidth = 2
    for (const item of selected.items) {
      const x = Number(item.transform?.[4] || 0)
      const y = Number(item.transform?.[5] || 0)
      const width = Math.max(Number(item.width || 0), 12)
      const height = Math.max(Math.abs(Number(item.height || item.transform?.[3] || 0)), 12)
      const [left, bottom, right, top] = viewport.convertToViewportRectangle([x, y, x + width, y + height])
      const rectX = Math.min(left, right) - 5
      const rectY = Math.min(bottom, top) - 5
      const rectWidth = Math.abs(right - left) + 10
      const rectHeight = Math.abs(top - bottom) + 10
      context.fillRect(rectX, rectY, rectWidth, rectHeight)
      context.strokeRect(rectX, rectY, rectWidth, rectHeight)
    }
    if (!selected.items.length) {
      const lengths = pageAyahs.map((entry) => Math.max(1, normalizeQuranText(String(entry?.text || "")).length))
      const targetIndex = Math.max(0, pageAyahs.findIndex((entry) => Number(entry?.numberInSurah) === ayah && Number(entry?.surah?.number) === surah))
      const total = Math.max(1, lengths.reduce((sum, length) => sum + length, 0))
      const before = lengths.slice(0, targetIndex).reduce((sum, length) => sum + length, 0) / total
      const share = Math.max(0.06, (lengths[targetIndex] || target.length) / total)
      const compactFinalPage = pageAyahs.length > 0 && pageAyahs.length <= 12
      const textTop = canvas.height * (compactFinalPage ? 0.39 : 0.16)
      const textHeight = canvas.height * (compactFinalPage ? 0.54 : 0.68)
      const maskY = textTop + before * textHeight
      const maskHeight = Math.min(textHeight * share + 20, textHeight - before * textHeight)
      context.fillRect(canvas.width * 0.08, maskY, canvas.width * 0.84, Math.max(38, maskHeight))
      context.strokeRect(canvas.width * 0.08, maskY, canvas.width * 0.84, Math.max(38, maskHeight))
    }

    context.fillStyle = "#204f45"
    context.font = "bold 24px sans-serif"
    context.textAlign = "center"
    context.fillText("أكمل الآية المخفية", canvas.width / 2, 34)

    const png = canvas.toBuffer("image/png")
    await document.destroy()
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجهيز صورة السؤال"
    return Response.json({ error: message.slice(0, 240) }, { status: 422 })
  }
}
