/* ============================================================
   Dental Appointment Scheduler
   Android Web Push Service Worker
   ============================================================ */

const CACHE_NAME = "dental-appointment-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ============================================================
   PUSH RECEIVED
   ============================================================ */

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Dental Appointment",
      body: event.data ? event.data.text() : "You have a new notification.",
    };
  }

  const title = data.title || "Dental Appointment";

  const options = {
    body: data.body || "You have a new appointment notification.",

    icon: data.icon || "/icon-192.png",

    badge: data.badge || "/icon-192.png",

    tag: data.tag || "dental-appointment",

    renotify: true,

    vibrate: [200, 100, 200],

    requireInteraction: false,

    data: {
      url: data.url || "/",
      appointmentId: data.appointmentId || null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ============================================================
   NOTIFICATION CLICK
   ============================================================ */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.url ||
    "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {

      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }

      return undefined;
    })
  );
});

/* ============================================================
   NOTIFICATION CLOSE
   ============================================================ */

self.addEventListener("notificationclose", () => {
  // Nothing required.
});