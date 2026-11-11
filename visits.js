// One fixed, aggregate page count. Never include form input, URLs, or identifiers.
(() => {
  if (location.hostname !== "abiemann.github.io" ||
      !location.pathname.startsWith("/BiemannWorldworks/") ||
      navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
  const pages = { home: "BiemannWorldworks", location: "BiemannWorldworks/gps" };
  const page = pages[document.body.dataset.visitPage];
  if (!page) return;
  fetch(`https://hits.sh/abiemann.github.io/${page}.svg`, {
    mode: "no-cors", credentials: "omit", referrerPolicy: "no-referrer",
    cache: "no-store", signal: AbortSignal.timeout(5000)
  }).catch(() => {}); // Counting must never prevent viewing or generating a QR.
})();
