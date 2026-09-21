importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 1. O EXTERMINADOR DE CACHE (Versão V2)
const CACHE_VERSION = 'v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 2. A Configuração Oficial
const firebaseConfig = {
  apiKey: "AIzaSyAIGwnL--sP4uJiru0d_XFCcOkJ5NpViFU",
  authDomain: "diario-filosofico.firebaseapp.com",
  projectId: "diario-filosofico",
  storageBucket: "diario-filosofico.firebasestorage.app",
  messagingSenderId: "284774616483",
  appId: "1:284774616483:web:a7705573f1071b56e35e16",
  measurementId: "G-JFD8VCB1W1"
};

// Inicializa o app em segundo plano
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// O Firebase agora cuidará de tudo sozinho, sem duplicatas.

// Ao clicar na notificação em segundo plano, foca uma aba já aberta ou abre o app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.FCM_MSG?.notification?.click_action
    || event.notification.data?.url
    || 'https://diario-filosofico-azure.vercel.app/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});