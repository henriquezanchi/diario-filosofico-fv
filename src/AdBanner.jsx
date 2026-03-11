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
    // Tiramos a margem daqui para não somar com a caixa de fora
    <div style={{ width: '100%', textAlign: 'center', overflow: 'hidden' }}>
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-4345985055033438" 
           data-ad-slot={slotId}
           data-ad-format="horizontal" /* Mudamos de 'auto' para 'horizontal' para forçar ele a ficar baixinho */
           data-full-width-responsive="true"></ins>
    </div>
  );
}