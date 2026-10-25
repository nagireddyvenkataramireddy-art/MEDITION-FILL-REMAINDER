// Service Worker for MediMind Smart Medication Reminders (Web Push + Background Alarms + Offline App Shell)
const CACHE_NAME = 'medimind-v5';
const APP_ICON = '/icons/icon-192x192.svg';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];
const DB_NAME = 'medimind_sw_db';
const DB_VERSION = 1;
const STORE_NAME = 'alarms';

// Active in-memory timers
let activeTimers = new Map();
let checkLoopInterval = null;

// Helper: IndexedDB for persistent alarm storage across SW restarts
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAlarms(alarms) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    alarms.forEach(a => store.put(a));
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[SW] saveAlarms error:', err);
  }
}

async function getStoredAlarms() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

async function removeAlarm(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {}
}

// Multi-stage notification dispatcher: guarantees notification posts even if browser/WebView rejects actions or icons
async function showSafeNotification(title, richOptions) {
  try {
    await self.registration.showNotification(title, richOptions);
    return true;
  } catch (err1) {
    console.warn('[SW] Rich showNotification failed, retrying without actions:', err1);
    try {
      const fallbackOptions = {
        body: richOptions.body || 'Time to take your medication.',
        tag: richOptions.tag || `med-${Date.now()}`,
        vibrate: [500, 200, 500, 200, 1000],
        requireInteraction: true,
        data: richOptions.data || {}
      };
      await self.registration.showNotification(title, fallbackOptions);
      return true;
    } catch (err2) {
      console.warn('[SW] Secondary showNotification failed, retrying minimal:', err2);
      try {
        await self.registration.showNotification(title, {
          body: richOptions.body || 'Time to take your medication.'
        });
        return true;
      } catch (err3) {
        console.error('[SW] Minimal showNotification failed:', err3);
        return false;
      }
    }
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
      await restoreAndScheduleAlarms();
      startSwCheckLoop();
    })()
  );
});

// Offline-capable fetch handler (network-first with cache fallback for navigation & static assets)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Skip API calls and external analytics
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/');
        })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Trigger a high-priority system notification with vibration and alert sound
async function fireMedicationNotification(dose) {
  const { id, medicationId, name, dosage, time, instruction, sound } = dose;

  const title = dose.title || `⏰ Time for ${name || 'Medication'} (${time || ''})`;
  const body = dose.body || `Scheduled dose: ${dosage || '1 dose'}. ${instruction ? instruction + ' • ' : ''}Tap Taken to record.`;
  const tag = `med-${medicationId || 'pill'}-${time || Date.now()}`;

  const options = {
    body,
    icon: APP_ICON,
    badge: APP_ICON,
    vibrate: [500, 200, 500, 200, 1000, 200, 1000],
    tag,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      id,
      medicationId,
      time,
      name,
      dosage,
      sound: sound || 'alert',
      timestamp: Date.now()
    },
    actions: medicationId && medicationId !== 'test' && medicationId !== 'welcome' ? [
      { action: 'take', title: '✅ Taken' },
      { action: 'snooze', title: '⏰ Snooze 15m' }
    ] : [
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  await showSafeNotification(title, options);

  // Notify any open or backgrounded clients that alarm fired so they play loud chime audio
  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({
        type: 'MEDICATION_ALARM_FIRED',
        dose
      });
    }
  } catch (e) {}

  if (id) {
    await removeAlarm(id);
  }
}

// TRUE WEB PUSH EVENT LISTENER: Wakes up Service Worker when app is closed or phone screen is locked!
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: '⏰ Medication Reminder',
        body: event.data.text() || 'It is time to take your scheduled medication.'
      };
    }
  }

  const dose = {
    id: payload.id || `push-${Date.now()}`,
    medicationId: payload.medicationId || 'pill',
    name: payload.name || 'Medication',
    dosage: payload.dosage || '1 dose',
    instruction: payload.instruction || '',
    time: payload.time || '',
    sound: payload.sound || 'alert',
    title: payload.title || `⏰ Time for ${payload.name || 'Medication'}`,
    body: payload.body || `Scheduled dose: ${payload.dosage || '1 dose'}. Tap Taken to record.`
  };

  event.waitUntil(fireMedicationNotification(dose));
});

// Clear all running timeout timers
function clearAllTimers() {
  activeTimers.forEach((timerId) => clearTimeout(timerId));
  activeTimers.clear();
}

// Schedule alarms for all upcoming doses
async function scheduleDoseAlarms(doses) {
  clearAllTimers();
  await saveAlarms(doses);

  const now = Date.now();

  doses.forEach((dose) => {
    const delay = dose.targetTimestamp - now;
    
    // If due now or up to 15 minutes past due and not taken, fire immediately
    if (delay <= 0 && delay > -15 * 60 * 1000) {
      fireMedicationNotification(dose);
      return;
    }

    // If upcoming in the future (within next 36 hours)
    if (delay > 0 && delay < 36 * 60 * 60 * 1000) {
      const timerId = setTimeout(() => {
        fireMedicationNotification(dose);
        activeTimers.delete(dose.id);
      }, delay);
      activeTimers.set(dose.id, timerId);

      // Web Notification Triggers API (Native Android AlarmManager integration where supported)
      if ('showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') {
        try {
          self.registration.showNotification(`⏰ Time for ${dose.name} (${dose.time})`, {
            body: `Scheduled: ${dose.dosage || '1 dose'}. Please take your medicine.`,
            icon: APP_ICON,
            badge: APP_ICON,
            vibrate: [500, 200, 500, 200, 1000],
            tag: `trigger-${dose.id}`,
            showTrigger: new TimestampTrigger(dose.targetTimestamp),
            data: dose
          });
        } catch (trigErr) {}
      }
    }
  });

  startSwCheckLoop();
}

function startSwCheckLoop() {
  if (checkLoopInterval) clearInterval(checkLoopInterval);
  checkLoopInterval = setInterval(async () => {
    const stored = await getStoredAlarms();
    if (!stored || stored.length === 0) return;
    const now = Date.now();
    for (const dose of stored) {
      if (now >= dose.targetTimestamp && now - dose.targetTimestamp < 15 * 60 * 1000) {
        await fireMedicationNotification(dose);
      }
    }
  }, 10000);
}

// Restore alarms from IndexedDB upon wake/restart
async function restoreAndScheduleAlarms() {
  const stored = await getStoredAlarms();
  if (stored && stored.length > 0) {
    await scheduleDoseAlarms(stored);
  }
}

// Handle incoming messages from React clients
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SYNC_SCHEDULE') {
    if (Array.isArray(data.doses)) {
      event.waitUntil(scheduleDoseAlarms(data.doses));
    }
  } else if (data.type === 'SHOW_NOTIFICATION') {
    const { title, body, medicationId, scheduledTime, sound, tag } = data;
    event.waitUntil(
      showSafeNotification(title || 'Medication Reminder', {
        body: body || 'It is time to take your medication.',
        icon: APP_ICON,
        badge: APP_ICON,
        vibrate: [500, 200, 500, 200, 1000, 200, 1000],
        tag: tag || (medicationId ? `med-${medicationId}-${scheduledTime || Date.now()}` : `med-alert-${Date.now()}`),
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: {
          medicationId,
          scheduledTime,
          sound,
          timestamp: Date.now()
        },
        actions: medicationId && medicationId !== 'test' && medicationId !== 'welcome' ? [
          { action: 'take', title: '✅ Taken' },
          { action: 'snooze', title: '⏰ Snooze 15m' }
        ] : [
          { action: 'dismiss', title: 'Dismiss' }
        ]
      })
    );
  } else if (data.type === 'SCHEDULE_DELAYED_NOTIFICATION') {
    const { delayMs, title, body, medicationId, scheduledTime, sound } = data;
    const ms = delayMs || 5000;
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(async () => {
          await fireMedicationNotification({
            id: `delayed-${Date.now()}`,
            medicationId: medicationId || 'test',
            name: 'Pill Reminder Test',
            dosage: '1 dose',
            time: scheduledTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sound: sound || 'alert',
            title: title || '⏰ Pill Reminder Alert',
            body: body || 'Background alert triggered on lock screen!'
          });
          resolve();
        }, ms);
      })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'med-reminder-check') {
    event.waitUntil(restoreAndScheduleAlarms());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'med-reminder-check') {
    event.waitUntil(restoreAndScheduleAlarms());
  }
});

// Handle notification interaction (clicking the notification or actions)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const medData = event.notification.data || {};
  const { medicationId, time, scheduledTime, id } = medData;
  const targetTime = time || scheduledTime;

  if (action === 'snooze') {
    const snoozeMinutes = 15;
    event.waitUntil(
      new Promise((resolve) => {
        setTimeout(async () => {
          await showSafeNotification('⏰ Snoozed Reminder', {
            body: '15 minutes passed! Please remember to take your medication.',
            icon: APP_ICON,
            badge: APP_ICON,
            vibrate: [500, 200, 500, 200, 1000],
            tag: `snooze-${medicationId || 'pill'}-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
            silent: false,
            data: { medicationId, scheduledTime: targetTime },
            actions: [
              { action: 'take', title: '✅ Taken' },
              { action: 'snooze', title: '⏰ Snooze 15m' }
            ]
          });
          resolve();
        }, snoozeMinutes * 60 * 1000);
      })
    );
  }

  if (action === 'take' && id) {
    removeAlarm(id);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (action === 'take') {
            client.postMessage({
              type: 'LOG_MEDICATION',
              medicationId,
              status: 'TAKEN',
              scheduledTime: targetTime
            });
          } else if (action === 'snooze') {
            client.postMessage({
              type: 'SNOOZE_MEDICATION',
              medicationId,
              scheduledTime: targetTime,
              minutes: 15
            });
          }
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        let url = '/';
        if (action === 'take' && medicationId) {
          url = `/?action=take&medId=${encodeURIComponent(medicationId)}&time=${encodeURIComponent(targetTime || '')}`;
        }
        return self.clients.openWindow(url);
      }
    })
  );
});
