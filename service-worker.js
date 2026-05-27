const CACHE_NAME = "gokhan-makina-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

try {
  importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyBZfRIh5ArL-WObbjh09XMa0y--2nvUyFI",
    authDomain: "gokhan-makina.firebaseapp.com",
    projectId: "gokhan-makina",
    storageBucket: "gokhan-makina.firebasestorage.app",
    messagingSenderId: "1088331719728",
    appId: "1:1088331719728:web:58c5e78bb205164be279f5",
    measurementId: "G-1WT7FVD1NY"
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Yeni servis görevi";
    const options = {
      body: payload.notification?.body || "Yeni bir görev atandı.",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: {
        url: payload.data?.url || self.registration.scope
      }
    };

    self.registration.showNotification(title, options);
  });
} catch (error) {
  console.warn("Firebase Messaging service worker yüklenemedi:", error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return undefined;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
