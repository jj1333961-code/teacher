(function () {
  'use strict';

  var dictionaries = {
    en: {
      'منصة ثمار': 'Thimar Platform', 'منصة ثِمار': 'Thimar Platform', 'لحفظ القرآن الكريم': 'for memorizing the Holy Quran', 'إظهار الرقم السري': 'Show password', 'إظهار Password': 'Show password', 'إخفاء الرقم السري': 'Hide password', 'إخفاء Password': 'Hide password', 'هل نسيت الرقم السري؟': 'Forgot your password?', 'هل نسيت Password؟': 'Forgot your password?', 'تغيير اللغة / Change language': 'Change language',
      'تسجيل الدخول': 'Log in', 'تسجيل الخروج': 'Log out', 'إنشاء حساب جديد': 'Create account', 'ليس لديك حساب؟': "Don't have an account?", 'أليس لديك حساب؟': "Don't have an account?",
      'اسم المستخدم': 'Username', 'الرقم السري': 'Password', 'رقم الهاتف': 'Phone number', 'تاريخ الميلاد': 'Date of birth', 'الصف الدراسي': 'Grade', 'أدخل الرقم السري': 'Enter your password', 'أدخل اسم المستخدم والرقم السري': 'Enter your username and password', 'الرئيسية': 'Home', 'الصفحة الرئيسية': 'Home',
      'المسؤول': 'Admin', 'الطالب': 'Student', 'المعلم': 'Teacher', 'ولي الأمر': 'Parent', 'الطلاب': 'Students', 'المعلمين': 'Teachers', 'أولياء الأمور': 'Parents',
      'الرئيسية': 'Home', 'لوحة التحكم': 'Dashboard', 'الإعدادات': 'Settings', 'الرسائل': 'Messages', 'محادثة': 'Chat', 'الإشعارات': 'Notifications',
      'المصحف الشريف': 'Holy Quran', 'القرآن الكريم': 'The Holy Quran', 'الاختبارات': 'Exams', 'قائمة الاختبار': 'Exam list', 'توليد الأسئلة بالذكاء الاصطناعي': 'Generate questions with AI',
      'الواجبات': 'Homework', 'التقارير': 'Reports', 'الحضور والغياب': 'Attendance', 'المواد الدراسية': 'Subjects', 'الملفات': 'Files',
      'حفظ': 'Save', 'إلغاء': 'Cancel', 'حذف': 'Delete', 'تعديل': 'Edit', 'إضافة': 'Add', 'رجوع': 'Back', 'إرسال': 'Send', 'تحديث': 'Refresh', 'بحث': 'Search',
      'التالي': 'Next', 'السابق': 'Previous', 'إغلاق': 'Close', 'تأكيد': 'Confirm', 'إعادة المحاولة': 'Try again', 'إعادة تشغيل الكاميرا': 'Restart camera',
      'جار التحميل...': 'Loading...', 'جارٍ التحميل...': 'Loading...', 'لا توجد بيانات': 'No data available', 'حدث خطأ': 'An error occurred', 'نجح': 'Succeeded', 'فشل': 'Failed',
      'تم الحفظ بنجاح': 'Saved successfully', 'تعذر الحفظ': 'Could not save', 'نعم': 'Yes', 'لا': 'No', 'مفتوح': 'Open', 'مغلق': 'Closed', 'الاسم': 'Name',
      'الكاميرا غير متاحة': 'Camera unavailable', 'تم رفض صلاحية الكاميرا': 'Camera permission was denied', 'الكاميرا مستخدمة بواسطة تطبيق آخر': 'Camera is being used by another app',
      'المتصفح لا يدعم الكاميرا': 'This browser does not support the camera', 'حدث خطأ أثناء تشغيل الكاميرا': 'An error occurred while starting the camera',
      'البصمة الصوتية': 'Voiceprint', 'بدء التسجيل': 'Start recording', 'إيقاف التسجيل': 'Stop recording', 'تسجيل الصوت': 'Record audio',
      'إعدادات العرض': 'Display settings', 'تبديل الوضع': 'Toggle theme', 'تغيير اللغة / Change language': 'Change language', 'Change language / Change language': 'Change language', 'فتح قائمة الأدوات': 'Open tools menu', 'إغلاق القائمة': 'Close menu',
      'قال تعالى:': 'Allah Almighty said:', 'مصحف مفتوح على حامل خشبي': 'An open Quran on a wooden stand', 'الأدوات': 'Tools', 'الوقت المتبقي': 'Time remaining', 'النتيجة': 'Result'
    }
  };
  var religiousSelector = '[data-no-translate],.quran-text,.ayah,.hadith,.dhikr,[lang="ar-QA"]';
  var locale = localStorage.getItem('lang') === 'en' ? 'en' : 'ar';
  var originals = new WeakMap();

  function isProtected(node) {
    var parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return !parent || !!parent.closest('script,style,code,pre,' + religiousSelector);
  }
  function dictionary() { return dictionaries[locale] || {}; }
  function translate(value) {
    if (locale === 'ar' || !value) return value;
    var result = value;
    Object.keys(dictionary()).sort(function(a,b){ return b.length-a.length; }).forEach(function(key){ result = result.split(key).join(dictionary()[key]); });
    return result;
  }
  function apply(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim() || isProtected(node)) continue;
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      node.nodeValue = locale === 'ar' ? originals.get(node) : translate(originals.get(node));
    }
    if (root.querySelectorAll) root.querySelectorAll('input,textarea,button,[title],[aria-label],[alt]').forEach(function(el){
      if (el.matches(religiousSelector) || el.closest(religiousSelector)) return;
      ['placeholder','title','aria-label','alt','value'].forEach(function(attr){
        if (!el.hasAttribute(attr) || (attr === 'value' && !['button','submit','reset'].includes((el.type || '').toLowerCase()))) return;
        var key = 'data-i18n-source-' + attr;
        if (!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(attr));
        var source = el.getAttribute(key) || '';
        var translated = dictionary()[source] || source;
        el.setAttribute(attr, locale === 'ar' ? source : translated);
      });
    });
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl';
    var button = document.getElementById('langToggleBtn');
    if (button) button.textContent = locale === 'en' ? 'ع' : 'EN';
  }
  function setLocale(next) {
    locale = next === 'en' ? 'en' : 'ar';
    localStorage.setItem('lang', locale);
    apply(document.body);
  }
  window.ThimarI18n = { apply: apply, setLocale: setLocale, t: translate, getLocale: function(){ return locale; } };
  window.addEventListener('languagechange', function(){
    var lockScreen = document.getElementById('lockScreen');
    var activePage = document.querySelector('.page:not(.hidden):not(#lockScreen), .home-page:not(.hidden), .chart-page:not(.hidden)');
    if (!activePage && lockScreen) setLocale(localStorage.getItem('lang'));
  });
  var observerFrame = 0;
  var pendingRoots = [];
  function scheduleApply(root) {
    if (!root) return;
    if (pendingRoots.indexOf(root) === -1) pendingRoots.push(root);
    if (observerFrame) return;
    var flush = function(){
      observerFrame = 0;
      var roots = pendingRoots.splice(0, pendingRoots.length);
      roots.slice(0, 8).forEach(apply);
      if (roots.length > 8) {
        pendingRoots = roots.slice(8).concat(pendingRoots);
        scheduleApply(pendingRoots[0]);
      }
    };
    if (typeof requestAnimationFrame === 'function') observerFrame = requestAnimationFrame(flush);
    else observerFrame = setTimeout(flush, 0);
  }
  var observer = new MutationObserver(function(records){
    records.forEach(function(record){
      record.addedNodes.forEach(function(added){
        if (added.nodeType === 1 || added.nodeType === 3) scheduleApply(added.nodeType === 3 ? added.parentElement : added);
      });
    });
  });
  document.addEventListener('DOMContentLoaded', function(){
    scheduleApply(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
