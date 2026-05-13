import React, { useState } from 'react';
import { Award, BookOpen, CheckCircle, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { GRADE_CURRICULAR } from '../constants/data';

// Agrupa os livros da grade por stage (ex: "1º Ano", "2º Ano", "3º Ano")
const agruparPorAno = (lista) => {
  return lista.reduce((acc, livro) => {
    const ano = livro.stage || 'Outros';
    if (!acc[ano]) acc[ano] = [];
    acc[ano].push(livro);
    return acc;
  }, {});
};

const TrilhaFormacao = ({ books, isDark, setNewBook, setShowAddBook, saveBooksToDb, user, db, doc, setDoc }) => {
  const [isOpen, setIsOpen] = useState(false);

  const gruposPorAno = agruparPorAno(GRADE_CURRICULAR);

  // Verifica se o livro já está na estante do usuário (por título)
  const encontrarNaEstante = (titulo) =>
    books.find((b) => b.title.toLowerCase().includes(titulo.toLowerCase()));

  // Ação: Adicionar como "já lido" direto no array e salvar no Firebase
  const handleJaLi = (livroCanon) => {
    const jaExiste = encontrarNaEstante(livroCanon.title);
    if (jaExiste) return; // Proteção extra, mas o botão já fica oculto

    const novoLivro = {
      id: `book_${Date.now()}`,
      title: livroCanon.title,
      author: livroCanon.author,
      currentPage: 0,
      totalPages: 0,
      status: 'lido',
      finishedDate: new Date().toISOString(),
      thumbnail: '',
      category: 'Filosofia',
      isPendingEnrichment: true,
    };

    saveBooksToDb([novoLivro, ...books]);
  };

  // Ação: Preenche o formulário para iniciar a leitura
  const handleLer = (livroCanon) => {
    setNewBook({
      title: livroCanon.title,
      author: livroCanon.author,
      status: 'lendo',
      currentPage: 0,
      totalPages: 0,
    });
    setShowAddBook(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Ação: Abre a busca na Amazon com link de afiliado
  const handleComprar = (livroCanon) => {
    const query = encodeURIComponent(`${livroCanon.title} ${livroCanon.author}`);
    window.open(
      `https://www.amazon.com.br/s?k=${query}&tag=filosofiae0a5-20`,
      '_blank',
      'noopener noreferrer'
    );
  };

  const cardStyle = (statusUser) => {
    if (statusUser === 'lido') {
      return {
        border: '1px solid #4caf50',
        background: isDark ? 'rgba(76, 175, 80, 0.07)' : '#f0fdf4',
      };
    }
    if (statusUser === 'lendo') {
      return {
        border: `1px solid ${isDark ? '#d4af37' : '#996515'}`,
        background: isDark ? 'rgba(212, 175, 55, 0.07)' : '#fffbf0',
      };
    }
    return {
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255,255,255,0.7)',
    };
  };

  return (
    <div
      style={{
        background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'white',
        borderRadius: '16px',
        border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.2)'}`,
        overflow: 'hidden',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* CABEÇALHO CLICÁVEL (ABRE/FECHA A GAVETA) */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          cursor: 'pointer',
          userSelect: 'none',
          background: isDark
            ? 'rgba(212, 175, 55, 0.06)'
            : 'rgba(139, 115, 85, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Award size={22} color={isDark ? '#FFD700' : '#996515'} />
          <h3
            style={{
              margin: 0,
              fontFamily: "'Cinzel', serif",
              fontSize: '1.15rem',
              color: isDark ? '#FFD700' : '#996515',
            }}
          >
            Trilha de Formação
          </h3>
          <span
            style={{
              fontSize: '0.75rem',
              color: isDark ? '#b8a88a' : '#888',
              fontStyle: 'italic',
            }}
          >
            — Obras Obrigatórias
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={20} color={isDark ? '#d4af37' : '#996515'} />
        ) : (
          <ChevronDown size={20} color={isDark ? '#d4af37' : '#996515'} />
        )}
      </div>

      {/* CONTEÚDO DA GAVETA */}
      {isOpen && (
        <div
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}
        >
          {Object.entries(gruposPorAno).map(([ano, livros]) => (
            <div key={ano}>
              {/* TÍTULO DO ANO */}
              <p
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontWeight: 'bold',
                  color: isDark ? '#b8a88a' : '#888',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                  paddingBottom: '0.5rem',
                }}
              >
                {ano}
              </p>

              {/* LISTA DE LIVROS DO ANO */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '1rem',
                }}
              >
                {livros.map((livroCanon, idx) => {
                  const livroNaEstante = encontrarNaEstante(livroCanon.title);
                  const statusUser = livroNaEstante
                    ? livroNaEstante.finishedDate
                      ? 'lido'
                      : livroNaEstante.status || 'lendo'
                    : 'pendente';

                  const isLido = statusUser === 'lido';
                  const isLendo = statusUser === 'lendo';
                  const jaTemNaEstante = !!livroNaEstante;

                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: '12px',
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        position: 'relative',
                        transition: 'box-shadow 0.2s',
                        ...cardStyle(statusUser),
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontFamily: "'Cinzel', serif",
                          fontSize: '0.95rem',
                          lineHeight: '1.3',
                          color: isLido
                            ? '#4caf50'
                            : isDark
                            ? '#f0e6d2'
                            : '#2c1810',
                        }}
                      >
                        {livroCanon.title}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          fontStyle: 'italic',
                          color: isDark ? '#b8a88a' : '#6b5744',
                        }}
                      >
                        {livroCanon.author}
                      </p>

                      <div style={{ marginTop: '0.5rem' }}>
                        {/* SE JÁ ESTIVER NA ESTANTE: MOSTRA SÓ O STATUS */}
                        {jaTemNaEstante ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              fontSize: '0.82rem',
                              fontWeight: 'bold',
                              color: isLido ? '#4caf50' : isDark ? '#d4af37' : '#996515',
                            }}
                          >
                            {isLido ? (
                              <>
                                <CheckCircle size={14} /> Concluído
                              </>
                            ) : (
                              <>
                                <BookOpen size={14} /> Lendo agora
                              </>
                            )}
                          </div>
                        ) : (
                          /* SE NÃO ESTIVER NA ESTANTE: MOSTRA OS 3 BOTÕES */
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {/* BOTÃO LER */}
                            <button
                              onClick={() => handleLer(livroCanon)}
                              title="Iniciar leitura"
                              style={{
                                flex: 1,
                                minWidth: '70px',
                                padding: '0.45rem 0.5rem',
                                background: 'transparent',
                                color: isDark ? '#d4af37' : '#996515',
                                border: `1px solid ${isDark ? 'rgba(212,175,55,0.5)' : 'rgba(139,115,85,0.5)'}`,
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <BookOpen size={12} /> Ler
                            </button>

                            {/* BOTÃO JÁ LI */}
                            <button
                              onClick={() => handleJaLi(livroCanon)}
                              title="Marcar como já lido"
                              style={{
                                flex: 1,
                                minWidth: '70px',
                                padding: '0.45rem 0.5rem',
                                background: 'transparent',
                                color: '#4caf50',
                                border: '1px solid rgba(76,175,80,0.5)',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <CheckCircle size={12} /> Já Li
                            </button>

                            {/* BOTÃO COMPRAR */}
                            <button
                              onClick={() => handleComprar(livroCanon)}
                              title="Comprar na Amazon"
                              style={{
                                flex: 1,
                                minWidth: '70px',
                                padding: '0.45rem 0.5rem',
                                background: 'transparent',
                                color: '#FF9900',
                                border: '1px solid rgba(255,153,0,0.5)',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <ShoppingCart size={12} /> Comprar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrilhaFormacao;