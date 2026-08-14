import { del, get, list, put } from "@vercel/blob"
import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TEXT_LENGTH = 200_000
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt"])

type ExamFileMeta = {
  id: string
  name: string
  pathname: string
  metadataPathname: string
  type: string
  size: number
  uploadedAt: string
  text: string
}

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_LENGTH)
}

async function extractText(buffer: Buffer, extension: string) {
  if (extension === "txt") return normalizeText(buffer.toString("utf8"))
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer })
    return normalizeText(result.value)
  }

  // pdf-parse يجب أن يبقى حزمة خادمية خارجية في next.config حتى يجد عامل PDF داخل node_modules.
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return normalizeText(result.text)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (/worker|pdf\.worker|fake worker/i.test(message)) {
      throw new Error("تعذر تشغيل قارئ PDF على الخادم. أعد المحاولة بعد تحديث الصفحة.")
    }
    throw error
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

async function readMetadata(pathname: string): Promise<ExamFileMeta | null> {
  try {
    const result = await get(pathname, { access: "private" })
    if (!result || result.statusCode !== 200) return null
    const text = await new Response(result.stream).text()
    if (!text.trim()) return null
    const parsed = JSON.parse(text) as Partial<ExamFileMeta>
    if (!parsed.id || !parsed.pathname || !parsed.metadataPathname) return null
    return parsed as ExamFileMeta
  } catch {
    // لا يجب أن يمنع ملف وصف تالف عرض بقية الملفات السليمة.
    return null
  }
}

function safeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback
  if (/token|secret|credential|api[_ -]?key/i.test(message)) return fallback
  return message.slice(0, 300) || fallback
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "exam-files/meta/" })
    const files = (await Promise.all(blobs.map((blob) => readMetadata(blob.pathname)))).filter(Boolean)
    return response({ files })
  } catch (error) {
    return response({ error: safeError(error, "تعذر تحميل الملفات") }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return response({ error: "اختر ملفاً صالحاً" }, 400)
    if (!file.size || file.size > MAX_FILE_SIZE) return response({ error: "حجم الملف يجب ألا يتجاوز 10 ميجابايت" }, 400)
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.has(extension)) return response({ error: "الأنواع المدعومة: PDF وDOCX وTXT" }, 415)

    const id = crypto.randomUUID()
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-120)
    const pathname = `exam-files/content/${id}-${safeName}`
    const metadataPathname = `exam-files/meta/${id}.json`
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractText(buffer, extension)
    if (text.length < 80) return response({ error: "لم نستطع استخراج نص كافٍ من الملف" }, 422)

    const uploaded = await put(pathname, buffer, { access: "private", contentType: file.type || "application/octet-stream", addRandomSuffix: false })
    const metadata: ExamFileMeta = { id, name: file.name, pathname: uploaded.pathname, metadataPathname, type: extension, size: file.size, uploadedAt: new Date().toISOString(), text }
    await put(metadataPathname, JSON.stringify(metadata), { access: "private", contentType: "application/json", addRandomSuffix: false })
    return response({ file: metadata }, 201)
  } catch (error) {
    return response({ error: safeError(error, "تعذر رفع الملف") }, 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { pathname, metadataPathname } = await request.json()
    if (typeof pathname !== "string" || typeof metadataPathname !== "string" || !pathname.startsWith("exam-files/content/") || !metadataPathname.startsWith("exam-files/meta/")) return response({ error: "بيانات الحذف غير صالحة" }, 400)
    await del([pathname, metadataPathname])
    return response({ success: true })
  } catch (error) {
    return response({ error: safeError(error, "تعذر حذف الملف") }, 500)
  }
}
