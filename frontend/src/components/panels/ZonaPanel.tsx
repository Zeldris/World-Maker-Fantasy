import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getZona, moverEnZona, resolveImageUrl, recogerDroppedItem, type ZonaResponse, type ZonePointInfo, type ZonaDinamicoInfo, type RegionControlInfo } from '../../lib/api'
import { ZonePointDetailModal, zonaDinamicoToDetailSource } from '../ZonePointDetailModal'
import { ZoneGroupDetailModal } from '../ZoneGroupDetailModal'
import type { LogEntry } from '../../types'

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
}

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25, docs/rpgtarkor/mundo-determinista.md) —
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
const TIPO_LABEL: Record<ZonePointInfo['tipo'] | 'OBJETO', string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
  EDIFICIO: 'Edificio',
  // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — único tipo exclusivo de
  // `dinamicos` (instancia por partida, nunca `ZonePoint` de catálogo).
  OBJETO: 'Objeto en el suelo',
}

/// Color por reputación con la facción del punto (2026-08-27, Pieza 3 de "Dinamismo del mundo") —
/// verde=aliado, amarillo=neutro, rojo=enemigo; naranja para NPC/FAUNA/EDIFICIO independientes
/// (podrían tener facción pero no la tienen ahora mismo) — nunca hereda el color de nadie.
///
/// INERTE, gris (2026-09-09, corrección de diseño real — Álvaro: "el color de sin facción solo se
/// debe aplicar en npc/fauna/construcciones... sino debe utilizar [uno propio], ya que el resto de
/// elementos no dependen de facción") — RECURSO/OBJETO nunca tienen facción por DISEÑO, distinto de
/// "no la tiene ahora mismo" (SIN_FACCION) — mezclarlos habría sido tan confuso como reutilizar
/// NEUTRO (que ya significa "neutral CON una facción real"), ver `zonePointColorFor` (backend).
///
/// B.11 (checklist frontend 2026-08-27) — mismos tonos exactos (`emerald-500`/`red-500`) que
/// `ReputacionPanel.tsx` usa para Amigable/Enemigo (`emerald-400`/`red-400` en texto), en vez de un
/// verde/rojo hex sueltos sin relación — dos representaciones del mismo concepto de reputación en
/// paneles distintos ahora comparten paleta, aunque cada una siga con su propio número de bandas
/// (aquí 3+SIN_FACCION+INERTE por punto de mapa, allí 5 por temperamento de combate — legítimamente
/// distintas, no se tocan los umbrales de ninguna).
const COLOR_HEX: Record<ZonePointInfo['color'], string> = {
  ALIADO: '#10b981',
  NEUTRO: '#d4af37',
  ENEMIGO: '#ef4444',
  SIN_FACCION: '#f97316',
  INERTE: '#8a8578',
}

/// 4 formas fijas por categoría (2026-08-27, diseño cerrado con la usuaria) — círculo=seres vivos
/// genéricos (fauna, grupos sin nombre propio), triángulo=NPC con nombre propio, cuadrado=edificio,
/// rombo=seres inertes (RECURSO: flora/materiales). Sin 5ª forma nueva incluso con el companion de
/// fauna con nombre propio (C10, 2026-09-13) — un anillo punteado extra alrededor del triángulo
/// (`hasCompanion`) señala "grupo" sin romper la silueta ya reconocible de NPC.
///
/// Rombo alargado verticalmente (checklist frontend 2026-08-27, A.9) — con las mismas proporciones
/// que el círculo (semi-ejes ≈ su radio) ambas formas se confundían a tamaño de icono pequeño,
/// justo el par que separa "fauna cazable" (círculo) de "recurso recolectable" (rombo). El
/// alargado vertical (7 horizontal / 10 vertical, antes 9/9) mantiene el área similar pero rompe
/// la silueta redondeada que lo acercaba al círculo.
/// Movimiento fluido de fauna/NPC (2026-09-09, Álvaro: "tiene que ser un movimiento lento y sutil,
/// como desplazarse caminando", pidió explícitamente que aplique a "todo", no solo al jugador) —
/// mismo patrón que `JugadorMarker` desde el principio: un único `<g transform>` por punto (ver
/// `ZonePointMarker` más abajo) es quien se desplaza, nunca coordenadas absolutas sueltas en cada
/// elemento hijo. Reddiseñado 2026-09-17 (bug real visto en vivo: "un borde circular... se está
/// moviendo antes que el triángulo") — antes cada elemento del mismo punto (forma, anillo de
/// companion, texto de cantidad, badge de +10) llevaba sus propias coordenadas `x`/`y` absolutas,
/// algunos con su propia `transition` de CSS sobre `cx/cy`/`points` y el texto sin ninguna, así que
/// durante la animación cada pieza se movía a su propio ritmo — visible como desfase real entre
/// ellas. Ahora todo el conjunto vive dentro del mismo `<g transform>`, una sola animación por
/// punto, todo se mueve pegado.
///
/// Sistema de movimiento por cuadrícula (2026-09-08, ritmo ralentizado 2026-09-17 a petición
/// explícita: "que la animación de movimiento sea bastante más lenta") — cada paso anima este
/// tiempo antes de pedir el siguiente, y es EXACTAMENTE la duración de la transición de
/// `ZonePointMarker`/`JugadorMarker` (una sola fuente de verdad, no dos constantes que puedan
/// desincronizarse) — así el desplazamiento visual dura el intervalo completo entre pasos, nunca
/// llega y se queda quieto esperando al siguiente (petición explícita: "que se vea como se desplaza
/// todo poco a poco, no que pegue un salto y aparezca en la celda"). Antes 250ms de intervalo con
/// 220ms de transición (deliberadamente algo más corta, para que el deslizamiento terminara justo
/// antes del siguiente paso) — al subir el intervalo sin tocar la transición, el marcador se
/// deslizaba rápido y luego quedaba quieto el resto del tiempo, justo el efecto de "salto" que se
/// pedía evitar.
const MS_POR_PASO_MOVIMIENTO = 600

/// Cada forma se dibuja SIEMPRE relativa al origen (0,0) — quien la envuelve (`ZonePointMarker`
/// más abajo) es el único responsable de posicionarla en el lienzo, vía un `<g transform>` que
/// mueve TODO el conjunto (forma + anillo de companion + texto de cantidad + badge) a la vez. Antes
/// cada elemento (forma, texto, badge) llevaba sus propias coordenadas absolutas `x`/`y` — algunos
/// con su propia `transition` de CSS sobre `cx/cy`/`points`, el texto sin ninguna — así que durante
/// la animación cada pieza del mismo punto se movía a su propio ritmo, visible como un desfase real
/// entre ellas (bug real visto en vivo, 2026-09-17: "un borde circular... se está moviendo antes
/// que el triángulo"). Un único `transform` en el `<g>` exterior es la única animación que el
/// navegador tiene que interpolar por punto — todo el conjunto se mueve pegado, mismo patrón que ya
/// usaba `JugadorMarker` desde el principio.
function ZonePointShape({ tipo, color, hasCompanion }: { tipo: ZonePointInfo['tipo'] | 'OBJETO'; color: string; hasCompanion?: boolean }) {
  const common = { fill: color, stroke: 'white', strokeWidth: 1.5 }
  switch (tipo) {
    case 'NPC':
      // Compañero de fauna con nombre propio en el mismo punto (C10, 2026-09-13) — "un icono
      // nuevo para los grupos": anillo punteado extra alrededor del triángulo normal de NPC, en
      // vez de una 5ª forma completa (mantiene la silueta ya reconocible de "NPC con nombre
      // propio", solo añade la señal de "aquí hay más de uno").
      return (
        <>
          {hasCompanion && <circle cx={0} cy={0} r={12} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="2.5 2" opacity={0.85} />}
          <polygon points="0,-9 -8,7 8,7" {...common} />
        </>
      )
    case 'EDIFICIO':
      return <rect x={-7} y={-7} width={14} height={14} {...common} />
    case 'RECURSO':
      return <polygon points="0,-10 7,0 0,10 -7,0" {...common} />
    case 'FAUNA':
      return <circle cx={0} cy={0} r={8} {...common} />
    case 'OBJETO':
      // "Tirar" objetos al suelo de la Zona (2026-09-06) — mismo rombo que RECURSO pero gris fijo,
      // para no confundir un objeto tirado por el jugador con un recurso natural sembrado.
      return <polygon points="0,-10 7,0 0,10 -7,0" fill="#8a8a8a" stroke="white" strokeWidth={1.5} />
  }
}

/// Envuelve `ZonePointShape` (y, si aplica, el texto/badge de cantidad) en un único `<g transform>`
/// — ver el comentario de `ZonePointShape` de arriba para el motivo. `children` opcional para poder
/// insertar el texto de cantidad DENTRO del mismo grupo animado (ver `data.puntos.map` más abajo),
/// en vez de que cada caller tenga que repetir el `<g>`/`transform` a mano.
function ZonePointMarker({ x, y, tipo, color, hasCompanion, children }: { x: number; y: number; tipo: ZonePointInfo['tipo'] | 'OBJETO'; color: string; hasCompanion?: boolean; children?: ReactNode }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${MS_POR_PASO_MOVIMIENTO}ms linear` }}>
      <ZonePointShape tipo={tipo} color={color} hasCompanion={hasCompanion} />
      {children}
    </g>
  )
}

/// Punto del jugador en el mapa de Zona (2026-09-04, petición explícita jugando en vivo: "ahora
/// falto yo en la zona") — estrella de 5 puntas negra, forma nunca usada por las 4 categorías de
/// `ZonePointShape` (círculo/triángulo/cuadrado/rombo), color propio (negro, confirmado por la
/// usuaria) distinto de los 4 tonos de reputación. Halo blanco fino + radio algo mayor (11 vs 7-10
/// del resto) para que nunca quede tapado si el jugador coincide con un pin normal (caso real: justo
/// tras cazar/recolectar/combatir, el jugador aparece exactamente sobre ese ZonePoint).
/// Movimiento fluido (2026-09-09, petición explícita de Álvaro: "ahora mismo saltan de una
/// posición a otra muy rápido... parece más una partida de ajedrez rápida... tiene que ser un
/// movimiento lento y sutil, como desplazarse caminando") — antes la forma se dibujaba con `x`/`y`
/// embebidos directamente en cada punto del `polygon`, así que un `transition` de CSS no tenía
/// ningún atributo aislado al que animar (todo el `points` cambia de golpe entre un valor y otro).
/// Ahora la silueta se calcula relativa al origen (0,0) una sola vez, y es el propio `<g>` quien se
/// desplaza vía `transform: translate(x, y)` — eso SÍ es un único valor animable con
/// `transition: transform`, el navegador interpola la posición fotograma a fotograma en vez de
/// saltar entre los dos centros de celda. Duración = `MS_POR_PASO_MOVIMIENTO` exacta (ver ese
/// comentario más arriba) — el deslizamiento ocupa el intervalo completo entre pasos, sin quedarse
/// quieto esperando al siguiente.
const JUGADOR_MARKER_PUNTOS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 11 : 4.5
  const angle = (Math.PI / 5) * i - Math.PI / 2
  return `${r * Math.cos(angle)},${r * Math.sin(angle)}`
}).join(' ')

function JugadorMarker({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${MS_POR_PASO_MOVIMIENTO}ms linear` }}>
      <circle cx={0} cy={0} r={14} fill="none" stroke="white" strokeWidth={1.5} opacity={0.8} />
      <polygon points={JUGADOR_MARKER_PUNTOS} fill="#0a0a0a" stroke="white" strokeWidth={1.5} />
      <title>Tú estás aquí</title>
    </g>
  )
}

/// Cuadrícula de referencia visual (2026-09-17, petición explícita: "una cuadrícula muy muy
/// transparente... para que fuese más claro cómo moverse entre la zona") — mismas 16×12 celdas de
/// 50px que ya usa el motor de movimiento real (`CELL_SIZE_PX`/`GRID_COLS`/`GRID_ROWS`,
/// backend/src/services/zonaPosicion.ts) sobre el viewBox fijo 800×600 — puramente decorativa, el
/// backend sigue siendo la única fuente de verdad de a qué celda cae cada clic
/// (`getScreenCTM().inverse()` ya convierte a píxel real, esto solo ayuda a LEER esa cuadrícula a
/// simple vista). `pointer-events: none` para no interceptar el clic de movimiento del lienzo.
const GRID_CELL_PX = 50
const GRID_COLS = 16
const GRID_ROWS = 12

function GridOverlay() {
  const lineas: ReactNode[] = []
  for (let col = 1; col < GRID_COLS; col++) {
    const x = col * GRID_CELL_PX
    lineas.push(<line key={`v${col}`} x1={x} y1={0} x2={x} y2={GRID_ROWS * GRID_CELL_PX} />)
  }
  for (let row = 1; row < GRID_ROWS; row++) {
    const y = row * GRID_CELL_PX
    lineas.push(<line key={`h${row}`} x1={0} y1={y} x2={GRID_COLS * GRID_CELL_PX} y2={y} />)
  }
  return (
    <g stroke="white" strokeWidth={1} opacity={0.12} pointerEvents="none">
      {lineas}
    </g>
  )
}

/// C.6/C.7 (checklist frontend 2026-08-27) — antes 3 comparaciones sueltas sin exhaustividad
/// comprobada por TypeScript (un 4º estado futuro se colaría en silencio) y sin comprobar que
/// `agresor` viniera informado en `EN_DISPUTA` (opcional en el tipo). Ahora un `switch` exhaustivo
/// (el `never` de abajo rompe la compilación si se añade un estado nuevo sin tratarlo aquí) +
/// tono de color por estado, mismo criterio que `OUTCOME_TONE` de `KingdomFoundingModal.tsx`.
/// B.12 (checklist frontend 2026-08-27) — el backend representa al agresor de una disputa como un
/// nombre de ALIANZA compuesto ("Clan Serhu-Concordia de Hierro"), que no coincide con ninguna
/// clave real de `factionsStatus`/`ReputacionPanel` (ahí viven "Clan Serhu" y "Concordia de Hierro"
/// por separado) — no es buscable entre paneles. Se descompone solo para MOSTRAR (" + " en vez del
/// guion, que puede leerse como parte de un nombre propio), sin tocar el dato real del backend, que
/// sigue siendo correcto como concepto de alianza.
function agresorLegible(agresor: string): string {
  return agresor.includes('-') ? agresor.split('-').join(' + ') : agresor
}

function regionControlDisplay(control: RegionControlInfo): { text: string; tone: string } {
  switch (control.estado) {
    case 'CONQUISTADA':
      return { text: `Territorio de ${agresorLegible(control.duenoActual)}`, tone: 'text-danger-400' }
    case 'EN_DISPUTA':
      return {
        text: control.agresor ? `En disputa: ${agresorLegible(control.agresor)} vs ${control.duenoActual}` : `En disputa por ${control.duenoActual}`,
        tone: 'text-cost-400',
      }
    case 'NEUTRAL_O_DUENO_ORIGINAL':
      return { text: `Territorio de ${control.duenoActual}`, tone: 'text-wood-300' }
    default: {
      const _exhaustive: never = control.estado
      return _exhaustive
    }
  }
}

export function ZonaPanel({ saveId, onEncuentroZona, soloConsulta = false, columnasAncho = false, onClose }: ZonaPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ZonaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Modal de detalle (2026-09-04) — comparte un mismo modal entre ZonePoint reales (`puntos`) y
  // dinámicos (`dinamicos`, sin ZonePoint sembrado), vía `zonaDinamicoToDetailSource`.
  const [selectedPoint, setSelectedPoint] = useState<ZonePointInfo | ZonaDinamicoInfo | null>(null)
  // Compañero de fauna con nombre propio en el mismo punto que su dueño (C10, 2026-09-13) —
  // estado de selección SEPARADO del normal: un punto con `companion` abre `ZoneGroupDetailModal`
  // (desglose de ambas entidades) en vez del modal de un solo NPC.
  const [selectedGroup, setSelectedGroup] = useState<ZonePointInfo | null>(null)
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

  useEffect(() => {
    setLoading(true)
    getZona(saveId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — tras recoger uno, el pin debe
  // desaparecer del mapa sin esperar a que el jugador cambie de pestaña y vuelva.
  async function handleRecoger(droppedItemId: string) {
    await recogerDroppedItem(saveId, droppedItemId)
    getZona(saveId).then(setData).catch(() => {})
  }

  // Sistema de movimiento por cuadrícula (2026-09-08) — clic en el lienzo (fondo o pin) pide el
  // destino real en píxel; el backend calcula el camino entero pero solo avanza UN PASO por
  // llamada (mismo criterio "el motor decide, el frontend solo pide"), así que aquí se sigue
  // llamando con el MISMO destino hasta agotar `caminoRestante` o toparse con `colision`/`aviso`.
  async function handleMoverA(destino: { x: number; y: number }) {
    const miToken = ++movimientoTokenRef.current
    setMovimientoEnCurso(true)
    setMensajeMovimiento(null)
    try {
      let sigue = true
      while (sigue && movimientoTokenRef.current === miToken) {
        const resultado = await moverEnZona(saveId, destino)
        if (movimientoTokenRef.current !== miToken) break // cancelado por un clic nuevo mientras esperaba
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
        } else if (resultado.aviso) {
          setMensajeMovimiento(`Algo se mueve cerca: ${resultado.aviso.targetName}.`)
          sigue = false
        } else if (resultado.caminoRestante.length === 0) {
          sigue = false
        } else {
          await new Promise((r) => setTimeout(r, MS_POR_PASO_MOVIMIENTO))
        }
      }
    } catch {
      if (movimientoTokenRef.current === miToken) setMensajeMovimiento('No se pudo mover — inténtalo de nuevo.')
    } finally {
      if (movimientoTokenRef.current === miToken) setMovimientoEnCurso(false)
    }
  }

  if (loading) return <p className="text-sm italic text-wood-500">Cargando zona...</p>
  if (error) return <p className="text-sm italic text-wood-500">{error}</p>
  if (!data?.disponible) {
    return <p className="text-sm italic text-wood-500">Esta ubicación todavía no tiene una zona explorable — vuelve al mapa con la otra pestaña.</p>
  }

  const imageUrl = resolveImageUrl(data.imageUrl ?? null)
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
            propio marcador del jugador). */}
        {(data.puntos.length > 0 || dinamicos.length > 0 || data.jugador) && (
          <div className={`flex overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60 ${columnasAncho ? 'min-h-0 flex-1 items-center justify-center' : ''}`}>
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
            <svg
              viewBox="0 0 800 600"
              className={`${columnasAncho ? 'max-h-full max-w-full' : 'h-auto w-full'} ${soloConsulta ? '' : movimientoEnCurso ? 'cursor-wait' : 'cursor-crosshair'}`}
              onClick={
                soloConsulta
                  ? undefined
                  : (e) => {
                      if (movimientoEnCurso) return
                      const svg = e.currentTarget
                      const punto = svg.createSVGPoint()
                      punto.x = e.clientX
                      punto.y = e.clientY
                      const ctm = svg.getScreenCTM()
                      if (!ctm) return
                      const local = punto.matrixTransform(ctm.inverse())
                      handleMoverA({ x: local.x, y: local.y })
                    }
              }
            >
              {imageUrl && <image href={imageUrl} x={0} y={0} width={800} height={600} preserveAspectRatio="xMidYMid slice" />}
              <GridOverlay />
              {data.puntos.map((p) => (
                <g key={p.id} onClick={(e) => { e.stopPropagation(); p.companion ? setSelectedGroup(p) : setSelectedPoint(p) }} className="cursor-pointer">
                  <ZonePointMarker x={p.x} y={p.y} tipo={p.tipo} color={COLOR_HEX[p.color]} hasCompanion={!!p.companion}>
                    {/* C.5 (checklist frontend 2026-08-27) — con 2 dígitos, el número centrado
                        dentro del icono podía sobresalir de formas estrechas (rombo/triángulo);
                        a partir de 10 se pinta como badge fuera del icono, arriba a la derecha.
                        Coordenadas relativas al origen (0,0) — mismo `<g transform>` animado que
                        la forma, se mueven pegados en vez de saltar por separado. */}
                    {p.cantidad > 1 && p.cantidad < 10 && (
                      <text x={0} y={3} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" stroke="black" strokeWidth={0.3}>
                        {p.cantidad}
                      </text>
                    )}
                    {p.cantidad >= 10 && (
                      <>
                        <circle cx={9} cy={-9} r={7} fill="#1a1410" stroke="white" strokeWidth={1} />
                        <text x={9} y={-6} textAnchor="middle" fontSize={8} fontWeight="bold" fill="white">
                          {p.cantidad}
                        </text>
                      </>
                    )}
                  </ZonePointMarker>
                  <title>{`${p.nombre}${p.cantidad > 1 ? ` ×${p.cantidad}` : ''} (${TIPO_LABEL[p.tipo]})${p.companion ? ` — con ${p.companion.nombre}` : ''}`}</title>
                </g>
              ))}
              {/* NPC/fauna dinámicos (2026-09-04) — ahora también se pintan como pines reales, con
                  la posición asignada por el backend (`posicionAleatoriaEnLienzo`), reutilizando
                  `ZonePointMarker` tal cual (su `tipo` ya es subconjunto válido). */}
              {dinamicos.map((d) => (
                <g key={d.slug} onClick={(e) => { e.stopPropagation(); setSelectedPoint(d) }} className="cursor-pointer">
                  <ZonePointMarker x={d.x} y={d.y} tipo={d.tipo} color={COLOR_HEX[d.color]} />
                  <title>{`${d.nombre} (${TIPO_LABEL[d.tipo]})`}</title>
                </g>
              ))}
              {data.jugador && <JugadorMarker x={data.jugador.x} y={data.jugador.y} />}
            </svg>
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
        {(data.puntos.length > 0 || dinamicos.length > 0 || data.jugador) && (
          <details className="group rounded-lg border border-iron-700 bg-wood-950/40 text-2xs text-wood-400">
            <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-wood-500 marker:content-none">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
              Leyenda del mapa
            </summary>
            <div className="flex flex-col gap-2 border-t border-iron-800 px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(Object.keys(TIPO_LABEL) as (ZonePointInfo['tipo'] | 'OBJETO')[]).map((tipo) => (
                  <span key={tipo} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                      <ZonePointMarker tipo={tipo} x={12} y={12} color="#8a8578" />
                    </svg>
                    {TIPO_LABEL[tipo]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                    <JugadorMarker x={12} y={12} />
                  </svg>
                  Tú
                </span>
                {/* Compañero de fauna con nombre propio (C10, 2026-09-13) — entrada propia en la
                    leyenda para el anillo punteado, mismo criterio del comentario de arriba
                    ("nunca puede desincronizarse de lo que de verdad se pinta"). */}
                <span className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                    <ZonePointMarker tipo="NPC" x={12} y={12} color="#8a8578" hasCompanion />
                  </svg>
                  NPC con compañero
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.ALIADO }} />
                  Aliado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.NEUTRO }} />
                  Neutro
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.ENEMIGO }} />
                  Enemigo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.SIN_FACCION }} />
                  Sin facción
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX.INERTE }} />
                  Salvaje
                </span>
              </div>
            </div>
          </details>
        )}
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
      <p className="text-sm font-medium text-wood-100">{data.locationName}</p>
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
          <ZonePointDetailModal point={selectedPoint} onClose={() => setSelectedPoint(null)} />
        ) : (
          <ZonePointDetailModal point={zonaDinamicoToDetailSource(selectedPoint)} onClose={() => setSelectedPoint(null)} onRecoger={handleRecoger} />
        ))}
      {selectedGroup && <ZoneGroupDetailModal point={selectedGroup} onClose={() => setSelectedGroup(null)} />}
    </div>
  )
}
