import React from 'react';
import { Award, CheckCircle, BookOpen, ShoppingCart, Plus } from 'lucide-react';
import { GRADE_CURRICULAR } from './constants/data';

export default function TrilhaFormacao({ books, isDark, setNewBook, setShowAddBook, saveBooksToDb }) {
  
  // Normalização ultra-robusta para ignorar hifens, artigos e acentos
  const normalizarParaMatch = (str = '') => {
    if (!str) return '';
    const artigos = /^(o|a|os|as|um|uma|the|an|a|de|do|da|dos|das)\s+/i;
    return str
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase()
      .replace(/-/g, ' ') // transforma hifen em espaço (ajuda no Bhagavad-Gita)
      .replace(/[^a-z0-9\s]/g, ' ') // remove pontuação
      .replace(artigos, '') // remove artigos iniciais
      .replace(/\s+/g, ' ').trim();
  };

  const getTokens = (str) => normalizarParaMatch(str).split(' ').filter(t => t.length > 2);

  const titulosEquivalentes = (tituloA, tituloB) => {
    const tA = getTokens(tituloA); 
    const tB = getTokens(tituloB);
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
      totalPages: 1, // valor simbólico
      currentPage: 1,
      status: 'lido',
      finishedDate: new Date().toISOString(),
      category: 'Filosofia',
      isPendingEnrichment: true // o operário vai buscar a capa depois
    };
    const novosLivros = [novoLivro, ...books];
    saveBooksToDb(novosLivros);
    alert(`✅ "${livro.title}" foi adicionado aos seus livros lidos!`);
  };

  const getProgressoGrade = () => {
    return GRADE_CURRICULAR.map(livroCanon => {
      const livroNaEstante = books.find(b => titulosEquivalentes(livroCanon.title, b.title));
      return {
        ...livroCanon,
        statusUser: livroNaEstante ? (livroNaEstante.finishedDate || livroNaEstante.status === 'lido' ? 'lido' : 'lendo') : 'pendente',
      };
    });
  };

  return (
    <div className="animate-fadeIn" style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <Award size={28} color={isDark ? '#FFD700' : '#996515'} />
        <h2 style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', fontFamily: "'Cinzel', serif" }}>
          Trilha de Formação
        </h2>
      </div>
      
      {['1º Ano', '2º Ano', '3º Ano'].map(ano => (
        <div key={ano} style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: isDark ? '#b8a88a' : '#6b5744', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: `1px solid ${isDark ? '#333' : '#eee'}`, paddingBottom: '0.3rem' }}>{ano}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {getProgressoGrade().filter(l => l.stage === ano).map((livro, idx) => {
              const isLido = livro.statusUser === 'lido';
              const isLendo = livro.statusUser === 'lendo';
              return (
                <div key={idx} style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', padding: '1rem', borderRadius: '12px', border: `1px solid ${isLido ? '#4caf50' : (isLendo ? '#FFD700' : (isDark ? '#333' : '#eee'))}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: '1rem' }}>{livro.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: isDark ? '#888' : '#666' }}>{livro.author}</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {isLido ? (
                      <span style={{ color: '#4caf50', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={14}/> Lido</span>
                    ) : (
                      <>
                        <button onClick={() => {setNewBook({title: livro.title, author: livro.author}); setShowAddBook(true); window.scrollTo(0,0);}} style={{ flex: 1, padding: '0.4rem', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Ler</button>
                        <button onClick={() => handleJaLi(livro)} style={{ flex: 1, padding: '0.4rem', background: 'transparent', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Já Li</button>
                      </>
                    )}
                    <a href={`https://www.amazon.com.br/s?k=${encodeURIComponent(livro.title + ' ' + livro.author)}&tag=filosofiae0a5-20`} target="_blank" rel="noopener noreferrer" style={{ padding: '0.4rem', background: '#FF9900', color: '#000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Comprar"><ShoppingCart size={14} /></a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}