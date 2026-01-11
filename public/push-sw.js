// public/push-sw.js

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.log('Push event but no data')
    return
  }

  try {
    const data = event.data.json()
    const title = data.title || 'New Notification'
    const body = data.body || ''
    const icon = '/icon-192x192.png' // Ensure this exists or use default
    const url = data.url || '/'

    const options = {
      body,
      icon,
      badge: icon,
      data: { url },
      vibrate: [100, 50, 100],
      actions: [
        {
          action: 'open',
          title: 'Open App',
        },
      ],
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (err) {
    console.error('Error processing push event:', err)
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        // If client is already open and valid, focus it
        if (client.url && 'focus' in client) {
          // Optional: Navigate to key URL if needed, or just focus
          // client.navigate(urlToOpen)
          return client.focus()
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
