(function () {
  'use strict';

  var routes = window.THIMAR_ROUTES;
  var corePromise = null;
  var pendingCalls = Object.create(null);
  var coreTimeoutMs = 15000;

  function routeForPage(id) {
    return routes && routes.pages && routes.pages[id] ? routes.pages[id] : '/login';
  }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* memory-only fallback */ }
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
    try { window.sessionStorage.setItem(key, value); } catch (error) { /* session storage may be blocked */ }
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

  function safeNextPath(role) {
    var value = new URLSearchParams(window.location.search).get('next');
    if (!value || value.charAt(0) !== '/' || value.indexOf('//') === 0) return routeForPage(role === 'admin' ? 'adminDashboard' : role === 'student' ? 'studentDashboard' : 'parentDashboard');
    var normalized = routes && routes.normalizePath ? routes.normalizePath(value) : value;
    if (!routes || !routes.isProtectedPath || !routes.isProtectedPath(normalized)) return routeForPage(role === 'admin' ? 'adminDashboard' : role === 'student' ? 'studentDashboard' : 'parentDashboard');
    if ((role === 'admin' && /^\/(student|parent)(\/|$)/.test(normalized)) || (role === 'student' && /^\/(admin|parent)(\/|$)/.test(normalized)) || (role === 'parent' && /^\/(admin|student)(\/|$)/.test(normalized))) return routeForPage(role === 'admin' ? 'adminDashboard' : role === 'student' ? 'studentDashboard' : 'parentDashboard');
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
      setLoginError('❌ أدخل اسم المستخدم والرقم السري');
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
      setLoginError('❌ اسم المستخدم أو الرقم السري غير صحيح');
      return;
    }

    persistLogin(user, role, role === 'admin' ? user.id : '');
    passInput.value = '';
    window.location.assign(safeNextPath(role));
  }

  function showPage(id) {
    if (window.__thimarAppCoreLoaded && window.__thimarCoreShowPage && window.__thimarCoreShowPage !== showPage) {
      return window.__thimarCoreShowPage.apply(window, arguments);
    }
    var publicRoute = routeForPage(id);
    if (id === 'lockScreen' || id === 'accountRecoveryPage' || id === 'signupStep1' || id === 'signupStep2') {
      if (window.location.pathname !== publicRoute) window.location.assign(publicRoute);
      return;
    }
    return runWhenCoreReady('showPage', arguments, null);
  }

  function loadCore() {
    if (window.__thimarAppCoreLoaded) return Promise.resolve();
    if (corePromise) return corePromise;
    corePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      var timeout = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        script.remove();
        corePromise = null;
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
        corePromise = null;
        reject(new Error('تعذر تحميل ملفات النظام'));
      };
      document.head.appendChild(script);
    });
    return corePromise;
  }

  function runWhenCoreReady(name, args, button) {
    if (pendingCalls[name]) return pendingCalls[name];
    if (button) button.disabled = true;
    var box = document.getElementById(name === 'startSignup' ? 'signupStep1Alert' : 'unifiedLoginAlert');
    if (box) box.innerHTML = '<div class="alert alert-info">جارٍ فتح الصفحة...</div>';
    pendingCalls[name] = loadCore().then(function () {
      var fn = name === 'showPage' ? window.showPage : window[name];
      if (typeof fn !== 'function' || fn === showPage) throw new Error('الدالة المطلوبة غير متاحة');
      return fn.apply(window, Array.prototype.slice.call(args || []));
    }).catch(function (error) {
      if (box) box.innerHTML = '<div class="alert alert-danger">❌ تعذر فتح الصفحة. تحقق من الاتصال ثم أعد المحاولة.</div>';
      console.error('[v0] core action failed', error);
    }).finally(function () {
      if (button) button.disabled = false;
      delete pendingCalls[name];
    });
    return pendingCalls[name];
  }

  window.loadThimarAppCore = loadCore;
  window.unifiedLogin = lightweightLogin;
  window.showPage = showPage;
  window.__thimarCoreShowPage = null;
  window.addEventListener('thimar:core-ready', function () {
    if (typeof window.showPage === 'function' && window.showPage !== showPage) window.__thimarCoreShowPage = window.showPage;
  }, { once: true });

  window.addEventListener('DOMContentLoaded', function () {
    var path = routes && routes.normalizePath ? routes.normalizePath(window.location.pathname) : window.location.pathname;
    var params = new URLSearchParams(window.location.search);
    var needsCore = (routes && routes.isProtectedPath && routes.isProtectedPath(path)) || path === '/quran-reader' || path === '/tuhfat' || params.has('page') || params.has('google');
    if (!needsCore) return;
    var start = function () { loadCore().catch(function (error) { console.error('[v0] protected route bootstrap failed', error); }); };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 900 });
    else window.setTimeout(start, 50);
  }, { once: true });
}());
