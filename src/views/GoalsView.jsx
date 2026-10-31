import React from 'react';
import { Award, Landmark, Plus, Shield, Star, Target, X } from 'lucide-react';

// Tela de Metas de longo prazo (virtudes e projetos).
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function GoalsView({ acceptedMissions, addProjectGoal, addVirtueGoal, isDark, newProjectGoal, newVirtueGoal, projectGoals, removeAcceptedMission, removeGoal, setNewProjectGoal, setNewVirtueGoal, toggleAcceptedMission, toggleGoal, virtueGoals }) {
  return (
    <div className="animate-fadeIn">
            <div style={{ background: 'var(--t-surface-soft)', padding: '2rem', borderRadius: '16px', border: `2px solid var(--t-divider-strong)` }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Target size={32} color={'var(--t-accent)'} />
                <h2 style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif" }}>Horizonte de Vida</h2>
              </div>
              <p style={{ color: 'var(--t-text-muted)', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>O que o homem constrói no mundo reflete o que ele constrói em si mesmo.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                
                {/* BLOCO 1: SONHOS (VIRTUDES) */}
                <div style={{ background: isDark ? 'rgba(212, 175, 55, 0.05)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid var(--t-divider)` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-accent)', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Star size={20} /> Sonhos (Forja Interior)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--t-text-muted)', marginBottom: '1rem' }}>Virtudes e qualidades que deseja conquistar.</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input type="text" value={newVirtueGoal} onChange={(e) => setNewVirtueGoal(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addVirtueGoal() }} placeholder="Ex: Desenvolver mais paciência..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid var(--t-gold-border)`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                    <button onClick={addVirtueGoal} style={{ padding: '0 1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={20} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {virtueGoals.map(goal => (
                      <div key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--t-field-bg)', borderRadius: '8px', border: `1px solid ${goal.completed ? 'var(--success)' : (isDark ? 'rgba(212, 175, 55, 0.2)' : 'var(--border-soft)')}` }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                          <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id, 'virtue')} style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: 'var(--gold)' }} />
                          <span style={{ color: 'var(--t-text)', textDecoration: goal.completed ? 'line-through' : 'none', opacity: goal.completed ? 0.6 : 1, lineHeight: '1.4' }}>{goal.text}</span>
                        </label>
                        <button onClick={() => removeGoal(goal.id, 'virtue')} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BLOCO 2: PROJETOS (AÇÕES NO MUNDO) */}
                <div style={{ background: isDark ? 'rgba(74, 144, 226, 0.05)' : '#f4f8ff', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.2)' : 'rgba(74, 144, 226, 0.2)'}` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-blue-text)', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Landmark size={20} /> Projetos (Obras no Mundo)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--t-text-muted)', marginBottom: '1rem' }}>Conquistas práticas, estudos, viagens, etc.</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <input type="text" value={newProjectGoal} onChange={(e) => setNewProjectGoal(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addProjectGoal() }} placeholder="Ex: Terminar a leitura do Bastião X..." style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.4)' : 'var(--border-light)'}`, background: 'var(--t-surface-glass)', color: 'var(--t-text)' }} />
                    <button onClick={addProjectGoal} style={{ padding: '0 1rem', background: 'var(--t-blue-text)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={20} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {projectGoals.map(goal => (
                      <div key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--t-field-bg)', borderRadius: '8px', border: `1px solid ${goal.completed ? 'var(--success)' : (isDark ? 'rgba(74, 144, 226, 0.2)' : 'var(--border-soft)')}` }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', flex: 1 }}>
                          <input type="checkbox" checked={goal.completed} onChange={() => toggleGoal(goal.id, 'project')} style={{ width: '18px', height: '18px', marginTop: '0.2rem', accentColor: 'var(--t-blue-text)' }} />
                          <span style={{ color: 'var(--t-text)', textDecoration: goal.completed ? 'line-through' : 'none', opacity: goal.completed ? 0.6 : 1, lineHeight: '1.4' }}>{goal.text}</span>
                        </label>
                        <button onClick={() => removeGoal(goal.id, 'project')} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* BLOCO 3: MISSÕES DE CICLO ATIVAS */}
              {acceptedMissions.length > 0 && (
                <div className="animate-fadeIn" style={{ marginTop: '2rem', padding: '1.5rem', background: isDark ? 'rgba(155, 89, 182, 0.05)' : '#fdf8ff', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : 'rgba(155, 89, 182, 0.3)'}` }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'var(--t-purple-text)', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={20} /> Missões em Andamento</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--t-text-muted)', marginBottom: '1.5rem' }}>Desafios práticos assumidos para forjar a vontade.</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {acceptedMissions.map(missao => (
                      <div key={missao.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1rem', background: missao.completed ? (isDark ? 'rgba(76, 175, 80, 0.1)' : '#f0fdf4') : 'var(--t-field-bg)', borderRadius: '8px', border: `1px solid ${missao.completed ? 'var(--success)' : (isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7')}`, transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
                        
                        {/* EFEITO DE BRILHO SE COMPLETA */}
                        {missao.completed && <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(76,175,80,0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>}

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer', flex: 1, zIndex: 1 }}>
                          <input type="checkbox" checked={missao.completed} onChange={() => toggleAcceptedMission(missao.id)} style={{ width: '20px', height: '20px', marginTop: '0.1rem', accentColor: 'var(--success)' }} />
                          <div style={{ opacity: missao.completed ? 0.7 : 1 }}>
                            <strong style={{ color: missao.completed ? 'var(--success)' : 'var(--t-text)', fontSize: '1.05rem', textDecoration: missao.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              {missao.titulo}
                            </strong>
                            <span style={{ color: 'var(--t-text-muted)', fontSize: '0.9rem', lineHeight: '1.4', display: 'block' }}>{missao.descricao}</span>
                            <span style={{ color: 'var(--t-purple-text)', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.5rem', display: 'block' }}>Assumida em: {missao.startDate.split('-').reverse().join('/')}</span>
                          </div>
                        </label>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', zIndex: 1 }}>
                          <button onClick={() => removeAcceptedMission(missao.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }} title="Abandonar Missão"><X size={18} /></button>
                          
                          {/* SELO DE VITÓRIA */}
                          {missao.completed && (
                            <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.5rem' }}>
                              <Award size={32} color="var(--gold-bright)" style={{ filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.5))' }} />
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--gold-bright)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '0.2rem' }}>Vitória</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
  );
}
