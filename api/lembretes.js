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
    const db = admin.firestore();
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

    const hourBRT = new Date().getUTCHours() - 3;
    const isMorning = hourBRT < 14;

    const message = {
      notification: {
        title: isMorning ? '☀️ Prólogo Matinal' : '🌙 Epílogo Noturno',
        body: isMorning ? 'Inicie seu dia com propósito. Sorteie sua virtude hoje!' : 'Hora do autoexame. O que você fez bem hoje? Feche o seu dia.',
      },
      // 👈 NOVO: Força o ícone de livro em todas as plataformas
      webpush: {
        notification: {
          icon: 'https://cdn-icons-png.flaticon.com/512/3389/3389081.png'
        }
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ success: true, enviados: response.successCount, falhas: response.failureCount });
    
  } catch (error) {
    // Se der erro, joga o erro VAZADO na tela branca para nós lermos!
    return res.status(500).json({ 
      erro_fatal: error.message, 
      dica: "Verifique os logs da Vercel para mais detalhes." 
    });
  }
}