import React from 'react';
import DeferredField from '../components/DeferredField';
import { Award, BookOpen, CheckCircle, ChevronDown, ChevronUp, Clock, Copy, Edit, FileText, Flame, Link2, Moon, Mountain, Plus, Save, Shield, Sparkles, Star, Sun, Sunrise, Swords, Target, Trash2, Users, X, Zap } from 'lucide-react';
import { db } from '../config/firebase-config';
import { doc, setDoc } from 'firebase/firestore';
import { BASTIOES_DB } from '../constants/bastioes';

// Módulo GDVE / FV: carta de degrau, tarefas, grupos e calendário.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function GdveView({ addGdveTask, copyInviteLink, customTasks, deleteGroupHandler, editingGdveTaskId, fvCalendar, fvCondicao, fvDaily, fvGdveBastiaoName, fvGdveCycleStatus, fvGdveReuniao, fvGdveTasks, fvLastCartaDate, fvLastMeetingDate, fvMasterName, fvNextCartaDate, fvUnidade, generateMonthlyReportText, gerarCartaDegrau, getBlockStyle, getFvMonthlyStats, getHeaderStyle, getTaskColor, getTodayKey, handleDiasMinistradosToggle, handleMonthlyReportChange, handlePropagandaToggle, isDark, isGdveDesafiosOpen, isGdveMóduloOpen, isGdvePlanOpen, isGdveRelatorioOpen, isGeneratingCartaDegrau, isJoiningGroup, isLoadingGroups, joinGroupByCode, leaveGroupHandler, monthlyReport, myGroups, newGdveTaskCycleTouched, newGdveTaskIsCycle, newGdveTaskName, newGdveTaskTarget, newTaskName, registerGdveAttendance, removeCustomTask, removeGdveTask, removeGroupMember, saveCustomTask, saveFvPlanning, setEditingGdveTaskId, setFvCalendar, setFvCondicao, setFvGdveTasks, setFvLastCartaDate, setFvLastMeetingDate, setFvMasterName, setFvNextCartaDate, setFvUnidade, setIsGdveDesafiosOpen, setIsGdveMóduloOpen, setIsGdvePlanOpen, setIsGdveRelatorioOpen, setNewGdveTaskCycleTouched, setNewGdveTaskIsCycle, setNewGdveTaskName, setNewGdveTaskTarget, setNewTaskName, setShowCreateGroupModal, showConfirm, showPrompt, showToast, startEditingGdveTask, todayTasksStatus, toggleGdveTask, toggleTaskStatus, user }) {
  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* 1. RESUMO FIXO NO TOPO (Dashboard de Leitura) */}
            <div style={{ background: isDark ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(255, 165, 0, 0.05) 100%)' : '#fffbf0', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.3)' : '#ffe082'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 1.2rem 0', color: isDark ? 'var(--gold-bright)' : 'var(--gold)', fontFamily: "'Cinzel', serif", display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}><Award size={20} /> Planejamento do Discipulado</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', paddingBottom: '1.5rem', borderBottom: `1px solid ${isDark ? 'rgba(255,215,0,0.1)' : 'rgba(139,115,85,0.1)'}`, marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Minha Unidade</span>
                  <strong style={{ color: 'var(--t-text)', fontSize: '1.1rem' }}>{fvUnidade || 'Não definida'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Minha Condição</span>
                  <strong style={{ color: 'var(--t-text)', fontSize: '1.1rem' }}>{fvCondicao || 'Não definida'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Mestre / Instrutor</span>
                  <strong style={{ color: 'var(--t-text)', fontSize: '1.1rem' }}>{fvMasterName || 'Não definido'}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Próxima Entrega</span>
                  <strong style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>{fvNextCartaDate ? new Date(fvNextCartaDate + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/--'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--t-text-muted)', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>Próxima Reunião</span>
                  <strong style={{ color: 'var(--t-text)', fontSize: '1.1rem' }}>{fvGdveReuniao ? new Date(fvGdveReuniao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '--/--/--'}</strong>
                </div>
              </div>
            </div>

            {/* 2. GAVETAS DO QUARTEL GENERAL */}
            {(() => {
              // Juiz de Acompanhamento (Checa também se a carta está atrasada)
              const planFilled = fvMasterName && fvLastMeetingDate && fvLastCartaDate && fvNextCartaDate;
              let planStatus = !fvMasterName ? 'empty' : (planFilled ? 'full' : 'partial');
              
              if (fvNextCartaDate) {
                const hojeStr = getTodayKey();
                if (fvNextCartaDate < hojeStr) {
                  planStatus = 'overdue'; // Aciona o alerta vermelho!
                }
              }

              // Juiz do Módulo GDVE (Bastião + Reunião + Práticas)
              const hasBastiao = fvGdveBastiaoName && fvGdveBastiaoName !== '';
              const hasMissoes = fvGdveTasks.length > 0;
              // Usa o state ao vivo (fvDaily), não o snapshot de `entries`, para não ficar
              // dessincronizado da lista de tarefas logo abaixo ao marcar/desmarcar uma missão.
              const todayGdveStatus = fvDaily?.gdveTasksStatus || {};
              const missoesCompletas = fvGdveTasks.filter(t => t.isCycle ? fvGdveCycleStatus[t.id] : (todayGdveStatus[t.id] >= t.target)).length;
              
              let gdveStatus = 'empty';
              if (hasBastiao || hasMissoes || fvDaily.gdveAttendance) {
                // A reunião só acontece a cada 15 dias, não pode ser exigência diária!
                if (hasMissoes) {
                  gdveStatus = (missoesCompletas === fvGdveTasks.length) ? 'full' : 'partial';
                } else {
                  // Se não tem missões, mas escolheu o Bastião, consideramos concluído
                  gdveStatus = hasBastiao ? 'full' : 'partial';
                }
              }

              // Juiz de Desafios Pessoais
              const totalD = customTasks.length;
              const feitosD = customTasks.filter(t => todayTasksStatus[t.id]).length;
              const desafiosStatus = totalD === 0 ? 'empty' : (feitosD === 0 ? 'empty' : (feitosD === totalD ? 'full' : 'partial'));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* GAVETA: MESTRE E CARTA */}
                  <div style={getBlockStyle(planStatus, isGdvePlanOpen, 'var(--t-accent-bright)')}>
                    <div onClick={() => setIsGdvePlanOpen(!isGdvePlanOpen)} style={getHeaderStyle(planStatus, isGdvePlanOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Shield size={28} color={'var(--t-accent-bright)'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: planStatus === 'overdue' ? 'var(--danger)' : 'var(--t-text)', fontFamily: "'Cinzel', serif", textDecoration: planStatus === 'full' && !isGdvePlanOpen ? 'line-through' : 'none' }}>
                          Mestre e Carta 
                          {planStatus === 'partial' && !isGdvePlanOpen && <span style={{fontSize: '0.8rem', opacity: 0.7}}> (Incompleto)</span>}
                          {planStatus === 'overdue' && !isGdvePlanOpen && <span style={{fontSize: '0.8rem', color: 'var(--danger)', fontStyle: 'italic', fontFamily: 'Georgia, serif'}}> (Atrasada!)</span>}
                        </h2>
                      </div>
                      {isGdvePlanOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdvePlanOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                         
                         {/* DADOS DE PERFIL */}
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Unidade</label>
                              <select value={fvUnidade || ''} onChange={(e) => setFvUnidade(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                <option value="">Selecione...</option>
                                {['ACROPOLEPLAY', 'AGORA', 'ÁGUAS CLARAS', 'ALTIPLANO', 'ALTO DA GLORIA', 'ANANINDEUA', 'ANÁPOLIS', 'ARAGUAINA', 'ASA NORTE', 'ASA SUL', 'BARRA DO GARÇAS', 'BELÉM', 'BOA VISTA', 'BODHIDHARMA', 'BRASÍLIA', 'BRASILIA SAMAMBAIA', 'CAMPINA GRANDE', 'CAMPO NOVO DO PARECIS', 'CARUARU', 'CATALÃO', 'CEILÂNDIA', 'CUIABÁ', 'FAZENDA NOVA ACRÓPOLE', 'FORMOSA', 'FORTALEZA DIONISIO TORRES', 'FORTALEZA FÁTIMA', 'FORTALEZA MEIRELES', 'FORTALEZA MESSEJANA', 'FORTALEZA SUL', 'GAMA', 'GOIANIA CIDADE JARDIM', 'GOIÂNIA ELDORADO', 'GOIANIA GARAVELO', 'GOIANIA II', 'GOIANIA ITUMBIARA', 'GOIANIA JARDIM AMÉRICA', 'GOIANIA SETOR OESTE', 'GOIÂNIA UNIVERSITARIO', 'GUARÁ', 'ITACA', 'JOÃO PESSOA', 'JUAZEIRO DO NORTE', 'LAGO SUL', 'MACAPÁ', 'MANAUS', 'MÓDULO SÃO JORGE', 'MOSSORÓ', 'MOSSORÓ ASSU', 'NATAL CANDELARIA', 'NATAL MORRO BRANCO', 'NATAL PONTA NEGRA', 'NATAL TIROL', 'NATAL ZONA NORTE', 'NOVA PARNAMIRIM', 'PALMAS', 'PALMAS AURENY', 'PETROLINA', 'PLANALTINA', 'PORTO VELHO', 'RECIFE BOA VIAGEM', 'RECIFE DERBY', 'RIO VERDE', 'RONDONÓPOLIS', 'SANTA MARIA', 'SÃO LUIS', 'SAO LUIS VINHAIS', 'SENADOR CANEDO', 'SERAPHIS', 'SINOP', 'SOBRADINHO', 'SOBRAL', 'SORRISO', 'SUDOESTE', 'TAGUATINGA', 'TERESINA', 'VALPARAISO', 'Outra'].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Condição</label>
                              <select value={fvCondicao || ''} onChange={(e) => setFvCondicao(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }}>
                                <option value="">Selecione...</option>
                                {['GS', 'GF', 'GM', 'Prov GS', 'Prov GF', 'Prov GM'].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Mestre / Instrutor (CD)</label>
                              <input type="text" value={fvMasterName || ''} onChange={(e) => setFvMasterName(e.target.value)} placeholder="Com quem você se reporta..." style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                            </div>
                         </div>

                         {/* DATAS DA CARTA */}
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Último Encontro / Entrevista</label>
                              <input type="date" value={fvLastMeetingDate || ''} onChange={(e) => setFvLastMeetingDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Última Entrega de Carta</label>
                              <input type="date" value={fvLastCartaDate || ''} onChange={(e) => { const novaData = e.target.value; setFvLastCartaDate(novaData); if (novaData) { const [ano, mes, dia] = novaData.split('-'); const dataCalculada = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1 + 3, parseInt(dia, 10)); setFvNextCartaDate(`${dataCalculada.getFullYear()}-${String(dataCalculada.getMonth() + 1).padStart(2, '0')}-${String(dataCalculada.getDate()).padStart(2, '0')}`); } else { setFvNextCartaDate(''); } }} style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-accent-bright)' }}>Próxima Entrega (Previsão)</label>
                              <input type="date" value={fvNextCartaDate || ''} onChange={(e) => setFvNextCartaDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: `1px solid var(--t-gold-border)`, borderRadius: '8px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} />
                            </div>
                         </div>

                         {/* EXPORTAR CARTA DE DEGRAU (SÍNTESE DO CICLO) */}
                         <div style={{ marginBottom: '2rem', padding: '1.5rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', borderRadius: '12px', border: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'var(--border-light)'}` }}>
                            <button onClick={gerarCartaDegrau} disabled={isGeneratingCartaDegrau} style={{ width: '100%', padding: '0.9rem', background: isGeneratingCartaDegrau ? (isDark ? 'rgba(255,152,0,0.15)' : '#fff3e0') : 'var(--t-accent)', color: isGeneratingCartaDegrau ? (isDark ? 'var(--orange)' : 'var(--orange-strong)') : 'var(--t-surface)', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: isGeneratingCartaDegrau ? 'not-allowed' : 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              {isGeneratingCartaDegrau ? <Sparkles className="animate-spin" size={18} /> : <FileText size={18} />}
                              {isGeneratingCartaDegrau ? 'Sintetizando seu ciclo...' : 'Exportar Carta de Degrau (Síntese do Ciclo)'}
                            </button>
                            <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: 'var(--t-text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                              Gera um rascunho sintetizando suas respostas da "Escalada (Degrau)" desde {fvLastCartaDate ? `a última entrega (${new Date(fvLastCartaDate + 'T12:00:00').toLocaleDateString('pt-BR')})` : 'os últimos 30 dias'}. Revise com atenção antes de entregar ao seu Instrutor.
                            </p>
                         </div>

                         {/* CONFIGURAÇÃO DO CALENDÁRIO DE ATIVIDADES (Com Múltiplos Dias e Horas) */}
                         <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px dashed ${isDark ? 'rgba(212, 175, 55, 0.3)' : 'var(--border-light)'}`, marginBottom: '2rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--t-accent-bright)', fontSize: '1rem', fontFamily: "'Cinzel', serif" }}>Calendário Fixo de Atividades</h4>
                            
                            {/* Aulas Regulares e Raio */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                               <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', padding: '1rem', borderRadius: '8px' }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--t-text-soft)', fontWeight: 'bold' }}>Aula Regular (Curso)</label>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select value={fvCalendar.aulaRegularDia} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularDia: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }}>
                                      <option value="">Selecione o Dia...</option>
                                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input type="time" title="Início" value={fvCalendar.aulaRegularHora} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularHora: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                                      <span style={{ color: 'var(--t-text)' }}>até</span>
                                      <input type="time" title="Fim" value={fvCalendar.aulaRegularFim} onChange={(e) => setFvCalendar({...fvCalendar, aulaRegularFim: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                                    </div>
                                 </div>
                               </div>
                               <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', padding: '1rem', borderRadius: '8px' }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--t-text-soft)', fontWeight: 'bold' }}>Reunião de Raio</label>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select value={fvCalendar.reuniaoRaioDia} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioDia: e.target.value})} style={{ padding: '0.6rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }}>
                                      <option value="">Selecione o Dia...</option>
                                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                                    </select>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <input type="time" title="Início" value={fvCalendar.reuniaoRaioHora} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioHora: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                                      <span style={{ color: 'var(--t-text)' }}>até</span>
                                      <input type="time" title="Fim" value={fvCalendar.reuniaoRaioFim} onChange={(e) => setFvCalendar({...fvCalendar, reuniaoRaioFim: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }} />
                                    </div>
                                 </div>
                               </div>
                            </div>

                            {/* Aulas Ministradas (Múltipla Seleção e Horários Individuais) */}
                            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                               <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--t-text-soft)', fontWeight: 'bold' }}>Dias em que Ministro Aula (Múltipla escolha)</label>
                               
                               {/* Botões dos Dias */}
                               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                 {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => {
                                   const isSelected = (fvCalendar.aulaMinistradaDias || []).includes(String(index));
                                   return (
                                     <button 
                                       key={index} 
                                       onClick={() => handleDiasMinistradosToggle(String(index))}
                                       style={{ padding: '0.5rem 0.8rem', background: isSelected ? 'var(--t-accent)' : 'transparent', color: isSelected ? (isDark ? 'var(--black)' : 'var(--white)') : 'var(--t-text-soft)', border: `1px solid ${isSelected ? 'transparent' : 'var(--border-light)'}`, borderRadius: '6px', cursor: 'pointer', fontWeight: isSelected ? 'bold' : 'normal' }}
                                     >
                                       {dia}
                                     </button>
                                   )
                                 })}
                               </div>

                               {/* Linhas de Horário que aparecem dependendo do dia marcado */}
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                 {['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map((nomeDia, index) => {
                                    const diaStr = String(index);
                                    if (!(fvCalendar.aulaMinistradaDias || []).includes(diaStr)) return null;
                                    
                                    const tempos = (fvCalendar.aulaMinistradaTempos || {})[diaStr] || { inicio: '', fim: '' };
                                    
                                    return (
                                      <div key={diaStr} className="animate-fadeIn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--white)', padding: '0.5rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : '#ddd'}` }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--t-accent)', width: '90px', fontWeight: 'bold' }}>{nomeDia}:</span>
                                        <input type="time" title="Início" value={tempos.inicio} onChange={(e) => { setFvCalendar(prev => ({ ...prev, aulaMinistradaTempos: { ...prev.aulaMinistradaTempos, [diaStr]: { ...prev.aulaMinistradaTempos?.[diaStr], inicio: e.target.value } } })); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }} />
                                        <span style={{ color: 'var(--t-text)', fontSize: '0.85rem' }}>até</span>
                                        <input type="time" title="Fim" value={tempos.fim} onChange={(e) => { setFvCalendar(prev => ({ ...prev, aulaMinistradaTempos: { ...prev.aulaMinistradaTempos, [diaStr]: { ...prev.aulaMinistradaTempos?.[diaStr], fim: e.target.value } } })); }} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }} />
                                      </div>
                                    )
                                 })}
                               </div>
                            </div>

                            {/* Calendário de ED e CRM (Data Exata) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                               <div style={{ background: isDark ? 'rgba(155, 89, 182, 0.1)' : '#fdf8ff', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(155, 89, 182, 0.3)' : '#e1bee7'}` }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--t-purple-text)', fontWeight: 'bold' }}>Data da Próxima CRM</label>
                                 <input type="date" value={fvCalendar.dataCrm} onChange={(e) => setFvCalendar({...fvCalendar, dataCrm: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }} />
                               </div>
                               <div style={{ background: isDark ? 'rgba(74, 144, 226, 0.1)' : '#f4f8ff', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.3)'}` }}>
                                 <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--t-blue-text)', fontWeight: 'bold' }}>Data da Próxima ED</label>
                                 <input type="date" value={fvCalendar.dataAulaEd} onChange={(e) => setFvCalendar({...fvCalendar, dataAulaEd: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'var(--t-surface-glass)', color: 'var(--t-text)', border: '1px solid var(--border-light)' }} />
                               </div>
                            </div>
                         </div>
                         
                         <button 
                           onClick={() => {
                             saveFvPlanning();
                             setIsGdvePlanOpen(false);
                           }} 
                           style={{ padding: '0.8rem 1.5rem', width: '100%', justifyContent: 'center', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                         >
                           <Save size={18} /> Salvar Ficha Completa
                         </button>
                      </div>
                    )}
                  </div>

                  {/* GAVETA: MÓDULO GDVE (A Grande Fusão) */}
                  <div style={getBlockStyle(gdveStatus, isGdveMóduloOpen, 'var(--t-accent-bright)')}>
                    <div onClick={() => setIsGdveMóduloOpen(!isGdveMóduloOpen)} style={getHeaderStyle(gdveStatus, isGdveMóduloOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen size={28} color={'var(--t-accent-bright)'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif", textDecoration: gdveStatus === 'full' && !isGdveMóduloOpen ? 'line-through' : 'none' }}>
                          Módulo GDVE {gdveStatus === 'partial' && !isGdveMóduloOpen && <span style={{fontSize: '0.8rem', opacity: 0.7}}> (Em Andamento)</span>}
                        </h2>
                      </div>
                      {isGdveMóduloOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdveMóduloOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>

                        {/* Seção Grupo: cada participante continua controlando suas próprias
                            tarefas/bastiões/presença abaixo (nada muda nisso) — o grupo só serve
                            pra avisar os colegas quando alguém concluir algo. */}
                        <div style={{ padding: '1rem', background: isDark ? 'rgba(76, 175, 80, 0.05)' : 'rgba(232, 245, 233, 0.5)', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(76,175,80,0.3)' : '#c8e6c9'}`, marginBottom: '2rem' }}>
                          {isLoadingGroups ? (
                            <p style={{ margin: 0, color: 'var(--t-text-soft)', fontSize: '0.9rem' }}>Carregando grupo...</p>
                          ) : myGroups.length === 0 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <Users size={20} color={'var(--t-success-text)'} />
                                <strong style={{ color: 'var(--t-text)' }}>Grupo de Estudo</strong>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--t-text-soft)', marginBottom: '1rem' }}>
                                Junte-se a colegas de degrau para serem avisados quando alguém concluir uma tarefa aqui embaixo.
                              </p>
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button onClick={() => setShowCreateGroupModal(true)} style={{ padding: '0.6rem 1.2rem', background: isDark ? 'var(--success)' : 'var(--success-strong)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                  <Plus size={16} /> Criar Grupo
                                </button>
                                <button
                                  disabled={isJoiningGroup}
                                  onClick={() => {
                                    showPrompt('Cole aqui o código de convite (ou o link inteiro):', (code) => {
                                      if (code) joinGroupByCode(code);
                                    }, { placeholder: 'Código de convite', submitLabel: 'Entrar' });
                                  }}
                                  style={{ padding: '0.6rem 1.2rem', background: 'transparent', color: 'var(--t-success-text)', border: `1px solid var(--t-success-text)`, borderRadius: '6px', fontWeight: 'bold', cursor: isJoiningGroup ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: isJoiningGroup ? 0.6 : 1, fontSize: '0.85rem' }}
                                >
                                  <Link2 size={16} /> Entrar com Código
                                </button>
                              </div>
                            </div>
                          ) : (
                            myGroups.map(group => (
                              <div key={group.id} style={{ marginBottom: myGroups.length > 1 ? '1rem' : 0, paddingBottom: myGroups.length > 1 ? '1rem' : 0, borderBottom: myGroups.length > 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-soft)'}` : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <div>
                                    <strong style={{ color: 'var(--t-text)' }}>{group.name}</strong>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--t-text-soft)' }}>
                                      {group.memberUids.length} {group.memberUids.length === 1 ? 'membro' : 'membros'}
                                      {group.isCoordinator && ' · você coordena'}
                                    </div>
                                  </div>
                                  <button onClick={() => copyInviteLink(group.inviteCode)} style={{ padding: '0.4rem 0.8rem', background: 'transparent', color: 'var(--t-success-text)', border: `1px solid var(--t-success-text)`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Copy size={13} /> Convite: {group.inviteCode}
                                  </button>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                  {group.memberUids.map(mUid => (
                                    <span key={mUid} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', background: isDark ? 'rgba(0,0,0,0.25)' : 'white', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`, borderRadius: '999px', fontSize: '0.75rem', color: 'var(--t-text)' }}>
                                      {group.memberNames?.[mUid] || 'Membro'}{mUid === group.coordinatorUid && ' 👑'}
                                      {group.isCoordinator && mUid !== user.uid && (
                                        <button onClick={() => removeGroupMember(group.id, mUid)} title="Remover do grupo" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
                                      )}
                                    </span>
                                  ))}
                                </div>

                                {group.isCoordinator ? (
                                  <button onClick={() => deleteGroupHandler(group.id, group.name)} style={{ padding: '0.4rem 0.8rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Trash2 size={13} /> Excluir Grupo
                                  </button>
                                ) : (
                                  <button onClick={() => leaveGroupHandler(group.id)} style={{ padding: '0.4rem 0.8rem', background: 'transparent', color: 'var(--t-text-soft)', border: `1px solid var(--t-field-border)`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
                                    Sair do Grupo
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Seção Reunião */}
                        <div style={{ padding: '1rem', background: fvDaily.gdveAttendance ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 215, 0, 0.05)', borderRadius: '12px', border: `1px solid ${fvDaily.gdveAttendance ? 'var(--success)' : 'var(--gold-bright)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                           <span style={{ color: 'var(--t-text)', fontWeight: 'bold' }}>Reunião Quinzenal:</span>
                           <button onClick={registerGdveAttendance} style={{ padding: '0.5rem 1rem', background: fvDaily.gdveAttendance ? 'var(--success)' : 'transparent', color: fvDaily.gdveAttendance ? 'white' : 'var(--gold-bright)', border: `1px solid ${fvDaily.gdveAttendance ? 'var(--success)' : 'var(--gold-bright)'}`, borderRadius: '6px', cursor: 'pointer' }}>
                             {fvDaily.gdveAttendance ? '✓ Presença Confirmada' : 'Marcar Presença'}
                           </button>
                        </div>
                        
                        {/* Seção Práticas do Grupo */}
                        <h4 style={{ color: 'var(--t-accent-bright)', fontSize: '1rem', fontFamily: "'Cinzel', serif", marginBottom: '1rem' }}>Práticas Específicas do Ciclo</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                           {fvGdveTasks.map(task => {
                             const isCycle = task.isCycle;
                             const isCounter = !isCycle && task.target > 1;
                             let isCompleted = false;
                             let displayValue = '';

                             // --- LÓGICA ULTRA-SMART DO BASTIÃO (NÚMERO OU NOME + MÚLTIPLOS) ---
                             let linkDoBastiao = null;
                             let multiplosBastioes = null; 
                             let bastiaoUnico = null; // <- NOVA VARIÁVEL PARA GUARDAR A OBRA EXATA
                             const taskNameLower = task.name.toLowerCase();
                             const taskNameSemAcento = taskNameLower.normalize('NFD').replace(/[̀-ͯ]/g, '');
                             const isBastiaoTask = taskNameSemAcento.includes('bastiao') || taskNameSemAcento.includes('leitura');

                             if (isBastiaoTask) {
                                const limpaTexto = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                                const textoLimpoTask = limpaTexto(task.name);

                                // 1. TENTATIVA POR NÚMERO (Ex: "039" ou "39")
                                const matchNumero = task.name.match(/\d+/);
                                if (matchNumero) {
                                   const numeroEncontrado = parseInt(matchNumero[0], 10).toString();
                                   bastiaoUnico = BASTIOES_DB.find(b => b.numero === numeroEncontrado);
                                   if (bastiaoUnico) linkDoBastiao = bastiaoUnico.link;
                                }

                                // 2. TENTATIVA POR NOME COM FILTRO DE MÚLTIPLOS E CORREÇÃO DE "???"
                                if (!linkDoBastiao) {
                                   const termoBusca = textoLimpoTask.replace('bastiao', '').replace('leitura', '').replace('ler', '').replace(/(^|\s)o(\s|$)/g, ' ').trim();
                                   
                                   if (termoBusca.length > 3) { 
                                      const resultados = BASTIOES_DB.filter(b => {
                                         const tituloLimpo = limpaTexto(b.titulo);
                                         if (tituloLimpo.length < 3) return false; 
                                         return tituloLimpo.includes(termoBusca) || termoBusca.includes(tituloLimpo);
                                      });

                                      if (resultados.length === 1) {
                                         bastiaoUnico = resultados[0];
                                         linkDoBastiao = bastiaoUnico.link;
                                      } else if (resultados.length > 1) {
                                         multiplosBastioes = resultados;
                                      }
                                   }
                                }
                             }
                             // -----------------------------------------

                             const currentCount = (typeof fvDaily.gdveTasksStatus?.[task.id] === 'boolean' ? (fvDaily.gdveTasksStatus[task.id] ? 1 : 0) : fvDaily.gdveTasksStatus?.[task.id]) || 0;
                             const targetCount = task.target || 1;
                             const taskColor = getTaskColor(currentCount, targetCount, isDark);

                             if (isCycle) {
                                isCompleted = !!fvGdveCycleStatus[task.id];
                                displayValue = isCompleted ? 'Feito' : 'Pendente';
                             } else if (isCounter) {
                                isCompleted = currentCount >= targetCount;
                                displayValue = `${currentCount}/${targetCount}`;
                             } else {
                                isCompleted = !!fvDaily.gdveTasksStatus?.[task.id];
                             }

                             return (
                               <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', borderRadius: '8px', border: `1px solid ${taskColor}`, transition: 'all 0.3s ease', marginBottom: '0.75rem' }}>
                                 <div onClick={() => toggleGdveTask(task)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                   
                                   {isCounter ? (
                                      <div style={{ padding: '0.3rem 0.6rem', background: taskColor, border: `1px solid ${taskColor}`, borderRadius: '12px', color: 'var(--white)', fontWeight: 'bold', fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>
                                        {displayValue}
                                      </div>
                                   ) : (
                                      <input type="checkbox" checked={isCompleted} readOnly style={{ width: '18px', height: '18px', accentColor: 'var(--success)' }} />
                                   )}
                                   
                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                     <span style={{ color: isCompleted ? 'var(--t-success-text)' : 'var(--t-text)', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                                       {task.name}
                                     </span>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--t-text-faint)', textTransform: 'uppercase' }}>
                                           {isCycle ? '⏳ Missão do Ciclo' : (isCounter ? '📅 Meta Diária' : '📅 Prática Diária')}
                                        </span>
                                        
                                        {/* AQUI APARECE O BOTÃO OU O MENU */}
                                        {linkDoBastiao && !multiplosBastioes && (
                                          <a 
                                            href={linkDoBastiao} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            onClick={async (e) => { 
                                              e.stopPropagation();
                                              // A MÁGICA ACONTECE AQUI: Se o nome for diferente do oficial, ele corrige!
                                              if (bastiaoUnico && task.name !== bastiaoUnico.nomeCompleto) {
                                                 const novasTasks = fvGdveTasks.map(t => 
                                                   t.id === task.id ? { ...t, name: bastiaoUnico.nomeCompleto } : t
                                                 );
                                                 setFvGdveTasks(novasTasks);
                                                 if (user) {
                                                   try {
                                                     await setDoc(doc(db, 'fvData', user.uid), { fvGdveTasks: novasTasks }, { merge: true });
                                                   } catch (err) {
                                                     console.error('Erro ao renomear tarefa GDVE:', err);
                                                     showToast('⚠️ Não foi possível salvar o nome corrigido da tarefa. Tente novamente.');
                                                   }
                                                 }
                                              }
                                            }}
                                            style={{ 
                                              fontSize: '0.65rem', padding: '2px 6px', background: isDark ? 'rgba(212,175,55,0.1)' : '#fffbf0', 
                                              color: 'var(--t-accent-bright)', border: `1px solid var(--t-accent-bright)`, 
                                              borderRadius: '4px', textDecoration: 'none', display: 'inline-block', fontWeight: 'bold'
                                            }}
                                          >
                                            🔗 Abrir PDF
                                          </a>
                                        )}

                                        {multiplosBastioes && (
                                          <select 
                                            onClick={(e) => e.stopPropagation()} 
                                            onChange={async (e) => { 
                                              const selectedLink = e.target.value;
                                              if (selectedLink) {
                                                // 1. Abre o PDF em nova aba
                                                window.open(selectedLink, '_blank'); 
                                                
                                                // 2. Descobre qual Bastião exato foi escolhido
                                                const bastiaoEscolhido = multiplosBastioes.find(b => b.link === selectedLink);
                                                
                                                if (bastiaoEscolhido) {
                                                   // 3. Atualiza o nome da tarefa para o nome oficial do Bastião
                                                   const novasTasks = fvGdveTasks.map(t => 
                                                     t.id === task.id ? { ...t, name: bastiaoEscolhido.nomeCompleto } : t
                                                   );
                                                   
                                                   // 4. Salva a alteração na tela e no Firebase
                                                   setFvGdveTasks(novasTasks);
                                                   if (user) {
                                                     try {
                                                       await setDoc(doc(db, 'fvData', user.uid), { fvGdveTasks: novasTasks }, { merge: true });
                                                     } catch (err) {
                                                       console.error('Erro ao renomear tarefa GDVE:', err);
                                                       showToast('⚠️ Não foi possível salvar o nome corrigido da tarefa. Tente novamente.');
                                                     }
                                                   }
                                                }
                                              }
                                              e.target.value = ''; // Reseta visualmente
                                            }}
                                            style={{ 
                                              fontSize: '0.65rem', padding: '2px 6px', background: isDark ? 'rgba(212,175,55,0.1)' : '#fffbf0', 
                                              color: 'var(--t-accent-bright)', border: `1px solid var(--t-accent-bright)`, 
                                              borderRadius: '4px', maxWidth: '200px', fontWeight: 'bold', cursor: 'pointer'
                                            }}
                                          >
                                            <option value="" style={{ background: isDark ? 'var(--bg-dark)' : 'var(--white)', color: 'var(--t-text-soft)' }}>
                                              {multiplosBastioes.length} encontrados! Escolha...
                                            </option>
                                            {multiplosBastioes.map((b, i) => (
                                              <option key={i} value={b.link} style={{ background: isDark ? 'var(--bg-dark)' : 'var(--white)', color: 'var(--t-text)' }}>
                                                {b.nomeCompleto}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                     </div>
                                   </div>
                                 </div>
                                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                                   <button onClick={(e) => { e.stopPropagation(); startEditingGdveTask(task); }} style={{ background: 'transparent', border: 'none', color: isDark ? 'var(--gold)' : 'var(--umber-bright)', cursor: 'pointer' }} title="Editar"><Edit size={16} /></button>
                                   <button onClick={(e) => { e.stopPropagation(); showConfirm('Deseja excluir esta prática?', () => removeGdveTask(task.id), { danger: true }); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Excluir"><Trash2 size={16} /></button>
                                 </div>
                               </div>
                             );
                           })}
                        </div>
                        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-light)'}` }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <h5 style={{ margin: 0, color: 'var(--t-accent-bright)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                               {editingGdveTaskId ? 'Editar Prática' : 'Adicionar Nova Prática'}
                             </h5>
                             {editingGdveTaskId && (
                               <button onClick={() => { setEditingGdveTaskId(null); setNewGdveTaskName(''); setNewGdveTaskTarget(1); setNewGdveTaskIsCycle(false); setNewGdveTaskCycleTouched(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                 <X size={16}/>
                               </button>
                             )}
                           </div>
                           
                           
                           <input 
                             type="text" 
                             value={newGdveTaskName} 
                             onChange={(e) => {
                               const val = e.target.value;
                               setNewGdveTaskName(val);
                               
                               // INTELIGÊNCIA: Se detectar que é leitura, muda o status automaticamente!
                               const valLimpo = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                               if (!newGdveTaskCycleTouched && (valLimpo.includes('bastiao') || valLimpo.includes('leitura') || /\bler\b/.test(valLimpo))) {
                                 setNewGdveTaskIsCycle(true);
                                 setNewGdveTaskTarget(1);
                               }
                             }}
                             placeholder="Ex: Ler Bastião / Eu sou Discípulo..." 
                             style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.4)' : 'var(--border-light)'}`, background: 'var(--t-field-bg)', color: 'var(--t-text)', fontFamily: 'Georgia, serif' }} 
                           />


                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--t-text-soft)' }}>
                                 <input type="checkbox" checked={newGdveTaskIsCycle} onChange={(e) => { setNewGdveTaskIsCycle(e.target.checked); setNewGdveTaskCycleTouched(true); if(e.target.checked) setNewGdveTaskTarget(1); }} style={{ width: '16px', height: '16px', accentColor: 'var(--gold-bright)', cursor: 'pointer' }} />
                                 Missão Única do Ciclo (Não zera diariamente)
                              </label>
                              
                              {!newGdveTaskIsCycle && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--t-text-soft)' }}>
                                   Vezes por dia:
                                   <input type="number" min="1" max="10" value={newGdveTaskTarget} onChange={(e) => setNewGdveTaskTarget(parseInt(e.target.value) || 1)} style={{ width: '60px', padding: '0.4rem', borderRadius: '4px', border: `1px solid var(--t-field-border)`, background: 'var(--t-field-bg)', color: 'var(--t-text)', textAlign: 'center' }} />
                                </label>
                              )}

                              <button onClick={addGdveTask} style={{ marginLeft: 'auto', padding: '0.6rem 1.5rem', background: 'var(--t-accent-bright)', color: 'var(--t-surface)', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.2s' }}>
                                 {editingGdveTaskId ? 'Salvar Alteração' : '+ Adicionar'}
                              </button>
                           </div>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setIsGdveMóduloOpen(false); // Fecha a gaveta
                            showToast('✅ Módulo GDVE atualizado com sucesso!');
                          }} 
                          style={{ marginTop: '2rem', width: '100%', padding: '0.8rem 1.5rem', background: 'var(--t-accent)', color: 'var(--t-surface)', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={18} /> Salvar Módulo GDVE
                        </button>

                      </div>
                    )}
                  </div>


                  {/* GAVETA: DESAFIOS PESSOAIS */}
                  <div style={getBlockStyle(desafiosStatus, isGdveDesafiosOpen, 'var(--t-blue-text)')}>
                    <div onClick={() => setIsGdveDesafiosOpen(!isGdveDesafiosOpen)} style={getHeaderStyle(desafiosStatus, isGdveDesafiosOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Swords size={28} color={'var(--t-blue-text)'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif", textDecoration: desafiosStatus === 'full' && !isGdveDesafiosOpen ? 'line-through' : 'none' }}>
                          Desafios Pessoais
                        </h2>
                      </div>
                      {isGdveDesafiosOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                    {isGdveDesafiosOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                         {customTasks.map(task => (
                           <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: isDark ? 'rgba(0,0,0,0.2)' : 'var(--gray-bg)', borderRadius: '8px', border: `1px solid ${todayTasksStatus[task.id] ? 'var(--success)' : 'var(--border-soft)'}`, marginBottom: '0.5rem' }}>
                              <div onClick={() => toggleTaskStatus(task.id)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                 <input type="checkbox" checked={!!todayTasksStatus[task.id]} readOnly style={{ width: '18px', height: '18px' }} />
                                 <span style={{ color: 'var(--t-text)' }}>{task.name}</span>
                              </div>
                              <button onClick={() => removeCustomTask(task.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                           </div>
                         ))}
                         <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Novo desafio pessoal..." style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--t-field-bg)', color: 'var(--t-text)' }} />
                            <button onClick={saveCustomTask} style={{ padding: '0 1rem', background: 'var(--t-blue-text)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>+</button>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* GAVETA: RELATÓRIO MENSAL FV */}
                  <div style={getBlockStyle('partial', isGdveRelatorioOpen, isDark ? '#9B59B6' : 'var(--purple)')}>
                    <div onClick={() => setIsGdveRelatorioOpen(!isGdveRelatorioOpen)} style={getHeaderStyle('partial', isGdveRelatorioOpen)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText size={28} color={'var(--t-purple-text)'} />
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif" }}>
                          Relatório Mensal do Ciclo
                        </h2>
                      </div>
                      {isGdveRelatorioOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>

                    {isGdveRelatorioOpen && (
                      <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                        {/* PAINEL DE RESULTADOS AUTOMATIZADOS DO CICLO */}
                        {(() => {
                          const s = getFvMonthlyStats();
                          const Badge = ({ icon: Icon, label, value, color }) => (
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: color || (isDark ? 'var(--gold-muted)' : '#64748b'), fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <Icon size={14} /> {label}
                              </div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isDark ? 'var(--parchment)' : '#1e293b', fontFamily: 'Georgia, serif' }}>
                                {value}
                              </div>
                            </div>
                          );

                          const getPraticasBadgeInfo = (dias) => {
                            if (dias >= 28) return { label: 'Sempre', color: 'var(--gold-bright)', icon: Sun };
                            if (dias >= 20) return { label: 'Frequente', color: 'var(--orange)', icon: Flame };
                            if (dias >= 12) return { label: 'Às vezes', color: 'var(--success)', icon: Target };
                            if (dias > 0) return { label: 'Raramente', color: 'var(--danger)', icon: Sparkles };
                            return { label: 'Nunca', color: isDark ? 'var(--gray-strong)' : '#999', icon: Moon };
                          };

                          return (
                            <div style={{ marginBottom: '2.5rem' }}>
                              <div style={{ background: isDark ? 'rgba(155, 89, 182, 0.1)' : '#fdf8ff', padding: '1rem', borderRadius: '12px', borderLeft: `4px solid var(--t-purple-text)`, marginBottom: '1.5rem' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--t-text)', lineHeight: '1.5' }}>
                                  <strong>Inteligência do Diário:</strong> Os dados abaixo foram extraídos dos seus registros diários e missões. Eles já estão prontos para o seu relatório oficial.
                                </p>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                <Badge icon={Clock} label="Voluntariado" value={s.hVol} color="var(--purple)" />
                                <Badge icon={BookOpen} label="Aulas Assistidas" value={s.hAs} color="#3498db" />
                                <Badge icon={Target} label="Aulas Ministradas" value={s.hMin} color="#e67e22" />
                                <Badge icon={Zap} label="Freq. de Práticas" value={s.freqPraticas} color="#f1c40f" />
                                <Badge icon={CheckCircle} label="Aulas de Curso" value={`${s.countAulaRegular} presenças`} />
                                <Badge icon={Award} label="Aulas de ED" value={`${s.countEd} presenças`} />
                                <Badge icon={Shield} label="CRM Mensal" value={s.countCrm > 0 ? 'Participou' : 'Não registrada'} />
                                <Badge icon={Star} label="Reuniões de Raio" value={`${s.countRaio} encontros`} />
                                <Badge icon={Mountain} label="Escalas de Limpeza" value={`${s.countLimpeza} check-ins`} />
                                <Badge icon={Sunrise} label="Guarda Noturna (GN)" value={`${s.countGN} turnos`} />
                              </div>
                            </div>
                          );
                        })()}

                        

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          
                          {/* INFORMAÇÕES QUE O APP NÃO PODE ADIVINHAR */}
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Participou das outras CRM (Extras/Especiais)?</label>
                              <select value={monthlyReport.outrasCrm} onChange={(e) => handleMonthlyReportChange('outrasCrm', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)` }}>
                                <option value="">Selecione...</option><option value="Sim">Sim</option><option value="Não">Não</option><option value="Não teve CRM extra">Não teve CRM extra</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Quantos bastiões leu esse mês?</label>
                              <p style={{ fontSize: '0.8rem', color: 'var(--gray)', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>*Se você tiver uma Tarefa chamada "Bastião", o app calculará sozinho.</p>
                              <select value={monthlyReport.bastioesLidos} onChange={(e) => handleMonthlyReportChange('bastioesLidos', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)` }}>
                                <option value="">Automático pelo App (ou Selecione)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5 ou mais">5 ou mais</option><option value="Nenhum">Nenhum</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Envolvimento com a Propaganda (Múltipla escolha)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                              {['Contato Pessoal', 'Divulgação WhatsApp', 'Redes Sociais (Insta/Face)', 'Cartazes/Folhetos', 'Não tenho me envolvido'].map(op => (
                                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', borderRadius: '6px' }}>
                                  <input type="checkbox" checked={(monthlyReport.propaganda || []).includes(op)} onChange={() => handlePropagandaToggle(op)} style={{ width: '18px', height: '18px', accentColor: 'var(--purple)' }} />
                                  <span style={{ color: 'var(--t-text)', fontSize: '0.9rem' }}>{op}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Pagou contribuição mensal?</label>
                              <select value={monthlyReport.contribuicao} onChange={(e) => handleMonthlyReportChange('contribuicao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)` }}>
                                <option value="">Selecione...</option><option value="Sim, estou em dias">Sim, em dias</option><option value="Sim, mas com atraso">Sim, mas com atraso</option><option value="Não">Não</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Fez alguma doação extra?</label>
                              <select value={monthlyReport.doacao} onChange={(e) => handleMonthlyReportChange('doacao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)` }}>
                                <option value="">Selecione...</option><option value="Em espécie">Sim, em espécie</option><option value="Objeto que necessitavam">Objeto necessitado</option><option value="Espécie e Objeto">Ambos</option><option value="Não tive condições/Lembrei">Não</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                             <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Secretaria de Atuação</label>
                                <select value={monthlyReport.secretariaAtuacao} onChange={(e) => handleMonthlyReportChange('secretariaAtuacao', e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)` }}>
                                  <option value="">Nenhuma / Selecione...</option>
                                  {['Abertura de Turma', 'Artes', 'Biblioteca', 'Café Artemis', 'Difusão', 'Economia', 'Escolástica', 'GGFF', 'GGMM', 'GGSS', 'Integração', 'Livraria', 'Manutenção', 'Programa Janos', 'Programa Merlin', 'Escola do Esporte', 'Círculo de Amigos', 'Assuntos Legais', 'GEA', 'Assistência Social'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                             </div>
                             <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                               <div>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Trabalhou/reuniu com os membros da sec.?</label>
                                  <input type="text" value={monthlyReport.secretariaReuniao} onChange={(e) => handleMonthlyReportChange('secretariaReuniao', e.target.value)} placeholder="Breve relato..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)`, fontFamily: 'Georgia, serif' }} />
                               </div>
                               <div>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Quantos membros? Algum destaque?</label>
                                  <input type="text" value={monthlyReport.secretariaMembros} onChange={(e) => handleMonthlyReportChange('secretariaMembros', e.target.value)} placeholder="Quantidade e destaques..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)`, fontFamily: 'Georgia, serif' }} />
                               </div>
                             </div>
                          </div>

                          <div style={{ height: '1px', background: isDark ? 'rgba(155, 89, 182, 0.2)' : 'rgba(142, 68, 173, 0.2)' }}></div>

                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Indique 1 ou 2 pontos positivos/crescimento deste mês</label>
                            <p style={{ fontSize: '0.85rem', color: 'var(--t-text-faint)', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>Momento de síntese pessoal: extraia suas vitórias com suas próprias palavras.</p>
                            <DeferredField value={monthlyReport.pontosPositivos} onCommit={(v) => handleMonthlyReportChange('pontosPositivos', v)} rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)`, fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                          </div>

                          <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--t-purple-text)' }}>Indique um desafio que você está percebendo para crescer</label>
                            <p style={{ fontSize: '0.85rem', color: 'var(--t-text-faint)', marginTop: '-0.3rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>Olhe para si mesmo e defina com clareza o seu principal obstáculo (Kurava) atual.</p>
                            <DeferredField value={monthlyReport.desafioCrescimento} onCommit={(v) => handleMonthlyReportChange('desafioCrescimento', v)} rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--t-field-bg)', color: 'var(--t-text)', border: `1px solid var(--t-purple-border)`, fontFamily: 'Georgia, serif', resize: 'vertical' }} />
                          </div>

                          <button onClick={generateMonthlyReportText} style={{ width: '100%', padding: '1.2rem', background: 'linear-gradient(135deg, #9B59B6 0%, var(--purple) 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 6px 15px rgba(155, 89, 182, 0.3)', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                            <FileText size={22} /> Gerar Relatório e Copiar
                          </button>

                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}
          </div>
  );
}
