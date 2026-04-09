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
    const currentHourStr = String(hourBRT).padStart(2, '0') + ':00';

    // Descobre a DATA de hoje no Brasil (YYYY-MM-DD) para achar o diário certo
    const d = new Date();
    d.setUTCHours(d.getUTCHours() - 3); 
    const todayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    
    const messages = [];

    // 3. Usa um loop "for...of" para podermos fazer buscas lá dentro
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Se não tem token ativado, ignora
      if (!userData.fcmToken) continue;

      const userMorningTime = userData.morningTime || '08:00';
      const userEveningTime = userData.eveningTime || '20:00';

      // 4. Lembretes Fixos (Prólogo e Epílogo)
      if (userMorningTime === currentHourStr) {
        messages.push({
          token: userData.fcmToken,
          notification: { title: '☀️ Prólogo Matinal', body: 'Inicie seu dia com propósito. Sorteie sua virtude hoje!' },
          webpush: { 
            headers: { TTL: '7200', Urgency: 'high' }, 
            notification: { icon: 'https://img.icons8.com/ios-filled/512/8b7355/open-book.png' },
            fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } // 👈 Comanda o Android a abrir o app
          }
        });
      } else if (userEveningTime === currentHourStr) {
        messages.push({
          token: userData.fcmToken,
          notification: { title: '🌙 Epílogo Noturno', body: 'Hora do autoexame. O que você fez bem hoje? Feche o seu dia.' },
          webpush: { 
            headers: { TTL: '7200', Urgency: 'high' }, 
            notification: { icon: 'https://img.icons8.com/ios-filled/512/8b7355/owl.png' },
            fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } // 👈 Comanda o Android a abrir o app
          }
        });
      }

      // 5. Lembrete Aleatório MÁGICO (Lendo o Diário de Hoje do Usuário!)
      const entryDoc = await db.collection('entries').doc(`${userId}_${todayKey}`).get();
      
      if (entryDoc.exists) {
        const entryData = entryDoc.data();
        const userRandomHour = entryData.randomReminderHour;

        if (userRandomHour === currentHourStr) {
          messages.push({
            token: userData.fcmToken,
            notification: { 
              title: `✨ Prática da ${entryData.virtue || 'Virtude'}`, 
              body: `Lembre-se: "${entryData.intention || 'Viver com consciência'}"` 
            },
            webpush: { 
              headers: { TTL: '7200', Urgency: 'high' },
              notification: { icon: 'https://img.icons8.com/ios-filled/512/8b7355/sparkling-diamond.png' },
              fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } // 👈 Comanda o Android a abrir o app
            }
          });
        }
      }
    }

    if (messages.length === 0) {
      return res.status(200).json({ message: `Nenhum lembrete agendado para as ${currentHourStr}.` });
    }

    // 6. Envia todas as mensagens que foram agendadas para a hora atual
    const sendPromises = messages.map(msg => admin.messaging().send(msg));
    await Promise.allSettled(sendPromises);

    return res.status(200).json({ success: true, enviados: messages.length, hora_analisada: currentHourStr });
    
  } catch (error) {
    return res.status(500).json({ erro_fatal: error.message });
  }
}