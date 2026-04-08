importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

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

// O "GRITO" PARA O ANDROID ACORDAR E VIBRAR:
// Sobrescrevemos o sistema invisível educado por este comando autoritário.
messaging.onBackgroundMessage((payload) => {
  console.log('Mensagem recebida com o app fechado: ', payload);
  
  const notificationTitle = payload.notification.title || 'Diário Filosófico';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png', // O ícone dourado do seu app
    badge: '/logo192.png', // O ícone pequenininho da barra superior
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Um padrão longo de vibração 
    requireInteraction: true // Impede que o Android limpe a notificação sozinho
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});