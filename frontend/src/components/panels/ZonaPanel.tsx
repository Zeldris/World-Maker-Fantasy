import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CapasContext } from '../../context/capasContext'
import { ViajerosAqui } from './ViajerosAqui'
import { getZona, resolveImageUrl, recogerDroppedItem, type ZonaResponse, type ZonePointInfo, type ZonaDinamicoInfo, type ZonaSalidaInfo } from '../../lib/api'
import { ZonePointDetailModal, zonaDinamicoToDetailSource } from '../ZonePointDetailModal'
import { anguloSalida, etiquetaSalida } from '../../lib/rumboSalida'
import { separarEtiquetas } from '../../lib/separarEtiquetas'
import { ZoneGroupDetailModal } from '../ZoneGroupDetailModal'
import { ZonaSalidaModal } from '../ZonaSalidaModal'
import { ParcelaDetailModal } from '../ParcelaDetailModal'
import { DefsFichas, EtiquetaNombre, anclaEtiqueta, cajaEtiqueta, cajaFicha, cajaMarca, etiquetaDeEstandarte, ANCHO_LIENZO_ZONA, ALTO_LIENZO_ZONA } from '../zona/FichaZona'
import { COLOR_HEX, DISPOSICION_LABEL, distanciaEnCeldas, regionControlDisplay, TIPO_LABEL, useEscalaPantalla } from '../../lib/zonaFichas'
import { AnilloInteraccion, GridOverlay, JugadorMarker, ParcelaMarker, SalidaMarker, ZonePointMarker } from '../zona/MarcadoresZona'
import { MS_POR_VELOCIDAD, PasoZonaContext } from '../../lib/zonaMovimiento'
import { useAjustes } from '../../context/useAjustes'
import { celdaDePixel, pixelDeCelda, riesgoDeRuta, rutaPrevista, tePersigue, textoCoste, type Celda } from '../../lib/zonaRuta'
import { MarcaObjetivoMision, BanderaDestino, CeldaResaltada, CeldasEnRiesgo, EtiquetaCoste, LineaRuta, RadioAmenaza, RutaPatrulla } from '../zona/RutaZona'
import { MenuFicha, TarjetaEncuentro, TarjetaFicha, type AccionFicha, type InfoFicha } from '../zona/MenuFicha'
import type { PresentacionOferta } from '../../lib/ofertaModoDinamico'
import { useEnciclopediaLink } from '../../context/useEnciclopediaLink'
import { LeyendaZona } from '../zona/LeyendaZona'
import { useMovimientoZona } from '../../hooks/useMovimientoZona'
import type { LogEntry, ProfessionRecipeInfo, ZonaParcelaInfo } from '../../types'
import { useMisiones } from '../../context/misionesContext'

interface ZonaPanelProps {
  saveId: string
  /// Conexión real con Interactuar (2026-09-09) — inserta el `LogEntry` real del encuentro
  /// (`resultado.logEntry`) en el log de personaje, mismo mecanismo que cualquier otro turno. Sin
  /// esto la tarjeta de oferta quedaba persistida en el backend pero invisible: `LogPanel.tsx`
  /// solo la renderiza colgada de una entrada de log concreta (`entry.dynamicModeOffer`), nunca
  /// leyendo `Save.pendingDynamicModeOffer` directamente.
  onEncuentroZona?: (logEntry: LogEntry) => void
  /// Piezas 2/3 del rediseño de movimiento en Zona (2026-09-09, decisión de Álvaro: "la sección de
  /// Zona en Mapa solo sería para visualizar y no la utilizaríamos para movernos" — el único
  /// movimiento real vive ahora en `ZonaMovimientoModal`, abierto desde el icono de brújula
  /// flotante). `true` = el lienzo deja de responder a clics de movimiento (fondo inerte); los
  /// pines siguen abriendo su modal de detalle igual, eso nunca fue "moverse". Default `false`
  /// (movimiento activo) para no romper ningún otro caller existente sin tocarlo explícitamente.
  soloConsulta?: boolean
  /// Layout de 2 columnas (2026-09-09, petición explícita de Álvaro: "aprovechemos el espacio
  /// horizontal para que se vea tanto la zona como el contenido de la zona en 2 columnas, así no
  /// teniendo que scrollear" — "pero que solo aplique al mapa de moverse [`ZonaMovimientoModal`],
  /// no al de información del botón [tab Mapa/`MapaPanel`], en ese ya hablaremos pero cambiaremos
  /// la distribución pero mantendremos el formato" — MapaPanel.tsx queda pendiente de un rediseño
  /// aparte, sin tocar aquí). `false` (apilado vertical, comportamiento de siempre) es el default
  /// para no romper el caller de MapaPanel.tsx sin tocarlo explícitamente.
  columnasAncho?: boolean
  /// Bug real jugando en vivo (2026-09-09, Álvaro: "el problema es de front... que al saltar el
  /// interactuar no se está cerrando el modal... hasta que respondas todo se bloquea") — una
  /// colisión pacífica dispara `dynamicModeOffer` real (tarjeta de Interactuar insertada en el log
  /// vía `onEncuentroZona`), pero el modal de movimiento seguía abierto ENCIMA, tapándola —
  /// `ZonaMovimientoModal` pasa su propio `onClose` aquí para cerrarse solo en cuanto la oferta
  /// llega, dejando la tarjeta visible y accionable de inmediato. `undefined` en el caller de
  /// MapaPanel.tsx (vista informativa, nunca dispara colisión) — no rompe nada sin tocarlo.
  onClose?: () => void
  /// Iconos de salida de región (2026-09-17) — el modal de salida (`ZonaSalidaModal` más abajo)
  /// arma el mismo texto libre que ya usa `TravelDestinationModal` ("Viajo hacia X."), reutilizando
  /// el motor de viaje determinista existente (`resolveTravel`, turnResolution.ts) sin duplicar
  /// ninguna lógica de viaje nueva — decisión explícita de Álvaro. `undefined` en el caller de
  /// MapaPanel.tsx (vista informativa, no ofrece viajar desde ahí) — no rompe nada sin tocarlo.
  onViajarA?: (actionText: string) => void
  /// UX-3 (hito 0.1) — motivo por el que ahora no se puede lanzar un turno (narrador escribiendo,
  /// ocupado…); `null`/ausente = libre. Deshabilita los botones que mandan una acción al turno.
  bloqueoTurno?: string | null
  /// UX-7 (hito 0.2) — motivo de `canDo(fase, 'moverse')` si ahora no se puede andar ni recoger
  /// (narrador escribiendo, encuentro, combate…). El mapa se sigue viendo; el paso no sale.
  bloqueoMovimiento?: string | null
  /// Icono de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — construir es DIRECTO,
  /// sin pasar por `onViajarA`/`/turn/narrate` (mismo criterio que "Descansar en campamento"). El
  /// roster estático de recetas (ya cargado una vez en GameView.tsx vía `useRecipesData`) resuelve
  /// nombre/descripción por `recipeKey`; `onRefreshSave` recarga Save/Zona tras construir con
  /// éxito. Ambos `undefined` en el caller de MapaPanel.tsx (vista informativa) dejan el modal sin
  /// poder construir — la parcela se sigue viendo, solo sin acción real, hasta decidir si esa vista
  /// también debe ofrecer construir.
  professionRecipes?: ProfessionRecipeInfo[]
  onRefreshSave?: () => Promise<void>
  /// Un paso real descartó una oferta pacífica sin responder (2026-09-28) — el caller retira esa
  /// tarjeta del log para que no quede un "Interactuar" que el backend ya no reconoce.
  onOfertaDescartada?: () => void
  /// F9-2 (2026-09-29) — el paso avanza el reloj (B2): el backend devuelve la hora nueva y la
  /// cabecera del juego se actualiza en cada paso, sin esperar al siguiente turno.
  onHoraActualizada?: (fictionalDateLabel: string) => void
  /// Cadáveres en el mapa (Fase 5, 2026-09-28) — abren el modal real de Saquear/Desollar (en
  /// GameView). `undefined` en la vista informativa: el pin se ve, sin acción.
  onSaquearCadaver?: (npcSlug: string) => void
  onDesollarCadaver?: (npcSlug: string) => void
  /// ZON-5 (hito 0.2): textos y acciones de la oferta de un encuentro (de su entrada del registro), para
  /// pintarla junto a la ficha sin cerrar el mapa; null cuando ya no hay oferta (ignorada, resuelta).
  /// Sin él, un encuentro cierra el mapa como siempre.
  ofertaEnMapa?: (entryId: string) => PresentacionOferta | null
}

/// ZON-19 (hito 0.1) — a esta distancia del personaje (2,5 celdas de 50 unidades) los nombres se ven sin
/// pasar el ratón.
const DISTANCIA_NOMBRE_VISIBLE = 125

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25, docs/rpgtarkor/lore-mundo/mundo-determinista.md) —
/// zonas navegables, PROTOTIPO en una sola zona (La Hondonada del Eco) antes de repetir en el
/// resto. Deliberadamente simple: solo muestra DÓNDE vive algo dentro de la zona actual (posición
/// real + nombre real de catálogo), nunca decide disponibilidad — eso es trabajo de las Capas 2-3
/// del documento, construidas encima de esto. Lienzo 800×600, misma convención que el mapa de
/// mundo (`InteractiveMap.tsx`) para poder reutilizar el mismo criterio de overlay SVG.
///
/// Sub-tab dentro del panel Mapa, no pestaña de nivel superior (2026-08-27, auditoría de diseño/UX
/// § 1.1: primero se quitó de `NavTabs.ts` por sentirse "un callejón sin salida en el 95% de las
/// ubicaciones" al vivir embebida siempre visible en Mapa; misma tarde, petición explícita: "quiero
/// que en la misma sección de Mapa el botón, al darle dentro directamente se vea la zona primero y
/// que sean dos tabs, para ver la zona y el mapa" — Zona vuelve a ser una vista de pleno derecho,
/// pero DENTRO del mismo botón/sección Mapa de siempre, alternable con un tab "Mapa" al lado, ver
/// MapaPanel.tsx). Al ser ahora su propia vista (no una subsección silenciosa), si no hay datos de
/// zona para la ubicación actual SÍ explica por qué está vacía, en vez de `null` como antes.




/// Punto del lienzo (viewBox 800×600) bajo un clic: el SVG se escala con CSS, así que `clientX/Y`
/// se pasan a coordenadas reales con la matriz de pantalla.
function puntoDelLienzo(e: { currentTarget: SVGSVGElement; clientX: number; clientY: number }): { x: number; y: number } | null {
  const svg = e.currentTarget
  const punto = svg.createSVGPoint()
  punto.x = e.clientX
  punto.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const local = punto.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

/// QA-27 (P6): la salida que está en la misma casilla que el jugador, si la hay y si `celda` es esa
/// casilla. Sin esto, quien queda encima de una salida no puede pulsarla (su ficha la tapa).
export function salidaEnCasillaDelJugador(data: Pick<ZonaResponse, 'jugador' | 'salidas'> | null, celda: Celda): ZonaSalidaInfo | null {
  if (!data?.jugador) return null
  const delJugador = celdaDePixel(data.jugador)
  if (delJugador.col !== celda.col || delJugador.row !== celda.row) return null
  return data.salidas.find((s) => { const c = celdaDePixel(s); return c.col === celda.col && c.row === celda.row }) ?? null
}

export function ZonaPanel({ saveId, onEncuentroZona, soloConsulta = false, columnasAncho = false, onClose, onViajarA, professionRecipes, onRefreshSave, onOfertaDescartada, onHoraActualizada, onSaquearCadaver, onDesollarCadaver, bloqueoTurno, bloqueoMovimiento = null, ofertaEnMapa }: ZonaPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ZonaResponse | null>(null)
  // ZON-11 (hito 0.1) — unidades del lienzo por píxel de pantalla: las fichas miden siempre lo mismo.
  const { ref: svgRef, escala } = useEscalaPantalla(ANCHO_LIENZO_ZONA)
  // ZON-14 (hito 0.1) — hacia dónde mira la ficha del personaje: el ángulo del último paso real.
  const [anguloJugador, setAnguloJugador] = useState<number | null>(null)
  // ZON-19 (hito 0.1) — nombre visible: lo cercano al personaje (≤ 2,5 celdas), lo seleccionado y lo
  // que está bajo el ratón.
  const [claveBajoRaton, setClaveBajoRaton] = useState<string | null>(null)
  // ZON-62 (hito 0.1) — cuadrícula: fijada con el botón del mapa o mientras se mantiene Alt.
  const [cuadriculaFijada, setCuadriculaFijada] = useState(false)
  // ZON-30/31: celda bajo el cursor (para resaltarla y prever la ruta hasta ella).
  const [celdaCursor, setCeldaCursor] = useState<Celda | null>(null)
  const [altPulsado, setAltPulsado] = useState(false)
  useEffect(() => {
    const abajo = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPulsado(true)
    }
    const arriba = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPulsado(false)
    }
    const soltar = () => setAltPulsado(false)
    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      window.removeEventListener('blur', soltar)
    }
  }, [])
  const posJugadorAnteriorRef = useRef<{ x: number; y: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Modal de detalle (2026-09-04) — comparte un mismo modal entre ZonePoint reales (`puntos`) y
  // dinámicos (`dinamicos`, sin ZonePoint sembrado), vía `zonaDinamicoToDetailSource`.
  const [selectedPoint, setSelectedPoint] = useState<ZonePointInfo | ZonaDinamicoInfo | null>(null)
  // Compañero de fauna con nombre propio en el mismo punto que su dueño (C10, 2026-09-13) —
  // estado de selección SEPARADO del normal: un punto con `companion` abre `ZoneGroupDetailModal`
  // (desglose de ambas entidades) en vez del modal de un solo NPC.
  const [selectedGroup, setSelectedGroup] = useState<ZonePointInfo | null>(null)
  // ZON-41: menú pegado a la ficha pulsada (el modal de arriba queda como «Ver ficha completa»).
  const [menuFicha, setMenuFicha] = useState<{ clave: string; punto: ZonePointInfo | ZonaDinamicoInfo } | null>(null)
  const { enciclopediaIndex, onEntityDetail } = useEnciclopediaLink()
  // Icono de salida de región (2026-09-17) — abre `ZonaSalidaModal`, distinto del resto (nunca
  // dispara movimiento/colisión, es puramente informativo hasta que se pulsa "Viajar").
  const [selectedSalida, setSelectedSalida] = useState<ZonaSalidaInfo | null>(null)
  // Icono de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — abre
  // `ParcelaDetailModal`, mismo criterio que `selectedSalida` (puramente informativo hasta que se
  // pulsa "Construir", nunca dispara movimiento/colisión).
  const [selectedParcela, setSelectedParcela] = useState<ZonaParcelaInfo | null>(null)
  // CR-40 (40g): abrir el tablón de avisos (lo provee GameView; sin él, no sale el botón).
  const misiones = useMisiones()
  const jugadorX = data?.jugador?.x
  const jugadorY = data?.jugador?.y
  useEffect(() => {
    if (jugadorX == null || jugadorY == null) return
    const anterior = posJugadorAnteriorRef.current
    if (anterior && (anterior.x !== jugadorX || anterior.y !== jugadorY)) {
      setAnguloJugador((Math.atan2(jugadorY - anterior.y, jugadorX - anterior.x) * 180) / Math.PI)
    }
    posJugadorAnteriorRef.current = { x: jugadorX, y: jugadorY }
  }, [jugadorX, jugadorY])
  function nombreVisible(clave: string, punto: { x: number; y: number }, seleccionado: boolean): boolean {
    if (seleccionado || claveBajoRaton === clave) return true
    if (jugadorX == null || jugadorY == null) return false
    return Math.hypot(punto.x - jugadorX, punto.y - jugadorY) <= DISTANCIA_NOMBRE_VISIBLE
  }

  // ZON-5: el encuentro que se está mostrando en el mapa (su entrada del registro y, si la hay, su ficha).
  const [encuentroMapa, setEncuentroMapa] = useState<{ entryId: string; zonePointId?: string } | null>(null)
  // ZON-36: velocidad de paso de Ajustes; ZON-35: parar, reanudar y cancelar.
  const { ajustes } = useAjustes()
  const {
    moverA: handleMoverA, movimientoEnCurso, mensajeMovimiento, setMensajeMovimiento, parar, reanudar, cancelar, destinoPendiente, msPasoActual, caminoRestante,
  } = useMovimientoZona({
    saveId, setData, bloqueoMovimiento, onEncuentroZona, onClose, onOfertaDescartada, onHoraActualizada, msPorPaso: MS_POR_VELOCIDAD[ajustes.velocidadPasoZona],
    onEncuentroEnMapa: ofertaEnMapa ? setEncuentroMapa : undefined,
  })
  // ZON-5: al volver a andar, la tarjeta del encuentro anterior sobra (alejarse ya la descarta).
  useEffect(() => {
    if (movimientoEnCurso) setEncuentroMapa(null)
  }, [movimientoEnCurso])
  // ZON-35: Espacio para y reanuda (fuera de los campos de texto).
  const pararReanudarRef = useRef<() => void>(() => {})
  pararReanudarRef.current = () => (movimientoEnCurso ? parar() : reanudar())
  useEffect(() => {
    if (soloConsulta) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      pararReanudarRef.current()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [soloConsulta])

  useEffect(() => {
    setLoading(true)
    getZona(saveId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  // P20 y P26 (QA-27): recolectar, hablar o una escena se abren encima del mapa (ZON-5) y lo que
  // cambian (un recurso ya identificado, alguien que se ha ido) no se veía hasta cerrar y reabrir.
  // Cuando el mapa vuelve a ser la capa de arriba, se recarga sin parpadeo.
  const capas = useContext(CapasContext)
  const zonaArriba = !soloConsulta && capas?.superior === 'zona'
  const zonaArribaAntes = useRef(zonaArriba)
  useEffect(() => {
    if (zonaArriba && !zonaArribaAntes.current) {
      getZona(saveId).then(setData).catch(() => {})
      // El aviso de antes («Te topas con Alguien») ya no vale tras lo que pasó encima.
      if (!movimientoEnCurso) setMensajeMovimiento(null)
    }
    zonaArribaAntes.current = zonaArriba
  }, [zonaArriba, saveId, movimientoEnCurso, setMensajeMovimiento])

  // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — tras recoger uno, el pin debe
  // desaparecer del mapa sin esperar a que el jugador cambie de pestaña y vuelva.
  async function handleRecoger(droppedItemId: string) {
    if (bloqueoMovimiento) {
      setMensajeMovimiento(bloqueoMovimiento)
      return
    }
    await recogerDroppedItem(saveId, droppedItemId)
    getZona(saveId).then(setData).catch(() => {})
  }

  // B3 (pruebas 2026-09-28) — "Ir hasta aquí" desde la ficha de un pin. Solo con movimiento real
  // (no en la vista informativa) y si el jugador no está ya pegado al pin.
  function irHastaPin(pin: { x: number; y: number }): (() => void) | undefined {
    if (soloConsulta) return undefined
    // Fase G del 0.1 (hallazgo G14): pegado ya al pin, la ficha se quedaba sin ninguna acción (ni
    // ir, ni cazar) — tras ignorar un encuentro no había forma de volver a él sin alejarse. Ahora
    // «Acercarte» pulsa la propia casilla, que en el backend vuelve a mirar los encuentros sin
    // silenciar el último (mismo camino que clicar tu casilla en el mapa).
    if (pegadoAPin(pin)) return () => void handleMoverA({ x: data!.jugador!.x, y: data!.jugador!.y })
    return () => void handleMoverA({ x: pin.x, y: pin.y })
  }

  function pegadoAPin(pin: { x: number; y: number }): boolean {
    return !!data?.jugador && Math.abs(data.jugador.x - pin.x) <= 50 && Math.abs(data.jugador.y - pin.y) <= 50
  }

  // Cadáveres en el mapa (Fase 5, 2026-09-28) — mismo patrón que las salidas lejanas
  // (`handleClickSalida`): si el cadáver está lejos, primero camina hasta él; solo si llega sin que
  // un encuentro corte el trayecto, cierra el mapa y abre el modal real de Saquear/Desollar.
  async function accionSobreCadaver(pin: { x: number; y: number }, abrir: () => void) {
    const cerca = !!data?.jugador && Math.abs(data.jugador.x - pin.x) <= 50 && Math.abs(data.jugador.y - pin.y) <= 50
    const alLlegar = () => {
      onClose?.()
      abrir()
    }
    // P125: un encuentro por el camino no pierde la acción; «Seguir mi camino» la hace al llegar.
    if (!cerca && !soloConsulta) await handleMoverA({ x: pin.x, y: pin.y }, { alLlegar })
    else alLlegar()
  }


  // Icono de salida (2026-09-28, mejora de movimiento): lejos de ella, en vez de solo avisar
  // "acércate más", el jugador camina hasta la salida y, si llega sin encuentros por el camino, se
  // abre directamente el modal de viaje. En la vista informativa (`soloConsulta`) no hay
  // movimiento, así que se mantiene el aviso.
  async function handleClickSalida(salida: ZonaSalidaInfo) {
    if (salida.alcanzable) {
      setSelectedSalida(salida)
      return
    }
    if (soloConsulta) {
      setMensajeMovimiento('Tienes que acercarte más a la salida para poder viajar.')
      return
    }
    if (movimientoEnCurso) return
    // P133: igual con una salida: el aviso de viaje se abre al llegar, también tras «Seguir mi camino».
    await handleMoverA(
      { x: salida.x, y: salida.y },
      {
        alLlegar: (fresca) => {
          const salidaFresca = fresca.salidas.find((s) => s.locationId === salida.locationId)
          if (salidaFresca?.alcanzable) setSelectedSalida(salidaFresca)
        },
      },
    )
  }

  // ZON-40/41: lo que dicen la tarjeta y el menú de una ficha, y qué se puede hacer con ella (las
  // mismas acciones que la ficha completa; ninguna nueva).
  function puntoPorClave(clave: string): ZonePointInfo | ZonaDinamicoInfo | null {
    if (!data) return null
    if (clave.startsWith('p:')) return data.puntos.find((p) => p.id === clave.slice(2)) ?? null
    return (data.dinamicos ?? []).find((d) => d.slug === clave.slice(2)) ?? null
  }
  function infoDeFicha(punto: ZonePointInfo | ZonaDinamicoInfo): InfoFicha {
    const detalles = [TIPO_LABEL[punto.tipo], DISPOSICION_LABEL[punto.color]]
    if ('cantidad' in punto && punto.cantidad > 1) detalles.push(`×${punto.cantidad}`)
    if ('companion' in punto && punto.companion) detalles.push(`con ${punto.companion.nombre}`)
    // ZON-16/ZON-58: lo desconocido, agotado o con candado, también en la tarjeta.
    if (!punto.descubierto) detalles.push('sin descubrir')
    if ('agotado' in punto && punto.agotado) detalles.push('agotado por ahora')
    if ('nivelRequerido' in punto && punto.nivelRequerido) detalles.push(`pide nivel ${punto.nivelRequerido} de oficio`)
    if (data?.jugador) {
      const d = distanciaEnCeldas(data.jugador, punto)
      detalles.push(d === 0 ? 'aquí' : `a ${d} ${d === 1 ? 'celda' : 'celdas'}`)
    }
    return { nombre: punto.nombre, detalles }
  }
  function accionesDeFicha(punto: ZonePointInfo | ZonaDinamicoInfo): AccionFicha[] {
    const acciones: AccionFicha[] = []
    const ir = irHastaPin(punto)
    if (ir) acciones.push({ label: pegadoAPin(punto) ? 'Interactuar' : 'Ir hasta aquí', onClick: ir })
    if ('droppedItemId' in punto && punto.droppedItemId) {
      const id = punto.droppedItemId
      acciones.push({ label: 'Recoger', onClick: () => void handleRecoger(id) })
    }
    if ('cadaver' in punto && punto.cadaver) {
      const { npcSlug, saqueable, desollable } = punto.cadaver
      if (saqueable && onSaquearCadaver) acciones.push({ label: 'Saquear', onClick: () => void accionSobreCadaver(punto, () => onSaquearCadaver(npcSlug)) })
      if (desollable && onDesollarCadaver) acciones.push({ label: 'Desollar', onClick: () => void accionSobreCadaver(punto, () => onDesollarCadaver(npcSlug)) })
    }
    const slug = 'targetSlug' in punto ? punto.targetSlug : punto.slug
    const ficha = punto.descubierto ? (enciclopediaIndex.bySlugKey.get(`fauna:${slug}`) ?? enciclopediaIndex.bySlugKey.get(`npc:${slug}`)) : undefined
    if (ficha && onEntityDetail) acciones.push({ label: 'Ver en la Enciclopedia', onClick: () => onEntityDetail(ficha) })
    acciones.push({ label: 'Ver ficha completa', onClick: () => ('companion' in punto && punto.companion ? setSelectedGroup(punto) : setSelectedPoint(punto)) })
    return acciones
  }

  // ZON-19: nombres visibles de las fichas. P92 (QA-27): las etiquetas se apartan en vertical si se
  // pisan. P123: antes que todo, las fichas mismas (con su «×N», anillo o candado), el jugador, los
  // viajeros y las parcelas, como obstáculos fijos, para que ninguna etiqueta, tampoco la de una salida,
  // los tape. Se recalcula solo si cambian la zona, la escala o qué nombres se ven (no a cada hover).
  const etiquetasFichas = data?.disponible
    ? [
        ...data.puntos.map((p) => ({ clave: `p:${p.id}`, x: p.x, y: p.y, nombre: p.nombre, sel: selectedPoint === p || selectedGroup === p })),
        ...(data.dinamicos ?? []).map((d) => ({ clave: `d:${d.slug}`, x: d.x, y: d.y, nombre: d.nombre, sel: selectedPoint === d })),
      ].filter((e) => nombreVisible(e.clave, e, e.sel))
    : []
  const clavesVisibles = etiquetasFichas.map((e) => e.clave).join('|')
  const dyEtiquetas = useMemo(() => {
    if (!data?.disponible) return new Map<string, number>()
    const visibles = new Set(clavesVisibles.split('|'))
    const dinamicosZona = data.dinamicos ?? []
    const nombres = [
      ...data.puntos.map((p) => ({ clave: `p:${p.id}`, x: p.x, y: p.y, nombre: p.nombre })),
      ...dinamicosZona.map((d) => ({ clave: `d:${d.slug}`, x: d.x, y: d.y, nombre: d.nombre })),
    ].filter((e) => visibles.has(e.clave))
    return separarEtiquetas(
      [
        ...data.puntos.map((p) =>
          cajaFicha(`f:p:${p.id}`, p.x, p.y, escala, { cantidad: p.cantidad ?? 1, anillo: !!p.companion || !p.descubierto, candado: p.nivelRequerido !== undefined, agotado: p.agotado }),
        ),
        ...dinamicosZona.map((d) => cajaFicha(`f:d:${d.slug}`, d.x, d.y, escala, { anillo: !d.descubierto })),
        ...(data.jugador ? [cajaMarca('m:jugador', data.jugador.x, data.jugador.y, escala, 22)] : []),
        ...(data.viajeros ?? []).map((v) => cajaMarca(`m:v:${v.id}`, v.x, v.y, escala, 12)),
        ...data.parcelas.map((p) => cajaMarca(`m:pa:${p.id}`, p.x, p.y, escala, 12)),
        ...data.salidas.map((s) => cajaEtiqueta(`s:${s.locationId}`, s.x, s.y, escala, etiquetaDeEstandarte(anguloSalida(s)), etiquetaSalida(s))),
        ...nombres
          .map((e) => cajaEtiqueta(e.clave, e.x, e.y, escala, { x: 0, y: 24, anchor: anclaEtiqueta(e.x, e.nombre, escala) }, e.nombre))
          .sort((a, b) => a.y - b.y),
      ],
      ALTO_LIENZO_ZONA,
    )
  }, [data, escala, clavesVisibles])

  if (loading) return <p className="text-sm italic text-wood-500">Cargando zona...</p>
  if (error) return <p className="text-sm italic text-wood-500">{error}</p>
  if (!data?.disponible) {
    return <p className="text-sm italic text-wood-500">Esta ubicación todavía no tiene una zona explorable — vuelve al mapa con la otra pestaña.</p>
  }

  const imageUrl = resolveImageUrl(data.imageUrl ?? null)
  // ZON-50/ZON-33: hostiles conocidos (el backend solo los marca si ya están descubiertos).
  const hostiles = data.puntos.filter((p) => p.hostil)
  const dinamicos = data.dinamicos ?? []
  // Layout de 2 columnas (2026-09-09) — solo cuando `columnasAncho` (ZonaMovimientoModal): mapa a
  // la izquierda, todo el contenido (control regional/mensaje/leyenda/listas) a la derecha con su
  // propio scroll, para aprovechar el ancho del modal sin tener que scrollear la página entera.
  // `soloConsulta` (MapaPanel.tsx) sigue apilado en vertical, sin tocar su distribución.
  const mapaColumn = (
    <>
      {/* Lienzo de puntos (2026-08-31, bug real: el comentario de esta sección ya decía "imagen
            de fondo y pines son independientes" desde 2026-08-30, pero el código seguía
            condicionando el `<svg>` ENTERO (imagen Y pines) a `imageUrl` — sin PNG subido, los
            `ZonePoint` reales existían en BD pero eran invisibles en el lienzo, solo se veían en
            la lista textual de abajo. Confirmado jugando en vivo con Playwright en el interior de
            Karot Veku, recién sembrado y sin imagen todavía). Ahora el `<svg>` se pinta siempre
            que haya `puntos`, con o sin imagen de fondo — el `<image>` es un elemento más dentro,
            no la condición de todo el bloque. */}
        {/* Punto del jugador en el mapa (2026-09-04) — el `<svg>` se pinta también cuando SOLO hay
            dinámicos o SOLO el jugador (antes solo dependía de `puntos.length`, dejando el mapa
            invisible en zonas sin ningún ZonePoint sembrado pero con NPC/fauna dinámico o con el
            propio marcador del jugador). Mismo criterio extendido a `parcelas` (§ 7.4, 2026-09-21)
            — una zona-interior recién creada (Capital/Cuartel Avanzado) nace sin ZonePoint/
            dinámicos, pero SÍ con Parcelas reales que pintar. */}
        {(data.puntos.length > 0 || dinamicos.length > 0 || data.jugador || data.parcelas.length > 0) && (
          <div className={`relative flex overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60 ${columnasAncho ? 'min-h-0 flex-1 items-center justify-center' : ''}`}>
            <LeyendaZona />
            {/* ZON-62 (hito 0.1, Z11) — cuadrícula bajo demanda: oculta por defecto, visible mientras se
                mantiene Alt o fijada con este botón (para mando/Steam Deck, sin tecla Alt). */}
            <button
              type="button"
              onClick={() => setCuadriculaFijada((v) => !v)}
              aria-pressed={cuadriculaFijada}
              title="Cuadrícula (o mantén Alt)"
              className={`tactile absolute right-2 top-2 z-10 rounded-md border px-2 py-1 text-2xs font-semibold transition-colors ${cuadriculaFijada ? 'border-accent-500 bg-accent-500/20 text-accent-200' : 'border-iron-700 bg-wood-950/85 text-wood-400 hover:text-wood-200'}`}
            >
              <span aria-hidden="true">▦</span> Cuadrícula
            </button>
            {/* Sistema de movimiento por cuadrícula (2026-09-08) — clic en el LIENZO (fondo, no un
                pin) mueve al jugador hacia ese punto; `getScreenCTM().inverse()` convierte la
                coordenada de pantalla del clic a coordenadas reales del viewBox 800×600 (el SVG se
                escala con CSS, `clientX/Y` por sí solos no sirven). Los pines paran la propagación
                (`stopPropagation`) para que clicar uno siga abriendo su modal de detalle, sin
                disparar también un movimiento hacia ese punto.

                Piezas 2/3 (2026-09-09) — con `soloConsulta`, el fondo deja de responder al clic del
                todo (cursor normal, sin `onClick`): esta vista pasa a ser puramente informativa, el
                movimiento real vive solo en `ZonaMovimientoModal`.

                `columnasAncho` (2026-09-09, dos bugs reales seguidos: "se queda cortado" y luego
                "sigue exactamente igual") — `w-full`+`h-full` a la vez ESTIRABA el propio viewport
                del <svg> al tamaño exacto del contenedor rectangular (que nunca es 4:3), deformando
                el marco antes de que `preserveAspectRatio` pudiera actuar (ese atributo solo protege
                el CONTENIDO del viewBox, no las dimensiones CSS del <svg> en sí). El intento
                siguiente (`aspect-ratio` + `maxHeight:100%` en el div) dependía de que TODA la
                cadena de ancestros propagara una altura real por `flex-1`/`min-h-0`, y colapsaba a
                un tamaño pequeño en cuanto un solo eslabón fallaba. Fix real y robusto: `max-h-full
                max-w-full` (nunca `h-full`/`w-full` a la vez) — el navegador calcula el tamaño
                intrínseco del <svg> a partir de su viewBox (800×600, 4:3) y lo limita por AMBOS
                ejes sin forzar ninguno, exactamente el comportamiento de una `<img>` con
                `object-fit: contain`. El div contenedor centra el resultado con flex. */}
            {/* ZON-35: parar y reanudar (también con Espacio). */}
            {!soloConsulta && (movimientoEnCurso || destinoPendiente) && (
              <button
                type="button"
                onClick={movimientoEnCurso ? parar : reanudar}
                className="tactile absolute left-2 top-2 z-10 rounded-md border border-iron-700 bg-wood-950/85 px-2 py-1 text-2xs font-semibold text-wood-200 hover:text-wood-100"
                title={movimientoEnCurso ? 'Parar (Espacio)' : 'Reanudar (Espacio)'}
              >
                {movimientoEnCurso ? '⏸ Parar' : '▶ Reanudar'}
              </button>
            )}
            <PasoZonaContext.Provider value={msPasoActual}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${ANCHO_LIENZO_ZONA} 600`}
              className={`${columnasAncho ? 'max-h-full max-w-full' : 'h-auto w-full'} ${soloConsulta ? '' : bloqueoMovimiento ? 'cursor-not-allowed' : movimientoEnCurso ? 'cursor-wait' : 'cursor-crosshair'}`}
              onClick={
                soloConsulta
                  ? undefined
                  : (e) => {
                      // ZON-41: con el menú de una ficha abierto, el clic fuera solo lo cierra.
                      if (menuFicha) {
                        setMenuFicha(null)
                        return
                      }
                      if (movimientoEnCurso) return
                      const local = puntoDelLienzo(e)
                      if (!local) return
                      // QA-27 (P6): encima de una salida (p. ej. tras cancelar un viaje), la ficha
                      // del jugador tapa el icono; pulsar la propia casilla abre esa salida.
                      const salidaAqui = salidaEnCasillaDelJugador(data, celdaDePixel(local))
                      if (salidaAqui) {
                        void handleClickSalida(salidaAqui)
                        return
                      }
                      handleMoverA(local)
                    }
              }
              // ZON-36: doble clic = ir rápido (corta el trayecto que haya y sale de nuevo, rápido).
              onDoubleClick={
                soloConsulta
                  ? undefined
                  : (e) => {
                      const local = puntoDelLienzo(e)
                      if (local) handleMoverA(local, { rapido: true })
                    }
              }
              onMouseMove={
                soloConsulta
                  ? undefined
                  : (e) => {
                      const local = puntoDelLienzo(e)
                      if (!local) return
                      const celda = celdaDePixel(local)
                      setCeldaCursor((prev) => (prev && prev.col === celda.col && prev.row === celda.row ? prev : celda))
                    }
              }
              onMouseLeave={soloConsulta ? undefined : () => setCeldaCursor(null)}
              // ZON-35: clic derecho cancela el trayecto.
              onContextMenu={
                soloConsulta
                  ? undefined
                  : (e) => {
                      if (!movimientoEnCurso && !destinoPendiente) return
                      e.preventDefault()
                      cancelar()
                    }
              }
            >
              <DefsFichas />
              {imageUrl && <image href={imageUrl} x={0} y={0} width={800} height={600} preserveAspectRatio="xMidYMid slice" />}
              {(cuadriculaFijada || altPulsado) && <GridOverlay />}
              {/* ZON-51: hasta dónde llega «Interactuar». */}
              {data.jugador && !soloConsulta && <AnilloInteraccion x={data.jugador.x} y={data.jugador.y} />}
              {/* ZON-50: radio de persecución de los hostiles ya descubiertos, con «vigila» o «¡te persigue!». */}
              {hostiles.map((h) => (
                <RadioAmenaza key={h.id} x={h.x} y={h.y} escala={escala} persigue={!!data.jugador && tePersigue(data.jugador, h)} />
              ))}
              {/* P106 (QA-27): el objetivo de una misión activa, marcado aunque siga sin descubrir. */}
              {data.puntos.filter((p) => p.objetivoMision).map((p) => (
                <MarcaObjetivoMision key={`mision-${p.id}`} x={p.x} y={p.y} escala={escala} />
              ))}
              {/* ZON-53: la patrulla de la ficha bajo el ratón (si ya está descubierta). */}
              {(() => {
                const punto = claveBajoRaton ? puntoPorClave(claveBajoRaton) : null
                return punto && 'ruta' in punto && punto.ruta ? <RutaPatrulla ruta={punto.ruta} escala={escala} /> : null
              })()}
              {/* ZON-30/31/32/34 (capa de ruta, bajo las fichas): celda bajo el cursor; sin andar, la ruta
                  prevista con su coste; andando o parado, la ruta que queda y la bandera de destino. */}
              {celdaCursor && !soloConsulta && <CeldaResaltada celda={celdaCursor} bloqueada={!!bloqueoMovimiento} />}
              {data.jugador && !soloConsulta && destinoPendiente && (
                <>
                  <LineaRuta desde={data.jugador} puntos={caminoRestante} escala={escala} tipo="en-curso" />
                  <BanderaDestino {...pixelDeCelda(celdaDePixel(destinoPendiente))} escala={escala} />
                </>
              )}
              {/* P62 (QA-27): sin ruta prevista mientras hay un menú de ficha o una tarjeta de encuentro
                  abiertos: su texto quedaba tapado debajo. */}
              {data.jugador && !soloConsulta && !movimientoEnCurso && !bloqueoMovimiento && celdaCursor && !menuFicha && !encuentroMapa &&
                (() => {
                  const destino = pixelDeCelda(celdaCursor)
                  const ruta = rutaPrevista(data.jugador, destino, data.fictionalMinutes)
                  if (ruta.pasos === 0) return null
                  // ZON-33: celdas en el radio de un hostil conocido; en rojo entera si acaba en encuentro seguro.
                  const riesgo = riesgoDeRuta(ruta.puntos, hostiles)
                  return (
                    <>
                      {riesgo.enRiesgo.length > 0 && <CeldasEnRiesgo puntos={riesgo.enRiesgo.map((i) => ruta.puntos[i]!)} escala={escala} />}
                      <LineaRuta desde={data.jugador} puntos={ruta.puntos} escala={escala} tipo="prevista" peligro={riesgo.encuentroSeguro} />
                      <EtiquetaCoste x={destino.x} y={destino.y} texto={textoCoste(ruta)} escala={escala} />
                    </>
                  )
                })()}
              {/* ZON-81: lo fijo (salidas y parcelas) bajo lo que se mueve. */}
              {/* Iconos de salida de región (2026-09-17) — siempre VISIBLES en su posición real
                  (dirección cardinal), incluso con `soloConsulta` (vista de MapaPanel). Umbral de
                  proximidad (2026-09-20, petición explícita de Álvaro: "al estar a una celda si
                  pulsas el icono saca el modal para poder darle a viajar") — el modal solo se abre
                  si `alcanzable` (misma celda o adyacente a la posición real del jugador, calculado
                  en el backend); lejos, el clic deja un aviso corto en vez de abrir nada, mismo
                  mecanismo ya usado para colisión/movimiento. `stopPropagation` para no disparar
                  también un clic de movimiento hacia ese punto del lienzo. */}
              {data.salidas.map((s) => (
                <g
                  key={s.locationId}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleClickSalida(s)
                  }}
                  className={`${s.alcanzable ? '' : 'opacity-60'} ${s.alcanzable || !soloConsulta ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <SalidaMarker x={s.x} y={s.y} escala={escala} texto={etiquetaSalida(s)} dyEtiqueta={(dyEtiquetas.get(`s:${s.locationId}`) ?? 0) / escala} />
                  <title>{etiquetaSalida(s)}</title>
                </g>
              ))}
              {/* Iconos de parcela (§ 7.4, 2026-09-21) — siempre visibles (mismo criterio que
                  `salidas`: solo zonas-interior de Capital/Cuartel Avanzado tienen alguna, `[]` en
                  el resto del mundo). Sin umbral de proximidad propio — a diferencia de una salida
                  de región, construir es una decisión de gestión, no un desplazamiento; se abre el
                  modal desde cualquier distancia dentro de la misma zona-interior. */}
              {data.parcelas.map((p) => (
                <g
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedParcela(p)
                  }}
                  className="cursor-pointer"
                >
                  <ParcelaMarker x={p.x} y={p.y} ocupada={p.building !== null} estado={p.building?.status} escala={escala} />
                  <title>{p.building ? p.building.name : 'Parcela vacía'}</title>
                </g>
              ))}
              {data.puntos.map((p) => (
                <g
                  key={p.id}
                  onClick={(e) => { e.stopPropagation(); setMenuFicha({ clave: `p:${p.id}`, punto: p }) }}
                  onMouseEnter={() => setClaveBajoRaton(`p:${p.id}`)}
                  onMouseLeave={() => setClaveBajoRaton(null)}
                  className="cursor-pointer"
                >
                  <ZonePointMarker x={p.x} y={p.y} tipo={p.tipo} color={COLOR_HEX[p.color]} escala={escala} hasCompanion={!!p.companion} cantidad={p.cantidad} desconocido={!p.descubierto} agotado={p.agotado} nivelRequerido={p.nivelRequerido} />
                  <title>{`${p.nombre}${p.cantidad > 1 ? ` ×${p.cantidad}` : ''} (${TIPO_LABEL[p.tipo]})${p.companion ? ` — con ${p.companion.nombre}` : ''}`}</title>
                </g>
              ))}
              {/* NPC/fauna dinámicos (2026-09-04) — ahora también se pintan como pines reales, con
                  la posición asignada por el backend (`posicionAleatoriaEnLienzo`), reutilizando
                  `ZonePointMarker` tal cual (su `tipo` ya es subconjunto válido). */}
              {dinamicos.map((d) => (
                <g
                  key={d.slug}
                  onClick={(e) => { e.stopPropagation(); setMenuFicha({ clave: `d:${d.slug}`, punto: d }) }}
                  onMouseEnter={() => setClaveBajoRaton(`d:${d.slug}`)}
                  onMouseLeave={() => setClaveBajoRaton(null)}
                  className="cursor-pointer"
                >
                  <ZonePointMarker x={d.x} y={d.y} tipo={d.tipo} color={COLOR_HEX[d.color]} escala={escala} desconocido={!d.descubierto} />
                  <title>{`${d.nombre} (${TIPO_LABEL[d.tipo]})`}</title>
                </g>
              ))}
              {/* CR-63 (63e): partidas y otros viajeros de paso; se habla con ellos en «De paso por aquí». */}
              {(data.viajeros ?? []).map((v) => (
                <g key={v.id} aria-label={`De paso: ${v.nombre}`}>
                  <circle cx={v.x} cy={v.y} r={11 * escala} fill="var(--color-wood-900)" stroke="var(--color-quest-300)" strokeWidth={2 * escala} />
                  <text x={v.x} y={v.y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13 * escala }}>
                    ⚑
                  </text>
                  <title>{v.nombre}</title>
                </g>
              ))}
              {data.jugador && <JugadorMarker x={data.jugador.x} y={data.jugador.y} escala={escala} angulo={anguloJugador} quieto={!movimientoEnCurso} />}
              {/* ZON-19 (hito 0.1) — nombres en una capa por encima de todo (ni salidas ni otras fichas los
                  tapan), con la misma animación de desplazamiento que su ficha. */}
              <g pointerEvents="none">
                {etiquetasFichas.map((e) => (
                    <g key={e.clave} style={{ transform: `translate(${e.x}px, ${e.y}px)`, transition: `transform ${msPasoActual}ms linear` }}>
                      <g transform={`scale(${escala})`}>
                        <EtiquetaNombre texto={e.nombre} y={24 + (dyEtiquetas.get(e.clave) ?? 0) / escala} anchor={anclaEtiqueta(e.x, e.nombre, escala)} />
                      </g>
                    </g>
                  ))}
              </g>
              {/* ZON-40: tarjeta de la ficha bajo el ratón (si no tiene su menú abierto). */}
              {(() => {
                const punto = claveBajoRaton && claveBajoRaton !== menuFicha?.clave ? puntoPorClave(claveBajoRaton) : null
                return punto ? <TarjetaFicha x={punto.x} y={punto.y} escala={escala} info={infoDeFicha(punto)} /> : null
              })()}
              {/* ZON-5: la tarjeta del encuentro, junto a su ficha (o al personaje si no tiene ficha propia). */}
              {encuentroMapa && ofertaEnMapa && data.jugador &&
                (() => {
                  const presentacion = ofertaEnMapa(encuentroMapa.entryId)
                  if (!presentacion) return null
                  const ficha = encuentroMapa.zonePointId ? data.puntos.find((p) => p.id === encuentroMapa.zonePointId) : undefined
                  const donde = ficha ?? data.jugador
                  // «Seguir mi camino»: ignorar y continuar hacia donde se iba (no con un agresivo).
                  const ignorar = presentacion.actions.find((a) => a.label === 'Ignorar')
                  const acciones =
                    ignorar && destinoPendiente
                      ? [...presentacion.actions, { label: 'Seguir mi camino', tone: 'neutral' as const, disabled: ignorar.disabled, onClick: () => { ignorar.onClick(); setEncuentroMapa(null); reanudar() } }]
                      : presentacion.actions
                  return <TarjetaEncuentro x={donde.x} y={donde.y} escala={escala} presentacion={{ ...presentacion, actions: acciones }} bloqueo={bloqueoTurno} />
                })()}
              {/* ZON-41: menú pegado a la ficha pulsada. */}
              {menuFicha && (
                <MenuFicha
                  x={menuFicha.punto.x}
                  y={menuFicha.punto.y}
                  escala={escala}
                  info={infoDeFicha(menuFicha.punto)}
                  acciones={accionesDeFicha(menuFicha.punto)}
                  onClose={() => setMenuFicha(null)}
                />
              )}
            </svg>
            </PasoZonaContext.Provider>
          </div>
        )}
    </>
  )

  const contenidoColumn = (
    <>
        {/* Control regional (2026-08-27, Pieza 5) — placeholder de texto, sin logo real todavía
            (pendiente de generación de imagen, mismo mecanismo que el resto de assets). Tono por
            estado (C.6) para que no se lea como metadata secundaria (mismo tono que un timestamp). */}
        {data.regionControl && <p className={`text-xs font-medium ${regionControlDisplay(data.regionControl).tone}`}>{regionControlDisplay(data.regionControl).text}</p>}
        {/* Sistema de movimiento por cuadrícula (2026-09-08) — mensaje simple de colisión/aviso,
            placeholder consciente hasta que se conecte con combate/Interactuar real (Franja 3). */}
        {mensajeMovimiento && <p className="text-xs font-medium text-accent2-300">{mensajeMovimiento}</p>}
        {/* UX 2026-09-01 (hallazgo jugando en vivo): el mapa usa 4 formas (círculo=Fauna,
            triángulo=NPC, cuadrado=Edificio, rombo=Recurso) y 4 colores de reputación con la
            facción del punto, pero no explicaba el código a una jugadora nueva. `<details>` nativo
            — colapsable sin JS extra, cerrado por defecto para no competir visualmente con el
            mapa; mismos `COLOR_HEX`/`TIPO_LABEL` que usa el propio SVG de arriba, así que nunca
            puede desincronizarse de lo que de verdad se pinta. Formas dibujadas con el mismo
            `ZonePointMarker` de los pines reales, a tamaño de leyenda (viewBox propio 20×20), en
            vez de reconstruir cada silueta a mano en CSS. */}
        {data.puntos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {data.puntos.map((p) => (
              <button type="button"
                key={p.id}
                onClick={() => (p.companion ? setSelectedGroup(p) : setSelectedPoint(p))}
                className="tactile flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-left text-xs transition-colors hover:border-accent-600/60"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX[p.color] }} />
                <span className="text-wood-100">
                  {p.nombre}
                  {p.cantidad > 1 && <span className="text-wood-500"> ×{p.cantidad}</span>}
                  {p.companion && <span className="text-wood-500"> + {p.companion.nombre}</span>}
                </span>
                <span className="ml-auto text-2xs uppercase tracking-wide text-wood-500">{TIPO_LABEL[p.tipo]}</span>
              </button>
            ))}
          </div>
        )}
        {/* NPCs presentados de forma determinista (2026-08-26) — desde 2026-09-04 con posición
            real asignada (ver el SVG de arriba), pero se mantiene también como lista de texto,
            mismo criterio que `puntos` (lista Y pin a la vez), ahora clicable igual que aquellos. */}
        {dinamicos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Presentes ahora</p>
            {dinamicos.map((d) => (
              <button type="button"
                key={d.slug}
                onClick={() => setSelectedPoint(d)}
                className="tactile flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-left text-xs transition-colors hover:border-accent-600/60"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX[d.color] }} />
                <span className="text-wood-100">{d.nombre}</span>
                <span className="ml-auto text-2xs uppercase tracking-wide text-wood-500">{TIPO_LABEL[d.tipo]}</span>
              </button>
            ))}
          </div>
        )}
    </>
  )

  return (
    <div className={`flex flex-col gap-3 ${columnasAncho ? 'h-full min-h-0' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-wood-100">{data.locationName}</p>
        {/* CR-40 (40g): el tablón de avisos de este lugar (de una facción o del Reino). */}
        {data.tablon && misiones && (
          <button
            type="button"
            onClick={() => misiones.abrirTablon(data.tablon!.buildingId)}
            className="rounded border border-accent-600/60 bg-accent-500/10 px-2.5 py-1 text-xs text-accent-100 hover:bg-accent-500/20"
          >
            📜 {data.tablon.nombre}{data.tablon.faccion ? ` · ${data.tablon.faccion}` : ''}
          </button>
        )}
      </div>
      {/* CR-63 (63e): partidas y otros viajeros de paso por este lugar. */}
      <ViajerosAqui saveId={saveId} lugar={data.locationName ?? ""} deZona={(data.viajeros ?? []).map((v) => v.id).join(",")} soloConsulta={soloConsulta} onRefreshSave={onRefreshSave} />
      {/* Pieza 2 (2026-09-09) — recuerda dónde vive el movimiento real cuando esta vista es solo
          informativa, para no dejar al jugador buscando un clic que ya no hace nada aquí. */}
      {soloConsulta && (
        <p className="text-2xs italic text-wood-500">
          Vista informativa — usa el icono 🧭 para moverte de verdad por la zona.
        </p>
      )}
      {columnasAncho ? (
        // Layout flex, no grid (2026-09-09, petición explícita de Álvaro: "reduce el tamaño de la
        // columna de zona para que quede ajustado y amplía el % de la columna del texto ya que nos
        // sobra espacio" — con un grid de fracciones fijas, la columna del mapa se quedaba más
        // ANCHA de lo que el SVG (limitado por ALTURA, 4:3) de verdad ocupaba, dejando hueco vacío
        // a los lados dentro de su propia columna en vez de cedérselo al texto). `w-fit` dimensiona
        // la columna del mapa exactamente al ancho real del SVG ya limitado por su altura
        // disponible (`max-h-full`, mapaColumn más abajo); `flex-1` en la columna de texto se lleva
        // TODO el ancho restante del modal, sea cual sea.
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[3fr_2fr]">
          <div className="flex min-h-0 flex-col gap-3">{mapaColumn}</div>
          <div className="flex flex-col gap-3 overflow-y-auto">{contenidoColumn}</div>
        </div>
      ) : (
        <>
          {mapaColumn}
          {contenidoColumn}
        </>
      )}
      {selectedPoint &&
        ('id' in selectedPoint ? (
          <ZonePointDetailModal point={selectedPoint} onClose={() => setSelectedPoint(null)} onIrHasta={irHastaPin(selectedPoint)} irHastaLabel={pegadoAPin(selectedPoint) ? 'Acercarte' : undefined} />
        ) : (
          <ZonePointDetailModal
            point={zonaDinamicoToDetailSource(selectedPoint)}
            onClose={() => setSelectedPoint(null)}
            onRecoger={handleRecoger}
            onIrHasta={irHastaPin(selectedPoint)}
            irHastaLabel={pegadoAPin(selectedPoint) ? 'Acercarte' : undefined}
            onSaquear={onSaquearCadaver ? (npcSlug) => void accionSobreCadaver(selectedPoint, () => onSaquearCadaver(npcSlug)) : undefined}
            onDesollar={onDesollarCadaver ? (npcSlug) => void accionSobreCadaver(selectedPoint, () => onDesollarCadaver(npcSlug)) : undefined}
          />
        ))}
      {selectedGroup && <ZoneGroupDetailModal point={selectedGroup} onClose={() => setSelectedGroup(null)} />}
      {selectedSalida && (
        <ZonaSalidaModal
          salida={selectedSalida}
          onCancel={() => setSelectedSalida(null)}
          bloqueoTurno={bloqueoTurno}
          onViajar={(actionText) => {
            setSelectedSalida(null)
            onViajarA?.(actionText)
          }}
        />
      )}
      {selectedParcela && (
        <ParcelaDetailModal
          saveId={saveId}
          parcela={selectedParcela}
          professionRecipes={professionRecipes ?? []}
          onCancel={() => setSelectedParcela(null)}
          onConstruido={(logEntry) => {
            setSelectedParcela(null)
            // Mismo patrón que `handleRecoger` — recarga la zona para que el icono pase de "hueco
            // vacío" a "edificio real" sin esperar a que el jugador cambie de pestaña y vuelva.
            getZona(saveId).then(setData).catch(() => {})
            onRefreshSave?.()
            // logEntry ya viene resuelto por completo del backend — mismo mecanismo que el resto
            // de encuentros de zona insertan su LogEntry real en el log de personaje.
            onEncuentroZona?.(logEntry)
          }}
        />
      )}
    </div>
  )
}
