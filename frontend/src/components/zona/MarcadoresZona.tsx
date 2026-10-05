import type { ReactNode } from 'react'
import { EstandarteSalida, FichaJugador, FichaZona } from './FichaZona'
import { anguloSalida } from '../../lib/rumboSalida'
import type { ZonaPinTipo } from '../ZonePointDetailModal'
import { MS_POR_VELOCIDAD, useMsPaso } from '../../lib/zonaMovimiento'

// ZON-80 (hito 0.2) — marcadores del mapa de zona, sacados de `ZonaPanel.tsx` tal cual: fichas que se
// desplazan, el personaje, las salidas, las parcelas y la cuadrícula.

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
export const MS_POR_PASO_MOVIMIENTO = MS_POR_VELOCIDAD.normal


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
/// Envuelve `ZonePointShape` (y, si aplica, el texto/badge de cantidad) en un único `<g transform>`
/// — ver el comentario de `ZonePointShape` de arriba para el motivo. `children` opcional para poder
/// insertar el texto de cantidad DENTRO del mismo grupo animado (ver `data.puntos.map` más abajo),
/// en vez de que cada caller tenga que repetir el `<g>`/`transform` a mano.
export function ZonePointMarker({ x, y, tipo, color, escala, hasCompanion, cantidad, sombra, children }: { x: number; y: number; tipo: ZonaPinTipo; color: string; escala: number; hasCompanion?: boolean; cantidad?: number; sombra?: boolean; children?: ReactNode }) {
  // ZON-36: la animación dura lo que el paso (según la velocidad elegida).
  const msPaso = useMsPaso()
  // ZON-10/ZON-11 (hito 0.1) — la ficha (placa + pictograma + anillo) vive en zona/FichaZona.tsx y se
  // dibuja en píxeles de pantalla; aquí solo se coloca y se anima en coordenadas del lienzo.
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${msPaso}ms linear` }}>
      <FichaZona tipo={tipo} color={color} escala={escala} hasCompanion={hasCompanion} cantidad={cantidad} sombra={sombra}>
        {children}
      </FichaZona>
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
export function JugadorMarker({ x, y, escala, angulo, quieto, sombra }: { x: number; y: number; escala: number; angulo: number | null; quieto: boolean; sombra?: boolean }) {
  const msPaso = useMsPaso()
  // ZON-14 (hito 0.1) — la estrella negra pasa a ficha propia (zona/FichaZona.tsx · FichaJugador).
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${msPaso}ms linear` }}>
      <FichaJugador escala={escala} angulo={angulo} quieto={quieto} sombra={sombra} />
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

export function GridOverlay() {
  const lineas: ReactNode[] = []
  for (let col = 1; col < GRID_COLS; col++) {
    const x = col * GRID_CELL_PX
    lineas.push(<line key={`v${col}`} x1={x} y1={0} x2={x} y2={GRID_ROWS * GRID_CELL_PX} />)
  }
  for (let row = 1; row < GRID_ROWS; row++) {
    const y = row * GRID_CELL_PX
    lineas.push(<line key={`h${row}`} x1={0} y1={y} x2={GRID_COLS * GRID_CELL_PX} y2={y} />)
  }
  // ZON-62 (hito 0.1, Z11) — cada línea dos veces: oscura y ancha debajo, clara y fina encima, para
  // verse sobre terreno claro y oscuro sin ensuciar la ilustración.
  return (
    <g pointerEvents="none" data-testid="cuadricula">
      <g stroke="black" strokeWidth={2} opacity={0.28}>
        {lineas}
      </g>
      <g stroke="white" strokeWidth={0.8} opacity={0.4}>
        {lineas}
      </g>
    </g>
  )
}

/// Icono de salida de región (2026-09-17, petición explícita de Álvaro: "cada salida debe estar
/// ubicada en su posición correcta hacia el camino que se indica en el mapa" — la posición YA la
/// calcula el backend, `salidasDeRegionPara`, según la dirección cardinal real; aquí solo se dibuja
/// el icono en esa posición). Forma nueva, distinta de las 4 de `ZonePointShape`
/// (círculo/triángulo/cuadrado/rombo) para no confundirla con fauna/NPC/edificio/recurso: una
/// flecha apuntando hacia afuera dentro de un círculo, "puerta hacia otra región". Sin `transform`
/// animado (a diferencia de `ZonePointMarker`) — una salida nunca se mueve, es un punto fijo del
/// propio mapa, como la cuadrícula.
export function SalidaMarker({ x, y, escala, texto }: { x: number; y: number; escala: number; texto: string }) {
  // B6 (pruebas 2026-09-28): la flecha gira hacia su rumbo real. ZON-17 (hito 0.1): estandarte con el
  // destino escrito (zona/FichaZona.tsx · EstandarteSalida).
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)` }}>
      <EstandarteSalida escala={escala} angulo={anguloSalida({ x, y })} texto={texto} />
    </g>
  )
}

/// Icono de parcela (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — cuadrado (mismo lenguaje
/// que `ZonePointShape` usa para EDIFICIO, coherente con "aquí puede haber una construcción") con
/// una cruz dentro cuando está vacía (hueco disponible) y sin ella cuando ya tiene `Building`
/// (edificio real, el icono se lee igual que un EDIFICIO normal del mapa). Sin `transform`
/// animado — como `SalidaMarker`, una parcela nunca se mueve, es un hueco fijo del propio PNG.
export function ParcelaMarker({ x, y, ocupada }: { x: number; y: number; ocupada: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)` }}>
      <rect x={-9} y={-9} width={18} height={18} fill={ocupada ? '#3a2f1f' : '#1a1410'} stroke={ocupada ? '#a8a29e' : '#d4af37'} strokeWidth={1.5} opacity={0.9} />
      {!ocupada && (
        <>
          <line x1={-5} y1={0} x2={5} y2={0} stroke="#d4af37" strokeWidth={2} />
          <line x1={0} y1={-5} x2={0} y2={5} stroke="#d4af37" strokeWidth={2} />
        </>
      )}
    </g>
  )
}
