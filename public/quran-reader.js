(function () {
  "use strict";

  if (window.__thimarQuranReaderLoaded) return;
  window.__thimarQuranReaderLoaded = true;

  var MUSHAF_URL = "/quran/quran.pdf";
  var MUSHAF_CACHE = "thimar-mushaf-v1";
  var currentPage = 1;
  var totalPages = 569;
  var pdfDocument = null;
  var renderToken = 0;
  var scaleFactor = 1.8;
  var pdfLibPromise = null;

  function fetchMushaf() {
    return fetch(MUSHAF_URL).then(function (response) {
      if (!response.ok) throw new Error("mushaf fetch failed");
      return response.arrayBuffer();
    });
  }

  function mushafBytes() {
    if (!("caches" in window)) return fetchMushaf();
    return caches.open(MUSHAF_CACHE).then(function (cache) {
      return cache.match(MUSHAF_URL).then(function (hit) {
        if (hit) return hit.arrayBuffer();
        return fetch(MUSHAF_URL).then(function (response) {
          if (!response.ok) throw new Error("mushaf fetch failed");
          try { cache.put(MUSHAF_URL, response.clone()); } catch (error) {}
          return response.arrayBuffer();
        });
      });
    }).catch(fetchMushaf);
  }

  function loadPdf() {
    if (pdfDocument) return Promise.resolve(pdfDocument);
    if (!pdfLibPromise) {
      pdfLibPromise = Promise.all([
        import("/vendor/pdfjs/pdf.min.mjs"),
        mushafBytes()
      ]).then(function (parts) {
        var pdfjs = parts[0].default || parts[0];
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
        return pdfjs.getDocument({
          data: new Uint8Array(parts[1]),
          cMapUrl: "/vendor/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
          disableFontFace: true,
          useSystemFonts: false
        }).promise;
      });
    }
    return pdfLibPromise.then(function (pdf) {
      pdfDocument = pdf;
      totalPages = pdf.numPages;
      return pdf;
    });
  }

  function setPage(page) {
    var requestedPage = parseInt(page, 10) || 1;
    if (requestedPage < 1 || (pdfDocument && requestedPage > totalPages)) return;
    currentPage = Math.min(totalPages, Math.max(1, requestedPage));
    if (typeof window.__quranResetZoom === "function") window.__quranResetZoom();

    var canvas = document.getElementById("quranOriginalCanvas");
    var token = ++renderToken;
    if (!canvas) return;

    loadPdf().then(function (pdf) {
      return pdf.getPage(currentPage);
    }).then(function (pageObj) {
      if (token !== renderToken) return;
      var frame = document.querySelector(".quran-reader-frame");
      if (!frame) return;
      var base = pageObj.getViewport({ scale: 1 });
      var maxW = Math.max(1, frame.clientWidth - 24);
      var maxH = Math.max(1, frame.clientHeight - 24);
      var fit = Math.min(maxW / base.width, maxH / base.height);
      var viewport = pageObj.getViewport({ scale: Math.max(fit, 0.1) * scaleFactor });
      var ratio = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = Math.ceil(viewport.width) + "px";
      canvas.style.height = Math.ceil(viewport.height) + "px";
      return pageObj.render({
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport: viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
      }).promise;
    }).catch(function (error) {
      console.warn("[v0] Quran reader failed to render", error);
    });
  }

  function openQuranReader(page) {
    if (typeof window.showPage === "function") window.showPage("quranReaderPage");
    setPage(page || 1);
    var reader = document.getElementById("quranReaderPage");
    if (reader && reader.requestFullscreen) reader.requestFullscreen().catch(function () {});
  }

  function closeQuranReader() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    if (typeof window.goBack === "function") window.goBack();
    else if (typeof window.showPage === "function") window.showPage("lockScreen");
  }

  window.openQuranReader = openQuranReader;
  window.nextQuranPage = function () { setPage(currentPage + 1); };
  window.previousQuranPage = function () { setPage(currentPage - 1); };
  window.closeQuranReader = closeQuranReader;
  window.__thimarMountQuranReader = function (page) { setPage(page || currentPage); };

  document.addEventListener("keydown", function (event) {
    var reader = document.getElementById("quranReaderPage");
    if (!reader || reader.classList.contains("hidden")) return;
    if (event.key === "ArrowRight") { event.preventDefault(); window.nextQuranPage(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); window.previousQuranPage(); }
    if (event.key === "Escape") { event.preventDefault(); closeQuranReader(); }
  });

  (function bindGestures() {
    var MIN_SCALE = 1;
    var MAX_SCALE = 4;
    var scale = 1;
    var tx = 0;
    var ty = 0;
    var pointers = {};
    var pinch = null;
    var pan = null;
    var swipe = null;

    function wrapEl() { return document.getElementById("quranZoomWrap"); }
    function frameEl() { return document.querySelector(".quran-reader-frame"); }
    function applyTransform() {
      var wrapper = wrapEl();
      if (wrapper) wrapper.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + scale + ")";
    }
    function clampPan() {
      if (scale <= 1.001) { tx = 0; ty = 0; return; }
      var frame = frameEl();
      if (!frame) return;
      var maxX = (frame.clientWidth * (scale - 1)) / 2 + frame.clientWidth * 0.25;
      var maxY = (frame.clientHeight * (scale - 1)) / 2 + frame.clientHeight * 0.25;
      tx = Math.max(-maxX, Math.min(maxX, tx));
      ty = Math.max(-maxY, Math.min(maxY, ty));
    }
    function resetZoom() { scale = 1; tx = 0; ty = 0; applyTransform(); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    window.__quranResetZoom = resetZoom;

    function onPointerDown(event) {
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        if (scale > 1.001) pan = { startX: event.clientX, startY: event.clientY, originX: tx, originY: ty };
        else swipe = { startX: event.clientX, startY: event.clientY };
      } else if (ids.length === 2) {
        swipe = null;
        var points = ids.map(function (id) { return pointers[id]; });
        pinch = { startDist: distance(points[0], points[1]), startScale: scale, startTx: tx, startTy: ty };
      }
      try { event.target.setPointerCapture(event.pointerId); } catch (error) {}
    }

    function onPointerMove(event) {
      if (!pointers[event.pointerId]) return;
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        var points = ids.map(function (id) { return pointers[id]; });
        var ratio = distance(points[0], points[1]) / (pinch.startDist || 1);
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.startScale * ratio));
        tx = pinch.startTx;
        ty = pinch.startTy;
        clampPan();
        applyTransform();
        event.preventDefault();
      } else if (ids.length === 1 && pan) {
        tx = pan.originX + (event.clientX - pan.startX);
        ty = pan.originY + (event.clientY - pan.startY);
        clampPan();
        applyTransform();
        event.preventDefault();
      } else if (ids.length === 1 && swipe && Math.abs(event.clientX - swipe.startX) > 10) {
        event.preventDefault();
      }
    }

    function onPointerUp(event) {
      var finishedSwipe = swipe;
      delete pointers[event.pointerId];
      var ids = Object.keys(pointers);
      if (ids.length < 2) pinch = null;
      if (ids.length < 1) pan = null;
      swipe = null;
      if (finishedSwipe && scale <= 1.001) {
        var dx = event.clientX - finishedSwipe.startX;
        var dy = event.clientY - finishedSwipe.startY;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) window.nextQuranPage();
          else window.previousQuranPage();
        }
      }
    }

    function onDoubleClick() {
      if (scale > 1.001) resetZoom();
      else { scale = 2; clampPan(); applyTransform(); }
    }

    function bind() {
      var surface = document.getElementById("quranSwipeSurface");
      if (!surface) {
        window.setTimeout(bind, 60);
        return;
      }
      if (surface.dataset.quranGesturesBound === "1") return;
      surface.dataset.quranGesturesBound = "1";
      surface.addEventListener("pointerdown", onPointerDown);
      surface.addEventListener("pointermove", onPointerMove);
      surface.addEventListener("pointerup", onPointerUp);
      surface.addEventListener("pointercancel", onPointerUp);
      surface.addEventListener("dblclick", onDoubleClick);
    }

    bind();
  }());

  function openRouteIfVisible() {
    var reader = document.getElementById("quranReaderPage");
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (reader && !reader.classList.contains("hidden") && path === "/quran-reader") openQuranReader(1);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", openRouteIfVisible, { once: true });
  else window.setTimeout(openRouteIfVisible, 0);
}());
