(function () {
  'use strict';

  var pages = Object.freeze({
    lockScreen: '/login',
    accountRecoveryPage: '/forgot-password',
    signupStep1: '/signup',
    signupStep2: '/signup/details',
    adminLogin: '/login/admin',
    adminDashboard: '/admin',
    adminAIPage: '/admin/ai',
    devAssistantPage: '/admin/developer',
    githubSyncPage: '/admin/github',
    notificationsPage: '/admin/notifications',
    adminsPage: '/admin/admins',
    adminSettings: '/admin/settings',
    addStudent: '/admin/students/new',
    editStudent: '/admin/students/edit',
    recordSession: '/admin/records/new',
    studentHistory: '/admin/students/history',
    studentsList: '/admin/students',
    messagesPage: '/admin/messages',
    subjectsPage: '/admin/subjects',
    filesPage: '/admin/files',
    studentLogin: '/login/student',
    studentDashboard: '/student',
    studentExamPage: '/student/exams/current',
    studentRecordsPage: '/student/records',
    studentFilesPage: '/student/files',
    studentInbox: '/student/messages',
    studentAIChat: '/student/ai',
    studentSettings: '/student/settings',
    parentLogin: '/login/parent',
    parentDashboard: '/parent',
    parentFilesPage: '/parent/files',
    parentInbox: '/parent/messages',
    parentAIChat: '/parent/ai',
    parentRecordsPage: '/parent/records',
    parentPendingTasksPage: '/parent/tasks',
    parentChartPage: '/parent/chart',
    quranReaderPage: '/quran-reader',
    tuhfatPage: '/tuhfat'
  });

  var aliases = Object.freeze({
    '/dashboard': Object.freeze({ admin: 'adminDashboard', student: 'studentDashboard', parent: 'parentDashboard' }),
    '/students': 'studentsList',
    '/profile': Object.freeze({ admin: 'adminSettings', student: 'studentSettings', parent: 'parentDashboard' }),
    '/settings': Object.freeze({ admin: 'adminSettings', student: 'studentSettings', parent: 'parentDashboard' }),
    '/register': 'signupStep1'
  });

  var protectedAliases = Object.freeze({
    '/dashboard': true,
    '/students': true,
    '/profile': true,
    '/settings': true
  });

  function normalizePath(path) {
    var normalized = String(path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
    return normalized || '/';
  }

  function pageForPath(path, role) {
    var normalized = normalizePath(path);
    if (Object.prototype.hasOwnProperty.call(pages, normalized)) return pages[normalized];
    var alias = aliases[normalized];
    if (typeof alias === 'string') return alias;
    if (alias && role && alias[role]) return alias[role];
    return null;
  }

  function isProtectedPath(path) {
    var normalized = normalizePath(path);
    return /^\/(admin|student|parent)(\/|$)/.test(normalized) || Boolean(protectedAliases[normalized]);
  }

  window.THIMAR_ROUTES = Object.freeze({
    pages: pages,
    aliases: aliases,
    protectedAliases: protectedAliases,
    normalizePath: normalizePath,
    pageForPath: pageForPath,
    isProtectedPath: isProtectedPath
  });
}());

/* Routes stay usable even when this file is loaded before the rest of the app. */
