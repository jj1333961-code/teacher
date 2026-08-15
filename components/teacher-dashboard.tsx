'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  Globe2,
  GraduationCap,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Moon,
  Phone,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

type Language = 'ar' | 'en'
type Theme = 'light' | 'dark'
type Screen = 'login' | 'register' | 'dashboard'
type Modal = 'none' | 'messages' | 'settings' | 'students' | 'teachers' | 'admins'
type RequestData = {
  id: string
  name: string
  nationalId: string
  phone: string
  role: 'student' | 'parent'
  track: 'platform' | 'center'
  notes: string
  method: 'google' | 'phone'
  read: boolean
}

const copy = {
  ar: {
    brand: 'أهل القرآن', brandSub: 'بوابة الإدارة', username: 'اسم المستخدم', password: 'كلمة المرور',
    login: 'تسجيل الدخول', create: 'إنشاء حساب جديد', back: 'العودة لتسجيل الدخول', registerTitle: 'طلب انضمام جديد',
    registerSub: 'اختر طريقة التسجيل ثم أكمل بياناتك', google: 'المتابعة بحساب Google', phoneMethod: 'المتابعة برقم الهاتف',
    chooseRole: 'اختر صفتك', student: 'طالب', parent: 'ولي أمر', fullName: 'الاسم بالكامل', nationalId: 'الرقم القومي',
    phone: 'رقم الهاتف', track: 'مكان المتابعة', platform: 'على المنصة', center: 'في دار التحفيظ', notes: 'ملاحظات', optional: 'اختياري',
    submit: 'إرسال طلب الانضمام', sent: 'تم إرسال طلبك بنجاح', sentSub: 'سيقوم المسؤول بمراجعة بياناتك والتواصل معك.',
    dashboard: 'لوحة الإدارة', welcome: 'مرحبًا بك، أحمد', overview: 'نظرة سريعة على المنصة اليوم', students: 'عدد الطلاب',
    teachers: 'عدد المعلمين', admins: 'عدد المسؤولين', addStudent: 'إضافة طالب', subjectsTeachers: 'المواد والمعلمون', manageAdmins: 'إدارة المسؤولين',
    messages: 'الرسائل', settings: 'الإعدادات', logout: 'تسجيل الخروج', recent: 'آخر النشاطات', newRequests: 'طلبات الانضمام الجديدة',
    viewMessages: 'عرض كل الرسائل', noMessages: 'لا توجد رسائل جديدة', new: 'جديد', role: 'الصفة', follow: 'المتابعة', method: 'طريقة التسجيل',
    openWhatsapp: 'إرسال عبر واتساب', whatsappMissing: 'أضف رقم المسؤول من الإعدادات أولًا', appearance: 'المظهر', language: 'لغة الموقع',
    whatsapp: 'رقم واتساب المسؤول', save: 'حفظ الإعدادات', saved: 'تم حفظ الإعدادات', close: 'إغلاق', demo: 'نسخة تجريبية',
    quick: 'إدارة سريعة', activity1: 'تمت إضافة طالبة جديدة', activity2: 'تم تحديث جدول الحلقات', activity3: 'وصل طلب انضمام جديد',
    required: 'يرجى إكمال جميع البيانات المطلوبة', placeholderUser: 'أدخل اسم المستخدم', placeholderPassword: 'أدخل كلمة المرور',
  },
  en: {
    brand: 'Ahl Al-Quran', brandSub: 'Admin portal', username: 'Username', password: 'Password', login: 'Sign in', create: 'Create new account',
    back: 'Back to sign in', registerTitle: 'New registration request', registerSub: 'Choose a sign-up method, then complete your details',
    google: 'Continue with Google', phoneMethod: 'Continue with phone', chooseRole: 'Choose your role', student: 'Student', parent: 'Parent',
    fullName: 'Full name', nationalId: 'National ID', phone: 'Phone number', track: 'Learning location', platform: 'On the platform', center: 'Quran center',
    notes: 'Notes', optional: 'Optional', submit: 'Submit request', sent: 'Request sent successfully', sentSub: 'An administrator will review your details and contact you.',
    dashboard: 'Admin dashboard', welcome: 'Welcome, Ahmed', overview: 'A quick look at your platform today', students: 'Students', teachers: 'Teachers', admins: 'Administrators',
    addStudent: 'Add student', subjectsTeachers: 'Subjects & teachers', manageAdmins: 'Manage admins', messages: 'Messages', settings: 'Settings', logout: 'Sign out',
    recent: 'Recent activity', newRequests: 'New registration requests', viewMessages: 'View all messages', noMessages: 'No new messages', new: 'New', role: 'Role',
    follow: 'Learning', method: 'Sign-up method', openWhatsapp: 'Send via WhatsApp', whatsappMissing: 'Add the administrator phone in settings first', appearance: 'Appearance',
    language: 'Site language', whatsapp: 'Administrator WhatsApp', save: 'Save settings', saved: 'Settings saved', close: 'Close', demo: 'Demo', quick: 'Quick management',
    activity1: 'A new student was added', activity2: 'Class schedule was updated', activity3: 'A new registration request arrived', required: 'Please complete all required fields',
    placeholderUser: 'Enter username', placeholderPassword: 'Enter password',
  },
}

const seedRequests: RequestData[] = [{ id: 'seed-1', name: 'مريم محمود علي', nationalId: '29801011234567', phone: '01012345678', role: 'student', track: 'platform', notes: 'ترغب في مراجعة جزء عم', method: 'phone', read: false }]

export function TeacherDashboard() {
  const [language, setLanguage] = useState<Language>('ar')
  const [theme, setTheme] = useState<Theme>('light')
  const [screen, setScreen] = useState<Screen>('login')
  const [modal, setModal] = useState<Modal>('none')
  const [requests, setRequests] = useState<RequestData[]>(seedRequests)
  const [whatsapp, setWhatsapp] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const t = copy[language]
  const rtl = language === 'ar'

  useEffect(() => {
    const savedTheme = localStorage.getItem('portal-theme') as Theme | null
    const savedLanguage = localStorage.getItem('portal-language') as Language | null
    const savedRequests = localStorage.getItem('portal-requests')
    if (savedTheme) setTheme(savedTheme)
    if (savedLanguage) setLanguage(savedLanguage)
    if (savedRequests) setRequests(JSON.parse(savedRequests))
    setWhatsapp(localStorage.getItem('portal-whatsapp') || '')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.lang = language
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    localStorage.setItem('portal-theme', theme)
    localStorage.setItem('portal-language', language)
  }, [theme, language, rtl, hydrated])

  const unread = requests.filter((request) => !request.read).length
  const toggleLanguage = () => setLanguage((value) => value === 'ar' ? 'en' : 'ar')
  const openMessages = () => { setRequests((items) => items.map((item) => ({ ...item, read: true }))); setModal('messages'); setMenuOpen(false) }
  const openWhatsApp = (request: RequestData) => {
    if (!whatsapp) return window.alert(t.whatsappMissing)
    const message = `${t.registerTitle}\n${t.fullName}: ${request.name}\n${t.nationalId}: ${request.nationalId}\n${t.phone}: ${request.phone}\n${t.role}: ${request.role === 'student' ? t.student : t.parent}\n${t.follow}: ${request.track === 'platform' ? t.platform : t.center}\n${t.notes}: ${request.notes || '-'}\n${t.method}: ${request.method === 'google' ? 'Google' : t.phoneMethod}`
    window.open(`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  if (screen === 'login') return <LoginScreen t={t} rtl={rtl} theme={theme} setTheme={setTheme} toggleLanguage={toggleLanguage} onLogin={() => setScreen('dashboard')} onRegister={() => setScreen('register')} />
  if (screen === 'register') return <RegistrationScreen t={t} rtl={rtl} theme={theme} setTheme={setTheme} toggleLanguage={toggleLanguage} onBack={() => setScreen('login')} onSubmit={(request) => { const next = [request, ...requests]; setRequests(next); localStorage.setItem('portal-requests', JSON.stringify(next)) }} />

  return <main className="min-h-screen bg-background text-foreground" dir={rtl ? 'rtl' : 'ltr'}>
    <header className="sticky top-0 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 md:px-8">
        <Brand t={t} compact />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t.quick}>
          <HeaderButton label={t.messages} icon={<Mail />} onClick={openMessages} badge={unread} />
          <HeaderButton label={t.settings} icon={<Settings />} onClick={() => setModal('settings')} />
          <button className="icon-action" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={t.appearance}>{theme === 'light' ? <Moon /> : <Sun />}</button>
          <button className="language-action" onClick={toggleLanguage}><Globe2 />{language === 'ar' ? 'English' : 'العربية'}</button>
          <button className="icon-action" onClick={() => setScreen('login')} aria-label={t.logout}><LogOut /></button>
        </nav>
        <button className="icon-action md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X /> : <Menu />}</button>
      </div>
      {menuOpen && <div className="flex flex-col gap-2 border-t border-border p-4 md:hidden">
        <button className="mobile-nav" onClick={openMessages}><Mail />{t.messages}{unread > 0 && <b>{unread}</b>}</button>
        <button className="mobile-nav" onClick={() => { setModal('settings'); setMenuOpen(false) }}><Settings />{t.settings}</button>
        <button className="mobile-nav" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon /> : <Sun />}{t.appearance}</button>
        <button className="mobile-nav" onClick={toggleLanguage}><Globe2 />{language === 'ar' ? 'English' : 'العربية'}</button>
      </div>}
    </header>

    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-2"><span className="eyebrow">{t.dashboard}</span><h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">{t.welcome}</h1><p className="text-muted-foreground">{t.overview}</p></div>
      <section className="grid gap-4 md:grid-cols-3" aria-label={t.quick}>
        <StatCard icon={<GraduationCap />} label={t.students} count="248" action={t.addStudent} onClick={() => setModal('students')} />
        <StatCard icon={<BookOpen />} label={t.teachers} count="18" action={t.subjectsTeachers} onClick={() => setModal('teachers')} />
        <StatCard icon={<ShieldCheck />} label={t.admins} count="4" action={t.manageAdmins} onClick={() => setModal('admins')} />
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="panel">
          <div className="flex items-center justify-between"><div><span className="eyebrow">{t.messages}</span><h2 className="mt-1 text-xl font-bold">{t.newRequests}</h2></div><span className="count-badge">{unread}</span></div>
          <div className="mt-6 flex flex-col gap-3">{requests.slice(0, 2).map((request) => <button key={request.id} onClick={openMessages} className="request-row"><span className="avatar"><UserRound /></span><span className="min-w-0 flex-1"><b className="block truncate">{request.name}</b><small className="text-muted-foreground">{request.role === 'student' ? t.student : t.parent} · {request.track === 'platform' ? t.platform : t.center}</small></span>{!request.read && <span className="new-dot">{t.new}</span>}<ChevronLeft /></button>)}</div>
          <button className="secondary-button mt-5 w-full" onClick={openMessages}>{t.viewMessages}</button>
        </article>
        <article className="panel"><span className="eyebrow">{t.recent}</span><div className="mt-5 flex flex-col gap-5"><Activity text={t.activity1} time="10:30"/><Activity text={t.activity2} time="09:15"/><Activity text={t.activity3} time={language === 'ar' ? 'أمس' : 'Yesterday'}/></div></article>
      </section>
    </div>

    {modal !== 'none' && <ModalShell title={modal === 'messages' ? t.messages : modal === 'settings' ? t.settings : modal === 'students' ? t.addStudent : modal === 'teachers' ? t.subjectsTeachers : t.manageAdmins} closeLabel={t.close} onClose={() => setModal('none')}>
      {modal === 'messages' && <div className="flex flex-col gap-4">{requests.map((request) => <article className="message-card" key={request.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{request.name}</h3><p className="text-sm text-muted-foreground">{request.role === 'student' ? t.student : t.parent}</p></div><span className="status-badge"><Check />{language === 'ar' ? 'تم الاستلام' : 'Received'}</span></div><dl className="details-grid"><Detail label={t.nationalId} value={request.nationalId}/><Detail label={t.phone} value={request.phone}/><Detail label={t.follow} value={request.track === 'platform' ? t.platform : t.center}/><Detail label={t.method} value={request.method === 'google' ? 'Google' : t.phoneMethod}/><Detail label={t.notes} value={request.notes || '-'}/></dl><button className="primary-button w-full" onClick={() => openWhatsApp(request)}><MessageSquareText />{t.openWhatsapp}</button></article>)}</div>}
      {modal === 'settings' && <SettingsPanel t={t} language={language} theme={theme} whatsapp={whatsapp} setLanguage={setLanguage} setTheme={setTheme} setWhatsapp={setWhatsapp} onSave={() => { localStorage.setItem('portal-whatsapp', whatsapp); window.alert(t.saved); setModal('none') }}/>} 
      {modal === 'students' && <QuickPanel icon={<GraduationCap />} text={language === 'ar' ? 'نموذج إضافة طالب جاهز للربط بقاعدة البيانات.' : 'The add student form is ready for database connection.'} demo={t.demo}/>} 
      {modal === 'teachers' && <QuickPanel icon={<BookOpen />} text={language === 'ar' ? 'إدارة المواد وتوزيع المعلمين على الحلقات من مكان واحد.' : 'Manage subjects and assign teachers in one place.'} demo={t.demo}/>} 
      {modal === 'admins' && <QuickPanel icon={<ShieldCheck />} text={language === 'ar' ? 'إضافة المسؤولين وتحديد صلاحياتهم بسهولة.' : 'Add administrators and manage their permissions.'} demo={t.demo}/>} 
    </ModalShell>}
  </main>
}

function Brand({ t, compact = false }: { t: typeof copy.ar; compact?: boolean }) { return <div className="flex items-center gap-3"><span className={compact ? 'brand-mark size-10' : 'brand-mark size-12'}><BookOpen /></span><span><b className="block text-lg leading-tight">{t.brand}</b><small className="text-muted-foreground">{t.brandSub}</small></span></div> }

function ThemeLanguage({ theme, setTheme, toggleLanguage, t }: { theme: Theme; setTheme: (v: Theme) => void; toggleLanguage: () => void; t: typeof copy.ar }) { return <div className="absolute top-5 flex items-center gap-2 end-5"><button className="icon-action" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={t.appearance}>{theme === 'light' ? <Moon /> : <Sun />}</button><button className="language-action" onClick={toggleLanguage}><Globe2 />{t.language === 'لغة الموقع' ? 'English' : 'العربية'}</button></div> }

function LoginScreen({ t, rtl, theme, setTheme, toggleLanguage, onLogin, onRegister }: { t: typeof copy.ar; rtl: boolean; theme: Theme; setTheme: (v: Theme) => void; toggleLanguage: () => void; onLogin: () => void; onRegister: () => void }) {
  const submit = (event: FormEvent) => { event.preventDefault(); onLogin() }
  return <main className="auth-shell" dir={rtl ? 'rtl' : 'ltr'}><ThemeLanguage t={t} theme={theme} setTheme={setTheme} toggleLanguage={toggleLanguage}/><section className="auth-card"><Brand t={t}/><form className="mt-10 flex flex-col gap-5" onSubmit={submit}><label className="field-label">{t.username}<span className="input-wrap"><UserRound/><input required autoComplete="username" placeholder={t.placeholderUser}/></span></label><label className="field-label">{t.password}<span className="input-wrap"><LockKeyhole/><input required type="password" autoComplete="current-password" placeholder={t.placeholderPassword}/></span></label><button className="primary-button h-12" type="submit">{t.login}<ArrowLeft /></button><button className="secondary-button h-12" type="button" onClick={onRegister}>{t.create}</button></form></section></main>
}

function RegistrationScreen({ t, rtl, theme, setTheme, toggleLanguage, onBack, onSubmit }: { t: typeof copy.ar; rtl: boolean; theme: Theme; setTheme: (v: Theme) => void; toggleLanguage: () => void; onBack: () => void; onSubmit: (r: RequestData) => void }) {
  const [method, setMethod] = useState<'google' | 'phone' | null>(null), [role, setRole] = useState<'student' | 'parent'>('student'), [track, setTrack] = useState<'platform' | 'center'>('platform'), [done, setDone] = useState(false), [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (!method) return setError(t.required); const request: RequestData = { id: crypto.randomUUID(), name: String(data.get('name')), nationalId: String(data.get('nationalId')), phone: String(data.get('phone')), notes: String(data.get('notes')), method, role, track, read: false }; onSubmit(request); setDone(true) }
  if (done) return <main className="auth-shell" dir={rtl ? 'rtl' : 'ltr'}><section className="auth-card text-center"><span className="success-mark"><Check /></span><h1 className="mt-5 text-2xl font-bold">{t.sent}</h1><p className="mt-2 leading-7 text-muted-foreground">{t.sentSub}</p><button className="primary-button mt-8 w-full" onClick={onBack}>{t.back}</button></section></main>
  return <main className="auth-shell py-24" dir={rtl ? 'rtl' : 'ltr'}><ThemeLanguage t={t} theme={theme} setTheme={setTheme} toggleLanguage={toggleLanguage}/><section className="auth-card auth-card-wide"><button className="back-button" onClick={onBack}><ArrowLeft />{t.back}</button><h1 className="mt-7 text-2xl font-bold">{t.registerTitle}</h1><p className="mt-2 text-muted-foreground">{t.registerSub}</p><form className="mt-7 flex flex-col gap-6" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><button type="button" className={`choice-button ${method === 'google' ? 'selected' : ''}`} onClick={() => setMethod('google')}><span className="google-g">G</span>{t.google}</button><button type="button" className={`choice-button ${method === 'phone' ? 'selected' : ''}`} onClick={() => setMethod('phone')}><Phone />{t.phoneMethod}</button></div><fieldset><legend className="field-label mb-3">{t.chooseRole}</legend><div className="grid grid-cols-2 gap-3"><button type="button" className={`choice-button ${role === 'student' ? 'selected' : ''}`} onClick={() => setRole('student')}><GraduationCap />{t.student}</button><button type="button" className={`choice-button ${role === 'parent' ? 'selected' : ''}`} onClick={() => setRole('parent')}><UsersRound />{t.parent}</button></div></fieldset><div className="grid gap-5 sm:grid-cols-2"><TextField label={t.fullName} name="name"/><TextField label={t.nationalId} name="nationalId" inputMode="numeric"/><TextField label={t.phone} name="phone" inputMode="tel"/><label className="field-label">{t.track}<select value={track} onChange={(e) => setTrack(e.target.value as 'platform' | 'center')}><option value="platform">{t.platform}</option><option value="center">{t.center}</option></select></label></div><label className="field-label">{t.notes} <small>({t.optional})</small><textarea name="notes" rows={3}/></label>{error && <p className="error-text">{error}</p>}<button className="primary-button h-12" type="submit">{t.submit}<ArrowLeft /></button></form></section></main>
}

function TextField({ label, name, inputMode }: { label: string; name: string; inputMode?: 'numeric' | 'tel' }) { return <label className="field-label">{label}<input name={name} inputMode={inputMode} required /></label> }
function HeaderButton({ label, icon, onClick, badge }: { label: string; icon: React.ReactNode; onClick: () => void; badge?: number }) { return <button className="header-action" onClick={onClick}>{icon}<span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</button> }
function StatCard({ icon, label, count, action, onClick }: { icon: React.ReactNode; label: string; count: string; action: string; onClick: () => void }) { return <article className="stat-card"><div className="flex items-start justify-between"><span className="stat-icon">{icon}</span><span className="font-mono text-3xl font-bold">{count}</span></div><h2 className="mt-5 text-muted-foreground">{label}</h2><button className="card-action" onClick={onClick}><Plus />{action}</button></article> }
function Activity({ text, time }: { text: string; time: string }) { return <div className="flex items-center gap-3"><span className="activity-dot"/><span className="flex-1 text-sm font-medium">{text}</span><small className="text-muted-foreground">{time}</small></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function ModalShell({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="flex items-center justify-between border-b border-border p-5"><h2 id="modal-title" className="text-xl font-bold">{title}</h2><button className="icon-action" onClick={onClose} aria-label={closeLabel}><X /></button></div><div className="overflow-y-auto p-5">{children}</div></section></div> }
function SettingsPanel({ t, language, theme, whatsapp, setLanguage, setTheme, setWhatsapp, onSave }: { t: typeof copy.ar; language: Language; theme: Theme; whatsapp: string; setLanguage: (v: Language) => void; setTheme: (v: Theme) => void; setWhatsapp: (v: string) => void; onSave: () => void }) { return <div className="flex flex-col gap-6"><fieldset><legend className="field-label mb-3">{t.appearance}</legend><div className="grid grid-cols-2 gap-3"><button className={`choice-button ${theme === 'light' ? 'selected' : ''}`} onClick={() => setTheme('light')}><Sun />Light</button><button className={`choice-button ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setTheme('dark')}><Moon />Dark</button></div></fieldset><fieldset><legend className="field-label mb-3">{t.language}</legend><div className="grid grid-cols-2 gap-3"><button className={`choice-button ${language === 'ar' ? 'selected' : ''}`} onClick={() => setLanguage('ar')}>العربية</button><button className={`choice-button ${language === 'en' ? 'selected' : ''}`} onClick={() => setLanguage('en')}>English</button></div></fieldset><label className="field-label">{t.whatsapp}<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="201xxxxxxxxx"/></label><button className="primary-button h-12" onClick={onSave}>{t.save}</button></div> }
function QuickPanel({ icon, text, demo }: { icon: React.ReactNode; text: string; demo: string }) { return <div className="py-10 text-center"><span className="success-mark">{icon}</span><p className="mx-auto mt-5 max-w-sm leading-7 text-muted-foreground">{text}</p><span className="demo-badge mt-5 inline-block">{demo}</span></div> }
