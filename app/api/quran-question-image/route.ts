import path from "node:path"
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { getQuranPdfBytes, normalizeQuranText } from "@/lib/quran-reference"

export const runtime = "nodejs"
export const maxDuration = 60

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D })

const QUESTION_TYPES = new Set(["mcq", "truefalse", "complete", "audio"])

// إزاحة الصفحة المتعلّمة بين ترقيم المصدر (604 صفحات) وملف المصحف المرفق.
let learnedPageOffset = 0

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

// ===== إطار الآية المزخرف =====
// نطبع مقطع الآية المقتطع من المصحف داخل الإطار الزخرفي، في المساحة الفارغة
// بمنتصفه، بأسلوب دمج multiply حتى يبدو النص مطبوعاً على الورق نفسه.
const FRAME_PATH = path.join(process.cwd(), "public", "ayah-frame.png")
// المساحة الآمنة داخل الإطار (بعيداً عن القوس والميدالية أعلاه وعن الفاصل أسفله).
const FRAME_CONTENT = { x: 196, y: 306, width: 1148, height: 520 }
let framePromise: Promise<any> | null = null

function loadFrame() {
  if (!framePromise) framePromise = loadImage(FRAME_PATH).catch(() => null)
  return framePromise
}

async function composeFramedAyah(
  pageCanvas: any,
  crop: { cropX: number; cropY: number; cropWidth: number; cropHeight: number },
) {
  const { cropX, cropY, cropWidth, cropHeight } = crop
  const frame = await loadFrame()
  if (!frame) {
    // احتياط: إن تعذّر تحميل الإطار نُعيد القصاصة كما هي بدل فشل السؤال.
    const plain = createCanvas(cropWidth, cropHeight)
    const plainContext = plain.getContext("2d")
    plainContext.fillStyle = "#f8f5ec"
    plainContext.fillRect(0, 0, cropWidth, cropHeight)
    plainContext.drawImage(pageCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
    return plain
  }

  const output = createCanvas(frame.width, frame.height)
  const context = output.getContext("2d")
  context.drawImage(frame, 0, 0, frame.width, frame.height)

  // نجهّز القصاصة على لوحة مستقلة ونبيّض خلفيتها لتذوب في ورق الإطار.
  const clip = createCanvas(cropWidth, cropHeight)
  const clipContext = clip.getContext("2d")
  clipContext.fillStyle = "#ffffff"
  clipContext.fillRect(0, 0, cropWidth, cropHeight)
  clipContext.drawImage(pageCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

  // نقتطع الهوامش الفارغة حول النص حتى تتوسّط الآية داخل الإطار تماماً.
  const ink = inkBounds(clipContext, cropWidth, cropHeight)
  const scale = Math.min(FRAME_CONTENT.width / ink.width, FRAME_CONTENT.height / ink.height, 1.9)
  const drawWidth = Math.max(1, Math.round(ink.width * scale))
  const drawHeight = Math.max(1, Math.round(ink.height * scale))
  const drawX = Math.round(FRAME_CONTENT.x + (FRAME_CONTENT.width - drawWidth) / 2)
  const drawY = Math.round(FRAME_CONTENT.y + (FRAME_CONTENT.height - drawHeight) / 2)

  context.save()
  context.globalCompositeOperation = "multiply"
  context.drawImage(clip, ink.x, ink.y, ink.width, ink.height, drawX, drawY, drawWidth, drawHeight)
  context.restore()
  return output
}

// حدود الحبر الفعلي داخل القصاصة (أي البكسلات غير الفارغة).
function inkBounds(context: any, width: number, height: number) {
  try {
    const { data } = context.getImageData(0, 0, width, height)
    let left = width, top = height, right = 0, bottom = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4
        // نعتبر البكسل حبراً إذا كان أغمق بوضوح من ورق المصحف الفاتح.
        if (data[index] < 205 || data[index + 1] < 205 || data[index + 2] < 195) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (right <= left || bottom <= top) return { x: 0, y: 0, width, height }
    const padding = 14
    const x = Math.max(0, left - padding)
    const y = Math.max(0, top - padding)
    return {
      x,
      y,
      width: Math.min(width - x, right - left + padding * 2),
      height: Math.min(height - y, bottom - top + padding * 2),
    }
  } catch {
    return { x: 0, y: 0, width, height }
  }
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
    const display = url.searchParams.get("display") === "anchor" ? "anchor" : "masked"
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || !Number.isInteger(to) || to < ayah) {
      return Response.json({ error: "مرجع الآية غير صالح" }, { status: 400 })
    }

    const [targetData, pdfBytes] = await Promise.all([getAyahRange(surah, ayah, to), getQuranPdfBytes()])
    const targetWords = normalizeQuranText(targetData.text).split(" ").filter(Boolean)
    if (targetWords.length < 2) throw new Error("تعذر تجهيز نص الآية")

    document = await getDocument({ data: pdfBytes, useSystemFonts: true, isEvalSupported: false }).promise
    let selected: { page: any; items: any[] } | null = null
    // ملف المصحف لدينا 569 صفحة بينما ترقيم المصدر 604، فالتقدير الخطي يزيغ بعدة
    // صفحات. لذلك نبحث بشكل حلزوني حول التقدير، ونتعلّم الإزاحة الناجحة ونعيد
    // استخدامها في الطلبات التالية حتى تُصاب الصفحة من المحاولة الأولى.
    const estimatedPage = Math.max(1, Math.min(document.numPages, Math.round(((targetData.page - 1) / 603) * (document.numPages - 1)) + 1))
    const base = Math.max(1, Math.min(document.numPages, estimatedPage + learnedPageOffset))
    const spiral: number[] = [base]
    for (let step = 1; step <= 22; step++) spiral.push(base + step, base - step)
    const candidatePages = Array.from(new Set(spiral)).filter((pageNumber) => pageNumber >= 1 && pageNumber <= document.numPages)

    for (const pageNumber of candidatePages) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = (content.items as any[]).filter((item) => itemText(item))
      const normalizedItems = items.map((item) => normalizeQuranText(itemText(item)))
      const pageText = normalizedItems.join(" ")
      const signature = targetWords.slice(0, Math.min(5, targetWords.length)).join(" ")
      if (!pageText.includes(signature)) continue

      const wanted = new Set(targetWords.filter((word) => word.length > 2))
      const targetNormalized = normalizeQuranText(targetData.text)
      const matchedItems = items.filter((item) => {
        const normalized = normalizeQuranText(itemText(item))
        const words = normalized.split(" ").filter((word) => word.length > 2)
        const score = words.filter((word) => wanted.has(word)).length
        const overlap = score / Math.max(1, Math.min(words.length, wanted.size))
        // لا يكفي تشابه كلمة أو كلمتين؛ فهذا كان يُدخل أسطراً من الآيات المجاورة.
        return normalized.includes(targetNormalized) || targetNormalized.includes(normalized) || (score >= 3 && overlap >= 0.72)
      })
      if (matchedItems.length) {
        selected = { page, items: matchedItems }
        learnedPageOffset = pageNumber - estimatedPage
        break
      }
    }

    let pageAyahs: any[] = []
    if (!selected) {
      selected = { page: await document.getPage(estimatedPage), items: [] }
      pageAyahs = await getPageAyahs(targetData.page)
    }

    const viewport = selected.page.getViewport({ scale: 3 })
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
      // قصّ محكم حول الآية المطلوبة؛ لا نترك مساحة تكفي لظهور آية مجاورة.
      const paddingX = 28
      const paddingY = 28
      cropX = Math.max(0, Math.floor(left - paddingX))
      cropY = Math.max(0, Math.floor(top - paddingY))
      cropWidth = Math.min(pageCanvas.width - cropX, Math.ceil(right - left + paddingX * 2))
      cropHeight = Math.min(pageCanvas.height - cropY, Math.ceil(bottom - top + paddingY * 2))
      if (to === ayah) {
        // بعض ملفات المصحف تعيد سطر الصفحة كاملاً كعنصر نصي واحد؛ نحد القص بعدد
        // الأسطر المتوقع للآية حتى لا يظهر أول سطر من الآية التالية.
        const expectedLines = Math.max(1, Math.ceil(normalizeQuranText(targetData.text).length / 52))
        cropHeight = Math.min(cropHeight, expectedLines * 190 + paddingY)
      }

      // ظل بلون خلفية المصحف فوق أي نص يقع خارج حدود الآية داخل القصاصة.
      context.fillStyle = "#f8f5ec"
      const safeTop = Math.max(cropY, Math.floor(top - 10))
      const safeBottom = Math.min(cropY + cropHeight, Math.ceil(bottom + 10))
      if (safeTop > cropY) context.fillRect(cropX, cropY, cropWidth, safeTop - cropY)
      if (safeBottom < cropY + cropHeight) context.fillRect(cropX, safeBottom, cropWidth, cropY + cropHeight - safeBottom)
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

    // في الصورة المقنّعة نخفي نطاق الإجابة. أما صورة anchor فتُستخدم فقط
    // لعرض آية البداية أو النهاية منفردة في سؤال التلاوة/الإكمال.
    if (display === "masked") {
      context.fillStyle = "#f8f5ec"
      context.strokeStyle = "#204f45"
      context.lineWidth = 3
      if (rectangles.length) {
        for (const rect of rectangles) {
          context.fillRect(rect.x - 10, rect.y - 10, rect.width + 20, rect.height + 20)
          context.strokeRect(rect.x - 10, rect.y - 10, rect.width + 20, rect.height + 20)
        }
      } else {
        const maskX = cropX + 18
        const maskY = cropY + Math.max(36, Math.round(cropHeight * 0.2))
        const maskWidth = Math.max(1, cropWidth - 36)
        const maskHeight = Math.max(84, Math.round(cropHeight * 0.6))
        context.fillRect(maskX, maskY, maskWidth, Math.min(maskHeight, pageCanvas.height - maskY))
        context.strokeRect(maskX, maskY, maskWidth, Math.min(maskHeight, pageCanvas.height - maskY))
      }
    }

    cropWidth = Math.max(1, Math.min(cropWidth, pageCanvas.width - cropX))
    cropHeight = Math.max(1, Math.min(cropHeight, pageCanvas.height - cropY))
    const output = await composeFramedAyah(pageCanvas, { cropX, cropY, cropWidth, cropHeight })

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
