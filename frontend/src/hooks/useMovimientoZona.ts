import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { getZona, moverEnZona, type ZonaResponse } from '../lib/api'
import { esperaAntesDePedir, MS_POR_VELOCIDAD } from '../lib/zonaMovimiento'
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
  /// ZON-36: duración de cada paso según la velocidad elegida en Ajustes (600, 250 o 0 ms).
  msPorPaso?: number
  /// ZON-5 (hito 0.2): si se da, un encuentro con oferta NO cierra el mapa: se avisa aquí (para pintar
  /// la tarjeta junto a la ficha) y el destino se guarda para «Seguir mi camino». Sin él, se cierra
  /// como siempre (`onClose`).
  onEncuentroEnMapa?: (encuentro: { entryId: string; zonePointId?: string }) => void
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useMovimientoZona({ saveId, setData, bloqueoMovimiento = null, onEncuentroZona, onClose, onOfertaDescartada, onHoraActualizada, msPorPaso = MS_POR_VELOCIDAD.normal, onEncuentroEnMapa }: OpcionesMovimientoZona) {
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
  // ZON-35: «Parar» se mira justo antes de pedir cada paso (así el personaje se queda en la celda
  // donde está); el destino se guarda para reanudar. ZON-36: duración del paso del trayecto en curso.
  const pararRef = useRef(false)
  const [destinoPendiente, setDestinoPendiente] = useState<{ x: number; y: number } | null>(null)
  const [msPasoActual, setMsPasoActual] = useState(msPorPaso)
  // ZON-34: lo que queda de la ruta en curso (se va consumiendo a cada paso).
  const [caminoRestante, setCaminoRestante] = useState<{ x: number; y: number }[]>([])
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
  async function moverA(destino: { x: number; y: number }, opciones: { rapido?: boolean } = {}): Promise<ZonaResponse | null> {
    if (bloqueoMovimiento) {
      setMensajeMovimiento(bloqueoMovimiento)
      return null
    }
    const miToken = ++movimientoTokenRef.current
    // ZON-36: doble clic = este trayecto, rápido (nunca más lento que lo elegido).
    const ms = opciones.rapido ? Math.min(msPorPaso, MS_POR_VELOCIDAD.rapida) : msPorPaso
    setMsPasoActual(ms)
    pararRef.current = false
    setDestinoPendiente(destino)
    setMovimientoEnCurso(true)
    setMensajeMovimiento(null)
    let llegado = false
    let parado = false
    // ZON-5: un encuentro mostrado en el mapa corta el trayecto pero conserva el destino.
    let interrumpido = false
    // ZON-38: lo que tardó la última llamada y cuándo empezó la última animación.
    let latencia = 0
    let inicioAnimacion = Number.NEGATIVE_INFINITY
    try {
      let sigue = true
      while (sigue && movimientoTokenRef.current === miToken) {
        const pedido = performance.now()
        const resultado = await moverEnZona(saveId, destino)
        latencia = performance.now() - pedido
        if (movimientoTokenRef.current !== miToken) break // cancelado por un clic nuevo mientras esperaba
        // Si la respuesta llega antes de que acabe la animación anterior, se espera a que acabe para
        // que cada paso se vea entero (sin acelerones).
        const falta = ms - (performance.now() - inicioAnimacion)
        if (falta > 0) await dormir(falta)
        if (movimientoTokenRef.current !== miToken) break
        inicioAnimacion = performance.now()
        setCaminoRestante(resultado.caminoRestante)
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
          // ZON-32: la hora avanza con cada paso (para la hora de llegada de la ruta prevista).
          return { ...prev, jugador: resultado.jugador, puntos, ...(resultado.fictionalMinutes != null ? { fictionalMinutes: resultado.fictionalMinutes } : {}) }
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
            // el jugador lo cerrara a mano sin saber por qué. ZON-5: con la tarjeta en el mapa, ya
            // no hace falta cerrarlo.
            if (onEncuentroEnMapa) {
              onEncuentroEnMapa({ entryId: resultado.logEntry.id, zonePointId: resultado.dynamicModeOffer.zonePointId })
              interrumpido = true
            } else onClose?.()
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
          if (onEncuentroEnMapa) {
            onEncuentroEnMapa({ entryId: resultado.logEntry.id, zonePointId: resultado.dynamicModeOffer.zonePointId })
            interrumpido = true
          } else onClose?.()
          sigue = false
        } else if (resultado.caminoRestante.length === 0) {
          sigue = false
          llegado = true
        } else if (pararRef.current) {
          parado = true
          sigue = false
        } else {
          // ZON-38: el siguiente paso se pide para que llegue justo al terminar esta animación.
          const espera = esperaAntesDePedir(ms, latencia)
          if (espera > 0) await dormir(espera)
          if (pararRef.current) {
            parado = true
            sigue = false
          }
        }
      }
    } catch (err) {
      // El backend explica por qué no (p.ej. un agresivo que te corta el paso, 409) — mostrarlo.
      if (movimientoTokenRef.current === miToken) setMensajeMovimiento(err instanceof Error && err.message ? err.message : 'No se pudo mover — inténtalo de nuevo.')
    } finally {
      if (movimientoTokenRef.current === miToken) {
        setMovimientoEnCurso(false)
        // Parado: el destino queda para reanudar; si no, el trayecto se acabó (llegada, encuentro…).
        if (parado) setMensajeMovimiento('Te detienes.')
        else if (!interrumpido) {
          setDestinoPendiente(null)
          setCaminoRestante([])
        }
      }
    }
    if (!llegado || movimientoTokenRef.current !== miToken) return null
    const fresca = await getZona(saveId).catch(() => null)
    if (fresca && movimientoTokenRef.current === miToken) setData(fresca)
    return fresca
  }

  /// ZON-35: para en la celda donde esté (el destino se guarda para reanudar).
  function parar() {
    if (movimientoEnCurso) pararRef.current = true
  }
  function reanudar() {
    if (!movimientoEnCurso && destinoPendiente) void moverA(destinoPendiente)
  }
  /// Clic derecho: para y olvida el destino.
  function cancelar() {
    pararRef.current = true
    setDestinoPendiente(null)
    setCaminoRestante([])
  }

  return { moverA, movimientoEnCurso, mensajeMovimiento, setMensajeMovimiento, parar, reanudar, cancelar, destinoPendiente, msPasoActual, caminoRestante }
}
