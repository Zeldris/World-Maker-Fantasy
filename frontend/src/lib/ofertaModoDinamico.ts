import type { LogEntry, MetodoObtencion } from '../types'
import { iconoRecurso } from './recursoAccion'

// Tarjeta de un encuentro («modo dinámico», 2026-08-27): sus textos y sus acciones, en un solo sitio
// para el registro (`LogPanel`) y para el mapa de zona (ZON-5, hito 0.2: la tarjeta sale también
// pegada a la ficha del encuentro, sin cerrar el mapa).
//
// «Interactuar» abre el mini-flujo (DynamicModeModal) para NPC/FAUNA; un RECURSO abre su modal de
// detalle (RecursoDetalleModal), cuyo botón hace la recolección. «Ignorar» solo limpia la tarjeta.
// Un agresivo que te corta el paso no se ignora: Interactuar lleva a combatir o, si lo viste tú
// primero, a huir. Orden pedido: Interactuar / (Responder) / Cazar / Ignorar.

export type OfertaModoDinamico = NonNullable<LogEntry['dynamicModeOffer']>

export interface AccionOferta {
  label: string
  onClick: () => void
  tone: 'primary' | 'danger' | 'accent' | 'neutral'
  disabled?: boolean
}

export interface ManejadoresOferta {
  onInteractuarModoDinamico?: (
    entryId: string,
    tipo: 'NPC' | 'FAUNA',
    targetSlug: string,
    targetName: string,
    quienInicia?: 'jugador' | 'npc',
    combateForzado?: boolean,
    zonePointId?: string,
    cantidad?: number,
  ) => void
  onResponderEscribiendo?: (targetName: string) => void
  onVerRecursoDetalle?: (entryId: string, targetSlug: string, targetName: string, metodo?: MetodoObtencion | null) => void
  onCazarEnZona?: (entryId: string, zonePointId: string) => void
  onDismissDynamicModeOffer?: (entryId: string) => void
}

export interface PresentacionOferta {
  tone: 'accent2' | 'danger'
  icon: string
  title: string
  subtitle: string
  warning?: { nivel: 'alto' | 'mortal'; text: string }
  error?: string
  actions: AccionOferta[]
}

export function presentacionOferta(entryId: string, offer: OfertaModoDinamico, h: ManejadoresOferta): PresentacionOferta {
  // Grupos de fauna reales (Fase 1, 2026-09-28) — «Un grupo de N {nombre}» cuando el punto
  // colisionado representa más de un individuo (nunca NPC/RECURSO, que no se agrupan).
  const nombre = offer.tipo === 'FAUNA' && (offer.cantidad ?? 1) > 1 ? `Un grupo de ${offer.cantidad} ${offer.targetName}` : offer.targetName
  return {
    tone: offer.combateForzado ? 'danger' : 'accent2',
    icon: offer.combateForzado ? '⚔️' : offer.tipo === 'RECURSO' ? iconoRecurso(offer.metodo) : '💬',
    title: offer.combateForzado ? `${nombre} te corta el paso` : offer.tipo === 'RECURSO' ? `${nombre} a la vista` : `${nombre} busca tu atención`,
    subtitle: offer.combateForzado
      ? 'No parece dispuesto a dejarte pasar.'
      : offer.tipo === 'NPC'
        ? 'Puedes hablar con esta persona.'
        : offer.tipo === 'RECURSO'
          ? 'Hay algo cerca que podrías recolectar.'
          : 'Hay algo cerca con lo que puedes interactuar.',
    warning:
      offer.riesgoCaza && offer.riesgoCaza.riesgo !== 'bajo' && (offer.combateForzado || offer.tipo === 'FAUNA')
        ? {
            nivel: offer.riesgoCaza.riesgo,
            // QA-27 P27: si te cortan el paso, el riesgo es de pelear, no de cazar.
            text: `${
              offer.combateForzado
                ? offer.riesgoCaza.riesgo === 'mortal'
                  ? 'Pelear puede matarte en un solo turno.'
                  : 'Pelear es peligroso.'
                : offer.riesgoCaza.riesgo === 'mortal'
                  ? 'Cazar esto puede matarte en un solo turno.'
                  : 'Cazar esto es peligroso.'
            } ${offer.riesgoCaza.motivo}`.trim(),
          }
        : undefined,
    error: offer.error,
    actions: [
      {
        label: offer.busy ? 'Interactuando...' : 'Interactuar',
        tone: 'primary',
        disabled: offer.busy,
        onClick: () =>
          offer.tipo === 'RECURSO'
            ? h.onVerRecursoDetalle?.(entryId, offer.targetSlug, offer.targetName, offer.metodo)
            : h.onInteractuarModoDinamico?.(entryId, offer.tipo, offer.targetSlug, offer.targetName, offer.quienInicia, offer.combateForzado, offer.zonePointId, offer.cantidad),
      },
      // Responder escribiendo (2026-10-02) — solo personas (NPC), también si te cortan el paso.
      ...(offer.tipo === 'NPC' && h.onResponderEscribiendo
        ? [{ label: '✍️ Responder', tone: 'accent' as const, disabled: offer.busy, onClick: () => h.onResponderEscribiendo!(offer.targetName) }]
        : []),
      // Cazar desde la tarjeta (Fase 2, 2026-09-28) — solo FAUNA no forzada con el `zonePointId` real
      // del grupo con el que se ha chocado.
      ...(offer.tipo === 'FAUNA' && offer.zonePointId && !offer.combateForzado
        ? [{ label: offer.busy ? 'Cazando...' : 'Cazar', tone: 'primary' as const, disabled: offer.busy, onClick: () => h.onCazarEnZona?.(entryId, offer.zonePointId!) }]
        : []),
      ...(offer.combateForzado ? [] : [{ label: 'Ignorar', tone: 'neutral' as const, disabled: offer.busy, onClick: () => h.onDismissDynamicModeOffer?.(entryId) }]),
    ],
  }
}
