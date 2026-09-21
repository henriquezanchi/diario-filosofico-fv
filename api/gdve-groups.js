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

const ITEM_TYPES = ['tarefa', 'bastiao', 'pratica'];
// Sem 0/O/1/I/L, pra evitar confusão na hora de digitar o código à mão.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Nome do grupo é opcional — quem não quiser pensar em um recebe uma
// divindade egípcia (não precisa ser único, só lúdico).
const EGYPTIAN_GODS = [
  'Rá', 'Osíris', 'Ísis', 'Hórus', 'Anúbis', 'Seth', 'Toth', 'Hathor',
  'Sekhmet', 'Bastet', 'Ptah', 'Maat', 'Nut', 'Geb', 'Amon', 'Sobek',
  'Khnum', 'Nefertum', 'Serket', 'Néftis', 'Aton', 'Shu', 'Tefnut', 'Mut',
];

function randomGodName() {
  return `Grupo ${EGYPTIAN_GODS[Math.floor(Math.random() * EGYPTIAN_GODS.length)]}`;
}

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function displayName(decoded) {
  return decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Alguém');
}

// Grupos de estudo GDVE: qualquer usuário aprovado pode criar um (vira
// coordenador) e convidar colegas por link/código. O coordenador cadastra
// tarefas/bastiões/práticas; qualquer membro marca sua própria conclusão, o
// que avisa os demais por push (respeitando a preferência de cada um).
// Tudo mediado aqui, como em fv-admin.js — o cliente nunca lê/escreve
// gdveGroups/gdveGroupItems diretamente.
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

  const uid = decoded.uid;
  const db = admin.firestore();
  const groupsRef = db.collection('gdveGroups');
  const itemsRef = db.collection('gdveGroupItems');

  const { action } = req.body || {};

  try {
    if (action === 'create') {
      const name = String(req.body?.name || '').trim() || randomGodName();

      let inviteCode = null;
      for (let attempt = 0; attempt < 5 && !inviteCode; attempt++) {
        const candidate = generateInviteCode();
        const clash = await groupsRef.where('inviteCode', '==', candidate).limit(1).get();
        if (clash.empty) inviteCode = candidate;
      }
      if (!inviteCode) return res.status(500).json({ error: 'Não foi possível gerar um código de convite. Tente novamente.' });

      const newGroup = {
        name,
        coordinatorUid: uid,
        memberUids: [uid],
        memberNames: { [uid]: displayName(decoded) },
        inviteCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const ref = await groupsRef.add(newGroup);
      return res.status(200).json({ group: { id: ref.id, name, coordinatorUid: uid, memberUids: [uid], inviteCode } });
    }

    if (action === 'join') {
      const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
      if (!inviteCode) return res.status(400).json({ error: 'Código de convite inválido.' });
      const snap = await groupsRef.where('inviteCode', '==', inviteCode).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Convite não encontrado. Confira o link/código.' });
      const groupDoc = snap.docs[0];
      const group = groupDoc.data();
      if (!group.memberUids.includes(uid)) {
        await groupDoc.ref.update({
          memberUids: admin.firestore.FieldValue.arrayUnion(uid),
          [`memberNames.${uid}`]: displayName(decoded),
        });
      }
      return res.status(200).json({ group: { id: groupDoc.id, name: group.name } });
    }

    if (action === 'listMine') {
      const snap = await groupsRef.where('memberUids', 'array-contains', uid).get();
      const groups = [];
      for (const groupDoc of snap.docs) {
        const group = groupDoc.data();
        const itemsSnap = await itemsRef.where('groupId', '==', groupDoc.id).get();
        const items = itemsSnap.docs
          .map(d => {
            const it = d.data();
            return {
              id: d.id,
              type: it.type,
              title: it.title,
              description: it.description || '',
              createdBy: it.createdBy,
              completedBy: it.completedBy || [],
              _createdAtMs: it.createdAt ? it.createdAt.toMillis() : 0,
            };
          })
          .sort((a, b) => b._createdAtMs - a._createdAtMs)
          .map(({ _createdAtMs, ...rest }) => rest);

        groups.push({
          id: groupDoc.id,
          name: group.name,
          coordinatorUid: group.coordinatorUid,
          isCoordinator: group.coordinatorUid === uid,
          memberUids: group.memberUids,
          memberNames: group.memberNames || {},
          inviteCode: group.inviteCode,
          items,
        });
      }
      return res.status(200).json({ groups });
    }

    // Ações abaixo exigem carregar o grupo e conferir que o requisitante é membro.
    const groupId = req.body?.groupId;
    if (!groupId) return res.status(400).json({ error: 'groupId é obrigatório.' });
    const groupSnap = await groupsRef.doc(groupId).get();
    if (!groupSnap.exists) return res.status(404).json({ error: 'Grupo não encontrado.' });
    const group = groupSnap.data();
    if (!group.memberUids.includes(uid)) {
      return res.status(403).json({ error: 'Você não faz parte deste grupo.' });
    }
    const isCoordinator = group.coordinatorUid === uid;

    if (action === 'addItem') {
      if (!isCoordinator) return res.status(403).json({ error: 'Só o coordenador do grupo pode adicionar itens.' });
      const type = ITEM_TYPES.includes(req.body?.type) ? req.body.type : 'tarefa';
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Título é obrigatório.' });
      const description = String(req.body?.description || '').trim();
      await itemsRef.add({
        groupId, type, title, description,
        createdBy: uid,
        completedBy: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'removeItem') {
      if (!isCoordinator) return res.status(403).json({ error: 'Só o coordenador do grupo pode remover itens.' });
      const itemId = req.body?.itemId;
      if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório.' });
      await itemsRef.doc(itemId).delete();
      return res.status(200).json({ success: true });
    }

    if (action === 'toggleCompletion') {
      const itemId = req.body?.itemId;
      if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório.' });
      const itemRef = itemsRef.doc(itemId);
      const itemSnap = await itemRef.get();
      if (!itemSnap.exists || itemSnap.data().groupId !== groupId) {
        return res.status(404).json({ error: 'Item não encontrado.' });
      }
      const item = itemSnap.data();
      const alreadyDone = (item.completedBy || []).includes(uid);
      await itemRef.update({
        completedBy: alreadyDone
          ? admin.firestore.FieldValue.arrayRemove(uid)
          : admin.firestore.FieldValue.arrayUnion(uid),
      });

      // Só avisa os demais ao MARCAR como concluído, nunca ao desmarcar.
      if (!alreadyDone) {
        const others = group.memberUids.filter(m => m !== uid);
        if (others.length > 0) {
          const usersSnap = await db.getAll(...others.map(m => db.collection('users').doc(m)));
          const messages = usersSnap
            .filter(s => s.exists && s.data().fcmToken && s.data().notifications?.alerts?.groupActivity !== false)
            .map(s => ({
              token: s.data().fcmToken,
              notification: {
                title: `✅ ${group.name}`,
                body: `${displayName(decoded)} concluiu: ${item.title}`,
              },
              webpush: { fcmOptions: { link: 'https://diario-filosofico-azure.vercel.app/' } },
            }));
          if (messages.length > 0) {
            await Promise.allSettled(messages.map(msg => admin.messaging().send(msg)));
          }
        }
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'leaveGroup') {
      if (isCoordinator) return res.status(400).json({ error: 'O coordenador não pode sair do grupo.' });
      await groupsRef.doc(groupId).update({
        memberUids: admin.firestore.FieldValue.arrayRemove(uid),
        [`memberNames.${uid}`]: admin.firestore.FieldValue.delete(),
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
