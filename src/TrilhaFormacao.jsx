import React, { useState } from 'react';
import { Award, CheckCircle, BookOpen, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { GRADE_CURRICULAR } from './constants/data';

export default function TrilhaFormacao({ books, isDark, setNewBook, setShowAddBook, saveBooksToDb, setBookSearchQuery, searchBooks }) {
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
            Trilha de Formação (Livros Obrigatórios para Pedagogos)
          </h2>
        </div>
        {isMainOpen ? <ChevronUp size={24} color={isDark ? '#d4af37' : '#6b4423'} /> : <ChevronDown size={24} color={isDark ? '#d4af37' : '#6b4423'} />}
      </div>

      {/* CONTEÚDO DA TRILHA */}
      {isMainOpen && (
        <div className="animate-fadeIn" style={{ padding: '1rem 2rem 2rem' }}>
          {['1º Ano', '2º Ano', '3º Ano'].map(ano => {
            // LÓGICA DE PORCENTAGEM DO ANO
            const livrosDoAno = progresso.filter(l => l.stage === ano);
            const total = livrosDoAno.length;
            const lidos = livrosDoAno.filter(l => l.statusUser === 'lido').length;
            const percentual = total > 0 ? Math.round((lidos / total) * 100) : 0;
            const isCompleted = percentual === 100;

            return (
              <div key={ano} style={{ marginBottom: '1rem' }}>
                {/* SUB-GAVETA POR ANO (AGORA COM PORCENTAGEM) */}
                <div 
                  onClick={() => toggleYear(ano)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '0.8rem 1rem', background: isDark ? 'rgba(255,255,255,0.03)' : '#f9f9f9', 
                    borderRadius: '8px', cursor: 'pointer', border: `1px solid ${isCompleted ? '#4caf50' : (isDark ? '#333' : '#eee')}`,
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  {/* Barra de progresso sutil no fundo do botão */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: `${percentual}%`, background: isCompleted ? '#4caf50' : (isDark ? '#d4af37' : '#996515'), transition: 'width 1s ease-in-out' }}></div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', letterSpacing: '1px' }}>{ano}</h3>
                    
                    {/* Badge de Porcentagem */}
                    <span style={{ 
                      fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '12px', 
                      background: isCompleted ? 'rgba(76, 175, 80, 0.15)' : (isDark ? 'rgba(212, 175, 55, 0.1)' : 'rgba(139, 115, 85, 0.1)'),
                      color: isCompleted ? '#4caf50' : (isDark ? '#d4af37' : '#996515') 
                    }}>
                      {percentual}% Concluído
                    </span>
                  </div>
                  
                  <div style={{ zIndex: 1, color: isDark ? '#b8a88a' : '#666' }}>
                    {openYears[ano] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* LISTA DE LIVROS DENTRO DA GAVETA */}
                {openYears[ano] && (
                  <div className="animate-fadeIn" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem', padding: '0 0.5rem' }}>
                    {livrosDoAno.map((livro, idx) => {
                      const isLido = livro.statusUser === 'lido';
                      const isLendo = livro.statusUser === 'lendo';
                      return (
                      <div key={idx} style={{ 
                        background: isLido ? (isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4') : (isDark ? 'rgba(255,255,255,0.02)' : '#fff'), 
                        padding: '1.2rem', borderRadius: '12px', 
                        border: `1px solid ${isLido ? '#4caf50' : (isLendo ? '#FFD700' : (isDark ? '#333' : '#eee'))}`, 
                        display: 'flex', flexDirection: 'column', gap: '0.5rem',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                      }}>
                        <h4 style={{ margin: 0, color: isLido ? '#4caf50' : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '1.1rem', fontFamily: "'Cinzel', serif", lineHeight: '1.2' }}>{livro.title}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: isDark ? '#b8a88a' : '#666', fontStyle: 'italic' }}>{livro.author}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '1rem' }}>
                          
                          {/* Área da Esquerda: Ações ou Status */}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {isLido ? (
                              <span style={{ color: '#4caf50', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <CheckCircle size={16}/> Lido
                              </span>
                            ) : (
                              <>
                                <button onClick={() => {
                                    const query = `${livro.title} ${livro.author}`;
                                    setShowAddBook(true); 
                                    setBookSearchQuery(query); 
                                    searchBooks(query); 
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }} style={{ padding: '0.5rem 1.2rem', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                  Ler
                                </button>
                                <button onClick={() => handleJaLi(livro)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                  Já Li
                                </button>
                              </>
                            )}
                          </div>

                          {/* Área da Direita: Carrinho Discreto */}
                          <a href={`https://www.amazon.com.br/s?k=${encodeURIComponent(livro.title + ' ' + livro.author)}&tag=filosofiae0a5-20`} target="_blank" rel="noopener noreferrer" style={{ padding: '0.5rem 0.8rem', background: '#FF9900', color: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="Comprar na Amazon">
                            <ShoppingCart size={16} />
                          </a>

                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}