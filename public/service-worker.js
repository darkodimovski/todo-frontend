/* Backoffice PWA service worker: push notifications + installability.
   Kept as a plain file in /public so it works in `npm start` and in builds. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Network passthrough. A fetch handler is part of what makes the app installable;
// no offline caching, so users always see live data.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Backoffice", body: event.data && event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Backoffice", {
      body: data.body || "",
      icon: "/logo192.png",
      badge: "/badge96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin) && "focus" in win) {
          win.navigate(target);
          return win.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
