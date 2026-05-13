import React, { useState } from 'react';
import { Award, CheckCircle, BookOpen, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { GRADE_CURRICULAR } from './constants/data';

export default function TrilhaFormacao({ books, isDark, setNewBook, setShowAddBook, saveBooksToDb }) {
  // Estado para a gaveta principal e para as gavetas de cada ano
  const [isMainOpen, setIsMainOpen] = useState(false);
  const [openYears, setOpenYears] = useState({ '1º Ano': true, '2º Ano': false, '3º Ano': false });

  const toggleYear = (ano) => {
    setOpenYears(prev => ({ ...prev, [ano]: !prev[ano] }));
  };

  // Inteligência de Match (Fuzzy)
  const normalizar = (str = '') => {
    if (!str) return '';
    const artigos = /^(o|a|os|as|um|uma|the|an|a|de|do|da|dos|das)\s+/i;
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/-/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(artigos, '').replace(/\s+/g, ' ').trim();
  };

  const getTokens = (str) => normalizar(str).split(' ').filter(t => t.length > 2);

  const matchInteligente = (tituloA, tituloB) => {
    const tA = getTokens(tituloA); const tB = getTokens(tituloB);
    if (tA.length === 0 || tB.length === 0) return false;
    const menor = tA.length < tB.length ? tA : tB;
    const maior = tA.length < tB.length ? tB : tA;
    const hits = menor.filter(t => maior.some(m => m.includes(t) || t.includes(m))).length;
    return (hits / menor.length) >= 0.75;
  };

  const handleJaLi = (livro) => {
    const novoLivro = {
      id: `book_${Date.now()}`,
      title: livro.title,
      author: livro.author,
      totalPages: 1,
      currentPage: 1,
      status: 'lido',
      finishedDate: new Date().toISOString(),
      category: 'Filosofia',
      isPendingEnrichment: true
    };
    saveBooksToDb([novoLivro, ...books]);
    alert(`✅ "${livro.title}" adicionado à estante!`);
  };

  const getProgressoGrade = () => {
    return GRADE_CURRICULAR.map(livroCanon => {
      // Cruzamento de dados com tolerância para obras clássicas
      const livroNaEstante = books.find(b => {
        const tituloOk = matchInteligente(livroCanon.title, b.title);
        const obrasMilenares = ['bhagavad gita', 'dhammapada', 'analectos', 'republica', 'voz do silêncio'];
        const isMilenar = obrasMilenares.some(o => livroCanon.title.toLowerCase().includes(o));
        return tituloOk; // Aqui o título manda, facilitando o match
      });

      return {
        ...livroCanon,
        statusUser: livroNaEstante ? (livroNaEstante.finishedDate || livroNaEstante.status === 'lido' ? 'lido' : 'lendo') : 'pendente',
      };
    });
  };

  const progresso = getProgressoGrade();

  return (
    <div style={{ 
      background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white', 
      borderRadius: '16px', 
      border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`,
      overflow: 'hidden',
      marginBottom: '2rem'
    }}>
      {/* CABEÇALHO DA GAVETA MESTRA */}
      <div 
        onClick={() => setIsMainOpen(!isMainOpen)}
        style={{ padding: '1.5rem 2rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? 'rgba(0,0,0,0.2)' : '#fdfbf7' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Award size={28} color={isDark ? '#FFD700' : '#996515'} />
          <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', color: isDark ? '#f0e6d2' : '#2c1810', fontFamily: "'Cinzel', serif" }}>
            Trilha de Formação (Livros Obrigatórios)
          </h2>
        </div>
        {isMainOpen ? <ChevronUp size={24} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={24} color={isDark ? '#d4af37' : '#6b4423'} />}
      </div>

      {/* CONTEÚDO DA TRILHA */}
      {isMainOpen && (
        <div className="animate-fadeIn" style={{ padding: '1rem 2rem 2rem' }}>
          {['1º Ano', '2º Ano', '3º Ano'].map(ano => (
            <div key={ano} style={{ marginBottom: '1rem' }}>
              {/* SUB-GAVETA POR ANO */}
              <div 
                onClick={() => toggleYear(ano)}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '0.8rem 1rem', background: isDark ? 'rgba(255,255,255,0.03)' : '#f9f9f9', 
                  borderRadius: '8px', cursor: 'pointer', border: `1px solid ${isDark ? '#333' : '#eee'}`
                }}
              >
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px' }}>{ano}</h3>
                {openYears[ano] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {openYears[ano] && (
                <div className="animate-fadeIn" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem', padding: '0 0.5rem' }}>
                  {progresso.filter(l => l.stage === ano).map((livro, idx) => {
                    const isLido = livro.statusUser === 'lido';
                    const isLendo = livro.statusUser === 'lendo';
                    return (
                      <div key={idx} style={{ 
                        background: isLido ? (isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4') : (isDark ? 'rgba(255,255,255,0.02)' : '#fff'), 
                        padding: '1.2rem', borderRadius: '12px', 
                        border: `1px solid ${isLido ? '#4caf50' : (isLendo ? '#FFD700' : (isDark ? '#333' : '#eee'))}`, 
                        display: 'flex', flexDirection: 'column', gap: '0.5rem' 
                      }}>
                        <h4 style={{ margin: 0, color: isLido ? '#4caf50' : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '1rem', fontFamily: "'Cinzel', serif" }}>{livro.title}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', fontStyle: 'italic' }}>{livro.author}</p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                          {isLido ? (
                            <div style={{ color: '#4caf50', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={14}/> Concluído</div>
                          ) : (
                            <>
                              <button onClick={() => {setNewBook({title: livro.title, author: livro.author}); setShowAddBook(true); window.scrollTo(0,0);}} style={{ flex: 1, padding: '0.5rem', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>Ler</button>
                              <button onClick={() => handleJaLi(livro)} style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>Já Li</button>
                            </>
                          )}
                          <a href={`https://www.amazon.com.br/s?k=${encodeURIComponent(livro.title + ' ' + livro.author)}&tag=filosofiae0a5-20`} target="_blank" rel="noopener noreferrer" style={{ padding: '0.5rem', background: '#FF9900', color: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Comprar na Amazon"><ShoppingCart size={16} /></a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}