import React, { useEffect, useRef, useState } from 'react';

// Campo de texto que guarda o que está sendo digitado no próprio estado e só
// avisa o App depois de uma pequena pausa (ou ao sair do campo). Assim cada
// tecla redesenha só este campo, e não a tela inteira.
//
// Uso: <DeferredField as="textarea" value={x} onCommit={setX} ... />
export default function DeferredField({ as: Tag = 'textarea', value, onCommit, delay = 300, onBlur, ...rest }) {
  const external = value ?? '';
  const [local, setLocal] = useState(external);
  const lastCommitted = useRef(external);
  const localRef = useRef(external);
  const timer = useRef(null);
  const commitRef = useRef(onCommit);

  useEffect(() => { commitRef.current = onCommit; });

  // O valor mudou por fora (ex: outro dia carregado): adota o novo valor.
  useEffect(() => {
    if (external !== lastCommitted.current) {
      lastCommitted.current = external;
      localRef.current = external;
      setLocal(external);
    }
  }, [external]);

  const flush = () => {
    clearTimeout(timer.current);
    const v = localRef.current;
    if (v !== lastCommitted.current) {
      lastCommitted.current = v;
      commitRef.current(v);
    }
  };

  // Ao sair da tela, entrega o que ainda estava pendente.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tag
      {...rest}
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        localRef.current = v;
        setLocal(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, delay);
      }}
      onBlur={(e) => {
        flush();
        if (onBlur) onBlur(e);
      }}
    />
  );
}
