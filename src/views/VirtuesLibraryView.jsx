import React from 'react';
import { Book, ChevronDown, ChevronUp } from 'lucide-react';
import { virtues } from '../constants/data';

// Biblioteca de Virtudes, exibida abaixo da tela de Leituras.
// Extraído do App.jsx e carregado sob demanda: o código desta tela só é
// baixado quando ela é aberta pela primeira vez.
export default function VirtuesLibraryView({ fvUnlocked, getBlockStyle, getHeaderStyle, isDark, isVirtuesOpen, selectedVirtueDetail, setIsVirtuesOpen, setSelectedVirtueDetail }) {
  return (
    <div className="animate-fadeIn" style={{ marginTop: '2rem' }}>
            <div style={getBlockStyle('partial', isVirtuesOpen, 'var(--t-accent-soft)')}>
              <div onClick={() => setIsVirtuesOpen(!isVirtuesOpen)} style={getHeaderStyle('partial', isVirtuesOpen)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Book size={28} color={'var(--t-accent-soft)'} />
                  <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: 'var(--t-text)', fontFamily: "'Cinzel', serif" }}>
                    {fvUnlocked ? "Virtudes Acropolitanas" : "Biblioteca de Virtudes"}
                  </h2>
                </div>
                {isVirtuesOpen ? <ChevronUp size={24} color={'var(--t-accent-soft)'} /> : <ChevronDown size={24} color={'var(--t-accent-soft)'} />}
              </div>

              {isVirtuesOpen && (
                <div className="animate-fadeIn" style={{ padding: '0 2rem 2rem 2rem' }}>
                  <p style={{ color: 'var(--t-text-muted)', marginBottom: '2rem', fontSize: '1rem', fontStyle: 'italic' }}>
                    Conheça as virtudes que estamos estudando e suas práticas
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {virtues.map((virtue, index) => (
                      <div key={index} onClick={() => setSelectedVirtueDetail(selectedVirtueDetail === virtue.name ? null : virtue.name)} style={{ padding: '1.5rem', background: selectedVirtueDetail === virtue.name ? (isDark ? `${virtue.color}20` : `${virtue.color}15`) : (isDark ? 'rgba(26, 26, 46, 0.4)' : 'rgba(255, 255, 255, 0.8)'), border: `2px solid ${selectedVirtueDetail === virtue.name ? virtue.color : 'var(--t-divider-strong)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.3rem', color: virtue.color, fontFamily: "'Cinzel', serif" }}>{virtue.name}</h3>
                        <p style={{ fontSize: '0.95rem', color: 'var(--t-text-tan)', margin: '0 0 1rem 0', fontStyle: 'italic' }}>{virtue.shortDesc}</p>
                        {selectedVirtueDetail === virtue.name && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid var(--t-divider)` }}>
                            <p style={{ fontSize: '1rem', color: 'var(--t-text)', marginBottom: '1rem', lineHeight: '1.7' }}>{virtue.description}</p>
                            <div style={{ padding: '1rem', background: isDark ? 'rgba(26, 26, 46, 0.6)' : 'rgba(255, 255, 255, 0.5)', borderRadius: '8px' }}>
                              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: virtue.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Práticas Sugeridas:</h4>
                              <p style={{ fontSize: '0.95rem', color: 'var(--t-text-tan)', margin: 0, lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                                {fvUnlocked ? (virtue.internalPractices || virtue.practices) : virtue.practices}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
