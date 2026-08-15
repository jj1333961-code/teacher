'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, Globe2, GraduationCap, LockKeyhole, Moon, Phone, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { signIn, useSession } from '@/lib/auth-client'
import { createRegistration } from '@/app/actions/registration'

type Language = 'ar' | 'en'
type Theme = 'light' | 'dark'
type Screen = 'login' | 'register' | 'dashboard'
type Copy = typeof copy.ar

const copy = {
  ar: {
    brand: 'أهل القرآن', brandSub: 'بوابة الإدارة', username: 'اسم المستخدم', password: 'كلمة المرور', login: 'تسجيل الدخول',
    create: 'تسجيل جديد', back: 'العودة', registerTitle: 'طلب انضمام جديد', registerSub: 'تحقق أولًا، ثم سجّل بياناتك بأمان.',
    google: 'التحقق بحساب Google', phoneMethod: 'التحقق برقم الهاتف', phone: 'رقم الهاتف', sendCode: 'إرسال رمز تجريبي',
    code: 'رمز التحقق', verify: 'تحقق', demoCode: 'رمز التجربة: 123456', verified: 'تم التحقق بنجاح',
    fullName: 'الاسم بالكامل', subject: 'المادة أو المجال', experience: 'الخبرة', region: 'المحافظة أو المنطقة', submit: 'إرسال طلب الانضمام',
    sent: 'تم إرسال طلبك بنجاح', sentSub: 'حُفظ الطلب في قاعدة البيانات وسيقوم المسؤول بمراجعته.',
    dashboard: 'لوحة الإدارة', welcome: 'مرحبًا بك في أهل القرآن', overview: 'تابع الطلاب والمعلمين وطلبات الانضمام من مكان واحد.',
    students: 'الطلاب', teachers: 'المعلمون', requests: 'طلبات الانضمام', language: 'لغة الموقع', appearance: 'المظهر',
    required: 'أكمل جميع البيانات المطلوبة.', authRequired: 'يجب إكمال التحقق قبل تسجيل البيانات.', failed: 'تعذر حفظ الطلب. حاول مرة أخرى.',
    placeholderUser: 'أدخل اسم المستخدم', placeholderPassword: 'أدخل كلمة المرور', menu: 'القائمة', loading: 'جارٍ الحفظ...',
  },
  en: {
    brand: 'Ahl Al-Quran', brandSub: 'Administration portal', username: 'Username', password: 'Password', login: 'Sign in',
    create: 'New registration', back: 'Back', registerTitle: 'New registration request', registerSub: 'Verify first, then securely submit your details.',
    google: 'Verify with Google', phoneMethod: 'Verify with phone', phone: 'Phone number', sendCode: 'Send demo code',
    code: 'Verification code', verify: 'Verify', demoCode: 'Demo code: 123456', verified: 'Verification complete',
    fullName: 'Full name', subject: 'Subject or field', experience: 'Experience', region: 'Region', submit: 'Submit registration',
    sent: 'Request sent successfully', sentSub: 'Your request is stored in the database and will be reviewed by an administrator.',
    dashboard: 'Administration dashboard', welcome: 'Welcome to Ahl Al-Quran', overview: 'Manage students, teachers, and registration requests in one place.',
    students: 'Students', teachers: 'Teachers', requests: 'Registration requests', language: 'Site language', appearance: 'Appearance',
    required: 'Complete all required information.', authRequired: 'Complete verification before submitting your details.', failed: 'Could not save the request. Please try again.',
    placeholderUser: 'Enter username', placeholderPassword: 'Enter password', menu: 'Menu', loading: 'Saving...',
  },
}

export function TeacherDashboard() {
  const [language, setLanguage] = useState<Language>('ar')
  const [theme, setTheme] = useState<Theme>('light')
  const [screen, setScreen] = useState<Screen>('login')
  const t = copy[language]
  const rtl = language === 'ar'

  useEffect(() => {
    const savedLanguage = sessionStorage.getItem('portal-language') as Language | null
    const savedTheme = sessionStorage.getItem('portal-theme') as Theme | null
    if (savedLanguage) setLanguage(savedLanguage)
    if (savedTheme) setTheme(savedTheme)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    sessionStorage.setItem('portal-language', language)
    sessionStorage.setItem('portal-theme', theme)
  }, [language, rtl, theme])

  const toggleLanguage = () => setLanguage((value) => value === 'ar' ? 'en' : 'ar')
  const controls = <ThemeLanguage t={t} language={language} theme={theme} setTheme={setTheme} toggleLanguage={toggleLanguage} />

  if (screen === 'login') return <LoginScreen t={t} rtl={rtl} controls={controls} onLogin={() => setScreen('dashboard')} onRegister={() => setScreen('register')} />
  if (screen === 'register') return <RegistrationScreen t={t} rtl={rtl} controls={controls} onBack={() => setScreen('login')} />

  return <main className="min-h-screen bg-background text-foreground" dir={rtl ? 'rtl' : 'ltr'}>
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"><Brand t={t}/>{controls}</div></header>
    <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2"><span className="eyebrow">{t.dashboard}</span><h1 className="text-balance text-3xl font-bold md:text-4xl">{t.welcome}</h1><p className="max-w-2xl text-pretty leading-7 text-muted-foreground">{t.overview}</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Stat icon={<GraduationCap/>} label={t.students} value="248"/><Stat icon={<BookOpen/>} label={t.teachers} value="18"/><Stat icon={<ShieldCheck/>} label={t.requests} value="12"/></div>
    </section>
  </main>
}

function Brand({ t }: { t: Copy }) { return <div className="flex items-center gap-3"><span className="brand-mark size-11"><BookOpen/></span><span><b className="block text-lg">{t.brand}</b><small className="text-muted-foreground">{t.brandSub}</small></span></div> }

function ThemeLanguage({ t, language, theme, setTheme, toggleLanguage }: { t: Copy; language: Language; theme: Theme; setTheme: (v: Theme) => void; toggleLanguage: () => void }) {
  return <div className="flex items-center gap-2"><button className="icon-action" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={t.appearance}>{theme === 'light' ? <Moon/> : <Sun/>}</button><button className="language-action" type="button" onClick={toggleLanguage} aria-label={t.language}><Globe2/>{language === 'ar' ? 'English' : 'العربية'}</button></div>
}

function LoginScreen({ t, rtl, controls, onLogin, onRegister }: { t: Copy; rtl: boolean; controls: React.ReactNode; onLogin: () => void; onRegister: () => void }) {
  return <main className="auth-shell" dir={rtl ? 'rtl' : 'ltr'}><div className="absolute top-5 end-5">{controls}</div><section className="auth-card"><Brand t={t}/><form className="mt-10 flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); onLogin() }}><label className="field-label">{t.username}<span className="input-wrap"><UserRound/><input required autoComplete="username" placeholder={t.placeholderUser}/></span></label><label className="field-label">{t.password}<span className="input-wrap"><LockKeyhole/><input required type="password" autoComplete="current-password" placeholder={t.placeholderPassword}/></span></label><button className="primary-button h-12" type="submit">{t.login}<ArrowLeft/></button><button className="secondary-button h-12" type="button" onClick={onRegister}>{t.create}</button></form></section></main>
}

function RegistrationScreen({ t, rtl, controls, onBack }: { t: Copy; rtl: boolean; controls: React.ReactNode; onBack: () => void }) {
  const { data: session } = useSession()
  const [method, setMethod] = useState<'google' | 'phone' | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const verified = method === 'google' ? Boolean(session?.user) : method === 'phone' && phoneVerified

  const chooseGoogle = async () => {
    setMethod('google'); setError('')
    if (!session?.user) await signIn.social({ provider: 'google', callbackURL: '/' })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (!verified) return setError(t.authRequired)
    const data = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await createRegistration({
        fullName: String(data.get('fullName') || ''), phone: String(data.get('phone') || phone), subject: String(data.get('subject') || ''),
        experience: String(data.get('experience') || ''), region: String(data.get('region') || ''), verificationMethod: method!,
        phoneVerificationId: method === 'phone' ? `demo-phone-${phone.replace(/\D/g, '')}` : undefined,
      })
      setDone(true)
    } catch { setError(t.failed) } finally { setSaving(false) }
  }

  if (done) return <main className="auth-shell" dir={rtl ? 'rtl' : 'ltr'}><section className="auth-card text-center"><span className="success-mark"><Check/></span><h1 className="mt-5 text-2xl font-bold">{t.sent}</h1><p className="mt-2 leading-7 text-muted-foreground">{t.sentSub}</p><button className="primary-button mt-8 w-full" onClick={onBack}>{t.back}</button></section></main>

  return <main className="auth-shell py-24" dir={rtl ? 'rtl' : 'ltr'}><div className="absolute top-5 end-5">{controls}</div><section className="auth-card auth-card-wide"><button className="back-button" onClick={onBack}><ArrowLeft/>{t.back}</button><h1 className="mt-7 text-balance text-2xl font-bold">{t.registerTitle}</h1><p className="mt-2 text-pretty leading-6 text-muted-foreground">{t.registerSub}</p>
    <div className="mt-7 grid gap-3 sm:grid-cols-2"><button type="button" className={`choice-button ${method === 'google' ? 'selected' : ''}`} onClick={chooseGoogle}><span className="google-g">G</span>{t.google}</button><button type="button" className={`choice-button ${method === 'phone' ? 'selected' : ''}`} onClick={() => { setMethod('phone'); setError('') }}><Phone/>{t.phoneMethod}</button></div>
    {method === 'phone' && !phoneVerified && <div className="mt-5 rounded-xl border border-border bg-muted p-4"><label className="field-label">{t.phone}<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required/></label>{codeSent && <><p className="mt-3 text-sm text-muted-foreground">{t.demoCode}</p><label className="field-label mt-3">{t.code}<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"/></label></>}<button type="button" className="secondary-button mt-4 w-full" onClick={() => codeSent ? (code === '123456' ? setPhoneVerified(true) : setError(t.authRequired)) : (phone.trim() ? setCodeSent(true) : setError(t.required))}>{codeSent ? t.verify : t.sendCode}</button></div>}
    {verified && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary"><Check className="size-4"/>{t.verified}</p>}
    {verified && <form className="mt-6 flex flex-col gap-5" onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><TextField label={t.fullName} name="fullName"/><TextField label={t.phone} name="phone" inputMode="tel" defaultValue={phone}/><TextField label={t.subject} name="subject"/><TextField label={t.experience} name="experience"/><TextField label={t.region} name="region"/></div>{error && <p className="error-text" role="alert">{error}</p>}<button className="primary-button h-12" disabled={saving} type="submit">{saving ? t.loading : t.submit}<ArrowLeft/></button></form>}
    {!verified && error && <p className="error-text mt-4" role="alert">{error}</p>}
  </section></main>
}

function TextField({ label, name, inputMode, defaultValue }: { label: string; name: string; inputMode?: 'tel'; defaultValue?: string }) { return <label className="field-label">{label}<input name={name} inputMode={inputMode} defaultValue={defaultValue} required/></label> }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="stat-card"><span className="stat-icon">{icon}</span><div><p className="text-sm text-muted-foreground">{label}</p><strong className="text-3xl">{value}</strong></div></article> }
