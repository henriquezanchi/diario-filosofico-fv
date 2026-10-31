import React from 'react';
import { ArrowLeft, Bell, CheckCircle, Clock, Save, ShieldAlert, Smartphone, Sparkles } from 'lucide-react';

// Tela do Guardião: lembretes por WhatsApp e alertas.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function NotificationsView({ isDark, notifSettings, saveBtnStatus, saveNotificationSettings, setNotifSettings, setView }) {
  return (
    <div className="animate-fadeIn" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setView('today')} style={{ background: 'transparent', border: 'none', color: 'var(--t-accent-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={24} />
              </button>
              <Bell size={28} color={'var(--t-accent-soft)'} />
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--t-text)', fontFamily: "'Cinzel', serif" }}>
                O Guardião (Notificações)
              </h2>
            </div>

            <p style={{ color: 'var(--t-text-soft)', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>
              Configure seu assistente pessoal no WhatsApp para manter a Forja sempre acesa.
            </p>

            {/* SEÇÃO 1: CONEXÃO */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-light)'}`, marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? 'var(--gold)' : '#2c3e50', fontSize: '1.1rem' }}>
                <Smartphone size={20} /> Conexão WhatsApp
              </h3>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--t-text)', fontSize: '0.9rem' }}>Seu número (com DDD):</label>
              <input 
                type="text" 
                placeholder="Ex: 62999999999"
                value={notifSettings.whatsappNumber}
                onChange={(e) => setNotifSettings({...notifSettings, whatsappNumber: e.target.value.replace(/\D/g, '')})}
                style={{ width: '100%', maxWidth: '300px', padding: '0.8rem', borderRadius: '8px', border: `1px solid var(--t-field-border)`, background: isDark ? 'rgba(0,0,0,0.4)' : 'var(--white)', color: isDark ? 'var(--white)' : 'var(--black)' }}
              />
            </div>

            {/* SEÇÃO 2: HORÁRIOS FIXOS */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-light)'}`, marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? 'var(--gold)' : '#2c3e50', fontSize: '1.1rem' }}>
                <Clock size={20} /> Rotina Diária
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--t-text)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={notifSettings.alerts.dailyVirtue} onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, dailyVirtue: e.target.checked}})} style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }} />
                    Lembrete do Prólogo (Manhã)
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--t-text-soft)' }}>Enviado às 08:00</span>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--t-text)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={notifSettings.alerts.dailyEpilogue} onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, dailyEpilogue: e.target.checked}})} style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }} />
                    Lembrete do Epílogo (Noite)
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--t-text-soft)' }}>Enviado às 20:00</span>
                </label>
              </div>
              <p style={{ margin: '1rem 0 0', fontSize: '0.8rem', color: 'var(--t-text-soft)', fontStyle: 'italic' }}>
                Se você já tiver feito aquela parte do dia, o lembrete não é enviado.
              </p>
            </div>

            {/* SEÇÃO 3: ALERTAS CONDICIONAIS */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'var(--border-light)'}`, marginBottom: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: isDark ? 'var(--gold)' : '#2c3e50', fontSize: '1.1rem' }}>
                <ShieldAlert size={20} /> Guardião de Disciplina
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--t-text-soft)', marginBottom: '1rem' }}>O Guardião avisa quando você está deixando a inércia vencer. Os avisos chegam junto com a mensagem das 20:00.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { id: 'pendingTasks', label: 'Avisar sobre as Tarefas Agendadas de hoje (de manhã) e as que ficaram pendentes (à noite)' },
                  { id: 'readingSlump', label: 'Avisar se eu ficar +3 dias sem avançar nas Leituras' },
                  { id: 'practiceSlump', label: 'Avisar se eu ficar +3 dias sem registrar Práticas' },
                  { id: 'diarySlump', label: 'Avisar se eu ficar +3 dias sem preencher o Diário' },
                  { id: 'gdveWarning', label: 'Avisar faltando 1 semana para a reunião do GDVE (se leitura pendente)' },
                  { id: 'randomVirtue', label: 'Lembrar a Virtude e a intenção do dia na mensagem da noite' },
                  { id: 'groupActivity', label: 'Avisar quando alguém do meu Grupo de Estudo (GDVE) concluir uma tarefa' }
                ].map(alert => (
                  <label key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--t-text)', fontSize: '0.95rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={notifSettings.alerts[alert.id]} 
                      onChange={(e) => setNotifSettings({...notifSettings, alerts: {...notifSettings.alerts, [alert.id]: e.target.checked}})} 
                      style={{ accentColor: 'var(--gold)', width: '18px', height: '18px', cursor: 'pointer' }} 
                    />
                    {alert.label}
                  </label>
                ))}
              </div>
            </div>

            {/* BOTÃO SALVAR INTELIGENTE */}
            <button 
              onClick={saveNotificationSettings}
              disabled={saveBtnStatus !== 'idle'}
              style={{ 
                width: '100%', padding: '1rem', 
                background: saveBtnStatus === 'success' ? '#27ae60' : 'var(--t-accent)', 
                color: saveBtnStatus === 'success' ? 'white' : 'var(--t-surface)', 
                border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', 
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', 
                cursor: saveBtnStatus !== 'idle' ? 'default' : 'pointer', 
                boxShadow: saveBtnStatus === 'success' ? '0 4px 15px rgba(39, 174, 96, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease' 
              }}
            >
              {saveBtnStatus === 'saving' ? <Sparkles className="animate-spin" size={20} /> : (saveBtnStatus === 'success' ? <CheckCircle size={20} /> : <Save size={20} />)} 
              {saveBtnStatus === 'saving' ? 'Salvando...' : (saveBtnStatus === 'success' ? 'Guardião Atualizado!' : 'Salvar Configurações')}
            </button>
          </div>
  );
}
