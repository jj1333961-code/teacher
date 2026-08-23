/* ============================================================
   القسم الإسلامي التفاعلي في «ثمار»
   القرآن الكريم / الدعاء / الأحاديث / الأذكار / مواقيت الصلاة / اتجاه القبلة
   ============================================================ */
(function () {
  "use strict";

  var D = window.THIMAR_ISLAMIC || {};
  var LS_LOC = "thimar_isl_location";
  var LS_NOTIFIED = "thimar_isl_notified";
  var KAABA = { lat: 21.4224779, lng: 39.8251832 };

  var PRAYER_KEYS = [
    { key: "Fajr", name: "الفجر" },
    { key: "Sunrise", name: "الشروق", info: true },
    { key: "Dhuhr", name: "الظهر" },
    { key: "Asr", name: "العصر" },
    { key: "Maghrib", name: "المغرب" },
    { key: "Isha", name: "العشاء" },
  ];

  /* ---------------- أدوات مساعدة ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function fmt12(hhmm) {
    if (!hhmm) return "--:--";
    var p = String(hhmm).trim().split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10) || 0;
    var mer = h >= 12 ? "م" : "ص";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return { t: pad(h12) + ":" + pad(m), mer: mer };
  }

  function hijriToday(date) {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).format(date || new Date()) + " هـ";
    } catch (e) {
      try {
        return new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(date || new Date());
      } catch (e2) { return ""; }
    }
  }

  var notificationAudio = null;
  function playNotificationSound() {
    try {
      if (!notificationAudio) { notificationAudio = new Audio("/audio/notification-chime.mp3"); notificationAudio.preload = "auto"; notificationAudio.volume = 0.65; }
      notificationAudio.currentTime = 0;
      var playback = notificationAudio.play();
      if (playback && playback.catch) playback.catch(function () {});
    } catch (e) {}
  }
  function toast(msg, type) {
    playNotificationSound();
    if (typeof window.showToast === "function") { window.showToast(msg, type || "info"); return; }
    console.log("[v0] isl:", msg);
  }

  /* ---------------- الأيقونات ---------------- */
  var ICONS = {
    quran:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 22c-5-3.4-10.4-4.8-15.5-4.8v20C21.6 37.2 27 38.6 32 42c5-3.4 10.4-4.8 15.5-4.8v-20C42.4 17.2 37 18.6 32 22Z"/><path d="M32 22v20"/><path d="M14 44 32 52l18-8"/><path d="M20 52 32 46l12 6"/><path d="M32 6.5 34.6 11l5 .7-3.6 3.5.9 5-4.9-2.6-4.9 2.6.9-5L24.4 11.7l5-.7L32 6.5Z" stroke-width="1.8"/></svg>',
    dua:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 54V28c0-8.8 7.2-16 16-16s16 7.2 16 16v26"/><path d="M27 50V32c0-2-1.6-3.6-3.6-3.6S19.8 30 19.8 32v11"/><path d="M37 50V32c0-2 1.6-3.6 3.6-3.6S44.2 30 44.2 32v11"/><path d="M27 50c0 3 2.2 5 5 5s5-2 5-5"/><path d="M32 3.5 34 7l3.8.6-2.7 2.7.6 3.8L32 12.3l-3.7 1.8.6-3.8-2.7-2.7L30 7 32 3.5Z" stroke-width="1.6"/></svg>',
    hadith:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="30" r="20"/><path d="M25 24.5c-2.6 0-4.6 2-4.6 4.5s2 4.5 4.6 4.5c2.4 0 4.2-1.5 4.4-4.2.3-3.6 1.5-5.6 4-7.3"/><path d="M39.5 24.5c-2.6 0-4.6 2-4.6 4.5s2 4.5 4.6 4.5c2.4 0 4.2-1.5 4.4-4.2.3-3.6 1.5-5.6 4-7.3"/><circle cx="32" cy="52" r="3.2" fill="currentColor" stroke="none"/></svg>',
    adhkar:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="32" cy="14" r="3.4"/><circle cx="43" cy="17.5" r="3.4"/><circle cx="50.5" cy="26" r="3.4"/><circle cx="52.5" cy="37" r="3.4"/><circle cx="21" cy="17.5" r="3.4"/><circle cx="13.5" cy="26" r="3.4"/><circle cx="11.5" cy="37" r="3.4"/><circle cx="18" cy="45.5" r="3.4"/><circle cx="46" cy="45.5" r="3.4"/><circle cx="32" cy="49" r="3.6"/><path d="M32 52.6v5.6M29 58h6l-1.4 4h-3.2L29 58Z"/></svg>',
    times:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 56V28c0-11 9-20 20-20s20 9 20 20v28Z"/><circle cx="32" cy="32" r="12"/><path d="M32 25v7l5 3.5"/></svg>',
    qibla:
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="23"/><path d="M32 5v5M32 54v5M5 32h5M54 32h5"/><path d="m24 40 6.5-15L47 18l-7 16.5L24 40Z"/><rect x="27" y="27" width="10" height="10" rx="1.6"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  };

  var TASBEEH = [
    "سُبْحَانَ اللهِ وَبِحَمْدِهِ",
    "سُبْحَانَ اللهِ العَظِيمِ",
    "سُبْحَانَ اللهِ وَالحَمْدُ لِلَّهِ",
    "لَا إِلَهَ إِلَّا اللهُ",
    "اللهُ أَكْبَرُ",
    "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ",
    "أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ",
    "اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
    "حَسْبِيَ اللهُ لَا إِلَهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ",
    "رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَعَافِنِي وَارْزُقْنِي",
    "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",
    "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ",
    "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ العَفْوَ فَاعْفُ عَنِّي",
    "سُبْحَانَ ذِي المُلْكِ وَالمَلَكُوتِ",
    "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
    "رَضِيتُ بِاللهِ رَبًّا، وَبِالإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ نَبِيًّا",
    "آمَنْتُ بِاللهِ وَحْدَهُ لَا شَرِيكَ لَهُ",
    "اللَّهُمَّ بَارِكْ لَنَا فِي أَوْقَاتِنَا وَأَعْمَالِنَا",
    "اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ المُتَطَهِّرِينَ",
    "اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي"
  ];

  var TILES = [
    { id: "quran", label: "القرآن الكريم", icon: ICONS.quran },
    { id: "tasbeeh", label: "التسبيح", icon: ICONS.adhkar },
    { id: "dua", label: "الدعاء", icon: ICONS.dua },
    { id: "hadith", label: "الأحاديث", icon: ICONS.hadith },
    { id: "adhkar", label: "الأذكار", icon: ICONS.adhkar },
    { id: "times", label: "مواقيت الصلاة", icon: ICONS.times },
    { id: "qibla", label: "اتجاه القبلة", icon: ICONS.qibla },
  ];

  /* ============================================================
     الحالة العامة
     ============================================================ */
  var state = {
    loc: null,          // { lat, lng, label }
    timings: null,      // { Fajr: "05:12", ... }
    next: null,         // { name, key, at: Date }
    tickTimer: null,
  };

  try {
    var raw = localStorage.getItem(LS_LOC);
    if (raw) state.loc = JSON.parse(raw);
  } catch (e) {}

  function saveLoc() {
    try { localStorage.setItem(LS_LOC, JSON.stringify(state.loc)); } catch (e) {}
  }

  /* ============================================================
     بناء الواجهة داخل كل حاوية
     ============================================================ */
  function tilesHTML() {
    return (
      '<div class="isl-tiles" role="list">' +
      TILES.map(function (t) {
        return (
          '<button type="button" class="isl-tile" role="listitem" data-isl-open="' + t.id + '">' +
          t.icon + "<span>" + esc(t.label) + "</span></button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function prayerCardHTML() {
    return (
      '<div class="isl-prayer-card" data-isl-card>' +
      '<div class="isl-prayer-inner">' +
      '<div class="isl-prayer-clock">' + ICONS.clock + "</div>" +
      '<div class="isl-prayer-name" data-isl-pname>—</div>' +
      '<div class="isl-prayer-time" data-isl-ptime>--:--</div>' +
      '<div class="isl-prayer-meta" data-isl-pmeta></div>' +
      '<div class="isl-prayer-countdown" data-isl-pcd></div>' +
      '<div class="isl-prayer-strip" data-isl-pstrip></div>' +
      '<button type="button" class="isl-prayer-btn" data-isl-open="times">' +
      "<span>عرض جميع المواقيت</span><span aria-hidden=\"true\">&#8249;</span></button>" +
      "</div></div>"
    );
  }

  function mountHub(host) {
    if (host.dataset.islReady === "1") return;
    host.dataset.islReady = "1";
    host.classList.add("isl-hub");
    host.innerHTML = tilesHTML() + prayerCardHTML();
    host.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-isl-open]");
      if (btn && host.contains(btn)) openSection(btn.getAttribute("data-isl-open"));
    });
    paintCards();
  }

  function mountAll() {
    document.querySelectorAll("[data-isl-hub]").forEach(mountHub);
  }

  /* ============================================================
     الطبقة المشتركة: النافذة، الم��حف، التنبيه
     ============================================================ */
  var modal, sheetTitle, sheetBody, backBtn, mushaf, mushafCanvas, mushafClose, athan, mushafZoom;
  var pdfDoc = null, pdfLib = null, rendering = false, pendingPage = null;
  var sheetStack = [];

  function ensureLayers() {
    if (modal) return;

    modal = el(
      '<div class="isl-modal" hidden role="dialog" aria-modal="true" aria-labelledby="islSheetTitle">' +
      '<div class="isl-sheet">' +
      '<div class="isl-sheet-head">' +
      '<button type="button" class="isl-back" hidden aria-label="رجوع">&#8250;</button>' +
      '<h3 id="islSheetTitle">—</h3>' +
      '<button type="button" class="isl-x" aria-label="إغلاق">&times;</button>' +
      "</div>" +
      '<div class="isl-sheet-body"></div>' +
      "</div></div>"
    );
    document.body.appendChild(modal);
    sheetTitle = modal.querySelector("h3");
    sheetBody = modal.querySelector(".isl-sheet-body");
    backBtn = modal.querySelector(".isl-back");
    modal.querySelector(".isl-x").addEventListener("click", closeModal);
    backBtn.addEventListener("click", goBackSheet);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

    mushaf = el(
      '<div class="isl-mushaf" hidden role="dialog" aria-modal="true" aria-label="المصحف الشريف">' +
      '<div class="isl-mushaf-stage"><canvas class="isl-mushaf-canvas"></canvas></div>' +
      '<button type="button" class="isl-mushaf-close" aria-label="العودة إلى قائمة السور">&times;</button>' +
      "</div>"
    );
    document.body.appendChild(mushaf);
    mushafCanvas = mushaf.querySelector(".isl-mushaf-canvas");
    mushafClose = mushaf.querySelector(".isl-mushaf-close");
    mushafZoom = 1;
    mushafClose.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); closeMushaf(); });

    athan = el(
      '<div class="isl-athan-toast" hidden role="dialog" aria-modal="true" aria-live="assertive">' +
      '<div class="isl-athan-backdrop"></div>' +
      '<div class="isl-athan-card">' +
      '<img src="/images/prayer-alert-reference.png" alt="تنبيه وقت الصلاة" class="isl-athan-art" />' +
      '<div class="isl-athan-overlay">' +
      '<button type="button" class="isl-athan-dismiss" aria-label="إغلاق التنبيه">&times;</button>' +
      '<p class="isl-athan-now">حان الآن وقت</p>' +
      '<h2 data-athan-name>الصلاة</h2>' +
      '<div class="isl-athan-time" data-athan-time>--:--</div>' +
      '<p class="isl-athan-date" data-athan-date></p>' +
      '<p class="isl-athan-text" data-athan-text></p>' +
      '<button type="button" class="isl-athan-action" data-athan-action>تم</button>' +
      '</div></div></div>'
    );
    athan._audio = new Audio("/audio/adhan-alert.mp3");
    athan._audio.preload = "auto";
    document.body.appendChild(athan);
    function dismissAthan() { athan.hidden = true; try { athan._audio.pause(); athan._audio.currentTime = 0; } catch (e) {} }
    athan.querySelector(".isl-athan-dismiss").addEventListener("click", dismissAthan);
    athan.querySelector("[data-athan-action]").addEventListener("click", dismissAthan);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!mushaf.hidden) closeMushaf();
      else if (!modal.hidden) closeModal();
    });
  }

  function openSheet(title, html, onMount) {
    ensureLayers();
    sheetStack.push({ title: title, html: html, onMount: onMount });
    renderSheet();
  }

  function renderSheet() {
    var cur = sheetStack[sheetStack.length - 1];
    if (!cur) return;
    sheetTitle.textContent = cur.title;
    sheetBody.innerHTML = cur.html;
    sheetBody.scrollTop = 0;
    backBtn.hidden = sheetStack.length < 2;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    if (typeof cur.onMount === "function") cur.onMount(sheetBody);
  }

  function goBackSheet() {
    sheetStack.pop();
    if (!sheetStack.length) return closeModal();
    var cur = sheetStack[sheetStack.length - 1];
    sheetTitle.textContent = cur.title;
    sheetBody.innerHTML = cur.html;
    backBtn.hidden = sheetStack.length < 2;
    if (typeof cur.onMount === "function") cur.onMount(sheetBody);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    sheetStack = [];
    sheetBody.innerHTML = "";
    stopCompass();
    if (mushaf && mushaf.hidden) document.body.style.overflow = "";
  }

  /* ============================================================
     1) القرآن الكريم — قاموس السور ثم المصحف
     ============================================================ */
  function openQuran() {
    var list = D.surahs || [];
    var html =
      '<input type="search" class="isl-search" placeholder="ابحث عن سورة بالاسم أو الرقم…" aria-label="بحث في السور">' +
      '<div class="isl-surah-list" data-surah-list>' +
      list.map(surahRow).join("") +
      "</div>";

    openSheet("قاموس القرآن الكريم", html, function (root) {
      var box = root.querySelector("[data-surah-list]");
      root.querySelector(".isl-search").addEventListener("input", function () {
        var q = this.value.trim();
        var filtered = !q
          ? list
          : list.filter(function (s) {
              return s.name.indexOf(q) > -1 || String(s.number) === q || String(s.number).indexOf(q) === 0;
            });
        box.innerHTML = filtered.length
          ? filtered.map(surahRow).join("")
          : '<p class="isl-note">لا توجد نتائج مطابقة.</p>';
      });
      box.addEventListener("click", function (e) {
        var row = e.target.closest("[data-surah]");
        if (row) openMushaf(parseInt(row.getAttribute("data-surah"), 10));
      });
    });
  }

  function surahRow(s) {
    return (
      '<button type="button" class="isl-surah" data-surah="' + s.number + '">' +
      '<span class="isl-surah-num"><span>' + s.number + "</span></span>" +
      "<span><span class=\"isl-surah-name\">سورة " + esc(s.name) + "</span>" +
      '<span class="isl-surah-sub">' + esc(s.type) + " • " + s.ayahs + " آية • صفحة " + s.page + "</span></span>" +
      "</button>"
    );
  }

  /* ---------------- عارض المصحف ---------------- */
  var pdfPage = 1, hideTimer = null;

  async function loadPdfLib() {
    if (pdfLib) return pdfLib;
    pdfLib = await import("/vendor/pdfjs/pdf.min.mjs");
    pdfLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
    return pdfLib;
  }

  async function openMushaf(surahNumber) {
    ensureLayers();
    var s = (D.surahs || []).find(function (x) { return x.number === surahNumber; });
    pdfPage = s ? s.page : 1;
    mushaf.hidden = false;
    document.body.style.overflow = "hidden";
    if (mushaf.requestFullscreen) mushaf.requestFullscreen().catch(function () {});
    showMushafClose();
    try {
      var lib = await loadPdfLib();
      if (!pdfDoc) pdfDoc = await lib.getDocument({ url: D.mushafPath || "/quran/quran.pdf", cMapUrl: "/vendor/pdfjs/cmaps/", cMapPacked: true }).promise;
      await renderPage(pdfPage);
    } catch (error) { console.log("[v0] Mushaf render failed", error); }
    bindMushafGestures();
  }

  async function renderPage(n) {
    if (!pdfDoc) return;
    pdfPage = Math.min(Math.max(1, n), pdfDoc.numPages);
    if (rendering) { pendingPage = pdfPage; return; }
    rendering = true;
    try {
      var page = await pdfDoc.getPage(pdfPage);
      var base = page.getViewport({ scale: 1 });
      var availableWidth = Math.max(1, window.innerWidth - 8);
      var availableHeight = Math.max(1, window.innerHeight - 8);
      var scale = Math.min(availableWidth / base.width, availableHeight / base.height) * mushafZoom;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var viewport = page.getViewport({ scale: scale * dpr });
      mushafCanvas.width = Math.floor(viewport.width);
      mushafCanvas.height = Math.floor(viewport.height);
      mushafCanvas.style.width = Math.floor(viewport.width / dpr) + "px";
      mushafCanvas.style.height = Math.floor(viewport.height / dpr) + "px";
      await page.render({ canvasContext: mushafCanvas.getContext("2d"), viewport: viewport }).promise;
    } finally {
      rendering = false;
      if (pendingPage) { var next = pendingPage; pendingPage = null; renderPage(next); }
    }
  }

  var gesturesBound = false;
  function bindMushafGestures() {
    if (gesturesBound) return;
    gesturesBound = true;
    var sx = 0, sy = 0, moved = false, pinchStart = 0, zoomStart = 1;

    mushaf.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        pinchStart = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        zoomStart = mushafZoom;
        moved = true;
        return;
      }
      if (!e.touches.length) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false;
    }, { passive: true });

    mushaf.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 2 || !pinchStart) return;
      var distance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      var nextZoom = Math.min(2.5, Math.max(1, zoomStart * distance / pinchStart));
      if (Math.abs(nextZoom - mushafZoom) < 0.02) return;
      mushafZoom = nextZoom;
      renderPage(pdfPage);
    }, { passive: true });

    mushaf.addEventListener("touchend", function (e) {
      if (pinchStart) { pinchStart = 0; return; }
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { closeMushaf(); return; }
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        moved = true;
        renderPage(dx > 0 ? pdfPage + 1 : pdfPage - 1);
      }
      if (!moved) toggleMushafClose();
    }, { passive: true });

    mushaf.addEventListener("click", function (e) {
      if (e.target === mushafClose) return;
      toggleMushafClose();
    });

    document.addEventListener("keydown", function (e) {
      if (mushaf.hidden) return;
      if (e.key === "ArrowLeft") renderPage(pdfPage + 1);
      if (e.key === "ArrowRight") renderPage(pdfPage - 1);
    });

    window.addEventListener("resize", function () {
      if (!mushaf.hidden) renderPage(pdfPage);
    });
  }

  function showMushafClose() {
    mushafClose.classList.remove("is-hidden");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { mushafClose.classList.add("is-hidden"); }, 3200);
  }
  function toggleMushafClose() {
    if (mushafClose.classList.contains("is-hidden")) showMushafClose();
    else { clearTimeout(hideTimer); mushafClose.classList.add("is-hidden"); }
  }
  function closeMushaf() {
    mushaf.hidden = true;
    clearTimeout(hideTimer);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    if (!modal || modal.hidden) document.body.style.overflow = "";
  }

  /* ============================================================
     2) الأدعية  3) الأذكار  4) الأحاديث
     ============================================================ */
  function catGrid(groups) {
    return (
      '<div class="isl-cat-grid">' +
      groups.map(function (g, i) {
        return (
          '<button type="button" class="isl-cat" data-cat="' + i + '">' + esc(g.title) +
          "<small>" + (g.items.length) + " " + (g.items.length > 10 ? "ذكرًا" : "عبارة") + "</small></button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function itemsHTML(group) {
    return (
      (group.note ? '<p class="isl-note">' + esc(group.note) + "</p>" : "") +
      group.items.map(function (it) {
        return (
          '<article class="isl-item">' +
          '<p class="isl-item-text">' + esc(it.text) + "</p>" +
          '<div class="isl-item-foot">' +
          (it.count ? '<span class="isl-chip">' + esc(it.count) + "</span>" : "") +
          "<span>" + esc(it.source || "") + "</span>" +
          "</div></article>"
        );
      }).join("")
    );
  }

  function openGroups(title, groups) {
    openSheet(title, catGrid(groups), function (root) {
      root.addEventListener("click", function (e) {
        var b = e.target.closest("[data-cat]");
        if (!b) return;
        var g = groups[parseInt(b.getAttribute("data-cat"), 10)];
        openSheet(g.title, itemsHTML(g));
      });
    });
  }

  function openHadiths() {
    var list = D.hadiths || [];
    var html =
      '<input type="search" class="isl-search" placeholder="ابحث في الأحاديث…" aria-label="بحث في الأحاديث">' +
      '<div data-hadith-list>' + list.map(hadithCard).join("") + "</div>";

    openSheet("الأحاديث النبوية وشرحها", html, function (root) {
      var box = root.querySelector("[data-hadith-list]");
      root.querySelector(".isl-search").addEventListener("input", function () {
        var q = this.value.trim();
        var f = !q ? list : list.filter(function (h) {
          return (h.text + " " + (h.tafsir || "") + " " + (h.source || "")).indexOf(q) > -1;
        });
        box.innerHTML = f.length ? f.map(hadithCard).join("") : '<p class="isl-note">لا توجد نتائج مطابقة.</p>';
      });
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tafsir-toggle]");
        if (!b) return;
        var box2 = b.parentElement.querySelector(".isl-tafsir");
        var open = box2.hasAttribute("hidden");
        if (open) box2.removeAttribute("hidden"); else box2.setAttribute("hidden", "");
        b.textContent = open ? "إخفاء الشرح" : "عرض شرح الحديث";
      });
    });
  }

  function hadithCard(h) {
    return (
      '<article class="isl-item">' +
      '<p class="isl-item-text">' + esc(h.text) + "</p>" +
      '<div class="isl-item-foot"><span class="isl-chip">' + esc(h.grade || "صحيح") + "</span><span>" + esc(h.source || "") + "</span></div>" +
      '<button type="button" class="isl-mini-btn" data-tafsir-toggle>عرض شرح الحديث</button>' +
      '<div class="isl-tafsir" hidden><strong>الشرح</strong>' + esc(h.tafsir || "") + "</div>" +
      "</article>"
    );
  }

  /* ============================================================
     5) مواقيت الصلاة
     ============================================================ */
  async function fetchTimingsByCoords(lat, lng) {
    var url = "https://api.aladhan.com/v1/timings/" + Math.floor(Date.now() / 1000) +
      "?latitude=" + lat + "&longitude=" + lng + "&method=5";
    var r = await fetch(url);
    if (!r.ok) throw new Error("api");
    var j = await r.json();
    return j.data;
  }

  async function fetchTimingsByAddress(address) {
    var url = "https://api.aladhan.com/v1/timingsByAddress?address=" + encodeURIComponent(address) + "&method=5";
    var r = await fetch(url);
    if (!r.ok) throw new Error("api");
    var j = await r.json();
    if (!j || !j.data || !j.data.timings) throw new Error("notfound");
    return j.data;
  }

  function clean(t) { return String(t || "").split(" ")[0]; }

  function applyTimings(data, loc) {
    state.timings = {};
    PRAYER_KEYS.forEach(function (p) { state.timings[p.key] = clean(data.timings[p.key]); });
    if (loc) { state.loc = loc; saveLoc(); }
    if (data.meta && data.meta.latitude != null && state.loc) {
      state.loc.lat = data.meta.latitude;
      state.loc.lng = data.meta.longitude;
      saveLoc();
    }
    computeNext();
    paintCards();
    startTick();
  }

  function computeNext() {
    if (!state.timings) return;
    var now = new Date();
    var found = null;
    PRAYER_KEYS.filter(function (p) { return !p.info; }).forEach(function (p) {
      if (found) return;
      var parts = state.timings[p.key].split(":");
      var d = new Date(now);
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      if (d > now) found = { key: p.key, name: p.name, at: d, time: state.timings[p.key] };
    });
    if (!found) {
      var parts2 = state.timings.Fajr.split(":");
      var d2 = new Date(now.getTime() + 86400000);
      d2.setHours(parseInt(parts2[0], 10), parseInt(parts2[1], 10), 0, 0);
      found = { key: "Fajr", name: "الفجر", at: d2, time: state.timings.Fajr };
    }
    state.next = found;
  }

  function paintCards() {
    var hijri = hijriToday();
    var greg = "";
    try { greg = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date()); } catch (e) {}

    document.querySelectorAll("[data-isl-card]").forEach(function (card) {
      var nameEl = card.querySelector("[data-isl-pname]");
      var timeEl = card.querySelector("[data-isl-ptime]");
      var metaEl = card.querySelector("[data-isl-pmeta]");
      var cdEl = card.querySelector("[data-isl-pcd]");
      var stripEl = card.querySelector("[data-isl-pstrip]");

      if (!state.next) {
        nameEl.textContent = "مواقيت الصلاة";
        timeEl.innerHTML = "--:--";
        metaEl.textContent = greg + (hijri ? " • " + hijri : "");
        cdEl.textContent = "جاري تحديد موقعك تلقائيًا…";
        if (stripEl) stripEl.innerHTML = "";
        return;
      }
      var f = fmt12(state.next.time);
      nameEl.textContent = "الصلاة القادمة: " + state.next.name;
      timeEl.innerHTML = esc(f.t) + "<small>" + f.mer + "</small>";
      metaEl.innerHTML =
        esc(greg) +
        (hijri ? '<span class="isl-dot">•</span>' + esc(hijri) : "") +
        (state.loc && state.loc.label ? '<span class="isl-dot">•</span>' + esc(state.loc.label) : "");
      cdEl.textContent = "متبقٍ " + remainText(state.next.at);

      if (stripEl) {
        stripEl.innerHTML = state.timings
          ? PRAYER_KEYS.filter(function (p) { return !p.info; }).map(function (p) {
              var ff = fmt12(state.timings[p.key]);
              var isNext = state.next && state.next.key === p.key;
              return (
                '<span class="isl-strip-item' + (isNext ? " is-next" : "") + '">' +
                '<b>' + esc(p.name) + "</b>" +
                "<i>" + ff.t + " " + ff.mer + "</i></span>"
              );
            }).join("")
          : "";
      }
    });
  }

  function remainText(at) {
    var ms = at - new Date();
    if (ms < 0) ms = 0;
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    return h > 0 ? h + " س " + pad(m % 60) + " د" : pad(m) + " د " + pad(Math.floor((ms % 60000) / 1000)) + " ث";
  }

  function startTick() {
    if (state.tickTimer) return;
    state.tickTimer = setInterval(function () {
      if (!state.next) return;
      if (new Date() >= state.next.at) {
        announce(state.next);
        computeNext();
      }
      paintCards();
      var body = document.querySelector("[data-times-body]");
      if (body) renderTimesBody(body);
    }, 1000);
  }

  function announce(p) {
    ensureLayers();
    var f = fmt12(p.time);
  var msg = "حان وقت صلاة " + p.name + " — " + f.t + " " + f.mer;
  playNotificationSound();
  var today = new Date();
  athan.querySelector("[data-athan-name]").textContent = "صلاة " + p.name;
  athan.querySelector("[data-athan-time]").textContent = f.t + " " + f.mer;
  athan.querySelector("[data-athan-date]").textContent = today.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  athan.querySelector("[data-athan-text]").textContent = "حافظ على صلاتك في وقتها";
  athan.hidden = false;
  try { athan._audio.currentTime = 0; athan._audio.play().catch(function () {}); } catch (e) {}
    setTimeout(function () { athan.hidden = true; }, 30000);
    try {
      if (window.Notification && Notification.permission === "granted") {
        new Notification("حان وقت الصلاة", { body: msg });
      }
    } catch (e) {}
    try {
      if (navigator.vibrate) navigator.vibrate([200, 120, 200]);
    } catch (e) {}
  }

  function openTimes() {
    openSheet("مواقيت الصلاة", '<div data-times-body></div>', function (root) {
      var body = root.querySelector("[data-times-body]");
      renderTimesBody(body);
      body.addEventListener("click", function (e) {
        if (e.target.closest("[data-use-gps]")) useGps(body);
        if (e.target.closest("[data-use-city]")) {
          var input = body.querySelector("[data-city-input]");
          useCity(input && input.value, body);
        }
        if (e.target.closest("[data-notify]")) askNotify();
      });
      body.addEventListener("keypress", function (e) {
        if (e.key === "Enter" && !e.nativeEvent?.isComposing && e.keyCode !== 229 && e.target.matches("[data-city-input]")) {
          useCity(e.target.value, body);
        }
      });
    });
  }

  function renderTimesBody(body) {
    var rows = state.timings
      ? PRAYER_KEYS.map(function (p) {
          var f = fmt12(state.timings[p.key]);
          var isNext = state.next && state.next.key === p.key;
          return (
            '<div class="isl-time-row' + (isNext ? " is-next" : "") + '">' +
            "<span>" + esc(p.name) + (p.info ? " (ليس صلاة)" : "") + "</span>" +
            "<b>" + f.t + " " + f.mer + "</b></div>"
          );
        }).join("")
      : '<p class="isl-note">حدّد موقعك أولًا لعرض المواقيت.</p>';

    var head = state.next
      ? '<p class="isl-note">الصلاة القادمة: <strong>' + esc(state.next.name) + "</strong> — متبقٍ " + remainText(state.next.at) + "</p>"
      : "";

    body.innerHTML =
      '<div class="isl-loc-box">' +
      '<button type="button" class="isl-btn" data-use-gps>تحديد موقعي تلقائيًا</button>' +
      '<input type="text" data-city-input placeholder="أو اكتب مدينة أخرى: القاهرة، مكة…" value="' +
      esc(state.loc && state.loc.manual ? state.loc.label : "") + '" aria-label="اسم المدينة">' +
      '<button type="button" class="isl-btn ghost" data-use-city>عرض المواقيت</button>' +
      "</div>" +
      (state.loc ? '<p class="isl-note">الموقع الحالي: <strong>' + esc(state.loc.label) + "</strong></p>" : "") +
      head +
      '<div class="isl-times">' + rows + "</div>" +
      '<button type="button" class="isl-btn ghost" data-notify style="margin-top:12px">تشغيل تنبيه وقت الصلاة</button>' +
      '<p class="isl-note">المواقيت محسوبة بطريقة الهيئة المصرية العامة للمساحة عبر واجهة Aladhan، ويمكنك عرض مواقيت أي مدينة أخرى بكتابة اسمها.</p>';
  }

  function useGps(body) {
    if (!navigator.geolocation) return toast("المتصفح لا يدعم تحديد الموقع", "error");
    toast("جاري تحديد موقعك…", "info");
    navigator.geolocation.getCurrentPosition(
      async function (pos) {
        try {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          var data = await fetchTimingsByCoords(lat, lng);
          applyTimings(data, { lat: lat, lng: lng, label: "موقعي الحالي", manual: false });
          if (body) renderTimesBody(body);
          toast("تم تحديث المواقيت حسب موقعك", "success");
        } catch (e) { toast("تعذّر جلب المواقيت", "error"); }
      },
      function () { toast("لم يُسمح بالوصول إلى الموقع", "error"); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function useCity(city, body) {
    city = (city || "").trim();
    if (!city) return toast("اكتب اسم المدينة أولًا", "error");
    try {
      var data = await fetchTimingsByAddress(city);
      applyTimings(data, { label: city, manual: true });
      if (body) renderTimesBody(body);
      toast("تم عرض مواقيت " + city, "success");
    } catch (e) { toast("لم يتم العثور على المدينة", "error"); }
  }

  function askNotify() {
    if (!window.Notification) return toast("التنبيهات غير مدعومة في هذا المتصفح", "error");
    Notification.requestPermission().then(function (p) {
      toast(p === "granted" ? "تم ت��غيل تنبيه الصلاة" : "لم يتم السماح بالتنبيهات", p === "granted" ? "success" : "error");
    });
  }

  /* ============================================================
     6) اتجاه القبل��
     ============================================================ */
  var compassHandler = null, qiblaBearing = null;

  function bearingToKaaba(lat, lng) {
    var toRad = Math.PI / 180, toDeg = 180 / Math.PI;
    var f1 = lat * toRad, f2 = KAABA.lat * toRad, dl = (KAABA.lng - lng) * toRad;
    var y = Math.sin(dl) * Math.cos(f2);
    var x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) * toDeg + 360) % 360;
  }

  function distanceToKaaba(lat, lng) {
    var toRad = Math.PI / 180, R = 6371;
    var dLat = (KAABA.lat - lat) * toRad, dLng = (KAABA.lng - lng) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * toRad) * Math.cos(KAABA.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function openQibla() {
    var html =
      '<div class="isl-qibla-wrap">' +
      '<div class="isl-compass">' +
      '<div class="isl-compass-dial" data-dial>' +
      '<span class="isl-compass-dir n">ش</span><span class="isl-compass-dir s">ج</span>' +
      '<span class="isl-compass-dir e">ق</span><span class="isl-compass-dir w">غ</span>' +
      '<div class="isl-needle" data-needle><span class="isl-needle-arrow"></span><span class="isl-kaaba">🕋</span></div>' +
      "</div><div class=\"isl-compass-center\"></div></div>" +
      '<div class="isl-qibla-read" data-qibla-read>حدّد موقعك لمعرفة اتجاه القبلة</div>' +
      '<div class="isl-loc-box" style="justify-content:center">' +
      '<button type="button" class="isl-btn" data-qibla-gps>تحديد موقعي</button>' +
      '<button type="button" class="isl-btn ghost" data-qibla-compass>تشغيل البوصلة</button>' +
      "</div>" +
      '<p class="isl-note">وجّه الجهاز أفقيًا؛ سيتحرك رمز الكعبة 🕋 نحو اتجاه القبلة. إن لم تتوفر بوصلة في جهازك فاستخدم زاوية القبلة المعروضة بالدرجات من الشمال.</p>' +
      "</div>";

    openSheet("اتجاه القبلة", html, function (root) {
      root.querySelector("[data-qibla-gps]").addEventListener("click", function () { locateQibla(root); });
      root.querySelector("[data-qibla-compass]").addEventListener("click", function () { startCompass(root); });
      if (state.loc && state.loc.lat != null) setQibla(root, state.loc.lat, state.loc.lng);
    });
  }

  function setQibla(root, lat, lng) {
    qiblaBearing = bearingToKaaba(lat, lng);
    var needle = root.querySelector("[data-needle]");
    needle.style.transform = "rotate(" + qiblaBearing.toFixed(1) + "deg)";
    root.querySelector("[data-qibla-read]").innerHTML =
      "زاوية القبلة: <strong>" + qiblaBearing.toFixed(1) + "°</strong> من الشمال • المسافة إلى مكة " +
      distanceToKaaba(lat, lng).toLocaleString("ar-EG") + " كم";
  }

  function locateQibla(root) {
    if (!navigator.geolocation) return toast("المتصفح لا يدعم تحديد الموقع", "error");
    toast("جاري تحديد موقعك…", "info");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        state.loc = Object.assign({}, state.loc || {}, { lat: lat, lng: lng, label: (state.loc && state.loc.manual ? state.loc.label : "موقعي الحالي") });
        saveLoc();
        setQibla(root, lat, lng);
        startCompass(root);
        toast("تم تحديد اتجاه القبلة", "success");
      },
      function () { toast("لم يُسمح بالوصول إلى الموقع", "error"); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function startCompass(root) {
    var dial = root.querySelector("[data-dial]");
    function attach() {
      stopCompass();
      compassHandler = function (e) {
        var heading = e.webkitCompassHeading != null ? e.webkitCompassHeading
          : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
        if (heading == null) return;
        dial.style.transform = "rotate(" + (-heading).toFixed(1) + "deg)";
      };
      window.addEventListener("deviceorientationabsolute", compassHandler, true);
      window.addEventListener("deviceorientation", compassHandler, true);
    }
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then(function (p) {
        if (p === "granted") attach();
        else toast("لم يُسمح باستخدام البوصلة", "error");
      }).catch(function () { toast("تعذّر تشغيل البوصلة", "error"); });
    } else attach();
  }

  function stopCompass() {
    if (!compassHandler) return;
    window.removeEventListener("deviceorientationabsolute", compassHandler, true);
    window.removeEventListener("deviceorientation", compassHandler, true);
    compassHandler = null;
  }

  /* ============================================================
     التوجيه
     ============================================================ */
  function openTasbeeh() {
    var html = '<div class="isl-tasbeeh-wrap"><label for="islTasbeehText">اختر التسبيحة</label><select id="islTasbeehText">' + TASBEEH.map(function (item, i) { return '<option value="' + i + '">' + esc(item) + '</option>'; }).join('') + '</select>' +
      '<div class="isl-tasbeeh-count" data-tasbeeh-count>0</div><div class="isl-tasbeeh-progress"><span data-tasbeeh-progress></span></div>' +
      '<div class="isl-tasbeeh-targets" role="group" aria-label="عدد التسبيحات"><button type="button" data-target="30">30</button><button type="button" data-target="50">50</button><button type="button" data-target="100">100</button><button type="button" data-target="1000">1000</button><input type="number" min="1" max="100000" value="100" aria-label="عدد مخصص" data-target-input></div>' +
      '<button type="button" class="isl-tasbeeh-tap" data-tasbeeh-tap>اضغط للتسبيح</button><p class="isl-tasbeeh-label" data-tasbeeh-label>' + esc(TASBEEH[0]) + '</p><button type="button" class="isl-tasbeeh-reset" data-tasbeeh-reset>إعادة ضبط العداد</button></div>';
    openSheet("التسبيح", html, function (root) {
      var count = 0, target = 100, countEl = root.querySelector('[data-tasbeeh-count]'), progress = root.querySelector('[data-tasbeeh-progress]'), label = root.querySelector('[data-tasbeeh-label]'), select = root.querySelector('#islTasbeehText'), input = root.querySelector('[data-target-input]');
      function paint() { countEl.textContent = count + ' / ' + target; progress.style.width = Math.min(100, count / target * 100) + '%'; label.textContent = TASBEEH[parseInt(select.value, 10) || 0]; }
      root.querySelectorAll('[data-target]').forEach(function (b) { b.addEventListener('click', function () { target = parseInt(b.dataset.target, 10); input.value = target; count = 0; paint(); }); });
      input.addEventListener('change', function () { target = Math.min(100000, Math.max(1, parseInt(input.value, 10) || 1)); input.value = target; count = 0; paint(); });
      select.addEventListener('change', paint);
      root.querySelector('[data-tasbeeh-tap]').addEventListener('click', function () { if (count < target) count++; paint(); if (count === target) toast('أحسنت، اكتمل العدد المحدد', 'success'); });
      root.querySelector('[data-tasbeeh-reset]').addEventListener('click', function () { count = 0; paint(); });
      paint();
    });
  }

  function openSection(id) {
    ensureLayers();
    if (id === "tasbeeh") return openTasbeeh();
    if (id === "quran") return openQuran();
    if (id === "dua") return openGroups("الدعاء", D.duas || []);
    if (id === "adhkar") return openGroups("الأذكار", D.adhkar || []);
    if (id === "hadith") return openHadiths();
    if (id === "times") return openTimes();
    if (id === "qibla") return openQibla();
  }

  /* ---------------- تحديد الموقع تلقائيًا ---------------- */
  function autoLocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async function (pos) {
        try {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          var data = await fetchTimingsByCoords(lat, lng);
          applyTimings(data, { lat: lat, lng: lng, label: "موقعي الحالي", manual: false });
          // حدّث نافذة المواقيت إن كانت مفتوحة
          var body = document.querySelector("[data-times-body]");
          if (body) renderTimesBody(body);
          console.log("[v0] auto-location resolved");
        } catch (e) { console.log("[v0] auto timings failed"); }
      },
      function () { console.log("[v0] auto-location denied"); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000 }
    );
  }

  /* ---------------- التهيئة ---------------- */
  async function boot() {
    mountAll();
    if (state.loc) {
      try {
        var data = state.loc.manual
          ? await fetchTimingsByAddress(state.loc.label)
          : await fetchTimingsByCoords(state.loc.lat, state.loc.lng);
        applyTimings(data, null);
      } catch (e) { console.log("[v0] timings restore failed"); }
      // حدّث الموقع تلقائيًا في الخلفية إن كان الموقع محفوظًا عبر GPS
      if (!state.loc.manual) autoLocate();
    } else {
      // لا يوجد موقع محفوظ: حدّد موقع المستخدم تلقائيًا
      autoLocate();
    }
    startTick();
  }

  window.THIMAR_ISLAMIC_HUB = { mount: mountAll, open: openSection };
  window.mountIslamicHub = mountAll;
  window.openIslamicSection = openSection;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
