// Código comum às funções da API. O prefixo "_" faz a Vercel não publicar
// este arquivo como endpoint.
import admin from 'firebase-admin';

// Aceita a chave privada nos formatos em que ela costuma ser colada na
// Vercel: com aspas em volta, com "\n" literais no lugar das quebras de
// linha, com quebras do Windows, em base64, ou o JSON inteiro da conta de
// serviço (em FIREBASE_SERVICE_ACCOUNT ou no próprio FIREBASE_PRIVATE_KEY).
function normalizePrivateKey(raw) {
  if (!raw) return undefined;
  let key = String(raw).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  if (!key.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) key = decoded.trim();
    } catch { /* não era base64 */ }
  }
  return key;
}

function readServiceAccount() {
  for (const candidate of [process.env.FIREBASE_SERVICE_ACCOUNT, process.env.FIREBASE_PRIVATE_KEY]) {
    const text = (candidate || '').trim();
    if (!text.startsWith('{')) continue;
    try {
      const json = JSON.parse(text);
      if (json.private_key) {
        return { projectId: json.project_id, clientEmail: json.client_email, privateKey: normalizePrivateKey(json.private_key) };
      }
    } catch { /* não era JSON */ }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

// Se a credencial estiver errada, a função não cai ao carregar: cada pedido
// recebe um erro claro e o motivo fica registrado no log da Vercel.
let initError = null;
if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(readServiceAccount()) });
  } catch (e) {
    initError = e;
    console.error('[firebase-admin] credencial inválida. Confira FIREBASE_PRIVATE_KEY na Vercel:', e.message);
  }
}

export function firebaseReady(res) {
  if (!initError) return true;
  res.status(500).json({ error: 'Servidor sem credencial válida do Firebase.' });
  return false;
}

export { admin };

// Único lugar com o endereço do app usado nos links de notificação.
export const APP_URL = 'https://diario-filosofico-fv.vercel.app/';

// Confere o token do Firebase enviado no cabeçalho Authorization.
// Devolve o token decodificado, ou null depois de já ter respondido 401.
export async function requireUser(req, res) {
  if (!firebaseReady(res)) return null;
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
