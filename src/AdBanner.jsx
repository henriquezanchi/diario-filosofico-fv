import React, { useEffect } from 'react';

export default function AdBanner({ slotId }) {
  useEffect(() => {
    try {
      // Evita carregar o mesmo anúncio duas vezes (o React em modo de desenvolvimento faz isso)
      const pushAd = () => {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      };
      
      // Um pequeno atraso garante que o script do Google já carregou
      setTimeout(pushAd, 300);
    } catch (e) {
      console.error("Erro ao carregar o anúncio:", e);
    }
  }, []);

  return (
    <div style={{ margin: '20px 0', textAlign: 'center', overflow: 'hidden', width: '100%' }}>
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-4345985055033438" 
           data-ad-slot={slotId}
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
}