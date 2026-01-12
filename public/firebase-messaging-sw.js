// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

// Initialize Firebase in the service worker
// Note: Config will be passed from the main app
firebase.initializeApp({
  apiKey: 'AIzaSyDtJQvZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ8vZ', // Placeholder - will be configured via environment
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef'
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload)

  const notificationTitle = payload.notification?.title || 'Brain Dumper'
  const notificationOptions = {
    body: payload.notification?.body || 'You have new tasks',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'daily-tasks',
    requireInteraction: false,
    data: {
      url: payload.data?.url || '/schedule',
    },
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/schedule'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
