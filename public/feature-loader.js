(function () {
  "use strict";

  var featureMap = Object.freeze({
    islamic: {
      styles: ["/islamic-hub.css", "/prayer-screen.css"],
      scripts: ["/islamic-data.js", "/prayer-screen.js", "/islamic-hub.js"],
    },
    messaging: {
      styles: ["/messaging.css"],
      scripts: ["/messaging.js"],
    },
    quran: {
      styles: [],
      scripts: ["/quran-reader.js"],
    },
    tuhfat: {
      styles: ["/tuhfat.css"],
      scripts: ["/tuhfat-data.js", "/tuhfat.js"],
    },
  });

  var featurePromises = Object.create(null);
  var scriptPromises = Object.create(null);

  function loadStyle(href) {
    var existing = document.querySelector('link[data-thimar-feature-style="' + href + '"]');
    if (existing) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.thimarFeatureStyle = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    var existing = document.querySelector('script[data-thimar-feature-script="' + src + '"]');
    if (existing) return Promise.resolve();

    scriptPromises[src] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.thimarFeatureScript = src;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        delete scriptPromises[src];
        reject(new Error("تعذر تحميل ميزة التطبيق"));
      };
      document.head.appendChild(script);
    });
    return scriptPromises[src];
  }

  function loadFeature(name) {
    var config = featureMap[name];
    if (!config) return Promise.reject(new Error("ميزة غير معروفة"));
    if (featurePromises[name]) return featurePromises[name];

    featurePromises[name] = Promise.resolve().then(function () {
      config.styles.forEach(loadStyle);
      return config.scripts.reduce(function (chain, src) {
        return chain.then(function () { return loadScript(src); });
      }, Promise.resolve());
    }).then(function () {
      window.dispatchEvent(new CustomEvent("thimar:feature-ready", { detail: { name: name } }));
      return true;
    }).catch(function (error) {
      delete featurePromises[name];
      throw error;
    });

    return featurePromises[name];
  }

  function installProxy(name, feature) {
    if (typeof window[name] === "function") return;
    var proxy = function () {
      var args = Array.prototype.slice.call(arguments);
      return loadFeature(feature).then(function () {
        var target = window[name];
        if (typeof target === "function" && target !== proxy) return target.apply(window, args);
        return undefined;
      });
    };
    window[name] = proxy;
  }

  installProxy("openTuhfat", "tuhfat");
  installProxy("openIslamicSection", "islamic");
  installProxy("openQuranReader", "quran");
  installProxy("nextQuranPage", "quran");
  installProxy("previousQuranPage", "quran");
  installProxy("closeQuranReader", "quran");

  window.THIMAR_FEATURES = featureMap;
  window.loadThimarFeature = loadFeature;
  window.ensureThimarFeature = loadFeature;
})();
