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

// Painel de administração de pedidos de acesso ao módulo FV.
// Único lugar autorizado a aprovar/recusar pedidos e a gerenciar a lista de
// admins — tudo validado aqui no servidor, nunca confiando no cliente.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Authorization token' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const requesterEmail = (decoded.email || '').toLowerCase();
  if (!requesterEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = admin.firestore();
  const whitelistRef = db.collection('admin').doc('whitelist');

  try {
    const whitelistSnap = await whitelistRef.get();
    const whitelistData = whitelistSnap.exists ? whitelistSnap.data() : {};
    const admins = (whitelistData.admins || []).map(e => String(e).toLowerCase());

    if (!admins.includes(requesterEmail)) {
      return res.status(403).json({ error: 'Você não tem permissão de administrador.' });
    }

    const { action } = req.body || {};

    if (action === 'list' || !action) {
      const pendingSnap = await db.collection('users').where('fvStatus', '==', 'pending').get();
      const pending = pendingSnap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || null,
          requestName: data.requestName || null,
          requestUnit: data.requestUnit || null,
          requestDate: data.requestDate ? data.requestDate.toDate().toISOString() : null,
        };
      });
      return res.status(200).json({ pending, admins });
    }

    if (action === 'decide') {
      const { uid, decision } = req.body || {};
      if (!uid || !['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }
      const userRef = db.collection('users').doc(uid);
      if (decision === 'approve') {
        await userRef.set({ fvStatus: 'approved', fvUnlocked: true }, { merge: true });
      } else {
        await userRef.set({ fvStatus: 'unregistered', fvUnlocked: false }, { merge: true });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'addAdmin') {
      const { email } = req.body || {};
      const clean = String(email || '').trim().toLowerCase();
      if (!clean || !clean.includes('@')) {
        return res.status(400).json({ error: 'E-mail inválido' });
      }
      if (!admins.includes(clean)) admins.push(clean);
      await whitelistRef.set({ admins }, { merge: true });
      return res.status(200).json({ admins });
    }

    if (action === 'removeAdmin') {
      const { email } = req.body || {};
      const clean = String(email || '').trim().toLowerCase();
      const updated = admins.filter(e => e !== clean);
      if (updated.length === 0) {
        return res.status(400).json({ error: 'Não é possível remover o último administrador.' });
      }
      await whitelistRef.set({ admins: updated }, { merge: true });
      return res.status(200).json({ admins: updated });
    }

    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
