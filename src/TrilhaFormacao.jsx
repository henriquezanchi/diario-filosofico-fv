import React from 'react';
import { Award, CheckCircle, BookOpen, Plus } from 'lucide-react';
import { GRADE_CURRICULAR } from './constants/data';

export default function TrilhaFormacao({ books, isDark, setNewBook, setShowAddBook }) {
  
  // --- MOTOR DA GRADE CURRICULAR ---
  const getProgressoGrade = () => {
    return GRADE_CURRICULAR.map(livroCanon => {
      const livroNaEstante = books.find(b => 
        b.title.toLowerCase().includes(livroCanon.title.toLowerCase())
      );
      return {
        ...livroCanon,
        statusUser: livroNaEstante ? (livroNaEstante.finishedDate ? 'lido' : livroNaEstante.status) : 'pendente',
      };
    });
  };

  return (
    <div className="animate-fadeIn" style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <Award size={28} color={isDark ? '#FFD700' : '#996515'} />
        <h2 style={{ margin: 0, color: isDark ? '#f0e6d2' : '#2c1810', fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontFamily: "'Cinzel', serif" }}>
          A Trilha de Formação
        </h2>
      </div>
      <p style={{ color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.95rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>
        Obras fundamentais da Tradição. Adicione-as à sua estante para forjar os degraus da sua escalada.
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'thin' }}>
        {getProgressoGrade().map((livro, idx) => {
          const isLido = livro.statusUser === 'lido';
          const isLendo = livro.statusUser === 'lendo';
          
          let borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          let bgColor = isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.6)';
          
          if (isLido) {
            borderColor = '#4caf50';
            bgColor = isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4';
          } else if (isLendo) {
            borderColor = isDark ? '#d4af37' : '#996515';
            bgColor = isDark ? 'rgba(212, 175, 55, 0.05)' : '#fffbf0';
          }

          return (
            <div key={idx} style={{ minWidth: '220px', width: '220px', background: bgColor, borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '1.2rem', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              {isLido && <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: 'radial-gradient(circle, rgba(76,175,80,0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>}
              
              <span style={{ fontSize: '0.65rem', color: isDark ? '#b8a88a' : '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem' }}>{livro.stage}</span>
              <h4 style={{ margin: '0 0 0.25rem 0', color: isLido ? '#4caf50' : (isDark ? '#f0e6d2' : '#2c1810'), fontSize: '1.05rem', lineHeight: '1.3', fontFamily: "'Cinzel', serif" }}>{livro.title}</h4>
              <p style={{ margin: '0 0 1rem 0', color: isDark ? '#b8a88a' : '#6b5744', fontSize: '0.85rem', fontStyle: 'italic' }}>{livro.author}</p>
              
              <div style={{ marginTop: 'auto' }}>
                {isLido ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4caf50', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <CheckCircle size={16} /> Concluído
                  </div>
                ) : isLendo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isDark ? '#d4af37' : '#996515', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <BookOpen size={16} /> Lendo agora
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setNewBook({ title: livro.title, author: livro.author, currentPage: 0, totalPages: 0, link: '', notes: '' });
                      setShowAddBook(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ width: '100%', padding: '0.6rem', background: 'transparent', color: isDark ? '#d4af37' : '#6b4423', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(139, 115, 85, 0.4)'}`, borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                  >
                    <Plus size={14} /> Iniciar Leitura
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}