import React from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

// Tela de Estatísticas do diário.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function AnalyticsView({ entries, isDark }) {
  return (
    <div className="animate-fadeIn">
            <div style={{ background: 'var(--t-surface-soft)', padding: '2rem', borderRadius: '16px', border: `2px solid var(--t-divider-strong)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <TrendingUp size={32} color={'var(--t-accent)'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif" }}>Métricas da Alma</h2>
              </div>
              <p style={{ color: 'var(--t-text-muted)', marginBottom: '2rem', fontSize: '1rem' }}>Observe seus padrões de comportamento e a constância do seu autoexame.</p>

              {entries.length === 0 ? (
                <div className="animate-fadeIn" style={{ padding: '3rem 1.5rem', textAlign: 'center', background: isDark ? 'rgba(26, 26, 46, 0.4)' : 'var(--bg-light)', borderRadius: '12px' }}>
                  <TrendingUp size={48} color={'var(--t-accent)'} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                  <p style={{ color: 'var(--t-text)', fontFamily: "'Cinzel', serif", fontSize: '1.15rem', marginBottom: '0.4rem' }}>Suas métricas ainda estão em branco.</p>
                  <p style={{ color: 'var(--t-text-muted)', fontSize: '0.95rem' }}>Cada dia preenchido no diário vira um traço nesse retrato. Volte aqui depois de alguns dias.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                   {(() => {
                      const total = entries.length;
                      const morningCount = entries.filter(e => e.morningDone).length;
                      const eveningCount = entries.filter(e => e.eveningDone).length;

                      // Calcula as Virtudes Mais Invocadas
                      const virtueCounts = {};
                      entries.forEach(e => {
                         if(e.virtue) virtueCounts[e.virtue] = (virtueCounts[e.virtue] || 0) + 1;
                      });
                      const topVirtues = Object.entries(virtueCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

                      // ==========================================
                      // LÓGICA DE COMPARAÇÃO DOS CICLOS (30 DIAS)
                      // ==========================================
                      const hoje = new Date();
                      const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
                      const sessentaDiasAtras = new Date(); sessentaDiasAtras.setDate(hoje.getDate() - 60);

                      const cicloAtual = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= trintaDiasAtras && d <= hoje; });
                      const cicloAnterior = entries.filter(e => { const d = new Date(e.date + 'T12:00:00'); return d >= sessentaDiasAtras && d < trintaDiasAtras; });

                      // CONTAGEM DE PRÁTICAS (Em vez de tarefas)
                      const countPraticas = (ciclo) => ciclo.reduce((acc, curr) => {
                          let count = 0;
                          if (curr.fvDaily?.praticas) {
                              count += Object.values(curr.fvDaily.praticas).filter(v => v === true).length;
                          }
                          return acc + count;
                      }, 0);

                      const preenchimentosAtual = cicloAtual.length;
                      const preenchimentosAnterior = cicloAnterior.length;
                      const varPreenchimentos = preenchimentosAnterior === 0 ? (preenchimentosAtual === 0 ? 0 : 100) : Math.round(((preenchimentosAtual - preenchimentosAnterior) / preenchimentosAnterior) * 100);

                      const praticasAtual = countPraticas(cicloAtual);
                      const praticasAnterior = countPraticas(cicloAnterior);
                      const varPraticas = praticasAnterior === 0 ? (praticasAtual === 0 ? 0 : 100) : Math.round(((praticasAtual - praticasAnterior) / praticasAnterior) * 100);

                      return (
                        <>
                          {/* CARDS DE VISÃO GERAL (NOVO FORMATO DASHBOARD) */}
                          <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.3)'}`, marginBottom: '2rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--t-accent-bright)', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={18} /> Resumo do Ciclo (30 dias)</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                              
                              {/* Card 1: Preenchimentos */}
                              <div style={{ background: 'var(--t-surface-glass)', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'var(--border-light)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Dias Forjados</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--t-accent-bright)', fontFamily: "'Cinzel', serif" }}>{preenchimentosAtual}</span>
                                  <span style={{ fontSize: '1rem', color: isDark ? 'var(--gray)' : '#999' }}>/ 30</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPreenchimentos >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPreenchimentos >= 0 ? 'var(--t-success-text)' : 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {varPreenchimentos >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                  {varPreenchimentos > 0 ? '+' : ''}{varPreenchimentos}%
                                </div>
                              </div>

                              {/* Card 2: Práticas Realizadas */}
                              <div style={{ background: 'var(--t-surface-glass)', padding: '1.5rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'var(--border-light)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>Práticas Realizadas</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--t-accent-bright)', fontFamily: "'Cinzel', serif" }}>{praticasAtual}</span>
                                  <span style={{ fontSize: '1rem', color: isDark ? 'var(--gray)' : '#999' }}>ações</span>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: varPraticas >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: varPraticas >= 0 ? 'var(--t-success-text)' : 'var(--danger)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {varPraticas >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />} 
                                  {varPraticas > 0 ? '+' : ''}{varPraticas}%
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* GRÁFICO DE BARRAS DAS VIRTUDES */}
                          <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'white', padding: '2rem', borderRadius: '12px', border: `1px solid var(--t-divider)` }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--t-text)', fontSize: '1.2rem', fontFamily: "'Cinzel', serif" }}>Virtudes Mais Invocadas</h3>
                            {topVirtues.length > 0 ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                 {topVirtues.map(([vName, vCount]) => {
                                    const percentage = Math.round((vCount / total) * 100);
                                    return (
                                      <div key={vName}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.95rem', color: 'var(--t-text)', fontWeight: 'bold' }}>
                                          <span>{vName}</span>
                                          <span style={{ color: 'var(--t-accent)' }}>{vCount} vezes ({percentage}%)</span>
                                        </div>
                                        <div style={{ width: '100%', height: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                                          <div style={{ width: `${percentage}%`, height: '100%', background: isDark ? 'linear-gradient(90deg, var(--gold-muted) 0%, var(--gold) 100%)' : 'linear-gradient(90deg, var(--umber-soft) 0%, var(--umber) 100%)', borderRadius: '6px', transition: 'width 1s ease-out' }}></div>
                                        </div>
                                      </div>
                                    );
                                 })}
                               </div>
                            ) : (
                               <p style={{ color: 'var(--t-text-muted)', fontStyle: 'italic', fontSize: '0.95rem', margin: 0 }}>Nenhuma virtude registrada nas suas anotações matinais.</p>
                            )}
                          </div>

                        </>
                      );
                   })()}
                </div>
              )}
            </div>
          </div>
  );
}
