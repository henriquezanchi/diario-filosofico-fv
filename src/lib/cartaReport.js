// Monta o texto do "Histórico da Carta de Degrau" exportado pelo discípulo.
//
// A ideia é ler o ciclo como uma trajetória: primeiro um panorama da
// constância, depois cada item da Carta com as respostas em ordem
// cronológica, agrupadas por semana, e por fim perguntas para a releitura.
// Organizar por item (e não por dia) é o que deixa visível o que mudou entre
// o começo e o fim do período.

const ITEM2_SUBKEYS = ['instintos', 'idade', 'enfermidade', 'animo', 'humor', 'ideias', 'sentimentos', 'ambiente'];
const ITEM2_SUBLABELS = {
  instintos: 'Instintos', idade: 'Idade', enfermidade: 'Enfermidade', animo: 'Ânimo',
  humor: 'Humor', ideias: 'Ideias', sentimentos: 'Sentimentos', ambiente: 'Ambiente',
};

export const DEFAULT_CARTA_ITEMS = [
  { id: 'item1', label: '1 – VARRER POR DENTRO' },
  { id: 'item2', label: '2 – AS LEIS DA MATÉRIA' },
  { id: 'item34', label: '3 e 4 – TRABALHO ORDENADO E EFICAZ' },
  { id: 'item5', label: '5 – ECONOMIA DE TEMPO E ENERGIA' },
  { id: 'item6', label: '6 – OS VÍCIOS' },
  { id: 'item7', label: '7 – AS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA' },
];

const WIDTH = 72;
const RULE = '═'.repeat(WIDTH);
const THIN = '─'.repeat(WIDTH);
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const asText = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const toDate = (key) => new Date(key + 'T12:00:00');
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortBR = (key) => { const [, m, d] = key.split('-'); return `${d}/${m}`; };
const longBR = (key) => toDate(key).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const addDays = (key, n) => { const d = toDate(key); d.setDate(d.getDate() + n); return keyOf(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

// Quebra um texto em linhas de até `width` caracteres, com recuo.
function wrap(text, indent, width = WIDTH) {
  const out = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (indent + line + ' ' + word).length > width) {
        out.push(indent + line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) out.push(indent + line);
  }
  return out;
}

const center = (text) => ' '.repeat(Math.max(0, Math.floor((WIDTH - text.length) / 2))) + text;

// Texto de um item numa entrada (o item 2 junta as subcategorias).
function itemText(fv, itemId) {
  if (itemId !== 'item2') return asText(fv[itemId]);
  const parts = ITEM2_SUBKEYS
    .filter(k => asText(fv[`item2_${k}`]))
    .map(k => `${ITEM2_SUBLABELS[k]}: ${asText(fv[`item2_${k}`])}`);
  if (asText(fv.item2)) parts.push(asText(fv.item2));
  return parts.join('\n');
}

function minutesOf(hhmm) {
  const [h, m] = asText(hhmm).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}
const fmtMinutes = (min) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

// Barra de constância de uma semana: um quadrado por dia do período.
const bar = (filled, total) => '■'.repeat(filled) + '□'.repeat(Math.max(0, total - filled));

/**
 * @param {object} p
 * @param {Array} p.entries        entradas do diário (com date e fvDaily)
 * @param {Array} [p.items]        itens da Carta configurados ({ id, label })
 * @param {string} [p.lastCartaDate] AAAA-MM-DD da última Carta entregue
 * @param {string} [p.masterName]  destinatário da Carta
 * @param {string} p.todayKey      AAAA-MM-DD de hoje
 * @returns {{ text: string, periodStart: string, periodEnd: string } | null}
 */
export function buildCartaHistoryReport({ entries, items, lastCartaDate, masterName, todayKey }) {
  const cartaItems = (items && items.length ? items : DEFAULT_CARTA_ITEMS).filter(i => i && i.id);

  // Período: o dia seguinte à última Carta até hoje; sem Carta anterior, os
  // últimos 30 dias (a mesma regra da síntese automática).
  const periodStart = lastCartaDate && lastCartaDate < todayKey ? addDays(lastCartaDate, 1) : addDays(todayKey, -29);
  const periodEnd = todayKey;
  const totalDays = daysBetween(periodStart, periodEnd) + 1;

  const inPeriod = entries
    .filter(e => e.date && e.date >= periodStart && e.date <= periodEnd && e.fvDaily)
    .sort((a, b) => a.date.localeCompare(b.date));

  const answeredByItem = Object.fromEntries(cartaItems.map(i => [i.id, []]));
  const daysWithText = new Set();
  let practiceDays = 0, vol = 0, assist = 0, minist = 0;
  for (const e of inPeriod) {
    const fv = e.fvDaily;
    for (const item of cartaItems) {
      const t = itemText(fv, item.id);
      if (t) { answeredByItem[item.id].push({ date: e.date, text: t }); daysWithText.add(e.date); }
    }
    if (fv.praticas && Object.values(fv.praticas).some(v => v === true)) practiceDays++;
    vol += minutesOf(fv.horasVoluntariado);
    assist += minutesOf(fv.horasAulaAssistida);
    minist += minutesOf(fv.horasAulaMinistrada);
  }
  if (daysWithText.size === 0) return null;

  // Semanas do período (blocos de 7 dias a partir do início).
  const weeks = [];
  for (let start = periodStart; start <= periodEnd; start = addDays(start, 7)) {
    const end = addDays(start, 6) < periodEnd ? addDays(start, 6) : periodEnd;
    weeks.push({ start, end, days: daysBetween(start, end) + 1 });
  }
  const weekOf = (date) => Math.floor(daysBetween(periodStart, date) / 7);

  const L = [];
  L.push(RULE, '', center('HISTÓRICO DA CARTA DE DEGRAU'), center('A trajetória do ciclo'), '');
  L.push(center(`${longBR(periodStart)}  →  ${longBR(periodEnd)}`));
  if (masterName) L.push(center(`Para: ${masterName}`));
  L.push('', RULE, '');

  // --- Panorama ---
  L.push('PANORAMA DO CICLO', THIN);
  L.push(`  Dias no período ............ ${totalDays}`);
  L.push(`  Dias com registro .......... ${daysWithText.size}  (${Math.round((daysWithText.size / totalDays) * 100)}%)`);
  L.push(`  Dias com práticas .......... ${practiceDays}`);
  if (vol || assist || minist) {
    if (vol) L.push(`  Voluntariado ............... ${fmtMinutes(vol)}`);
    if (assist) L.push(`  Aulas assistidas ........... ${fmtMinutes(assist)}`);
    if (minist) L.push(`  Aulas ministradas .......... ${fmtMinutes(minist)}`);
  }
  L.push('');
  L.push('  Constância semanal (■ = dia com registro na Carta)');
  weeks.forEach((w, i) => {
    const filled = [...daysWithText].filter(d => d >= w.start && d <= w.end).length;
    L.push(`  Semana ${String(i + 1).padStart(2)}  ${shortBR(w.start)}–${shortBR(w.end)}  ${bar(filled, w.days).padEnd(8)} ${filled}/${w.days}`);
  });
  L.push('');
  L.push('  Registros por item');
  for (const item of cartaItems) {
    const n = answeredByItem[item.id].length;
    const name = item.label.length > 44 ? item.label.slice(0, 43) + '…' : item.label;
    L.push(`  ${name.padEnd(46, '.')} ${String(n).padStart(2)} dia(s)`);
  }
  L.push('', '');

  // --- Trajetória por item ---
  L.push('A TRAJETÓRIA DE CADA ITEM', THIN);
  L.push(...wrap('Cada item mostra as respostas em ordem, do começo ao fim do ciclo. Leia de cima para baixo e observe o que mudou.', '  '));
  L.push('');

  for (const item of cartaItems) {
    const answers = answeredByItem[item.id];
    L.push('', RULE.slice(0, 3) + ' ' + item.label + ' ' + RULE.slice(0, Math.max(3, WIDTH - item.label.length - 5)));
    if (answers.length === 0) {
      L.push('', '  Nenhuma resposta registrada neste ciclo.');
      continue;
    }
    L.push(`  ${answers.length} registro(s) · do dia ${shortBR(answers[0].date)} ao dia ${shortBR(answers[answers.length - 1].date)}`);

    let currentWeek = -1;
    for (const a of answers) {
      const w = weekOf(a.date);
      if (w !== currentWeek) {
        currentWeek = w;
        L.push('', `  ┌ Semana ${w + 1} (${shortBR(weeks[w].start)} a ${shortBR(weeks[w].end)})`);
      }
      const head = `  │ ${WEEKDAYS[toDate(a.date).getDay()]} ${shortBR(a.date)}  `;
      const cont = '  │' + ' '.repeat(head.length - 3);
      const body = wrap(a.text, '', WIDTH - head.length);
      body.forEach((line, i) => L.push((i === 0 ? head : cont) + line));
    }

    // Primeira e última respostas lado a lado no tempo: o começo e o fim.
    if (answers.length >= 3) {
      const first = answers[0], last = answers[answers.length - 1];
      L.push('', '  ◆ Do começo ao fim do ciclo');
      L.push(`    Início (${shortBR(first.date)}):`);
      L.push(...wrap(first.text, '      '));
      L.push(`    Fim (${shortBR(last.date)}):`);
      L.push(...wrap(last.text, '      '));
    }
  }

  // --- Releitura ---
  L.push('', '', RULE, 'PARA A RELEITURA', THIN);
  [
    'Comparando o começo e o fim de cada item: o que mudou de fato?',
    'Que padrões se repetiram ao longo das semanas?',
    'Onde houve um avanço real, que já se nota no dia a dia?',
    'Em que ponto você ainda tropeça no fim do ciclo?',
    'Que semana teve menos registros, e o que aconteceu nela?',
  ].forEach(q => L.push(...wrap(`• ${q}`, '  ')));
  L.push('', RULE, center(`Gerado em ${longBR(todayKey)} pelo Diário Filosófico`), '');

  return { text: L.join('\n'), periodStart, periodEnd };
}
