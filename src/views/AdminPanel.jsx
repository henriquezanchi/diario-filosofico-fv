import React from 'react';
import { CheckCircle, Plus, ShieldAlert, Trash2, X, XCircle } from 'lucide-react';

// Painel de administração de pedidos de acesso, admins e unidades.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function AdminPanel({ addAdminEmail, addUnit, adminRecordsList, decidePendingRequest, isDark, isLoadingAdminPanel, isSuperAdmin, myAdminUnits, newAdminEmail, newAdminUnits, newUnitName, pendingRequests, removeAdminEmail, removeUnit, setNewAdminEmail, setNewAdminUnits, setNewUnitName, setShowAdminPanel, unitsList }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
            <div className="animate-fadeIn" style={{ background: 'var(--t-page-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflowY: 'auto', border: `2px solid var(--t-accent)`, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>

              <button onClick={() => setShowAdminPanel(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--t-text)', cursor: 'pointer' }}>
                <X size={24} />
              </button>

              <ShieldAlert size={40} color={'var(--t-accent)'} style={{ marginBottom: '0.5rem' }} />
              <h2 style={{ margin: '0 0 0.3rem 0', fontFamily: "'Cinzel', serif", color: 'var(--t-text)', fontSize: '1.5rem' }}>Pedidos de Acesso</h2>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: 'var(--t-text-soft)', fontStyle: 'italic' }}>
                {isSuperAdmin ? 'Admin geral — você vê pedidos de todas as unidades.' : `Mostrando pedidos de: ${myAdminUnits.join(', ') || 'nenhuma unidade vinculada'}`}
              </p>

              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--t-text-soft)', textAlign: 'center', padding: '1rem 0' }}>Nenhum pedido pendente no momento.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                  {pendingRequests.map(req => (
                    <div key={req.uid} style={{ padding: '1rem', background: isDark ? 'rgba(255,255,255,0.03)' : 'var(--gray-bg)', borderRadius: '10px', border: `1px solid ${isDark ? '#333' : 'var(--border-soft)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'left' }}>
                          <strong style={{ color: 'var(--t-text)' }}>{req.requestName || 'Sem nome'}</strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--t-text-soft)' }}>{req.requestUnit || 'Unidade não informada'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--t-text)', fontWeight: 'bold' }}>{req.requestEmail || 'sem e-mail'}</div>
                          {req.email && req.requestEmail && req.email !== req.requestEmail && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>⚠️ E-mail de login diferente: {req.email}</div>
                          )}
                          {req.requestDate && <div style={{ fontSize: '0.75rem', color: isDark ? 'var(--gray-text)' : '#aaa' }}>{new Date(req.requestDate).toLocaleString('pt-BR')}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <button disabled={isLoadingAdminPanel} onClick={() => decidePendingRequest(req.uid, 'approve')} style={{ padding: '0.5rem 0.8rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '6px', cursor: isLoadingAdminPanel ? 'default' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: isLoadingAdminPanel ? 0.6 : 1 }}>
                            <CheckCircle size={16}/> Aprovar
                          </button>
                          <button disabled={isLoadingAdminPanel} onClick={() => decidePendingRequest(req.uid, 'reject')} style={{ padding: '0.5rem 0.8rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', cursor: isLoadingAdminPanel ? 'default' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: isLoadingAdminPanel ? 0.6 : 1 }}>
                            <XCircle size={16}/> Recusar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isSuperAdmin && (
                <>
                  <div style={{ borderTop: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-soft)'}`, paddingTop: '1.5rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: isDark ? 'var(--gold)' : 'var(--umber-bright)' }}>Unidades</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                      {unitsList.map(unit => (
                        <div key={unit} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: isDark ? 'rgba(255,255,255,0.03)' : 'var(--gray-bg)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--t-text)' }}>{unit}</span>
                          <button disabled={isLoadingAdminPanel} onClick={() => removeUnit(unit)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: isLoadingAdminPanel ? 'default' : 'pointer' }} title="Remover unidade">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
                      {unitsList.length === 0 && <p style={{ margin: 0, fontSize: '0.8rem', color: isDark ? 'var(--gray)' : '#999', fontStyle: 'italic' }}>Nenhuma unidade cadastrada ainda — o formulário de solicitação vai usar texto livre até você cadastrar a primeira.</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder={"Nome da unidade...\n(pode colar várias — uma por linha ou separadas por vírgula)"}
                        rows={4}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-field-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      <button disabled={isLoadingAdminPanel || !newUnitName.trim()} onClick={addUnit} style={{ padding: '0.6rem 1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isLoadingAdminPanel ? 'default' : 'pointer', opacity: isLoadingAdminPanel ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Plus size={16}/> Adicionar
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-soft)'}`, paddingTop: '1.5rem', textAlign: 'left' }}>
                    <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: isDark ? 'var(--gold)' : 'var(--umber-bright)' }}>Administradores</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                      {adminRecordsList.map(a => (
                        <div key={a.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: isDark ? 'rgba(255,255,255,0.03)' : 'var(--gray-bg)', borderRadius: '6px', gap: '0.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--t-text)' }}>{a.email}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--t-text-soft)' }}>{a.units.length === 0 ? 'Admin geral (todas as unidades)' : a.units.join(', ')}</div>
                          </div>
                          <button disabled={isLoadingAdminPanel} onClick={() => removeAdminEmail(a.email)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: isLoadingAdminPanel ? 'default' : 'pointer', flexShrink: 0 }} title="Remover admin">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="novo-admin@exemplo.com"
                        style={{ padding: '0.6rem', borderRadius: '6px', border: `1px solid var(--t-field-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)' }}
                      />
                      {unitsList.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {unitsList.map(unit => (
                            <label key={unit} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--t-text-tan)', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={newAdminUnits.includes(unit)}
                                onChange={(e) => setNewAdminUnits(prev => e.target.checked ? [...prev, unit] : prev.filter(u => u !== unit))}
                              />
                              {unit}
                            </label>
                          ))}
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: '0.75rem', color: isDark ? 'var(--gray)' : '#999', fontStyle: 'italic' }}>Sem nenhuma unidade marcada, o admin vê pedidos de todas as unidades.</p>
                      <button disabled={isLoadingAdminPanel || !newAdminEmail.trim()} onClick={addAdminEmail} style={{ padding: '0.6rem 1rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isLoadingAdminPanel ? 'default' : 'pointer', opacity: isLoadingAdminPanel ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Plus size={16}/> Adicionar Admin
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
  );
}
