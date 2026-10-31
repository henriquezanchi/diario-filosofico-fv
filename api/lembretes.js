import { admin, APP_URL, getAllChunked, serverError, firebaseReady } from './_lib/shared.js';

// O usuário digita DDD + número (ex: 62999999999). A Z-API espera o DDI 55.
// Zeros à esquerda (ex: 062...) vêm do hábito de discar o código de operadora
// e são removidos antes de decidir se o DDI já está presente.
export function normalizeWhatsappPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 10) return null; // curto demais para DDD + número
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

async function sendWhatsApp(phone, message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const instanceToken = process.env.ZAPI_INSTANCE_TOKEN;
  if (!instanceId || !instanceToken) return; // WhatsApp ainda não configurado
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

// Data no fuso de Brasília (UTC-3, sem horário de verão desde 2019).
// Os campos UTC do objeto devolvido representam a hora local de Brasília.
function brtDate(offsetDays = 0) {
  return new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
}
function dateKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Mesma regra de recorrência usada no app (getTasksForToday).
export function isTaskDueOn(task, d) {
  const rec = task.recurrence;
  if (!rec || rec === 'daily') return true;
  if (rec === 'weekly') return Array.isArray(task.weekDays) && task.weekDays.includes(d.getUTCDay());
  if (rec === 'monthly') return parseInt(task.monthDay, 10) === d.getUTCDate();
  if (rec === 'biweekly' && task.baseDate) {
    const [y, m, day] = task.baseDate.split('-').map(Number);
    const base = Date.UTC(y, m - 1, day);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const diffDays = Math.round((today - base) / 86400000);
    return diffDays >= 0 && diffDays % 14 === 0;
  }
  return true;
}

const entryHasDiary = (e) => !!(e && (e.morningDone || e.eveningDone));
const entryHasPractice = (e) => !!(e && e.fvDaily && e.fvDaily.praticas && Object.values(e.fvDaily.praticas).some(v => v === true));

function bookIsUnfinished(b) {
  if (b.finishedDate || b.status === 'lido') return false;
  return !(b.totalPages > 0 && b.currentPage >= b.totalPages);
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!firebaseReady(res)) return;

  const db = admin.firestore();
  const now = brtDate();
  const hourBRT = now.getUTCHours();
  const todayKey = dateKey(now);

  // O cron roda 2x por dia (08:00 e 20:00 BRT, ver vercel.json). O plano
  // Hobby da Vercel não permite mais disparos, então todos os lembretes se
  // encaixam nessas duas janelas, independentemente do horário escolhido no
  // app. A folga de uma hora cobre atrasos no disparo do cron.
  const isMorningRun = hourBRT >= 7 && hourBRT <= 9;
  const isEveningRun = hourBRT >= 19 && hourBRT <= 21;
  if (!isMorningRun && !isEveningRun) {
    return res.status(200).json({ success: true, skipped: true, hora: hourBRT });
  }

  try {
    const usersSnapshot = await db.collection('users').get();

    // Só interessa quem pode receber algo: push ou WhatsApp.
    const targets = [];
    for (const userDoc of usersSnapshot.docs) {
      const data = userDoc.data();
      const notif = data.notifications || {};
      const phone = notif.whatsappNumber ? normalizeWhatsappPhone(notif.whatsappNumber) : null;
      if (!data.fcmToken && !phone) continue;
      targets.push({ uid: userDoc.id, data, alerts: notif.alerts || {}, phone });
    }

    // Leituras em lote: uma ida ao Firestore por coleção, não uma por usuário.
    const pastKeys = isEveningRun ? [1, 2, 3].map(n => dateKey(brtDate(-n))) : [];
    const entryKeys = [todayKey, ...pastKeys];
    const entryRefs = targets.flatMap(t => entryKeys.map(k => db.collection('entries').doc(`${t.uid}_${k}`)));
    const taskRefs = targets.map(t => db.collection('customTasks').doc(t.uid));
    const guardianTargets = isEveningRun ? targets.filter(t => t.phone) : [];
    const bookRefs = guardianTargets.map(t => db.collection('userBooks').doc(t.uid));
    const fvRefs = guardianTargets.map(t => db.collection('fvData').doc(t.uid));

    const [entrySnaps, taskSnaps, bookSnaps, fvSnaps] = await Promise.all([
      getAllChunked(db, entryRefs),
      getAllChunked(db, taskRefs),
      getAllChunked(db, bookRefs),
      getAllChunked(db, fvRefs),
    ]);
    const byPath = (snaps) => new Map(snaps.map(s => [s.ref.path, s.exists ? s.data() : null]));
    const entries = byPath(entrySnaps);
    const tasksDocs = byPath(taskSnaps);
    const booksDocs = byPath(bookSnaps);
    const fvDocs = byPath(fvSnaps);

    const inSevenDaysKey = dateKey(brtDate(7));
    const pushMessages = [];
    const whatsappJobs = [];

    for (const t of targets) {
      const { uid, data, alerts, phone } = t;
      const today = entries.get(`entries/${uid}_${todayKey}`);
      const tasks = tasksDocs.get(`customTasks/${uid}`)?.tasks || [];
      const tasksToday = tasks.filter(task => isTaskDueOn(task, now));

      if (isMorningRun) {
        if (today?.morningDone) continue; // quem já fez o Prólogo não precisa de lembrete

        const tasksLine = tasksToday.length > 0
          ? `Você tem ${tasksToday.length} prática(s) agendada(s) para hoje.`
          : '';

        if (data.fcmToken) {
          pushMessages.push({
            token: data.fcmToken,
            notification: {
              title: '☀️ Prólogo Matinal',
              body: ['Momento de definir sua intenção e virtude do dia.', tasksLine].filter(Boolean).join(' '),
            },
            webpush: { fcmOptions: { link: APP_URL } },
          });
        }

        if (phone) {
          const lines = [];
          if (alerts.dailyVirtue !== false) lines.push('☀️ *Prólogo Matinal*\n\nMomento de definir sua intenção e virtude do dia.');
          if (tasksLine && alerts.pendingTasks !== false) lines.push(`📋 ${tasksLine}`);
          if (lines.length) whatsappJobs.push({ phone, message: `${lines.join('\n\n')}\n\n${APP_URL}` });
        }
        continue;
      }

      // --- Disparo da noite ---
      if (today?.eveningDone) continue; // dia já fechado

      const virtue = today?.virtue;
      const intention = today?.intention;
      const doneMap = today?.tasksStatus || {};
      const pendingCount = tasksToday.filter(task => !doneMap[task.id]).length;

      if (data.fcmToken && virtue) {
        pushMessages.push({
          token: data.fcmToken,
          notification: {
            title: `✨ Prática da ${virtue}`,
            body: intention ? `Sua intenção: "${intention}". Hora do Epílogo.` : 'Hora de revisar o dia no Epílogo.',
          },
          webpush: { fcmOptions: { link: APP_URL } },
        });
      }

      if (!phone) continue;

      const lines = [];
      if (alerts.dailyEpilogue !== false) lines.push('🌙 *Epílogo*\n\nHora de revisar o seu dia antes de dormir.');
      if (alerts.randomVirtue && virtue) {
        lines.push(`✨ Virtude do dia: *${virtue}*${intention ? `\nSua intenção: "${intention}"` : ''}`);
      }
      if (alerts.pendingTasks !== false && pendingCount > 0) {
        lines.push(`📋 Ainda falta(m) ${pendingCount} prática(s) de hoje.`);
      }

      const pastEntries = pastKeys.map(k => entries.get(`entries/${uid}_${k}`));
      if (alerts.diarySlump !== false && !entryHasDiary(today) && pastEntries.every(e => !entryHasDiary(e))) {
        lines.push('📖 Já são 3 dias sem preencher o Diário. Que tal retomar hoje?');
      }
      if (alerts.practiceSlump !== false && !entryHasPractice(today) && pastEntries.every(e => !entryHasPractice(e))) {
        lines.push('🧘 Já são 3 dias sem registrar Práticas.');
      }
      if (alerts.readingSlump !== false) {
        const books = (booksDocs.get(`userBooks/${uid}`)?.books || []).filter(bookIsUnfinished);
        const threeDaysAgo = Date.now() - 3 * 86400000;
        const tracked = books.filter(b => b.updatedAt);
        if (tracked.length > 0 && tracked.every(b => new Date(b.updatedAt).getTime() < threeDaysAgo)) {
          lines.push('📚 Suas leituras estão paradas há mais de 3 dias.');
        }
      }
      if (alerts.gdveWarning !== false) {
        const fv = fvDocs.get(`fvData/${uid}`);
        const meeting = fv && (fv.fvGdveReuniao || fv.gdveReuniao);
        if (typeof meeting === 'string' && meeting.slice(0, 10) === inSevenDaysKey) {
          lines.push('🏛️ Falta 1 semana para a reunião do GDVE. Confira se a leitura do ciclo está em dia.');
        }
      }

      if (lines.length) whatsappJobs.push({ phone, message: `${lines.join('\n\n')}\n\n${APP_URL}` });
    }

    const results = await Promise.allSettled([
      ...pushMessages.map(msg => admin.messaging().send(msg)),
      ...whatsappJobs.map(job => sendWhatsApp(job.phone, job.message)),
    ]);
    const failures = results.filter(r => r.status === 'rejected');
    failures.slice(0, 5).forEach(f => console.error('[lembretes] envio falhou:', f.reason?.message || f.reason));

    return res.status(200).json({
      success: true,
      push: pushMessages.length,
      whatsapp: whatsappJobs.length,
      falhas: failures.length,
      janela: isMorningRun ? 'manha' : 'noite',
    });
  } catch (e) {
    return serverError(res, 'lembretes', e);
  }
}
