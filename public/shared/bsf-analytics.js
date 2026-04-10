(function () {
  if (window.__bsfAnalyticsScheduled) return;
  window.__bsfAnalyticsScheduled = true;

  var GA_ID = "G-Q4EYY24EDZ";
  var dataLayer = (window.dataLayer = window.dataLayer || []);

  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      dataLayer.push(arguments);
    };
  }

  function appendScript(src, options) {
    var script = document.createElement("script");
    script.src = src;
    if (options && options.async) script.async = true;
    if (options && options.defer) script.defer = true;
    if (options && options.onload) script.onload = options.onload;
    document.head.appendChild(script);
  }

  function loadAnalytics() {
    if (window.__bsfAnalyticsLoaded) return;
    window.__bsfAnalyticsLoaded = true;

    window.gtag("js", new Date());
    window.gtag("config", GA_ID);

    appendScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID), {
      async: true
    });

    appendScript("/_vercel/insights/script.js", {
      defer: true
    });
  }

  function scheduleLoad() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadAnalytics, { timeout: 2500 });
      return;
    }
    window.setTimeout(loadAnalytics, 1200);
  }

  if (document.readyState === "complete") {
    scheduleLoad();
    return;
  }

  window.addEventListener("load", scheduleLoad, { once: true });
})();
