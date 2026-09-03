(function () {
  'use strict';

  var routes = window.THIMAR_ROUTES || { pages: {}, normalizePath: function (path) { return path || '/'; }, isProtectedPath: function () { return false; } };
  var corePromise = null;
  var pendingCalls = Object.create(null);
  var proxyFunctions = Object.create(null);
  var coreTimeoutMs = 15000;
  var PUBLIC_PAGE_IDS = Object.freeze({
    lockScreen: true,
    accountRecoveryPage: true,
    signupStep1: true,
    signupStep2: true,
    adminLogin: true,
    studentLogin: true,
    parentLogin: true
  });

  function routeForPage(id) {
    return routes.pages && routes.pages[id] ? routes.pages[id] : '/login';
  }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* التخزين المحلي قد يكون محظوراً */ }
  }

  function readArray(key) {
    try {
      var raw = safeStorageGet(key);
      var value = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeSession(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (error) { /* الجلسة المؤقتة اختيارية */ }
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').trim();
  }

  function normalizeDigits(value) {
    return normalizeText(value).replace(/[٠-٩]/g, function (digit) {
      return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
    });
  }

  function ensureLocalAuthRecords() {
    var admins = readArray('admins');
    if (!admins.length) {
      admins = [{ id: 1, mobile: '00000000000', password: '1234', isMain: true }];
      safeStorageSet('admins', JSON.stringify(admins));
    }

    var students = readArray('students');
    var seededStudent = students.find(function (student) {
      return normalizeText(student.username) === 'عثمان' || normalizeText(student.nationalId || student.national) === '778888889999999900';
    });
    if (!seededStudent) {
      students.push({
        id: 'student_othman_local',
        name: 'عثمان',
        username: 'عثمان',
        national: '778888889999999900',
        nationalId: '778888889999999900',
        birth: '2006-12-12',
        birthDate: '2006-12-12',
        studentPass: 'واحد',
        password: 'واحد',
        parent: 'شعبان',
        parentName: 'شعبان',
        parentPass: 'واحد',
        subjectIds: [1],
        subjects: [{ id: 1, name: 'القرآن الكريم', teacher: 'ش/أحمد شعبان' }],
        subject: 'القرآن الكريم',
        notes: '',
        localSeed: true
      });
      safeStorageSet('students', JSON.stringify(students));
    }
    return { admins: admins, students: students };
  }

  function roleHomePath(role) {
    return routeForPage(role === 'admin' ? 'adminDashboard' : role === 'student' ? 'studentDashboard' : 'parentDashboard');
  }

  function safeNextPath(role) {
    var value = new URLSearchParams(window.location.search).get('next');
    if (!value || value.charAt(0) !== '/' || value.indexOf('//') === 0) return roleHomePath(role);
    var normalized = routes.normalizePath ? routes.normalizePath(value) : value;
    if (!routes.isProtectedPath || !routes.isProtectedPath(normalized)) return roleHomePath(role);
    if ((role === 'admin' && /^\/(student|parent)(\/|$)/.test(normalized)) ||
        (role === 'student' && /^\/(admin|parent)(\/|$)/.test(normalized)) ||
        (role === 'parent' && /^\/(admin|student)(\/|$)/.test(normalized))) return roleHomePath(role);
    return value;
  }

  function persistLogin(user, role, adminId) {
    writeSession('currentUser', JSON.stringify(user));
    writeSession('currentType', role);
    writeSession('currentAdminId', adminId || '');
    writeSession('pageHistory', '[]');
  }

  function setLoginError(message) {
    var box = document.getElementById('unifiedLoginAlert');
    if (box) box.innerHTML = '<div class="alert alert-danger">' + message + '</div>';
  }

  function lightweightLogin() {
    var userInput = document.getElementById('unifiedUser');
    var passInput = document.getElementById('unifiedPass');
    if (!userInput || !passInput) return;
    var username = normalizeText(userInput.value);
    var password = normalizeText(passInput.value);
    if (!username || !password) {
      setLoginError('أدخل اسم المستخدم والرقم السري');
      return;
    }

    var records = ensureLocalAuthRecords();
    var admin = records.admins.find(function (item) {
      return normalizeDigits(item.mobile) === normalizeDigits(username) && normalizeText(item.password) === password;
    });
    var student = records.students.find(function (item) {
      return normalizeText(item.username) === username && normalizeText(item.studentPass || item.password) === password;
    });
    var parentChildren = records.students.filter(function (item) {
      var parentMatches = normalizeText(item.parent || item.parentName) === username;
      var phoneMatches = [item.parentPhone, item.phone].some(function (phone) {
        return phone && normalizeDigits(phone) === normalizeDigits(username);
      });
      return (parentMatches || phoneMatches) && normalizeText(item.parentPass || item.parentPassword) === password;
    });

    var user;
    var role;
    if (admin) { user = admin; role = 'admin'; }
    else if (student) { user = student; role = 'student'; }
    else if (parentChildren.length) { user = parentChildren; role = 'parent'; }
    else {
      setLoginError('اسم المستخدم أو الرقم السري غير صحيح');
      return;
    }

    persistLogin(user, role, role === 'admin' ? user.id : '');
    passInput.value = '';
    window.location.assign(safeNextPath(role));
  }

  function showPublicPage(id, options) {
    var publicRoute = routeForPage(id);
    var publicPage = document.getElementById(id);
    if (!publicPage || !PUBLIC_PAGE_IDS[id]) return false;
    document.querySelectorAll('.page, .home-page, .chart-page').forEach(function (page) { page.classList.add('hidden'); });
    publicPage.classList.remove('hidden');
    if (!(options && options.fromBrowser) && window.location.pathname !== publicRoute) {
      window.history.pushState({ page: id, thimarRoute: true }, '', publicRoute);
    }
    return publicPage;
  }

  function loadCore() {
    if (window.__thimarAppCoreLoaded && typeof window.showPage === 'function' && !proxyFunctions.showPage) return Promise.resolve();
    if (corePromise) return corePromise;
    corePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      var timeout = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        script.remove();
        reject(new Error('انتهت مهلة تحميل النظام'));
      }, coreTimeoutMs);
      script.src = '/app-core.js';
      script.async = true;
      script.onload = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        window.__thimarAppCoreLoaded = true;
        window.dispatchEvent(new Event('thimar:core-ready'));
        resolve();
      };
      script.onerror = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('تعذر تحميل ملفات النظام'));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      corePromise = null;
      throw error;
    });
    return corePromise;
  }

  function runWhenCoreReady(name, args, button, boxId) {
    if (pendingCalls[name]) return pendingCalls[name];
    if (button) button.disabled = true;
    var box = document.getElementById(boxId || (name === 'startSignup' ? 'signupStep1Alert' : 'unifiedLoginAlert'));
    if (box) box.innerHTML = '<div class="alert alert-info">جارٍ فتح الصفحة...</div>';
    pendingCalls[name] = loadCore().then(function () {
      var fn = window[name];
      if (typeof fn !== 'function' || fn === proxyFunctions[name]) throw new Error('الدالة المطلوبة غير متاحة');
      return fn.apply(window, Array.prototype.slice.call(args || []));
    }).catch(function (error) {
      if (box) box.innerHTML = '<div class="alert alert-danger">تعذر فتح الصفحة. أعد المحاولة من فضلك.</div>';
      console.error('[v0] core action failed', name, error);
    }).finally(function () {
      if (button) button.disabled = false;
      delete pendingCalls[name];
    });
    return pendingCalls[name];
  }

  function showPage(id, options) {
    if (window.__thimarAppCoreLoaded && typeof window.__thimarCoreShowPage === 'function') {
      return window.__thimarCoreShowPage.apply(window, arguments);
    }
    if (showPublicPage(id, options)) return document.getElementById(id);
    return runWhenCoreReady('showPage', arguments, null);
  }

  function installCoreProxy(name, boxId) {
  var proxy = function () {
  // التنقل إلى الصفحات العامة لا يجب أن ينتظر تحميل النواة؛ هذا يمنع تجمد زر إنشاء الحساب عند بطء الشبكة.
  if (name === 'startSignup' || name === 'openAccountRecovery') {
  var publicId = name === 'startSignup' ? 'signupStep1' : 'accountRecoveryPage';
  var publicPage = showPublicPage(publicId);
  if (publicPage) {
  loadCore().catch(function (error) {
  console.error('[v0] public page core bootstrap failed', name, error);
  });
  return publicPage;
  }
  }
  return runWhenCoreReady(name, arguments, null, boxId);
  };
  proxyFunctions[name] = proxy;
  window[name] = proxy;
  }

  function openSignupPageNow() {
  var page = document.getElementById('signupStep1');
  if (!page) return;
  document.querySelectorAll('.page, .home-page, .chart-page').forEach(function (item) { item.classList.add('hidden'); });
  page.classList.remove('hidden');
  if (window.history && window.history.pushState && window.location.pathname !== '/signup') {
  window.history.pushState({ page: 'signupStep1', thimarRoute: true }, '', '/signup');
  }
  window.setTimeout(function () {
  loadCore().catch(function (error) { console.error('[v0] signup bootstrap failed', error); });
  }, 250);
  }

  function toggleUnifiedPassword() {
    var input = document.getElementById('unifiedPass');
    var button = document.getElementById('unifiedPassToggle');
    if (!input || !button) return;
    var showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    button.classList.toggle('is-visible', showing);
    button.setAttribute('aria-pressed', String(showing));
    button.setAttribute('aria-label', showing ? 'إخفاء الرقم السري' : 'إظهار الرقم السري');
  }

  function togglePassVisibility(id, icon) {
    var input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.textContent = input.type === 'password' ? '👁' : '🙈';
  }

  function toggleTheme() {
    var html = document.documentElement;
    var button = document.querySelector('.theme-toggle');
    var dark = html.getAttribute('data-theme') === 'dark';
    try {
      if (dark) { html.removeAttribute('data-theme'); safeStorageSet('theme', 'light'); if (button) button.textContent = '🌙'; }
      else { html.setAttribute('data-theme', 'dark'); safeStorageSet('theme', 'dark'); if (button) button.textContent = '☀️'; }
    } catch (error) {
      if (dark) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', 'dark');
    }
  }

  function toggleLang() {
    var next = document.documentElement.lang === 'en' ? 'ar' : 'en';
    safeStorageSet('lang', next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'en' ? 'ltr' : 'rtl';
    var button = document.getElementById('langToggleBtn');
    if (button) button.textContent = next === 'en' ? 'ع' : 'EN';
    window.dispatchEvent(new Event('languagechange'));
  }

  window.loadThimarAppCore = loadCore;
  window.unifiedLogin = lightweightLogin;
  window.showPage = showPage;
  window.openSignupPageNow = openSignupPageNow;
  window.toggleUnifiedPassword = toggleUnifiedPassword;
  window.togglePassVisibility = togglePassVisibility;
  window.toggleTheme = toggleTheme;
  window.toggleLang = toggleLang;
  installCoreProxy('startSignup', 'signupStep1Alert');
  installCoreProxy('openAccountRecovery', 'unifiedLoginAlert');

  window.addEventListener('thimar:core-ready', function () {
    if (typeof window.showPage === 'function' && window.showPage !== showPage) {
      window.__thimarCoreShowPage = window.showPage;
    }
  }, { once: true });

  window.addEventListener('DOMContentLoaded', function () {
    var path = routes.normalizePath ? routes.normalizePath(window.location.pathname) : window.location.pathname;
    var params = new URLSearchParams(window.location.search);
    var directPublicPage = routes.pages ? Object.keys(routes.pages).find(function (id) { return routes.pages[id] === path; }) : null;
    if (directPublicPage && PUBLIC_PAGE_IDS[directPublicPage]) showPublicPage(directPublicPage, { fromBrowser: true });

    var needsCore = (routes.isProtectedPath && routes.isProtectedPath(path)) ||
      path === '/forgot-password' || /^\/signup(\/|$)/.test(path) ||
      /^\/login\/(admin|student|parent)(\/|$)/.test(path) ||
      path === '/quran-reader' || path === '/tuhfat' || params.has('page') || params.has('google');
    if (!needsCore) return;
    // صفحات التطبيق legacy تعتمد على النواة لربط الأحداث. تأجيل تحميلها إلى idle
    // جعل الواجهة تظهر صحيحة لكنها غير تفاعلية عند أول نقرات المستخدم.
    var start = function () {
      loadCore().catch(function (error) {
        console.error('[v0] protected route bootstrap failed', error);
        var alert = document.getElementById('unifiedLoginAlert') || document.getElementById('signupStep1Alert');
        if (alert) alert.innerHTML = '<div class="alert alert-danger">تعذر فتح الصفحة. أعد المحاولة من فضلك.</div>';
      });
    };
    start();
  }, { once: true });
}());
