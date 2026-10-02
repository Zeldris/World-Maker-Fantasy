import type { LogEntry } from '../types'

/// UX-12 (hito 0.2, roadmap-front-ux.md § 4.3, H10) — qué hacer con lo que llega al registro
/// mientras el cajón de paneles está abierto: lo **crítico** (combate, alguien que te corta el
/// paso) cierra el cajón; lo **importante** (narración nueva, oferta, misión) avisa dentro del
/// cajón; lo **menor** (tu propia acción) no interrumpe.
export type PesoLlegada = 'critico' | 'importante' | 'menor'

export function pesoDeLlegada(e: LogEntry): PesoLlegada {
  if (e.isPlayerAction) return 'menor'
  if (e.combate || e.dynamicModeOffer?.combateForzado) return 'critico'
  return 'importante'
}

/// Texto del aviso para lo importante que ha llegado con el cajón abierto, o null si no hay nada.
export function avisoDeLlegadas(entries: LogEntry[]): string | null {
  const importantes = entries.filter((e) => pesoDeLlegada(e) === 'importante')
  if (importantes.length === 0) return null
  const ultima = importantes[importantes.length - 1]
  const texto =
    ultima.questOffer || ultima.newQuest
      ? 'Te proponen una misión'
      : ultima.dynamicModeOffer || ultima.npcInteractionOffer
        ? 'Algo busca tu atención'
        : 'El narrador ha respondido'
  return importantes.length > 1 ? `${texto} (+${importantes.length - 1} más)` : texto
}
