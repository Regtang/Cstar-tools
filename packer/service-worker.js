const CACHE_NAME = "cstar-container-packer-v25";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./i18n.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./sample-cargo.csv",
  "./sample-cargo.xlsx",
  "./sample-cargo.docx",
  "./templates/Cstar货物导入模板.xlsx",
  "./docs/喜事达Cstar装箱软件用户手册.docx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
