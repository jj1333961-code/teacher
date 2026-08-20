import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <p className="text-sm text-muted-foreground">ثمار</p>
        <h1 className="mt-2 text-3xl font-bold">إنشاء حساب جديد</h1>
        <p className="mt-3 leading-7 text-muted-foreground">هذه الخطوة مستقلة عن لوحة النظام، وستظل بياناتك ووظائف التسجيل الأصلية محفوظة دون تحميل بقية اللوحات.</p>
        <Link href="/legacy" prefetch={false} className="mt-8 block rounded-xl bg-primary px-5 py-3 text-center font-semibold text-primary-foreground hover:opacity-90">فتح نموذج التسجيل</Link>
        <div className="mt-5 flex justify-between text-sm"><Link href="/login" className="text-primary underline">لدي حساب بالفعل</Link><Link href="/" className="text-muted-foreground underline">العودة للترحيب</Link></div>
      </section>
    </main>
  )
}
