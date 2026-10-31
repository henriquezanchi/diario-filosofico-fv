import React from 'react';
import DeferredField from '../components/DeferredField';
import { AlertCircle, Award, BookOpen, Bookmark, Camera, ChevronDown, ChevronUp, Edit, FileText, Plus, Save, Search, Sparkles, Star, Trash2, X } from 'lucide-react';
import TrilhaFormacao from '../TrilhaFormacao';
import { getReadingRank } from '../constants/ranks';

// Tela de Leituras e Estudos: estante, busca de livros e fichamentos.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function LeiturasView({ bookSearchQuery, bookSearchResults, books, dailyStudyTip, editingBookId, expandedNotesId, favoriteTheme, finishedBooksCount, isDark, isMobile, isSearchingBooks, newBook, saveBooksToDb, searchBooks, selectedForDeletion, setBarcodeScanError, setBookSearchQuery, setBookSearchResults, setBooks, setEditingBookId, setExpandedNotesId, setNewBook, setSelectedForDeletion, setShelfSearchTerm, setShowAddBook, setShowBarcodeScanner, setShowReadBooks, shelfSearchTerm, showAddBook, showConfirm, showPrompt, showReadBooks, showToast, totalForgedPages }) {
  return (
    <div className="animate-fadeIn">
            
            {/* DICA DINÂMICA DE LEITURA (EPL2R) */}
            {dailyStudyTip && (
              <div style={{ padding: '1.5rem 2rem', background: isDark ? 'rgba(52, 152, 219, 0.05)' : '#f0f7ff', borderRadius: '12px', borderLeft: `4px solid ${isDark ? '#3498db' : 'var(--blue)'}`, marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ background: isDark ? 'rgba(52, 152, 219, 0.1)' : '#e0f0ff', padding: '1rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={28} color={isDark ? '#3498db' : 'var(--blue)'} />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', color: isDark ? '#3498db' : 'var(--blue)', display: 'block', marginBottom: '0.4rem' }}>
                    Técnica Recomendada: {dailyStudyTip.phase}
                  </span>
                  <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--t-text)', lineHeight: '1.6', fontStyle: 'italic' }}>
                    "{dailyStudyTip.text}"
                  </p>
                </div>
              </div>
            )}

            {/* BARRA DE FERRAMENTAS: NOVO LIVRO */}
            <div style={{ background: 'var(--t-surface-soft)', padding: '2rem', borderRadius: '16px', border: `2px solid var(--t-divider-strong)`, marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative', flexWrap: 'wrap' }}>
                <button onClick={() => setShowAddBook(true)} style={{ background: 'var(--t-accent-bright)', color: isDark ? 'var(--black)' : 'var(--white)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={16} /> Adicionar Novo Livro
                </button>
                <button onClick={() => { setBarcodeScanError(''); setShowBarcodeScanner(true); }} style={{ background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={16} /> Escanear Código de Barras
                </button>
              </div>
            </div>

            {/* DASHBOARD DE GRAU DO LEITOR */}
            {(() => {
              const rank = getReadingRank(totalForgedPages);
              const progressToNext = rank.next ? Math.min(100, Math.round((totalForgedPages / rank.next) * 100)) : 100;
              return (
                <div className="animate-fadeIn" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div style={{ background: isDark ? 'rgba(0,0,0,0.3)' : '#fcfcfc', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-soft)'}`, display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: `3px solid ${rank.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : 'white', boxShadow: `0 0 15px ${rank.color}40` }}>
                      <Award size={36} color={rank.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--t-text-faint)', fontWeight: 'bold' }}>Seu Grau na Escola</span>
                      <h3 style={{ margin: '0.2rem 0 0.5rem 0', fontFamily: "'Cinzel', serif", fontSize: '1.4rem', color: rank.color }}>{rank.title}</h3>
                      {rank.next ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--t-text)', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                            <span>Páginas Forjadas: {totalForgedPages}</span><span>Rumo a {rank.next}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressToNext}%`, height: '100%', background: rank.color, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: rank.color, fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.5rem' }}>Você alcançou o cume.</div>
                      )}
                    </div>
                  </div>
                  
                  {/* MÉTRICAS DETALHADAS */}
                  <div style={{ background: isDark ? 'rgba(212,175,55,0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid var(--t-divider)`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', borderRight: `1px solid var(--t-divider)`, borderBottom: `1px solid var(--t-divider)`, paddingBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: 'var(--t-accent-bright)' }}>{books.length}</div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--t-text-muted)', fontWeight: 'bold' }}>Na Estante</div>
                    </div>
                    <div style={{ textAlign: 'center', borderBottom: `1px solid var(--t-divider)`, paddingBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: 'var(--success)' }}>{finishedBooksCount}</div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--t-text-muted)', fontWeight: 'bold' }}>Concluídos</div>
                    </div>
                    <div style={{ textAlign: 'center', borderRight: `1px solid var(--t-divider)`, paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--t-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 0.5rem' }}>{favoriteTheme}</div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--t-text-muted)', fontWeight: 'bold', marginTop: '0.2rem' }}>Tema Frequente</div>
                    </div>
                    <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--t-text)' }}>{books.length > 0 ? Math.round((finishedBooksCount / books.length) * 100) : 0}%</div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--t-text-muted)', fontWeight: 'bold', marginTop: '0.2rem' }}>Taxa de Conclusão</div>
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* FORMULÁRIO DE LIVRO (OCULTO POR PADRÃO) */}
            {showAddBook && (
              <div style={{ padding: '1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255, 245, 220, 0.3)', borderRadius: '12px', marginBottom: '2.5rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--t-accent)', fontFamily: "'Cinzel', serif" }}>{editingBookId ? 'Editar Livro' : 'Adicionar à Estante'}</h3>
                  <button onClick={() => { setShowAddBook(false); setBookSearchResults([]); setBookSearchQuery(''); }} style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>
                
                {/* BARRA DE PESQUISA GOOGLE */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" value={bookSearchQuery} onChange={(e) => setBookSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchBooks(bookSearchQuery)} placeholder="Pesquise por título ou autor na base do Google..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `2px solid var(--t-accent)`, background: isDark ? 'rgba(0,0,0,0.2)' : 'white', color: 'var(--t-text)' }} />
                    <button onClick={() => searchBooks(bookSearchQuery)} style={{ padding: '0 1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                      {isSearchingBooks ? <Sparkles className="animate-spin" size={18}/> : <Search size={18}/>}
                    </button>
                  </div>

                  {bookSearchResults.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--t-field-bg)', borderRadius: '8px', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {bookSearchResults.map(res => (
                        <div key={res.id} onClick={() => {
                            if (editingBookId) {
                              const updated = books.map(b => { if (b.id === editingBookId) { return { ...b, title: res.title, author: res.author, totalPages: res.totalPages, thumbnail: res.thumbnail, category: res.category, isPendingEnrichment: false }; } return b; });
                              saveBooksToDb(updated); setShowAddBook(false); setBookSearchResults([]); setEditingBookId(null);
                            } else {
                              setNewBook({ title: res.title, author: res.author, currentPage: 0, totalPages: res.totalPages, thumbnail: res.thumbnail, category: res.category }); setBookSearchResults([]);
                            }
                          }}
                          style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '6px', borderBottom: isDark ? '1px solid #333' : '1px solid var(--border-soft)' }}
                        >
                          <img src={res.thumbnail || 'https://via.placeholder.com/40x60?text=No+Cover'} alt="Capa" style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--t-text)' }}>{res.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{res.author}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* FORMULÁRIO MANUAL */}
                {bookSearchResults.length === 0 && !isSearchingBooks && (
                  <>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray)', marginBottom: '0.2rem' }}>Título</label>
                        <input type="text" value={newBook.title} onChange={(e) => setNewBook({...newBook, title: e.target.value})} placeholder="Título..." style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray)', marginBottom: '0.2rem' }}>Autor</label>
                        <input type="text" value={newBook.author} onChange={(e) => setNewBook({...newBook, author: e.target.value})} placeholder="Autor..." style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Pág. Atual</label>
                        <input type="number" value={newBook.currentPage} onChange={(e) => setNewBook({...newBook, currentPage: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Total Págs</label>
                        <input type="number" value={newBook.totalPages} onChange={(e) => setNewBook({...newBook, totalPages: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>Link do PDF</label>
                        <input type="text" value={newBook.link || ''} onChange={(e) => setNewBook({...newBook, link: e.target.value})} placeholder="https://..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                      </div>
                    </div>
                  </>
                )}
                
                <button 
                  onClick={() => {
                    if(!newBook.title) return showToast('Dê um título ao livro.');
                    let updated;
                    if (editingBookId) {
                      updated = books.map(b => b.id === editingBookId ? { ...b, ...newBook } : b);
                    } else {
                      updated = [{ id: `book_${Date.now()}`, ...newBook, status: 'lendo', finishedDate: null }, ...books];
                    }
                    saveBooksToDb(updated);
                    setShowAddBook(false); setBookSearchQuery(''); setNewBook({ title: '', author: '', currentPage: 0, totalPages: 0 }); setEditingBookId(null);
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  <Save size={18} style={{ marginRight: '0.5rem' }}/> {editingBookId ? 'Salvar Alterações' : 'Guardar na Estante'}
                </button>
              </div>
            )}

            {/* A GRANDE ESTANTE DE LIVROS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(() => {
                const filteredBooks = books.filter(b => b.title.toLowerCase().includes(shelfSearchTerm.toLowerCase()) || b.author.toLowerCase().includes(shelfSearchTerm.toLowerCase()));
                const attentionBooks = filteredBooks.filter(b => !b.isPendingEnrichment && b.totalPages === 0);
                const readBooks = filteredBooks.filter(b => b.status === 'lido' || b.finishedDate || (b.totalPages > 0 && b.currentPage >= b.totalPages));
                const ownedBooks = filteredBooks.filter(b => b.status === 'juro' && !attentionBooks.includes(b) && !readBooks.includes(b));
                const wishBooks = filteredBooks.filter(b => b.status === 'desejo' && !attentionBooks.includes(b) && !readBooks.includes(b));
                const readingBooks = filteredBooks.filter(b => !attentionBooks.includes(b) && !readBooks.includes(b) && !ownedBooks.includes(b) && !wishBooks.includes(b));

                const toggleDeleteSelection = (id) => {
                  if (selectedForDeletion.includes(id)) setSelectedForDeletion(prev => prev.filter(item => item !== id));
                  else setSelectedForDeletion(prev => [...prev, id]);
                };

                const renderBookCard = (book, isWarning) => {
                  const progress = book.totalPages > 0 ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)) : 0;
                  const isFinished = !!book.finishedDate || (progress >= 100 && book.totalPages > 0);
                  const isPending = book.isPendingEnrichment;

                  return (
                    <div key={book.id} style={{ background: isFinished ? (isDark ? 'rgba(76, 175, 80, 0.05)' : '#f0fdf4') : (isWarning ? (isDark ? 'rgba(231,76,60,0.05)' : '#fff5f5') : (isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)')), border: `1px solid ${isWarning ? 'var(--danger)' : (isFinished ? 'var(--success)' : 'var(--t-divider-strong)')}`, borderRadius: '12px', padding: '1.2rem', position: 'relative', overflow: 'hidden', display: 'flex', gap: '1rem' }}>
                      {isWarning && <input type="checkbox" checked={selectedForDeletion.includes(book.id)} onChange={() => toggleDeleteSelection(book.id)} style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 5, width: '20px', height: '20px', cursor: 'pointer' }} />}
                      
                      <div style={{ flexShrink: 0, width: '80px', height: '120px', background: '#333', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', position: 'relative' }}>
                        <img src={book.thumbnail || 'https://placehold.co/80x120/1a1a2e/d4af37?text=Sem+Capa'} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {isPending && <div className="animate-fadeIn" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: 'var(--gold-bright)', fontSize: '0.65rem', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>Buscando...</div>}
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ margin: 0, color: 'var(--t-text)', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", lineHeight: '1.2' }}>{book.title}</h3>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button onClick={() => { setEditingBookId(book.id); setNewBook(book); setShowAddBook(true); window.scrollTo(0,0); }} style={{ background: 'transparent', border: 'none', color: 'var(--t-accent)', cursor: 'pointer' }}><Edit size={14} /></button>
                            <button onClick={() => showConfirm('Remover da estante?', () => saveBooksToDb(books.filter(b => b.id !== book.id)), { danger: true })} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <p style={{ margin: '0.2rem 0 0.5rem 0', color: 'var(--t-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>{book.author}</p>
                        {book.category && <span style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '2px 6px', background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: '4px', color: 'var(--t-accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>{book.category}</span>}

                        {isWarning ? (
                           <div style={{ marginTop: 'auto', padding: '0.6rem', background: 'var(--danger)', color: 'white', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 5px rgba(231, 76, 60, 0.3)' }} onClick={() => { setEditingBookId(book.id); setNewBook(book); setShowAddBook(true); window.scrollTo(0,0); }}>
                             <Search size={14} /> Completar Dados
                           </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--t-text-muted)', marginBottom: '0.3rem' }}>
                              <span>{isPending ? 'Analisando os astros...' : `${progress}% concluído`}</span>
                              {isFinished && <span style={{ color: 'var(--success)' }}>Lido</span>}
                            </div>
                            <div style={{ width: '100%', height: '6px', background: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-soft)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: isFinished ? 'var(--success)' : 'var(--t-accent)', transition: 'width 0.8s ease' }}></div>
                            </div>
                            {!isFinished && (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button onClick={() => {
                                  showPrompt(`Em qual página você parou? (Total: ${book.totalPages})`, (inputPagina) => {
                                    if (inputPagina && !isNaN(inputPagina)) {
                                      const novaPag = Math.min(book.totalPages, parseInt(inputPagina));
                                      const acabouAgora = (novaPag >= book.totalPages);
                                      saveBooksToDb(books.map(b => b.id === book.id ? { ...b, currentPage: novaPag, finishedDate: acabouAgora ? new Date().toISOString() : null } : b));
                                    }
                                  }, { defaultValue: book.currentPage, inputType: 'number', submitLabel: 'Atualizar' });
                                }} style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: 'var(--t-accent)', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : 'var(--border-light)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>+ Atualizar</button>
                              </div>
                            )}
                          </>
                        )}
                        
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                          {book.link && <a href={book.link} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.5rem', background: '#3498DB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}><FileText size={12} /> Abrir PDF</a>}
                          <button onClick={(e) => { e.stopPropagation(); setExpandedNotesId(prev => prev === book.id ? null : book.id); }} style={{ flex: 1, padding: '0.5rem', background: expandedNotesId === book.id ? 'var(--t-accent)' : (isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0'), color: expandedNotesId === book.id ? 'var(--t-surface)' : 'var(--t-text)', border: `1px solid ${expandedNotesId === book.id ? 'transparent' : 'var(--t-field-border)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'all 0.2s' }}><Edit size={12} /> {book.notes ? 'Ver Notas' : '+ Notas'}</button>
                        </div>

                        {expandedNotesId === book.id && (
                          <div className="animate-fadeIn" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                            <DeferredField value={book.notes || ''} onCommit={(v) => setBooks(prev => prev.map(b => b.id === book.id ? { ...b, notes: v } : b))} placeholder="Suas reflexões..." rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.4)' : 'var(--border-light)'}`, background: isDark ? 'rgba(0,0,0,0.4)' : 'var(--white)', color: 'var(--t-text)', fontSize: '0.9rem', fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                            <button onClick={(e) => { e.stopPropagation(); saveBooksToDb(books); setExpandedNotesId(null); }} style={{ alignSelf: 'flex-end', padding: '0.5rem 1.5rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={14} /> Salvar Fichamento</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };
                
                return (
                  <>
                    {/* A TRILHA DE FORMAÇÃO VEM AQUI PRIMEIRO, SEMPRE VISÍVEL */}
                  <TrilhaFormacao 
                    books={books} 
                    isDark={isDark} 
                    setNewBook={setNewBook} 
                    setShowAddBook={setShowAddBook} 
                    saveBooksToDb={saveBooksToDb}
                    setBookSearchQuery={setBookSearchQuery}
                    searchBooks={searchBooks}
                  />
                      

                    {/* BARRA DE PESQUISA NA ESTANTE */}
                    {books.length > 0 && (
                      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                        <Search size={18} color={'var(--t-text-muted)'} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                        <input type="text" placeholder="Filtrar livros por título ou autor..." value={shelfSearchTerm} onChange={(e) => setShelfSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.8rem', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'var(--border-light)'}`, borderRadius: '8px', background: isDark ? 'rgba(0,0,0,0.2)' : 'white', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                      </div>
                    )}

                    {books.length === 0 && !showAddBook ? (
                      <div className="animate-fadeIn" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--t-text-muted)' }}>
                        <Bookmark size={48} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                        <p style={{ fontSize: '1.15rem', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', marginBottom: '0.4rem' }}>Sua estante está vazia — por enquanto.</p>
                        <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>Todo grande leitor começa com um livro só. Qual é o que está na sua mesa de cabeceira agora?</p>
                        <button onClick={() => setShowAddBook(true)} style={{ padding: '0.7rem 1.4rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Georgia, serif' }}>
                          <Plus size={16} /> Adicionar meu primeiro livro
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* 1. SEÇÃO ESTOU LENDO */}
                        {readingBooks.length > 0 && (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-accent-bright)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={18} /> Estante (Lendo Agora)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {readingBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}

                        {/* 2. SEÇÃO PROMESSSAS (JÁ TENHO) */}
                        {ownedBooks.length > 0 && (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-text)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bookmark size={18} /> Minha Biblioteca (Vou Começar)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {ownedBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}
                        
                        {/* 3. SEÇÃO REQUER ATENÇÃO (COM EXCLUSÃO EM LOTE) */}
                        {attentionBooks.length > 0 && (
                          <div style={{ marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid var(--t-divider)`}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                              <h3 style={{ margin: 0, color: 'var(--danger)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={18} /> Requer Atenção (Sem Páginas)</h3>
                              {selectedForDeletion.length > 0 && (
                                <button onClick={() => showConfirm(`Apagar ${selectedForDeletion.length} livros permanentemente?`, () => { saveBooksToDb(books.filter(b => !selectedForDeletion.includes(b.id))); setSelectedForDeletion([]); }, { danger: true })} style={{ background: 'var(--danger)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                                  🗑️ Apagar Selecionados ({selectedForDeletion.length})
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                              {attentionBooks.map(b => renderBookCard(b, true))}
                            </div>
                          </div>
                        )}

                        {/* 4. SEÇÃO LISTA DE DESEJOS */}
                        {wishBooks.length > 0 && (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-text-muted)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={18} /> Lista de Desejos (Quero Comprar)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', opacity: 0.8 }}>
                              {wishBooks.map(b => renderBookCard(b, false))}
                            </div>
                          </div>
                        )}
                        
                        {/* 5. SEÇÃO JÁ LIDOS (GAVETA SANFONA) */}
                        {readBooks.length > 0 && (
                          <div style={{ paddingTop: '1.5rem', borderTop: `1px solid var(--t-divider)`}}>
                            <div onClick={() => setShowReadBooks(!showReadBooks)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.5rem 0' }}>
                              <h3 style={{ margin: 0, color: 'var(--success)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={18} /> Sabedoria Acumulada ({readBooks.length} obras lidas)</h3>
                              {showReadBooks ? <ChevronUp size={20} color="var(--success)" /> : <ChevronDown size={20} color="var(--success)" />}
                            </div>
                            {showReadBooks && (
                              <div className="animate-fadeIn" style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {readBooks.sort((a,b) => new Date(b.finishedDate || 0) - new Date(a.finishedDate || 0)).map(b => renderBookCard(b, false))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
  );
}
