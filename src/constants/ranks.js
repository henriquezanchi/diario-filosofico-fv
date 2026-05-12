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

export const CATEGORY_MAP = {
  'Religion': 'Religião',
  'Philosophy': 'Filosofia',
  'Fiction': 'Ficção',
  'History': 'História',
  'Psychology': 'Psicologia',
  'Science': 'Ciência',
  'Self-Help': 'Autoajuda',
  'Body, Mind & Spirit': 'Espiritualidade',
  'Biography & Autobiography': 'Biografia',
  'Literary Collections': 'Literatura',
  'Poetry': 'Poesia',
  'Social Science': 'Ciências Sociais'
};

export const translateCategory = (rawCategory) => {
  if (!rawCategory) return 'Filosofia';
  let result = rawCategory;
  Object.entries(CATEGORY_MAP).forEach(([en, pt]) => {
    result = result.replace(new RegExp(en, 'g'), pt);
  });
  return result;
};