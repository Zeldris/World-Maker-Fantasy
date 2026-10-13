/// P91/P94 (QA-27): las acciones que arma el juego llevan los nombres entre comillas simples para
/// que el backend las analice («…, contra 'Guchapo'.»). Cuando el texto de la jugadora se repite
/// en algo que se lee (la narración de reserva, el «se pone a ello»), esas comillas sobran. Mismo
/// criterio que `sinComillasSueltas` del frontend: los apóstrofos de los nombres (Vash'grath) no se
/// tocan.
const COMILLAS_QUE_ENVUELVEN = /(^|[\s(,])'([^'\n]+)'(?=[\s.,;:)!?]|$)/g;

export function sinComillasSueltas(texto: string): string {
  return texto.replace(COMILLAS_QUE_ENVUELVEN, '$1$2');
}

/// La acción para citarla entre « »: sin comillas sueltas ni el punto final (que va fuera).
export function accionParaCitar(accion: string): string {
  return sinComillasSueltas(accion).trim().replace(/\.+$/, '');
}
