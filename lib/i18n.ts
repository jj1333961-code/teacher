export type Locale = 'ar' | 'en'
export type TranslationKey = keyof typeof messages.ar

type Dictionary = Record<string, string>

export const messages = {
  ar: {
    'common.login': 'تسجيل الدخول',
    'common.logout': 'تسجيل الخروج',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.back': 'رجوع',
    'common.send': 'إرسال',
    'auth.accountType': 'نوع الحساب',
    'auth.student': 'طالب',
    'auth.fullName': 'الاسم الكامل',
    'auth.nationalId': 'الرقم القومي',
    'auth.phone': 'رقم الهاتف',
    'auth.send': 'إرسال',
    'common.loading': 'جارٍ التحميل...',
    'common.refresh': 'تحديث',
    'common.retry': 'إعادة المحاولة',
    'common.search': 'بحث',
    'common.next': 'التالي',
    'common.previous': 'السابق',
    'common.close': 'إغلاق',
    'common.open': 'فتح',
    'common.yes': 'نعم',
    'common.no': 'لا',
    'common.home': 'الرئيسية',
    'common.switchToEnglish': 'التبديل إلى الإنجليزية',
    'common.switchToArabic': 'التبديل إلى العربية',
    'common.settings': 'الإعدادات',
    'common.noData': 'لا توجد بيانات',
    'common.of': 'من',
    'auth.username': 'اسم المستخدم',
    'auth.password': 'كلمة المرور',
    'auth.phone': 'رقم الهاتف',
    'auth.nationalId': 'الرقم القومي',
    'auth.student': 'الطالب',
    'auth.teacher': 'المعلم',
    'auth.parent': 'ولي الأمر',
    'dashboard.admin': 'المسؤول',
    'dashboard.student': 'لوحة الطالب',
    'dashboard.teacher': 'لوحة المعلم',
    'dashboard.parent': 'لوحة ولي الأمر',
    'exam.exams': 'الاختبارات',
    'exam.start': 'ابدأ الاختبار',
    'exam.question': 'السؤال',
    'exam.nextQuestion': 'السؤال التالي',
    'exam.delete': 'حذف الاختبار',
    'recitation.title': 'التسميع',
    'recitation.recording': 'التسجيل الصوتي',
    'quran.title': 'القرآن الكريم',
    'antiCheat.title': 'مكافحة الغش',
    'antiCheat.scan': 'فحص الغش لهذا الاختبار',
    'settings.admin': 'إعدادات المسؤول',
    'notifications.requestSent': 'تم إرسال الطلب',
    'errors.generic': 'حدث خطأ',
    'errors.network': 'خطأ في الشبكة',
    'errors.unable': 'تعذر تنفيذ الأمر',
    'status.success': 'نجح',
    'status.failed': 'فشل',
    'status.enabled': 'مفعل',
    'status.disabled': 'غير مفعل',
    'status.open': 'مفتوح',
    'status.closed': 'مغلق',
    'platform.name': 'منصة المعلّم الذكية',
    'platform.connectedNeon': 'متصل بـ Neon',
  },
  en: {
    'common.login': 'Log in',
    'common.logout': 'Log out',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.back': 'Back',
    'common.send': 'Send',
    'auth.accountType': 'Account type',
    'auth.student': 'Student',
    'auth.fullName': 'Full name',
    'auth.nationalId': 'National ID',
    'auth.phone': 'Phone Number',
    'auth.send': 'Send',
    'common.loading': 'Loading...',
    'common.refresh': 'Refresh',
    'common.retry': 'Try again',
    'common.search': 'Search',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.home': 'Home',
    'common.switchToEnglish': 'Switch to English',
    'common.switchToArabic': 'Switch to Arabic',
    'common.settings': 'Settings',
    'common.noData': 'No data available',
    'common.of': 'of',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.phone': 'Phone number',
    'auth.nationalId': 'National ID',
    'auth.student': 'Student',
    'auth.teacher': 'Teacher',
    'auth.parent': 'Parent',
    'dashboard.admin': 'Admin',
    'dashboard.student': 'Student dashboard',
    'dashboard.teacher': 'Teacher dashboard',
    'dashboard.parent': 'Parent dashboard',
    'exam.exams': 'Exams',
    'exam.start': 'Start exam',
    'exam.question': 'Question',
    'exam.nextQuestion': 'Next question',
    'exam.delete': 'Delete exam',
    'recitation.title': 'Recitation',
    'recitation.recording': 'Audio recording',
    'quran.title': 'The Holy Quran',
    'antiCheat.title': 'Anti-cheat',
    'antiCheat.scan': 'Anti-cheat scan for this exam',
    'settings.admin': 'Admin settings',
    'notifications.requestSent': 'Request sent',
    'errors.generic': 'An error occurred',
    'errors.network': 'Network error',
    'errors.unable': 'Unable to execute the request',
    'status.success': 'Succeeded',
    'status.failed': 'Failed',
    'status.enabled': 'Enabled',
    'status.disabled': 'Disabled',
    'status.open': 'Open',
    'status.closed': 'Closed',
    'platform.name': 'Smart Teacher Platform',
    'platform.connectedNeon': 'Connected to Neon',
  },
} satisfies Record<Locale, Dictionary>

const arabicMessages = messages.ar as Record<string, string>
const englishMessages = messages.en as Record<string, string>
export const translations = Object.fromEntries(Object.entries(arabicMessages).map(([key, value]) => [value, englishMessages[key]])) as Record<string, string>
export const arabicToEnglish = translations
export const englishToArabic = Object.fromEntries(Object.entries(translations).map(([ar, en]) => [en, ar]))

export function getLocale(value?: string | null): Locale { return value === 'en' ? 'en' : 'ar' }
export function t(key: string, locale: Locale = 'ar', variables: Record<string, string | number> = {}) {
  const value = (messages[locale] as Record<string, string>)[key] ?? arabicMessages[key]
  if (!value) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] Missing translation key: ${key}`)
    return key
  }
  return Object.entries(variables).reduce((result, [name, replacement]) => result.replaceAll(`{{${name}}}`, String(replacement)), value)
}

export function translate(value: string, locale: Locale) {
  if (!value) return value
  const dictionary = locale === 'en' ? arabicToEnglish : englishToArabic
  let result = value
  for (const key of Object.keys(dictionary).sort((a, b) => b.length - a.length)) result = result.split(key).join(dictionary[key])
  return result
}

export function validateDictionaries() {
  const arKeys = Object.keys(messages.ar).sort()
  const enKeys = Object.keys(messages.en).sort()
  const missingInEnglish = arKeys.filter((key) => !englishMessages[key])
  const missingInArabic = enKeys.filter((key) => !arabicMessages[key])
  if (process.env.NODE_ENV !== 'production' && (missingInEnglish.length || missingInArabic.length)) console.warn('[i18n] Missing translations', { missingInEnglish, missingInArabic })
  return { arabic: arKeys.length, english: enKeys.length, missingInEnglish, missingInArabic }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') validateDictionaries()

export const localeNamespaces = ['common', 'auth', 'dashboard', 'student', 'teacher', 'exam', 'recitation', 'quran', 'antiCheat', 'settings', 'notifications', 'errors', 'status', 'platform'] as const
export type LocaleNamespace = typeof localeNamespaces[number]
