export const translateCategory = (category) => {
  if (!category) return 'Filosofia';
  return category
    .replace(/Religion/g, 'Religião')
    .replace(/Philosophy/g, 'Filosofia')
    .replace(/Fiction/g, 'Ficção')
    .replace(/History/g, 'História')
    .replace(/Psychology/g, 'Psicologia')
    .replace(/Science/g, 'Ciência')
    .replace(/Self-Help/g, 'Autoajuda')
    .replace(/Body, Mind & Spirit/g, 'Espiritualidade')
    .replace(/Biography & Autobiography/g, 'Biografia')
    .replace(/Literary Collections/g, 'Literatura')
    .replace(/Poetry/g, 'Poesia')
    .replace(/Social Science/g, 'Ciências Sociais');
};