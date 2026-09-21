import admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

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

// Estrutura padrão da Carta de Degrau — mesma usada como default em
// loadMod2Config() no cliente, caso o usuário nunca tenha customizado
// fvData/{uid}.config.itensCarta.
const DEFAULT_ITENS_CARTA = [
  { id: 'item1', label: '1 – VARRER POR DENTRO', desc: 'Exame da personalidade, descobrir os nós, buscar as causas que os geraram, encontrar a fórmula de limpeza (redenção) e aplicá-las.' },
  { id: 'item2', label: '2 – AS LEIS DA MATÉRIA', desc: 'Descobrir como atuam em nós os ciclos da matéria (para não nos afetarem): instintos de conservação/procriação, idade, enfermidade, ânimo, humor, ideias, sentimentos, ambiente.' },
  { id: 'item34', label: '3 e 4 – TRABALHO ORDENADO E EFICAZ', desc: 'Colocar ordem na vida. Necessária disciplina e perseverança: exercícios de ordem e limpeza.' },
  { id: 'item5', label: '5 – ECONOMIA DE TEMPO E ENERGIA', desc: 'Requer atenção.' },
  { id: 'item6', label: '6 – OS VÍCIOS', desc: 'Superar: preguiça, gula e luxúria e outros da mesma natureza (apatia, moleza, debilidade, negligência). Moderar: álcool e fumo. Proibido: drogas.' },
  { id: 'item7', label: '7 – AS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA', desc: 'Perseverança: repetir sem rotina com sentido de perfeição. Constância: estabilidade e consciência elevada. (Nota: Comentar sobre frequência no diário, carta, exercícios, ED, etc).' },
];

const ITEM2_SUBKEYS = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
const ITEM2_SUBLABELS = { instintos: 'Instintos (Conserv./Procriação)', idade: 'Idade', enfermidade: 'Enfermidade', animo: 'Ânimo', humor: 'Humor', ideias: 'Ideias', sentimentos: 'Sentimentos', ambiente: 'Ambiente' };

const CartaSchema = z.object({
  item1: z.string(),
  item2: z.string(),
  item34: z.string(),
  item5: z.string(),
  item6: z.string(),
  item7: z.string(),
});

function formatDateBR(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

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
    const fvDataSnap = await db.collection('fvData').doc(uid).get();
    const fvData = fvDataSnap.exists ? fvDataSnap.data() : {};
    const itensCarta = fvData.config?.itensCarta?.length ? fvData.config.itensCarta : DEFAULT_ITENS_CARTA;
    const lastCartaDate = fvData.fvLastCartaDate || fvData.lastCartaDate || null;
    const masterName = fvData.fvMasterName || fvData.masterName || null;

    // Período: desde a última Carta de Degrau entregue; sem isso, os
    // últimos 30 dias (mesma janela usada em outras métricas do ciclo).
    let periodStart;
    if (lastCartaDate) {
      periodStart = lastCartaDate;
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      periodStart = d.toISOString().slice(0, 10);
    }

    const entriesSnap = await db.collection('entries').where('userId', '==', uid).get();
    const entries = entriesSnap.docs
      .map(d => d.data())
      .filter(e => e.date && e.date > periodStart)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (entries.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro encontrado no período desde a última Carta de Degrau. Preencha o diário antes de gerar a síntese.' });
    }

    // Monta, por item, a lista cronológica de respostas do ciclo.
    const porItem = {};
    for (const item of itensCarta) {
      porItem[item.id] = [];
    }
    for (const entry of entries) {
      const fv = entry.fvDaily || {};
      const dataFormatada = formatDateBR(entry.date);
      for (const item of itensCarta) {
        if (item.id === 'item2') {
          const partes = ITEM2_SUBKEYS
            .filter(k => (fv[`item2_${k}`] || '').trim())
            .map(k => `${ITEM2_SUBLABELS[k]}: ${fv[`item2_${k}`].trim()}`);
          if ((fv.item2 || '').trim()) partes.push(fv.item2.trim());
          if (partes.length) porItem.item2.push({ data: dataFormatada, texto: partes.join(' | ') });
        } else if ((fv[item.id] || '').trim()) {
          porItem[item.id].push({ data: dataFormatada, texto: fv[item.id].trim() });
        }
      }
    }

    const temAlgumaResposta = Object.values(porItem).some(lista => lista.length > 0);
    if (!temAlgumaResposta) {
      return res.status(400).json({ error: 'Não há respostas preenchidas na "Escalada (Degrau)" no período. Preencha os itens antes de gerar a síntese.' });
    }

    const blocosPrompt = itensCarta.map(item => {
      const respostas = porItem[item.id];
      const corpo = respostas.length
        ? respostas.map(r => `  [${r.data}] ${r.texto}`).join('\n')
        : '  (nenhuma resposta registrada neste período)';
      return `### ${item.label}\nInstrução original do item: ${item.desc}\nRespostas diárias do aluno no período:\n${corpo}`;
    }).join('\n\n');

    const prompt = `Você é um instrutor experiente de uma escola de filosofia prática, revisando o autoexame diário de um discípulo para redigir a síntese oficial da "Carta de Degrau" dele — um relatório periódico entregue ao Mestre/instrutor responsável.

Para CADA um dos 6 itens abaixo, você tem a lista cronológica de respostas que o aluno escreveu dia após dia neste ciclo. Sua tarefa é escrever UM ÚNICO parágrafo de síntese por item (não uma por dia, não uma lista).

REGRAS IMPORTANTES:
- NÃO faça uma média fria ou um resumo estatístico das respostas. Leia a sequência cronológica e escreva sobre o CAMINHAR do aluno: onde ele começou o ciclo, o que mudou, que padrões se repetiram, onde houve avanço real e onde ele ainda tropeça no fim do período. É uma leitura de trajetória, não um apanhado geral.
- Escreva na terceira pessoa, em tom técnico e sóbrio (como um instrutor avaliando um relatório), sem elogios vazios nem críticas genéricas — seja específico, citando os padrões reais que aparecem nas respostas.
- Se um item não teve nenhuma resposta registrada, diga isso claramente em uma frase curta (ex: "O aluno não registrou reflexões sobre este item neste ciclo.") em vez de inventar conteúdo.
- Cada síntese deve ter entre 3 e 6 linhas — nem telegráfica demais, nem um textão.
- Português do Brasil, sem markdown, sem listas — texto corrido em parágrafo.

ITENS E RESPOSTAS DO CICLO:

${blocosPrompt}

Retorne a síntese de cada item nas chaves exatas: item1, item2, item34, item5, item6, item7.`;

    const response = await anthropic.messages.parse({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(CartaSchema) },
    });

    if (!response.parsed_output) {
      return res.status(502).json({ error: 'Não foi possível interpretar a resposta da IA. Tente novamente.' });
    }

    return res.status(200).json({
      itens: itensCarta.map(item => ({
        id: item.id,
        label: item.label,
        comentario: response.parsed_output[item.id] || '',
      })),
      periodStart,
      periodEnd: entries[entries.length - 1].date,
      masterName,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
