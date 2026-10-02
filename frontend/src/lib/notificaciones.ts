import type { LogEntry } from '../types'

// HUD-6 (hito 0.2, roadmap-front.md) — notificaciones (toasts): pila arriba a la derecha con el
// borde por tipo. Aquí la parte pura: qué avisos salen de una entrada del registro y cómo se
// agrupan los repetidos.

/// quest = misión · moss = logro u objeto obtenido · danger = peligro · accent = sistema ·
/// accent2 = mundo vivo.
export type TipoNotificacion = 'quest' | 'moss' | 'danger' | 'accent' | 'accent2'

export interface NuevaNotificacion {
  tipo: TipoNotificacion
  icono: string
  texto: string
}

export interface Notificacion extends NuevaNotificacion {
  id: number
  /// Cuántas veces ha llegado la misma (se enseña «×N»).
  veces: number
}

export const MAX_NOTIFICACIONES = 4

/// Añade una notificación a la pila. Si ya hay una igual (mismo tipo y texto), sube su contador y
/// pasa arriba en vez de repetirla. Como mucho `MAX_NOTIFICACIONES`; se caen las más viejas.
export function agregarNotificacion(lista: Notificacion[], nueva: NuevaNotificacion, id: number): Notificacion[] {
  const igual = lista.find((n) => n.tipo === nueva.tipo && n.texto === nueva.texto)
  const resto = lista.filter((n) => n !== igual)
  const entrada: Notificacion = igual ? { ...igual, id, veces: igual.veces + 1 } : { ...nueva, id, veces: 1 }
  return [...resto, entrada].slice(-MAX_NOTIFICACIONES)
}

/// Avisos que merece una entrada nueva del registro del personaje.
export function notificacionesDeEntrada(e: LogEntry): NuevaNotificacion[] {
  const avisos: NuevaNotificacion[] = []
  if (e.newQuest) avisos.push({ tipo: 'quest', icono: '🎯', texto: `Misión aceptada: ${e.newQuest.title}` })
  if (e.questCompleted) avisos.push({ tipo: 'quest', icono: '🏆', texto: `Misión completada: ${e.questCompleted.title}` })
  if (e.factionRepChange && e.factionRepChange.delta !== 0) {
    const sube = e.factionRepChange.delta > 0
    avisos.push({
      tipo: sube ? 'moss' : 'danger',
      icono: sube ? '🤝' : '⚠️',
      texto: `Reputación con ${e.factionRepChange.faction} ${sube ? '+' : ''}${e.factionRepChange.delta}`,
    })
  }
  if (e.professionXpGain?.leveledUp) {
    avisos.push({ tipo: 'moss', icono: '🆙', texto: `Oficio de ${e.professionXpGain.oficio} a nivel ${e.professionXpGain.newLevel}` })
  }
  return avisos
}
