import admin from 'firebase-admin';

const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

export default async function handler(req, res) {
  const db = admin.firestore();
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3); // Horário de Brasília
  const hourBRT = d.getUTCHours();
  const currentHourStr = String(hourBRT).padStart(2, '0') + ':00';
  const todayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const dayOfWeek = d.getUTCDay();

  try {
    const usersSnapshot = await db.collection('users').get();
    const messages = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      if (!userData.fcmToken) continue;

      // 1. Notificações Fixas (Prólogo/Epílogo)
      if (userData.morningTime === currentHourStr) {
        messages.push({
          token: userData.fcmToken,
          notification: { title: '☀️ Prólogo Matinal', body: 'Momento de definir sua intenção e virtude do dia.' },
          webpush: { fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } }
        });
      }

      // 2. Lembrete Aleatório (Diamante)
      const entryDoc = await db.collection('entries').doc(`${userId}_${todayKey}`).get();
      if (entryDoc.exists && entryDoc.data().randomReminderHour === currentHourStr) {
        const entry = entryDoc.data();
        messages.push({
          token: userData.fcmToken,
          notification: { title: `✨ Prática da ${entry.virtue}`, body: `Lembrete: "${entry.intention}"` },
          webpush: { fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } }
        });
      }

      // 3. NOVO: Lembrete de Tarefas Pendentes (Roda às 10:00 da manhã)
      if (currentHourStr === "10:00") {
        const tasksDoc = await db.collection('customTasks').doc(userId).get();
        if (tasksDoc.exists) {
          const tasks = tasksDoc.data().tasks || [];
          const tasksToday = tasks.filter(t => {
            if (!t.recurrence || t.recurrence === 'daily') return true;
            if (t.recurrence === 'weekly') return t.weekDays?.includes(dayOfWeek);
            return false;
          });
          
          if (tasksToday.length > 0) {
            messages.push({
              token: userData.fcmToken,
              notification: { title: '📋 Práticas de Hoje', body: `Você tem ${tasksToday.length} tarefas filosóficas para realizar hoje.` },
              webpush: { fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } }
            });
          }
        }
      }
    }

    if (messages.length > 0) {
      await Promise.allSettled(messages.map(msg => admin.messaging().send(msg)));
    }

    return res.status(200).json({ success: true, enviados: messages.length, hora: currentHourStr });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}