import Link from 'next/link'

const features = [
  { title: 'التسميع والمتابعة', description: 'سجّل تقدمك وراجع مهامك اليومية في مساحة منظمة.' },
  { title: 'اختبارات قرآنية', description: 'اختبارات مخصصة تظهر عند فتحها فقط دون تحميل مسبق.' },
  { title: 'مساحة هادئة للنمو', description: 'تجربة خفيفة تبدأ بالترحيب ثم تحمل ما تحتاجه عند الطلب.' },
]

export default function Page() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col justify-center gap-10 lg:flex-row lg:items-center lg:gap-20">
        <div className="max-w-2xl">
          <p className="mb-5 font-mono text-sm font-semibold tracking-[0.2em] text-primary">THIMAR / ثمار</p>
          <h1 className="text-balance font-serif text-5xl font-bold leading-tight tracking-tight text-primary sm:text-7xl">
            ابدأ بخطوة هادئة نحو الثبات
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
            منصة قرآنية للتعلّم والتسميع والاختبارات. نحمّل شاشة الترحيب أولًا، ثم نفتح مساحة العمل المطلوبة فقط عند اختيارها.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/index.html" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              دخول المنصة
            </Link>
            <Link href="/index.html#signup" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary px-6 font-semibold text-primary transition-colors hover:bg-primary/10">
              إنشاء حساب
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">المساحات الثقيلة لا تُحمّل في هذه الصفحة.</p>
        </div>
        <div className="grid w-full max-w-md gap-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-serif text-xl font-bold text-card-foreground">{feature.title}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
