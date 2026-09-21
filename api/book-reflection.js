import admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

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

const anthropic = new Anthropic();

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

  try {
    const booksSnap = await db.collection('userBooks').doc(uid).get();
    const allBooks = booksSnap.exists ? (booksSnap.data().books || []) : [];

    const readBooks = allBooks.filter(b =>
      b.status === 'lido' || b.finishedDate || (b.totalPages > 0 && b.currentPage >= b.totalPages)
    );

    if (readBooks.length < 2) {
      return res.status(400).json({ error: 'Marque pelo menos 2 livros como concluídos na sua estante para gerar uma reflexão cruzada.' });
    }

    const blocosPrompt = readBooks.map((b, i) => {
      const partes = [`${i + 1}. "${b.title}"${b.author ? ` — ${b.author}` : ''}`];
      if (b.category) partes.push(`   Categoria: ${b.category}`);
      if (b.notes && b.notes.trim()) partes.push(`   Notas do leitor: ${b.notes.trim()}`);
      return partes.join('\n');
    }).join('\n\n');

    const prompt = `Você é um tutor de filosofia ajudando um leitor a enxergar conexões entre os livros que ele já leu.

LIVROS JÁ LIDOS PELO LEITOR:

${blocosPrompt}

Escreva uma reflexão cruzada em português do Brasil, ligando esses livros entre si: temas recorrentes que atravessam mais de um deles, pontos onde os autores discordam ou se tensionam, e como a ideia de um livro ilumina ou desafia a de outro. Use os títulos ao mencionar os livros.

REGRAS IMPORTANTES:
- NÃO resuma cada livro separadamente um após o outro — isso não é o que foi pedido. O texto deve costurar os livros JUNTOS, em diálogo.
- Se as notas do leitor estiverem disponíveis, aproveite-as para tornar a reflexão mais pessoal e específica, não genérica.
- Tom de conversa entre tutor e aluno: instigante, mas não professoral nem pomposo.
- 3 a 5 parágrafos, texto corrido, sem markdown, sem listas, sem títulos internos.
- Termine sugerindo, em uma frase, que conexão ou pergunta o leitor poderia explorar a seguir (não precisa ser uma recomendação de livro novo).`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const reflection = response.content?.find(block => block.type === 'text')?.text || '';
    if (!reflection) {
      return res.status(502).json({ error: 'Não foi possível gerar a reflexão. Tente novamente.' });
    }

    return res.status(200).json({
      reflection,
      books: readBooks.map(b => ({ title: b.title, author: b.author || null })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
