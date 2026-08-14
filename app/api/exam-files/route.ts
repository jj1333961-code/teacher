import { del, get, put } from "@vercel/blob"
import mammoth from "mammoth"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TEXT_LENGTH = 240_000
const ROLES = {
  mushaf: { pathname: "references/quran.pdf", metadataPathname: "references/meta/mushaf.json", extensions: new Set(["pdf"]) },
  mutashabihat: { pathname: "references/mutashabihat", metadataPathname: "references/meta/mutashabihat.json", extensions: new Set(["pdf", "docx", "txt"]) },
} as const

type ReferenceRole = keyof typeof ROLES
type ReferenceMeta = { role: ReferenceRole; name: string; pathname: string; metadataPathname: string; type: string; size: number; uploadedAt: string; textLength: number }

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_LENGTH)
}

async function extractText(buffer: Buffer, extension: string) {
  if (extension === "txt") return normalizeText(buffer.toString("utf8"))
  if (extension === "docx") return normalizeText((await mammoth.extractRawText({ buffer })).value)
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try { return normalizeText((await parser.getText()).text) } finally { await parser.destroy().catch(() => undefined) }
}

async function readMeta(role: ReferenceRole): Promise<ReferenceMeta | null> {
  try {
    const result = await get(ROLES[role].metadataPathname, { access: "private" })
    if (!result || result.statusCode !== 200) return null
    const parsed = JSON.parse(await new Response(result.stream).text()) as ReferenceMeta & { text?: string }
    const { text: _text, ...meta } = parsed
    return meta
  } catch { return null }
}

function safeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback
  if (/token|secret|credential|api[_ -]?key/i.test(message)) return fallback
  return message.slice(0, 300) || fallback
}

function ensureConfigured() {
  if (!(process.env.BLOB_READ_WRITE_TOKEN || "").trim()) throw new Error("خدمة حفظ المراجع غير مهيأة على الخادم")
}

function isRole(value: unknown): value is ReferenceRole { return value === "mushaf" || value === "mutashabihat" }

export async function GET() {
  try {
    ensureConfigured()
    const references = (await Promise.all((Object.keys(ROLES) as ReferenceRole[]).map(readMeta))).filter(Boolean)
    return response({ references })
  } catch (error) { return response({ error: safeError(error, "تعذر تحميل المراجع") }, 503) }
}

export async function POST(request: Request) {
  let temporaryPath = ""
  try {
    ensureConfigured()
    const form = await request.formData()
    const file = form.get("file")
    const role = form.get("role")
    if (!(file instanceof File) || !isRole(role)) return response({ error: "اختر الملف ونوع المرجع" }, 400)
    if (!file.size || file.size > MAX_FILE_SIZE) return response({ error: "حجم الملف يجب ألا يتجاوز 20 ميجابايت" }, 400)
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ROLES[role].extensions.has(extension as never)) return response({ error: role === "mushaf" ? "مرجع المصحف يجب أن يكون PDF" : "الأنواع المدعومة: PDF وDOCX وTXT" }, 415)

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractText(buffer, extension)
    if (text.length < 80) return response({ error: "لم نستطع استخراج نص كافٍ من الملف" }, 422)

    temporaryPath = `${ROLES[role].pathname}.upload-${crypto.randomUUID()}`
    await put(temporaryPath, buffer, { access: "private", contentType: file.type || "application/octet-stream", addRandomSuffix: false })
    await put(ROLES[role].pathname, buffer, { access: "private", contentType: file.type || "application/octet-stream", addRandomSuffix: false, allowOverwrite: true })
    const meta: ReferenceMeta & { text: string } = { role, name: file.name.slice(0, 180), pathname: ROLES[role].pathname, metadataPathname: ROLES[role].metadataPathname, type: extension, size: file.size, uploadedAt: new Date().toISOString(), textLength: text.length, text }
    await put(ROLES[role].metadataPathname, JSON.stringify(meta), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true })
    await del(temporaryPath).catch(() => undefined)
    temporaryPath = ""
    const { text: _text, ...publicMeta } = meta
    return response({ reference: publicMeta }, 201)
  } catch (error) {
    if (temporaryPath) await del(temporaryPath).catch(() => undefined)
    return response({ error: safeError(error, "تعذر رفع المرجع") }, 500)
  }
}

export async function DELETE(request: Request) {
  try {
    ensureConfigured()
    const { role } = await request.json()
    if (!isRole(role)) return response({ error: "نوع المرجع غير صالح" }, 400)
    await del([ROLES[role].pathname, ROLES[role].metadataPathname]).catch(() => undefined)
    return response({ success: true })
  } catch (error) { return response({ error: safeError(error, "تعذر حذف المرجع") }, 500) }
}
