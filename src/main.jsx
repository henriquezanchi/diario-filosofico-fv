import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Anúncios: carregados só depois que o app já está na tela. Os blocos que
// renderizarem antes entram na fila window.adsbygoogle e são preenchidos
// assim que o script chega.
const loadAds = () => {
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4345985055033438';
  document.head.appendChild(script);
};
const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
if (document.readyState === 'complete') whenIdle(loadAds);
else window.addEventListener('load', () => whenIdle(loadAds), { once: true });
