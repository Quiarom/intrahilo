import React, { useEffect, useRef } from 'react';

export function ResetDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Native modal supplies keyboard focus containment and an inert background.
    element.showModal();
    return () => {
      element.close();
      const target = opener?.isConnected && !opener.matches(':disabled') ? opener : document.querySelector<HTMLElement>('main h1');
      target?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" aria-describedby="reset-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <p className="eyebrow">ACCIÓN DE DEMO</p><h2 id="reset-title">¿Reiniciar los datos sintéticos?</h2>
    <p id="reset-description">Se reconstruirá la muestra de demostración. Los datos reales no se modifican.</p>
    <div><button className="button secondary" autoFocus onClick={onCancel}>Cancelar</button><button className="button primary" onClick={onConfirm}>Sí, reiniciar demo</button></div>
  </dialog>;
}
