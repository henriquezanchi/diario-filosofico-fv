// Importa as ferramentas do Firebase que funcionam em segundo plano (Background)
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// SUAS CREDENCIAIS DO FIREBASE
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

// Lida com as mensagens quando o App estiver FECHADO
messaging.onBackgroundMessage(function(payload) {
  console.log('Notificação recebida em background: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    // Você pode colocar um ícone aqui futuramente
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});