
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const medId = event.notification.data?.medicationId;
  const scheduledTime = event.notification.data?.scheduledTime;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and send the action
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (action === 'take') {
            client.postMessage({
              type: 'LOG_MEDICATION',
              medicationId: medId,
              status: 'TAKEN',
              scheduledTime: scheduledTime
            });
          }
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (clients.openWindow) {
        let url = '/';
        if (action === 'take') {
          url = `/?action=take&medId=${medId}&time=${scheduledTime}`;
        }
        return clients.openWindow(url);
      }
    })
  );
});
