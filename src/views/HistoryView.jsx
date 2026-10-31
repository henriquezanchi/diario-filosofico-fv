import React from 'react';
import { Award, BookOpen, Calendar, CheckCircle, ChevronDown, ChevronUp, Download, Edit, FileText, Search, Star, Upload, X, XCircle } from 'lucide-react';

// Histórico de entradas do diário, por ano e mês.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function HistoryView({ deleteEntry, entries, expandedEntryId, expandedMonths, expandedYears, exportFvReportTXT, exportToCSV, filteredEntries, fvUnlocked, handleDateChange, importDiary, isDark, searchTerm, setExpandedEntryId, setExpandedMonths, setExpandedYears, setSearchTerm, setView }) {
  return (
    <div className="animate-fadeIn">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.5rem', color: 'var(--t-accent)', margin: 0 }}>Histórico de Reflexões</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button onClick={exportToCSV} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? 'var(--t-accent)' : 'var(--border-light)', color: 'white', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} /> Exportar CSV
                </button>
                {/* NOVO: BOTÃO DO RELATÓRIO TXT FV */}
                {fvUnlocked && (
                  <button onClick={exportFvReportTXT} disabled={entries.length === 0} style={{ padding: '0.75rem 1.5rem', background: entries.length > 0 ? 'linear-gradient(135deg, var(--gold-bright) 0%, #FFA500 100%)' : 'var(--border-light)', color: 'var(--black)', border: 'none', borderRadius: '8px', cursor: entries.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: entries.length > 0 ? '0 4px 12px rgba(255,215,0,0.2)' : 'none' }}>
                    <FileText size={18} /> Histórico da Carta (TXT)
                  </button>
                )}
                <label style={{ padding: '0.75rem 1.5rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Upload size={18} /> Importar
                  <input type="file" accept=".csv,.json,.txt" onChange={importDiary} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <Search size={20} color={'var(--t-accent)'} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Buscar nas reflexões..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 3rem', border: `2px solid ${isDark ? 'rgba(212, 175, 55, 0.5)' : 'var(--umber)'}`, borderRadius: '8px', fontSize: '1rem', fontFamily: 'Georgia, serif', background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
            </div>

            {filteredEntries.length === 0 ? (
              <div className="animate-fadeIn" style={{ padding: '3rem 1.5rem', textAlign: 'center', background: 'var(--t-surface-soft)', borderRadius: '16px', border: `2px solid var(--t-divider-strong)` }}>
                <Calendar size={48} color={'var(--t-accent)'} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                <p style={{ color: 'var(--t-text)', fontFamily: "'Cinzel', serif", fontSize: '1.1rem' }}>{searchTerm ? 'Nada encontrado com esse termo' : 'Seu histórico começa com o dia de hoje.'}</p>
                {!searchTerm && <p style={{ color: 'var(--t-text-muted)', fontSize: '0.9rem', marginTop: '0.4rem' }}>Volte ao Prólogo e escreva sua primeira reflexão.</p>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  // Variáveis para saber o que abrir por padrão
                  const todayObj = new Date();
                  const currentYearStr = todayObj.getFullYear().toString();
                  const currentMonthStr = todayObj.toLocaleDateString('pt-BR', { month: 'long' });
                  const currentMonthKey = `${currentMonthStr.charAt(0).toUpperCase() + currentMonthStr.slice(1)} ${currentYearStr}`;

                  // 1. Agrupa as entradas por Ano -> Mês preservando a ordem cronológica
                  const groupedEntries = [];
                  filteredEntries.forEach(entry => {
                    const dateObj = new Date(entry.date + 'T12:00:00');
                    const year = dateObj.getFullYear().toString();
                    const monthStr = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
                    const month = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
                    const monthKey = `${month} ${year}`;
                    
                    let yearGroup = groupedEntries.find(g => g.year === year);
                    if (!yearGroup) {
                        yearGroup = { year, total: 0, months: [] };
                        groupedEntries.push(yearGroup);
                    }
                    yearGroup.total++;
                    
                    let monthGroup = yearGroup.months.find(m => m.monthKey === monthKey);
                    if (!monthGroup) {
                        monthGroup = { month, monthKey, entries: [] };
                        yearGroup.months.push(monthGroup);
                    }
                    monthGroup.entries.push(entry);
                  });

                  // 2. Renderiza Anos > Meses > Entradas
                  return groupedEntries.map((yearGroup) => {
                    // Lógica Mágica: O ano atual fica aberto por padrão. Os antigos fechados.
                    const isYearExpanded = expandedYears[yearGroup.year] !== undefined ? expandedYears[yearGroup.year] : (yearGroup.year === currentYearStr);

                    return (
                      <div key={yearGroup.year} style={{ background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(240, 230, 210, 0.4)', borderRadius: '16px', border: `1px solid var(--t-divider)`, overflow: 'hidden' }}>
                        
                        {/* CABEÇALHO DO ANO */}
                        <div 
                          onClick={() => setExpandedYears(prev => ({ ...prev, [yearGroup.year]: !isYearExpanded }))}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(139, 115, 85, 0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <h2 style={{ margin: 0, color: isDark ? 'var(--gold-bright)' : 'var(--umber)', fontFamily: "'Cinzel', serif", fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Calendar size={24} /> {yearGroup.year}
                            <span style={{ fontSize: '0.9rem', opacity: 0.8, background: 'var(--t-divider)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontFamily: 'Georgia, serif' }}>
                              {yearGroup.total} {yearGroup.total === 1 ? 'dia' : 'dias'}
                            </span>
                          </h2>
                          {isYearExpanded ? <ChevronUp size={28} color={isDark ? 'var(--gold-bright)' : 'var(--umber)'} /> : <ChevronDown size={28} color={isDark ? 'var(--gold-bright)' : 'var(--umber)'} />}
                        </div>

                        {/* LISTA DE MESES DENTRO DO ANO */}
                        {isYearExpanded && (
                          <div className="animate-fadeIn" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {yearGroup.months.map((monthGroup) => {
                              // Lógica Mágica: O mês corrente fica aberto por padrão. Os outros fechados.
                              const isMonthExpanded = expandedMonths[monthGroup.monthKey] !== undefined ? expandedMonths[monthGroup.monthKey] : (monthGroup.monthKey === currentMonthKey);

                              return (
                                <div key={monthGroup.monthKey} style={{ marginBottom: '0.5rem' }}>
                                  
                                  {/* CABEÇALHO DO MÊS */}
                                  <div 
                                    onClick={() => setExpandedMonths(prev => ({ ...prev, [monthGroup.monthKey]: !isMonthExpanded }))}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: isDark ? 'rgba(212, 175, 55, 0.05)' : 'white', borderRadius: '12px', cursor: 'pointer', border: `1px solid var(--t-divider-strong)`, transition: 'all 0.2s' }}
                                  >
                                    <h3 style={{ margin: 0, color: 'var(--t-accent)', fontFamily: "'Cinzel', serif", fontSize: '1.3rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <BookOpen size={18} /> {monthGroup.month}
                                      <span style={{ fontSize: '0.85rem', opacity: 0.8, background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(139,115,85,0.1)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontFamily: 'Georgia, serif' }}>
                                        {monthGroup.entries.length} {monthGroup.entries.length === 1 ? 'dia' : 'dias'}
                                      </span>
                                    </h3>
                                    {isMonthExpanded ? <ChevronUp size={20} color={'var(--t-accent)'} /> : <ChevronDown size={20} color={'var(--t-accent)'} />}
                                  </div>

                                  {/* DIAS DENTRO DO MÊS */}
                                  {isMonthExpanded && (
                                    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingLeft: '0.5rem', borderLeft: `2px solid var(--t-divider)` }}>
                                      {monthGroup.entries.map((entry) => {
                                        const isExpanded = expandedEntryId === entry.id;
                                        const isPartial = entry.morningDone && !entry.eveningDone;

                                        return (
                                          <div key={entry.id} style={{ background: isPartial ? (isDark ? 'rgba(40, 25, 10, 0.6)' : '#fffdf5') : 'var(--t-surface-soft)', padding: '1.5rem', borderRadius: '12px', border: `2px solid ${isPartial ? (isDark ? 'var(--orange)' : 'var(--orange-soft)') : 'var(--t-divider-strong)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                                            
                                            {/* CABEÇALHO RESUMIDO E CLICÁVEL */}
                                            <div onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                              <div>
                                                <h3 style={{ margin: 0, color: isPartial ? 'var(--t-orange-text)' : 'var(--t-accent)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </h3>
                                                
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                  {entry.virtue && <span style={{ padding: '0.2rem 0.6rem', background: isDark ? 'rgba(212,175,55,0.2)' : '#fdf5e6', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--t-accent)', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : 'var(--bg-light-alt)'}` }}>Virtude: <strong>{entry.virtue}</strong></span>}

                                                  {!entry.didMorning && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--orange)', border: '1px solid rgba(255,152,0,0.3)' }}>⚠️ Sem Prólogo</span>}
  
                                                  {isPartial && <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,152,0,0.1)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--orange)', border: '1px solid rgba(255,152,0,0.3)' }}>⏳ Epílogo Pendente</span>}
  
                                                  {entry.fvDaily && fvUnlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, var(--gold-bright) 0%, #FFA500 100%)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--black)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(255,215,0,0.2)' }}>
                                                      <Award size={12} /> FV
                                                    </span>
                                                  )}

                                                  {/* NOVO SELO GDVE NO HISTÓRICO */}
                                                  {entry.fvDaily && entry.fvDaily.gdveAttendance && fvUnlocked && (
                                                    <span style={{ padding: '0.2rem 0.6rem', background: 'linear-gradient(135deg, #9B59B6 0%, var(--purple) 100%)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--white)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 4px rgba(155,89,182,0.3)' }}>
                                                      <Star size={12} /> GDVE
                                                    </span>
                                                  )}
                                                </div>

                                              </div>
                                              
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleDateChange(entry.date); setView('today'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '0.5rem', background: 'transparent', color: 'var(--t-accent)', border: `2px solid var(--t-accent)`, borderRadius: '8px', cursor: 'pointer' }} title="Preencher ou Editar este dia"><Edit size={16} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); deleteEntry(entry.date); }} style={{ padding: '0.5rem', background: 'transparent', color: 'var(--danger)', border: '2px solid var(--danger)', borderRadius: '8px', cursor: 'pointer' }} title="Excluir"><X size={16} /></button>
                                                {isExpanded ? <ChevronUp size={24} color={'var(--t-accent)'} /> : <ChevronDown size={24} color={'var(--t-accent)'} />}
                                              </div>
                                            </div>

                                            {/* CONTEÚDO EXPANDIDO */}
                                            {isExpanded && (
                                              <div className="animate-fadeIn" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid var(--t-divider)` }}>
                                                
                                                {entry.intention && (
                                                  <div style={{ marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-text)', fontSize: '1rem' }}>Compromisso:</h4>
                                                    <p style={{ margin: 0, color: 'var(--t-text-tan)', lineHeight: '1.6' }}>{entry.intention}</p>
                                                  </div>
                                                )}

                                                {entry.tasksSnapshot && entry.tasksSnapshot.length > 0 && (
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    {entry.tasksSnapshot.filter(t => t.completed).length > 0 && (
                                                      <div style={{ padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.05)' : '#f8fff8', borderRadius: '8px', borderLeft: `4px solid ${isDark ? 'var(--success)' : 'var(--success-soft)'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-success-text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle size={16} /> Práticas Realizadas:</h4>
                                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? 'var(--tan-soft)' : 'var(--success-strong)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                          {entry.tasksSnapshot.filter(t => t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                                                        </ul>
                                                      </div>
                                                    )}
                                                    {entry.tasksSnapshot.filter(t => !t.completed).length > 0 && (
                                                      <div style={{ padding: '1rem', background: isDark ? 'rgba(244, 67, 54, 0.05)' : '#fff5f5', borderRadius: '8px', borderLeft: `4px solid ${isDark ? '#f44336' : '#e53935'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: isDark ? '#e57373' : '#c62828', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><XCircle size={16} /> Práticas Não Realizadas:</h4>
                                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: isDark ? 'var(--gold-muted)' : '#c62828', fontSize: '0.95rem', lineHeight: '1.6', textDecoration: 'line-through', opacity: 0.8 }}>
                                                          {entry.tasksSnapshot.filter(t => !t.completed).map((task, idx) => <li key={idx}>{task.name}</li>)}
                                                        </ul>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}

                                                {entry.fvDaily && entry.fvDaily.praticas && (fvUnlocked || entry.fvDaily.praticas.tratack) && (
                                                  <div style={{ padding: '1rem', background: isDark ? 'rgba(255, 215, 0, 0.05)' : '#fffbf0', borderRadius: '8px', borderLeft: `4px solid var(--t-accent-bright)`, marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-accent-bright)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      <Award size={16} /> {fvUnlocked ? 'Práticas FV Realizadas:' : 'Práticas Extras Realizadas:'}
                                                    </h4>
                                                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--t-text-tan)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                                      {(() => {
                                                        const praticasFeitas = Object.entries(entry.fvDaily.praticas).filter(([_, feito]) => feito).map(([key]) => key);
                                                        const listaPermitida = fvUnlocked ? praticasFeitas : praticasFeitas.filter(k => k === 'tratack');

                                                        if (listaPermitida.length === 0) return fvUnlocked ? <li style={{ fontStyle: 'italic', opacity: 0.7, listStyle: 'none', marginLeft: '-1.2rem' }}>Apenas os registros escritos foram salvos.</li> : null;

                                                        const dicionarioGeral = { tratack: 'Tratak', recitarHonra: 'Recitar Código de Dignidade', recitar7Fases: 'Recitar 7 Fases da ED', camara: 'Câmara de Purificação' };
                                                        const dicionarioTemplo = { porta: 'Porta', patioAberto: 'Pátio Aberto', patioColunas: 'Pátio de Colunas', santuario: 'Santuário' };
                                                        const listaGeral = listaPermitida.filter(key => dicionarioGeral[key]);
                                                        const listaTemplo = ['porta', 'patioAberto', 'patioColunas', 'santuario'].filter(key => listaPermitida.includes(key));

                                                        return (
                                                          <>
                                                            {listaGeral.map(key => <li key={key}><strong>{dicionarioGeral[key]}</strong></li>)}
                                                            {listaTemplo.length > 0 && (<li key="templo-grupo"><strong>Templo: {listaTemplo.map(k => dicionarioTemplo[k]).join(', ')}</strong></li>)}
                                                          </>
                                                        );
                                                      })()}
                                                    </ul>
                                                  </div>
                                                )}   

                                                {entry.eveningDone && (
                                                  <>
                                                    {entry.whereIFailed && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-text)', fontSize: '1rem' }}>Em que falhei:</h4>
                                                        <p style={{ margin: 0, color: 'var(--t-text-tan)', lineHeight: '1.6' }}>{entry.whereIFailed}</p>
                                                      </div>
                                                    )}
                                                    {entry.whatIDidWell && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-text)', fontSize: '1rem' }}>O que fiz bem:</h4>
                                                        <p style={{ margin: 0, color: 'var(--t-text-tan)', lineHeight: '1.6' }}>{entry.whatIDidWell}</p>
                                                      </div>
                                                    )}
                                                    {entry.whatILeftUndone && (
                                                      <div style={{ marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-text)', fontSize: '1rem' }}>O que deixei de fazer:</h4>
                                                        <p style={{ margin: 0, color: 'var(--t-text-tan)', lineHeight: '1.6' }}>{entry.whatILeftUndone}</p>
                                                      </div>
                                                    )}
                                                    {entry.freeEpilogue && (
                                                      <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: `1px dashed ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(139, 115, 85, 0.3)'}` }}>
                                                        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--t-text)', fontSize: '1rem' }}>Reflexão Livre:</h4>
                                                        <p style={{ margin: 0, color: 'var(--t-text-tan)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{entry.freeEpilogue}</p>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            )}
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
                  });
                })()}
              </div>
            )}
          </div>
  );
}
