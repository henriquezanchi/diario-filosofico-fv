import { AUTHOR_CANON } from './ranks';

export const AUTHOR_CANON = {
  'platão': 35, 'platao': 35,
  'sêneca': 14, 'seneca': 14,
  'helena petrovna blavatsky': 6, 'h. p. blavatsky': 6, 'blavatsky': 6,
  'jorge ángel livraga': 15, 'j. a. livraga': 15, 'jorge angel livraga': 15,
  'délia steinberg guzmán': 10, 'delia steinberg guzman': 10,
  'marco aurélio': 1, 'marco aurelio': 1,
  'epicteto': 2,
  'aristóteles': 30, 'aristoteles': 30,
  'sri ram': 5,
  'immanuel kant': 15,
  'friedrich nietzsche': 10,
  'carl jung': 12
};

export const getReadingRank = (pages) => {
  if (pages < 500) return { title: "Pedra Bruta", next: 500, color: "#95A5A6" };
  if (pages < 1500) return { title: "Coluna Dórica", next: 1500, color: "#3498DB" };
  if (pages < 3000) return { title: "Cidadão de Roma", next: 3000, color: "#E67E22" };
  if (pages < 6000) return { title: "Senador Estóico", next: 6000, color: "#9B59B6" };
  if (pages < 10000) return { title: "Mestre da Academia", next: 10000, color: "#E74C3C" };
  return { title: "Sábio do Panteão", next: null, color: "#FFD700" };
};

export const getFavoriteTheme = (books) => {
  if (!books || books.length === 0) return "Nenhum";
  const themeCounts = {};
  books.forEach(b => {
    const theme = b.category || 'Filosofia';
    themeCounts[theme] = (themeCounts[theme] || 0) + 1;
  });
  return Object.keys(themeCounts).reduce((a, b) => themeCounts[a] > themeCounts[b] ? a : b);
};

export const getAuthorStats = (books) => {
  if (!books || books.length === 0) return [];
  const stats = {};

  books.forEach(b => {
    if (!b.author || b.author === 'Autor desconhecido') return;

    const isFinished = b.status === 'lido' || b.finishedDate || (b.totalPages > 0 && b.currentPage >= b.totalPages);
    const isReading = b.status === 'lendo' || (b.currentPage > 0 && b.currentPage < b.totalPages);

    if (!stats[b.author]) stats[b.author] = { totalPages: 0, readPages: 0, readBooks: 0 };

    stats[b.author].totalPages += (b.totalPages || 0);
    stats[b.author].readPages += (b.currentPage || 0);

    if (isFinished || isReading) {
      stats[b.author].readBooks += 1;
    }
  });

  return Object.entries(stats)
    .filter(([_, data]) => data.readBooks > 0)
    .map(([author, data]) => {
      const authorKey = author.toLowerCase().trim();
      const totalWorks = AUTHOR_CANON[authorKey] || Math.max(data.readBooks, 1);

      let depthPerc = 0;
      if (data.totalPages > 0) {
        const pageCompletion = data.readPages / data.totalPages;
        depthPerc = Math.round((data.readBooks / totalWorks) * pageCompletion * 100);
      }
      if (depthPerc > 100) depthPerc = 100;

      return { author, ...data, totalWorks, depthPerc };
    })
    .sort((a, b) => b.depthPerc - a.depthPerc)
    .slice(0, 6);
};