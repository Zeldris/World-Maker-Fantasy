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
/// Celdas de 50 px (`celdaDePixel`, backend `zonaPosicion.ts`).
const mismaCelda = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.floor(a.x / 50) === Math.floor(b.x / 50) && Math.floor(a.y / 50) === Math.floor(b.y / 50)

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
  // P125/P133: lo que se hace al llegar (abrir Desollar, el aviso de una salida…) sigue con el
  // destino: un encuentro por el camino y «Seguir mi camino» ya no lo pierden.
  const alLlegarRef = useRef<((fresca: ZonaResponse) => void) | null>(null)
  // P135: el encuentro salió ya en la casilla de destino; «Seguir mi camino» no vuelve a pedirla
  // (sería pulsar la propia casilla, que ofrece otra vez lo que hay al lado), solo termina el viaje.
  const llegoConEncuentroRef = useRef(false)
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
  async function moverA(destino: { x: number; y: number }, opciones: { rapido?: boolean; alLlegar?: (fresca: ZonaResponse) => void } = {}): Promise<ZonaResponse | null> {
    if (bloqueoMovimiento) {
      setMensajeMovimiento(bloqueoMovimiento)
      return null
    }
    alLlegarRef.current = opciones.alLlegar ?? null
    llegoConEncuentroRef.current = false
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
        // QA-27 (P8, 2026-10-09, jugando): un aviso del backend sin encuentro (p. ej. «ve Colmena
        // de Lebude cerca, pero todavía no sabe aprovecharlo…») solo iba al diario, detrás del mapa
        // abierto: «Acercarte» parecía no hacer nada. Se enseña en el mapa y entra en el diario.
        if (resultado.logEntry && !resultado.colision && !resultado.dynamicModeOffer) {
          setMensajeMovimiento(resultado.logEntry.text)
          onEncuentroZona?.({
            id: resultado.logEntry.id,
            channel: 'character',
            text: resultado.logEntry.text,
            timeLabel: resultado.logEntry.timeLabel,
            createdAt: resultado.logEntry.createdAt,
          })
        }
        if (resultado.colision) {
          // QA-59 (P102, P103): la frase del backend, que lleva artículo, número y quién vio a quién;
          // la de aquí decía «Te topas con Orca desconocida» aunque la orca se hubiera acercado antes.
          // Sin entrada (ya había otra oferta abierta), el aviso de antes sigue valiendo.
          if (resultado.logEntry) setMensajeMovimiento(resultado.logEntry.text)
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
              llegoConEncuentroRef.current = resultado.llegado ?? mismaCelda(resultado.jugador, destino)
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
          setMensajeMovimiento(resultado.logEntry.text)
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
            llegoConEncuentroRef.current = resultado.llegado ?? mismaCelda(resultado.jugador, destino)
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
          if (!llegado) alLlegarRef.current = null
        }
      }
    }
    if (!llegado || movimientoTokenRef.current !== miToken) return null
    return terminarViaje(miToken)
  }

  /// Llegada: zona recién recargada y, si la hay, la acción que esperaba al destino.
  async function terminarViaje(miToken: number): Promise<ZonaResponse | null> {
    const alLlegar = alLlegarRef.current
    alLlegarRef.current = null
    const fresca = await getZona(saveId).catch(() => null)
    if (!fresca || movimientoTokenRef.current !== miToken) return null
    setData(fresca)
    alLlegar?.(fresca)
    return fresca
  }

  /// ZON-35: para en la celda donde esté (el destino se guarda para reanudar).
  function parar() {
    if (movimientoEnCurso) pararRef.current = true
  }
  function reanudar() {
    if (movimientoEnCurso || !destinoPendiente) return
    if (llegoConEncuentroRef.current) {
      llegoConEncuentroRef.current = false
      setDestinoPendiente(null)
      setCaminoRestante([])
      void terminarViaje(movimientoTokenRef.current)
      return
    }
    void moverA(destinoPendiente, { alLlegar: alLlegarRef.current ?? undefined })
  }
  /// Clic derecho: para y olvida el destino.
  function cancelar() {
    pararRef.current = true
    alLlegarRef.current = null
    setDestinoPendiente(null)
    setCaminoRestante([])
  }

  return { moverA, movimientoEnCurso, mensajeMovimiento, setMensajeMovimiento, parar, reanudar, cancelar, destinoPendiente, msPasoActual, caminoRestante }
}
