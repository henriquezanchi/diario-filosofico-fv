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

// Único lugar autorizado a ler a whitelist (admin/whitelist) e a aprovar o
// acesso ao módulo FV (users/{uid}.fvStatus / fvUnlocked). As regras do
// Firestore bloqueiam o cliente de fazer isso diretamente.
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

  try {
    const db = admin.firestore();
    const uid = decoded.uid;
    const email = (decoded.email || '').toLowerCase();

    let isVip = false;
    let units = [];
    const whitelistDoc = await db.collection('admin').doc('whitelist').get();
    if (whitelistDoc.exists) {
      const whitelistData = whitelistDoc.data();
      const allowedEmails = whitelistData.emails || [];
      units = whitelistData.units || [];
      if (email) {
        isVip = allowedEmails.map(e => String(e).toLowerCase()).includes(email);
      }
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    let fvStatus, fvUnlocked;

    if (!userSnap.exists) {
      fvStatus = isVip ? 'approved' : 'unregistered';
      fvUnlocked = isVip;
      await userRef.set({
        createdAt: admin.firestore.Timestamp.now(),
        theme: 'light',
        lastDrawDate: null,
        fvUnlocked,
        fvStatus,
        email: decoded.email || 'Sem e-mail',
      });
    } else {
      const data = userSnap.data();
      fvStatus = data.fvStatus || 'unregistered';
      if (isVip && fvStatus !== 'approved') {
        fvStatus = 'approved';
      }
      // fvUnlocked sempre reflete o fvStatus no login (o app grava fvUnlocked:false
      // no logout só para "esconder" o módulo até o próximo login re-liberar).
      fvUnlocked = fvStatus === 'approved';
      if (fvStatus !== data.fvStatus || fvUnlocked !== !!data.fvUnlocked) {
        await userRef.set({ fvStatus, fvUnlocked }, { merge: true });
      }
    }

    return res.status(200).json({ isVip, fvStatus, fvUnlocked, units });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
