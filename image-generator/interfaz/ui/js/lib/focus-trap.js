/* Copiado de galivelop-image-generator (MIT), ver ui/LICENSE-GVIG. */
/* Trampa de foco reutilizable: Tab y Mayús+Tab dan la vuelta dentro de `container` (el editor de plantilla y el cajón
   de la cola). Devuelve la función que la quita. */

export const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]';

/** Los elementos enfocables visibles de `container`, en orden. */
export function focusables(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
}

/** Atrapa Tab dentro de `container`. Al salir por el final vuelve al primero y, con Mayús, desde el primero (o desde algo que no es
    enfocable con Tab, como el título) al último. */
export function trapFocus(container) {
  const onKey = (ev) => {
    if (ev.key !== 'Tab') return;
    const nodes = focusables(container);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey && (active === first || !nodes.includes(active))) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && (active === last || !nodes.includes(active))) { ev.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
