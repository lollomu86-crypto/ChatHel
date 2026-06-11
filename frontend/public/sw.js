/* ChatHel service worker — handles Web Push notifications and click navigation. */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "ChatHel", body: "Nuova notifica" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) { /* keep defaults */ }
  const title = data.title || "ChatHel";
  const options = {
    body: data.body || "",
    icon: data.icon || "/chathel-symbol.png",
    badge: "/chathel-symbol.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/app" },
    vibrate: [80, 40, 80],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      if (c.url.includes(self.location.origin)) {
        c.focus();
        c.postMessage({ type: "navigate", url: target });
        return;
      }
    }
    return clients.openWindow(target);
  })());
});
