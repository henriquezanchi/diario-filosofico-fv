import admin from 'firebase-admin';

// Função segura para consertar a senha do Firebase
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
};

// 1. Inicia o Firebase
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  } catch (initError) {
    console.error("Erro ao tentar conectar no Firebase:", initError);
  }
}

export default async function handler(req, res) {
  try {
    // 2. Descobre que horas são agora no Brasil (Fuso UTC-3)
    const currentUtcHour = new Date().getUTCHours();
    const hourBRT = (currentUtcHour - 3 + 24) % 24; 
    // Transforma em texto (ex: 8 vira "08:00")
    const currentHourStr = String(hourBRT).padStart(2, '0') + ':00';

    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    
    const messages = [];

    // 3. Olha usuário por usuário no banco de dados
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Se não tem token ativado, ignora
      if (!data.fcmToken) return;

      // Pega os horários escolhidos pelo usuário (ou usa o padrão)
      const userMorningTime = data.morningTime || '08:00';
      const userEveningTime = data.eveningTime || '20:00';

    // 4. Monta a mensagem certa SÓ SE a hora atual bater com a hora do usuário
      if (userMorningTime === currentHourStr) {
        messages.push({
          token: data.fcmToken,
          notification: { title: '☀️ Prólogo Matinal', body: 'Inicie seu dia com propósito. Sorteie sua virtude hoje!' },
          webpush: { 
            headers: { TTL: '7200' }, 
            notification: { icon: 'https://img.icons8.com/ios-filled/512/8b7355/open-book.png' } // Ícone: Livro Aberto
          }
        });
      } else if (userEveningTime === currentHourStr) {
        messages.push({
          token: data.fcmToken,
          notification: { title: '🌙 Epílogo Noturno', body: 'Hora do autoexame. O que você fez bem hoje? Feche o seu dia.' },
          webpush: { 
            headers: { TTL: '7200' }, 
            notification: { icon: 'https://img.icons8.com/ios-filled/512/8b7355/owl.png' } // Ícone: Coruja Filosófica
          }
        });
      }
      });

    if (messages.length === 0) {
      return res.status(200).json({ message: `Nenhum lembrete agendado para as ${currentHourStr}.` });
    }

    // 5. Envia todas as mensagens que foram agendadas para a hora atual
    const sendPromises = messages.map(msg => admin.messaging().send(msg));
    await Promise.allSettled(sendPromises);

    return res.status(200).json({ success: true, enviados: messages.length, hora_analisada: currentHourStr });
    
  } catch (error) {
    return res.status(500).json({ erro_fatal: error.message });
  }
}