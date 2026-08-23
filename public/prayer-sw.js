const timers = new Map();
const notified = new Set();
const ICON = '/images/prayer-alert-reference.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function schedulePrayer(prayer) {
  const when = new Date(prayer.at).getTime();
  const delay = when - Date.now();
  if (!prayer.key || !Number.isFinite(when) || delay <= 0 || delay > 26 * 60 * 60 * 1000) return;
  clearTimeout(timers.get(prayer.key));
  timers.set(prayer.key, setTimeout(() => notifyPrayer(prayer), delay));
}

async function notifyPrayer(prayer) {
  const id = `${prayer.key}-${prayer.day}`;
  if (notified.has(id)) return;
  notified.add(id);
  await self.registration.showNotification(`حان وقت صلاة ${prayer.name}`, {
    body: `${prayer.displayTime} — حافظ على صلاتك في وقتها`,
    icon: ICON,
    badge: ICON,
    image: ICON,
    tag: `prayer-${prayer.key}`,
    renotify: false,
    requireInteraction: true,
    vibrate: [250, 120, 250],
    actions: [
      { action: 'open-prayer', title: 'فتح شاشة الصلاة' },
      { action: 'close', title: 'إغلاق' }
    ],
    data: { url: '/app.html?prayer=1', prayer }
  });
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'schedule-prayers') {
    for (const prayer of data.prayers || []) schedulePrayer(prayer);
  }
  if (data.type === 'clear-prayers') {
    timers.forEach(clearTimeout); timers.clear(); notified.clear();
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/app.html', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) if ('focus' in client) return client.focus();
    return self.clients.openWindow(url);
  }));
});
