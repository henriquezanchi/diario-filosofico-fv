importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 1. O EXTERMINADOR DE CACHE: Força o celular a apagar o código velho imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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

// O Firebase agora cuidará de tudo sozinho, sem duplicatas, e o código velho foi destruído.