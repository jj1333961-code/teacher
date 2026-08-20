import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <p className="text-sm text-muted-foreground">ثمار</p>
        <h1 className="mt-2 text-3xl font-bold">دخول النظام</h1>
        <p className="mt-3 leading-7 text-muted-foreground">تم فصل شاشة الدخول عن بقية المنصة لتصل إليك وحدها، بينما تبقى كل الوظائف والبيانات القديمة متاحة في النظام.</p>
        <Link href="/legacy" prefetch={false} className="mt-8 block rounded-xl bg-primary px-5 py-3 text-center font-semibold text-primary-foreground hover:opacity-90">فتح شاشة الدخول</Link>
        <div className="mt-5 flex justify-between text-sm"><Link href="/signup" className="text-primary underline">إنشاء حساب جديد</Link><Link href="/" className="text-muted-foreground underline">العودة للترحيب</Link></div>
      </section>
    </main>
  )
}
