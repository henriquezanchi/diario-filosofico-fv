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

const APP_URL = 'https://diario-filosofico-azure.vercel.app/';

// Usuário digita só DDD+número (ex: 62999999999); a Z-API espera o DDI
// também (55). Se já vier mais longo que 11 dígitos, assume que o DDI
// já está incluído e não mexe.
function normalizeWhatsappPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

async function sendWhatsApp(phone, message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const instanceToken = process.env.ZAPI_INSTANCE_TOKEN;
  if (!instanceId || !instanceToken) return; // WhatsApp não configurado ainda — silencioso
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ZAPI_CLIENT_TOKEN) headers['Client-Token'] = process.env.ZAPI_CLIENT_TOKEN;
  const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Z-API ${resp.status}: ${body}`);
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = admin.firestore();
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - 3); // Horário de Brasília
  const hourBRT = d.getUTCHours();
  const currentHourStr = String(hourBRT).padStart(2, '0') + ':00';
  const todayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const dayOfWeek = d.getUTCDay();

  // Esse cron só roda 2x/dia (08:00 e 20:00 BRT — ver vercel.json; o plano
  // Hobby da Vercel limita a 2 disparos de cron por dia no total). Por isso
  // os lembretes de WhatsApp do Guardião não tentam respeitar o horário
  // exato que a pessoa escolheu (notifMorningTime/notifNightTime) — isso
  // exigiria rodar de hora em hora. Em vez disso, o lembrete da manhã
  // dispara sempre às 08:00 BRT e o da noite sempre às 20:00 BRT, se a
  // pessoa tiver ativado o alerta e cadastrado o número.
  const isMorningRun = currentHourStr === '08:00';
  const isEveningRun = currentHourStr === '20:00';

  try {
    const usersSnapshot = await db.collection('users').get();
    const pushMessages = [];
    const whatsappJobs = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      const notif = userData.notifications || {};
      const alerts = notif.alerts || {};
      const wpPhone = notif.whatsappNumber ? normalizeWhatsappPhone(notif.whatsappNumber) : null;

      if (!userData.fcmToken && !wpPhone) continue;

      // 1. Prólogo Matinal
      if (userData.fcmToken && userData.morningTime === currentHourStr) {
        pushMessages.push({
          token: userData.fcmToken,
          notification: { title: '☀️ Prólogo Matinal', body: 'Momento de definir sua intenção e virtude do dia.' },
          webpush: { fcmOptions: { link: APP_URL } }
        });
      }
      if (wpPhone && isMorningRun && alerts.dailyVirtue !== false) {
        whatsappJobs.push({ phone: wpPhone, message: `☀️ *Prólogo Matinal*\n\nMomento de definir sua intenção e virtude do dia.\n${APP_URL}` });
      }

      // 2. Epílogo (fecho do dia) — só existia no WhatsApp mesmo, não havia gatilho de push pra isso
      if (wpPhone && isEveningRun && alerts.dailyEpilogue !== false) {
        whatsappJobs.push({ phone: wpPhone, message: `🌙 *Epílogo*\n\nHora de revisar o seu dia antes de dormir.\n${APP_URL}` });
      }

      // 3. Lembrete Aleatório (Diamante)
      const entryDoc = await db.collection('entries').doc(`${userId}_${todayKey}`).get();
      if (entryDoc.exists) {
        const entry = entryDoc.data();
        if (entry.randomReminderHour === currentHourStr) {
          if (userData.fcmToken) {
            pushMessages.push({
              token: userData.fcmToken,
              notification: { title: `✨ Prática da ${entry.virtue}`, body: `Lembrete: "${entry.intention}"` },
              webpush: { fcmOptions: { link: APP_URL } }
            });
          }
          if (wpPhone && alerts.randomVirtue) {
            whatsappJobs.push({ phone: wpPhone, message: `✨ *Prática da ${entry.virtue}*\n\nLembrete: "${entry.intention}"\n${APP_URL}` });
          }
        }
      }

      // 4. Lembrete de Tarefas Pendentes — antes checava "10:00", horário que
      // esse cron nunca atinge (só roda às 08:00/20:00); alinhado pra rodar
      // junto com o disparo da manhã, tanto pro push quanto pro WhatsApp.
      if (isMorningRun) {
        const tasksDoc = await db.collection('customTasks').doc(userId).get();
        if (tasksDoc.exists) {
          const tasks = tasksDoc.data().tasks || [];
          const tasksToday = tasks.filter(t => {
            if (!t.recurrence || t.recurrence === 'daily') return true;
            if (t.recurrence === 'weekly') return t.weekDays?.includes(dayOfWeek);
            return false;
          });

          if (tasksToday.length > 0) {
            if (userData.fcmToken) {
              pushMessages.push({
                token: userData.fcmToken,
                notification: { title: '📋 Práticas de Hoje', body: `Você tem ${tasksToday.length} tarefas filosóficas para realizar hoje.` },
                webpush: { fcmOptions: { link: APP_URL } }
              });
            }
            if (wpPhone && alerts.pendingTasks !== false) {
              whatsappJobs.push({ phone: wpPhone, message: `📋 *Práticas de Hoje*\n\nVocê tem ${tasksToday.length} tarefa(s) filosófica(s) para realizar hoje.\n${APP_URL}` });
            }
          }
        }
      }
    }

    const results = await Promise.allSettled([
      ...pushMessages.map(msg => admin.messaging().send(msg)),
      ...whatsappJobs.map(job => sendWhatsApp(job.phone, job.message)),
    ]);
    const failed = results.filter(r => r.status === 'rejected').length;

    return res.status(200).json({
      success: true,
      push: pushMessages.length,
      whatsapp: whatsappJobs.length,
      falhas: failed,
      hora: currentHourStr
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
