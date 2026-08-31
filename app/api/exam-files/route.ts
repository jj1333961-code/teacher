import { del, list } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

async function listAllExamFiles() {
  const urls: string[] = []
  let cursor: string | undefined

  do {
    const page = await list({ prefix: "exam-files/", cursor, limit: 1000 })
    urls.push(...page.blobs.map((blob) => blob.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  return urls
}

/**
 * ملفات الاختبارات أزيلت نهائياً بطلب مالك المنصة.
 * المصحف مستقل في public/quran ولا يمر عبر هذا المسار.
 */
export async function GET() {
  return response({ files: [], storageAvailable: false, uploadsDisabled: true })
}

export async function POST() {
  return response({ error: "تم تعطيل رفع ملفات الاختبارات. المصحف هو ملف PDF الوحيد المعروض في المنصة." }, 410)
}

export async function DELETE() {
  try {
    if (!(process.env.BLOB_READ_WRITE_TOKEN || "").trim()) {
      return response({ success: true, deleted: 0 })
    }

    const urls = await listAllExamFiles()
    if (urls.length) await del(urls)
    return response({ success: true, deleted: urls.length })
  } catch {
    return response({ error: "تعذر تنظيف ملفات الاختبارات المخزنة" }, 500)
  }
}
