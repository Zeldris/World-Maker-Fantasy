import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { getZona, moverEnZona, type ZonaResponse } from '../lib/api'
import { MS_POR_PASO_MOVIMIENTO } from '../components/zona/MarcadoresZona'
import type { LogEntry } from '../types'

// ZON-80 (hito 0.2) — el bucle de pasos del mapa de zona, sacado de `ZonaPanel.tsx` tal cual: pide
// un paso al backend con el mismo destino hasta llegar, toparse con algo o que un clic nuevo lo
// cancele. Aquí entran después parar, la velocidad y pedir el siguiente paso mientras se anima
// (ZON-35, ZON-36, ZON-38).
export interface OpcionesMovimientoZona {
  saveId: string
  setData: Dispatch<SetStateAction<ZonaResponse | null>>
  bloqueoMovimiento?: string | null
  onEncuentroZona?: (logEntry: LogEntry) => void
  onClose?: () => void
  onOfertaDescartada?: () => void
  onHoraActualizada?: (fictionalDateLabel: string) => void
}

export function useMovimientoZona({ saveId, setData, bloqueoMovimiento = null, onEncuentroZona, onClose, onOfertaDescartada, onHoraActualizada }: OpcionesMovimientoZona) {
  // Sistema de movimiento por cuadrícula (2026-09-08) — mensaje simple de colisión/aviso ("por
  // ahora, acabaremos metiendo una animación" — placeholder consciente hasta que Franja 3 conecte
  // esto con combate/Interactuar real). `movimientoEnCurso` deshabilita nuevos clics mientras se
  // anima el trayecto actual, para no solapar dos llamadas al backend a la vez.
  const [mensajeMovimiento, setMensajeMovimiento] = useState<string | null>(null)
  const [movimientoEnCurso, setMovimientoEnCurso] = useState(false)
  // Token de cancelación (2026-09-08) — si el jugador clica un destino NUEVO a mitad de la
  // animación del anterior, el bucle en curso debe parar de seguir pidiendo pasos del trayecto
  // viejo; comparar contra el token actual en cada iteración es más simple que cancelar promesas.
  const movimientoTokenRef = useRef(0)
  // Sistema de movimiento por cuadrícula (2026-09-08) — clic en el lienzo (fondo o pin) pide el
  // destino real en píxel; el backend calcula el camino entero pero solo avanza UN PASO por
  // llamada (mismo criterio "el motor decide, el frontend solo pide"), así que aquí se sigue
  // llamando con el MISMO destino hasta agotar `caminoRestante` o toparse con `colision`/`aviso`.
  //
  // Devuelve la zona recién recargada si el trayecto terminó sin interrupción (llegó al destino),
  // `null` si lo cortó un encuentro, un error o un clic nuevo. Recargar al llegar (2026-09-28, bug
  // real jugando en vivo con Playwright): `salidas[].alcanzable` solo se calculaba al abrir el
  // panel — tras caminar hasta una salida, pulsarla seguía diciendo "Tienes que acercarte más"
  // hasta cerrar y reabrir el modal.
  async function moverA(destino: { x: number; y: number }): Promise<ZonaResponse | null> {
    if (bloqueoMovimiento) {
      setMensajeMovimiento(bloqueoMovimiento)
      return null
    }
    const miToken = ++movimientoTokenRef.current
    setMovimientoEnCurso(true)
    setMensajeMovimiento(null)
    let llegado = false
    try {
      let sigue = true
      while (sigue && movimientoTokenRef.current === miToken) {
        const resultado = await moverEnZona(saveId, destino)
        if (movimientoTokenRef.current !== miToken) break // cancelado por un clic nuevo mientras esperaba
        if (resultado.ofertaDescartada) onOfertaDescartada?.()
        if (resultado.fictionalDateLabel) onHoraActualizada?.(resultado.fictionalDateLabel)
        // Sincronización real del mundo (2026-09-09, bug real: "los elementos se mueven, pero no...
        // a la vez que muevo yo") — el backend ya movió la fauna/NPC este mismo paso
        // (`avanzarZonePointsUnPaso`); se fusiona aquí sobre `puntos` para que se anime en el mismo
        // ritmo que el propio marcador del jugador, en vez de esperar a un refetch completo.
        setData((prev) => {
          if (!prev) return prev
          const puntos =
            resultado.zonePointsMovidos.length > 0
              ? prev.puntos.map((p) => {
                  const movido = resultado.zonePointsMovidos.find((m) => m.id === p.id)
                  return movido ? { ...p, x: movido.x, y: movido.y } : p
                })
              : prev.puntos
          return { ...prev, jugador: resultado.jugador, puntos }
        })
        if (resultado.colision) {
          setMensajeMovimiento(`Te topas con ${resultado.colision.targetName}.`)
          // Conexión real con Interactuar (2026-09-09) — la colisión con un NPC/fauna no agresivo
          // ya dejó `pendingDynamicModeOffer` real en el backend, con su propio LogEntry
          // determinista (`resultado.logEntry`, shape mínimo) — se combina con `dynamicModeOffer`
          // (mismo campo que ya lee `LogPanel.tsx` para pintar la tarjeta) y se inserta directo en
          // el log de personaje, sin recargar la partida entera.
          if (resultado.dynamicModeOffer && resultado.logEntry) {
            onEncuentroZona?.({
              id: resultado.logEntry.id,
              channel: 'character',
              text: resultado.logEntry.text,
              timeLabel: resultado.logEntry.timeLabel,
              createdAt: resultado.logEntry.createdAt,
              // Fase 10 (2026-09-29) — la tirada opuesta "¿quién ve a quién primero?" viaja en la entrada.
              roll: resultado.logEntry.roll,
              dynamicModeOffer: { ...resultado.dynamicModeOffer, busy: false },
            })
            // Cierra el modal de movimiento (2026-09-09) — sin esto la tarjeta de Interactuar
            // quedaba insertada en el log DETRÁS del propio modal, invisible/inaccesible hasta que
            // el jugador lo cerrara a mano sin saber por qué.
            onClose?.()
          } else if (resultado.colision.temperamento === 'AGRESIVO' && resultado.logEntry) {
            // Bug real jugando en vivo (2026-09-15): un AGRESIVO en la misma celda cerraba el modal
            // sin dejar ningún rastro — el jugador no sabía que debía reaccionar. El backend ya deja
            // un LogEntry propio para este caso (sin dynamicModeOffer, no aplica a un agresivo);
            // se inserta igual que el resto y se cierra el modal para que el jugador vea el aviso y
            // pueda escribir su acción de inmediato.
            onEncuentroZona?.({
              id: resultado.logEntry.id,
              channel: 'character',
              text: resultado.logEntry.text,
              timeLabel: resultado.logEntry.timeLabel,
              createdAt: resultado.logEntry.createdAt,
            })
            onClose?.()
          }
          sigue = false
        } else if (resultado.dynamicModeOffer && resultado.logEntry) {
          // Encuentro con un RECURSO (2026-09-28, bug real jugando en vivo) — el backend deja la
          // oferta y su LogEntry sin `colision` (un recurso nunca es un encuentro de combate), y
          // esta rama no existía: el trayecto seguía y la tarjeta "X a la vista" solo aparecía
          // tras recargar la página. Mismo tratamiento que la oferta de una colisión de arriba.
          setMensajeMovimiento(`Encuentras ${resultado.dynamicModeOffer.targetName}.`)
          onEncuentroZona?.({
            id: resultado.logEntry.id,
            channel: 'character',
            text: resultado.logEntry.text,
            timeLabel: resultado.logEntry.timeLabel,
            createdAt: resultado.logEntry.createdAt,
            roll: resultado.logEntry.roll,
            dynamicModeOffer: { ...resultado.dynamicModeOffer, busy: false },
          })
          onClose?.()
          sigue = false
        } else if (resultado.caminoRestante.length === 0) {
          sigue = false
          llegado = true
        } else {
          await new Promise((r) => setTimeout(r, MS_POR_PASO_MOVIMIENTO))
        }
      }
    } catch (err) {
      // El backend explica por qué no (p.ej. un agresivo que te corta el paso, 409) — mostrarlo.
      if (movimientoTokenRef.current === miToken) setMensajeMovimiento(err instanceof Error && err.message ? err.message : 'No se pudo mover — inténtalo de nuevo.')
    } finally {
      if (movimientoTokenRef.current === miToken) setMovimientoEnCurso(false)
    }
    if (!llegado || movimientoTokenRef.current !== miToken) return null
    const fresca = await getZona(saveId).catch(() => null)
    if (fresca && movimientoTokenRef.current === miToken) setData(fresca)
    return fresca
  }

  return { moverA, movimientoEnCurso, mensajeMovimiento, setMensajeMovimiento }
}
