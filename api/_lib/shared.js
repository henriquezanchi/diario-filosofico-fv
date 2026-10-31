// Código comum às funções da API. O prefixo "_" faz a Vercel não publicar
// este arquivo como endpoint.
import admin from 'firebase-admin';

const formatPrivateKey = (key) => (key ? key.replace(/\n/g, '\n') : undefined);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

export { admin };

// Único lugar com o endereço do app usado nos links de notificação.
export const APP_URL = 'https://diario-filosofico-fv.vercel.app/';

// Confere o token do Firebase enviado no cabeçalho Authorization.
// Devolve o token decodificado, ou null depois de já ter respondido 401.
export async function requireUser(req, res) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: 'Missing Authorization token' });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// Registra o erro real no log da Vercel e devolve uma mensagem genérica,
// sem expor detalhes internos ao navegador.
export function serverError(res, where, e) {
  console.error(`[${where}]`, e);
  return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
}

// db.getAll em lotes, para não montar uma única chamada gigante.
export async function getAllChunked(db, refs, size = 300) {
  const out = [];
  for (let i = 0; i < refs.length; i += size) {
    const chunk = refs.slice(i, i + size);
    if (chunk.length) out.push(...(await db.getAll(...chunk)));
  }
  return out;
}
