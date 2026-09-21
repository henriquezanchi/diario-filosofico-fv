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

// Normaliza o formato antigo (array de strings) para o novo (array de
// { email, units }) sem exigir migração manual — o formato novo é
// persistido assim que alguém usar addAdmin/removeAdmin pela primeira vez.
const normalizeAdmins = (raw) => (raw || []).map(a =>
  typeof a === 'string'
    ? { email: a.toLowerCase(), units: [] }
    : { email: String(a.email || '').toLowerCase(), units: Array.isArray(a.units) ? a.units : [] }
);

// Painel de administração de pedidos de acesso ao módulo FV.
// Único lugar autorizado a aprovar/recusar pedidos e a gerenciar admins e
// unidades — tudo validado aqui no servidor, nunca confiando no cliente.
//
// Modelo: admin.units === [] => "admin geral" (vê e decide pedidos de
// qualquer unidade). admin.units === ['Unidade X', ...] => só vê e decide
// pedidos cuja requestUnit esteja nessa lista.
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
    const admins = normalizeAdmins(whitelistData.admins);
    const units = whitelistData.units || [];

    const me = admins.find(a => a.email === requesterEmail);
    if (!me) {
      return res.status(403).json({ error: 'Você não tem permissão de administrador.' });
    }
    const isSuperAdmin = me.units.length === 0;

    const { action } = req.body || {};

    if (action === 'list' || !action) {
      const pendingSnap = await db.collection('users').where('fvStatus', '==', 'pending').get();
      let pending = pendingSnap.docs.map(d => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || null,
          requestEmail: data.requestEmail || data.email || null,
          requestName: data.requestName || null,
          requestUnit: data.requestUnit || null,
          requestDate: data.requestDate ? data.requestDate.toDate().toISOString() : null,
        };
      });
      if (!isSuperAdmin) {
        pending = pending.filter(p => p.requestUnit && me.units.includes(p.requestUnit));
      }
      return res.status(200).json({
        pending,
        units,
        isSuperAdmin,
        myUnits: me.units,
        admins: isSuperAdmin ? admins : undefined,
      });
    }

    if (action === 'decide') {
      const { uid, decision } = req.body || {};
      if (!uid || !['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      const requestUnit = userSnap.data().requestUnit || null;
      if (!isSuperAdmin && !(requestUnit && me.units.includes(requestUnit))) {
        return res.status(403).json({ error: 'Este pedido não é da sua unidade.' });
      }
      if (decision === 'approve') {
        await userRef.set({ fvStatus: 'approved', fvUnlocked: true }, { merge: true });
      } else {
        await userRef.set({ fvStatus: 'unregistered', fvUnlocked: false }, { merge: true });
      }
      return res.status(200).json({ success: true });
    }

    // As ações abaixo (gerenciar admins e unidades) são exclusivas do admin geral.
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Só o admin geral pode gerenciar administradores e unidades.' });
    }

    if (action === 'addAdmin') {
      const { email, units: adminUnits } = req.body || {};
      const clean = String(email || '').trim().toLowerCase();
      if (!clean || !clean.includes('@')) {
        return res.status(400).json({ error: 'E-mail inválido' });
      }
      const cleanUnits = Array.isArray(adminUnits) ? adminUnits.filter(u => units.includes(u)) : [];
      const updated = admins.filter(a => a.email !== clean);
      updated.push({ email: clean, units: cleanUnits });
      await whitelistRef.set({ admins: updated }, { merge: true });
      return res.status(200).json({ admins: updated });
    }

    if (action === 'removeAdmin') {
      const { email } = req.body || {};
      const clean = String(email || '').trim().toLowerCase();
      const updated = admins.filter(a => a.email !== clean);
      const remainingSuperAdmins = updated.filter(a => a.units.length === 0);
      if (remainingSuperAdmins.length === 0) {
        return res.status(400).json({ error: 'Não é possível remover o último admin geral.' });
      }
      await whitelistRef.set({ admins: updated }, { merge: true });
      return res.status(200).json({ admins: updated });
    }

    if (action === 'addUnit') {
      // Aceita tanto uma unidade única (`unit`) quanto várias de uma vez
      // (`units`, array) — útil pra importar a lista inteira da rede de uma vez.
      const { unit, units: bulkUnits } = req.body || {};
      const incoming = Array.isArray(bulkUnits) ? bulkUnits : [unit];
      const cleanIncoming = [...new Set(incoming.map(u => String(u || '').trim()).filter(Boolean))];
      if (cleanIncoming.length === 0) {
        return res.status(400).json({ error: 'Nenhum nome de unidade válido informado' });
      }
      const updatedUnits = [...units];
      for (const u of cleanIncoming) {
        if (!updatedUnits.includes(u)) updatedUnits.push(u);
      }
      await whitelistRef.set({ units: updatedUnits }, { merge: true });
      return res.status(200).json({ units: updatedUnits });
    }

    if (action === 'removeUnit') {
      const { unit } = req.body || {};
      const clean = String(unit || '').trim();
      const updatedUnits = units.filter(u => u !== clean);
      // Tira a unidade removida de qualquer admin que a tivesse — evita
      // deixar um admin "órfão" preso a uma unidade que não existe mais.
      const updatedAdmins = admins.map(a => ({ ...a, units: a.units.filter(u => u !== clean) }));
      await whitelistRef.set({ units: updatedUnits, admins: updatedAdmins }, { merge: true });
      return res.status(200).json({ units: updatedUnits, admins: updatedAdmins });
    }

    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
