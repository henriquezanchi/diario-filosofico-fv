import admin from 'firebase-admin';

// 1. Inicia o Firebase com a sua Chave Mestra secreta
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  try {
    const db = admin.firestore();
    
    // 2. Busca todos os usuários que têm as notificações ativadas
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'Nenhum usuário com notificação ativa no momento.' });
    }

    // 3. Descobre a hora atual no Brasil (Fuso horário UTC -3)
    const hourBRT = new Date().getUTCHours() - 3;
    
    // 4. Define a mensagem certa: Se for antes das 14h, é Prólogo. Se for depois, é Epílogo.
    const isMorning = hourBRT < 14;

    const message = {
      notification: {
        title: isMorning ? '☀️ Prólogo Matinal' : '🌙 Epílogo Noturno',
        body: isMorning ? 'Inicie seu dia com propósito. Sorteie sua virtude hoje!' : 'Hora do autoexame. O que você fez bem hoje? Feche o seu dia.',
      },
      tokens: tokens, // Manda para todo mundo de uma vez!
    };

    // 5. Faz o envio
    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ success: true, enviados: response.successCount, falhas: response.failureCount });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}