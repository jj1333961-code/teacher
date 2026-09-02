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
  return response({ error: "تم تعطيل حذف ملفات الاختبارات عبر الواجهة العامة" }, 410)
}
