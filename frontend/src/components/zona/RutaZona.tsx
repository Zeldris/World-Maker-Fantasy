import { CELDA_PX, RADIO_PERSECUCION_CELDAS, type Celda } from '../../lib/zonaRuta'
import { useMsPaso } from '../../lib/zonaMovimiento'

// ZON-30/31/32/34 (hito 0.2) — capa de ruta del mapa de zona: celda bajo el cursor, ruta prevista
// (o la que queda por andar), coste junto al destino y bandera de destino. Los tamaños de trazo y
// texto van en píxeles de pantalla (`escala` = unidades del lienzo por píxel, ZON-11).

/// ZON-30: la celda bajo el cursor, con esquinas suaves.
export function CeldaResaltada({ celda, bloqueada = false }: { celda: Celda; bloqueada?: boolean }) {
  return (
    <rect
      data-testid="celda-cursor"
      x={celda.col * CELDA_PX + 2}
      y={celda.row * CELDA_PX + 2}
      width={CELDA_PX - 4}
      height={CELDA_PX - 4}
      rx={8}
      fill={bloqueada ? 'rgba(220,38,38,0.10)' : 'rgba(255,255,255,0.10)'}
      stroke={bloqueada ? 'var(--color-danger-400)' : 'rgba(255,255,255,0.55)'}
      strokeWidth={1.5}
      pointerEvents="none"
    />
  )
}

/// ZON-31/34: ruta en puntos desde el personaje (la prevista al pasar el ratón o la que queda).
export function LineaRuta({ desde, puntos, escala, tipo, peligro = false }: { desde: { x: number; y: number }; puntos: { x: number; y: number }[]; escala: number; tipo: 'prevista' | 'en-curso'; peligro?: boolean }) {
  if (puntos.length === 0) return null
  const linea = [desde, ...puntos].map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <g pointerEvents="none" data-testid={`ruta-${tipo}`}>
      <polyline points={linea} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4 * escala} strokeLinecap="round" strokeLinejoin="round" />
      <polyline
        points={linea}
        fill="none"
        // ZON-33: entera en rojo si acaba en un encuentro seguro.
        stroke={peligro ? 'var(--color-danger-400)' : tipo === 'en-curso' ? 'var(--color-accent-300)' : 'rgba(255,255,255,0.85)'}
        strokeWidth={2 * escala}
        strokeDasharray={`${2 * escala} ${6 * escala}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/// ZON-34: bandera en el destino, hasta llegar.
export function BanderaDestino({ x, y, escala }: { x: number; y: number; escala: number }) {
  return (
    <g pointerEvents="none" data-testid="bandera-destino" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g transform={`scale(${escala})`}>
        <line x1={0} y1={8} x2={0} y2={-18} stroke="#1c1917" strokeWidth={2.5} />
        <path d="M0,-18 L14,-13 L0,-8 Z" fill="var(--color-accent-400)" stroke="#1c1917" strokeWidth={1} />
        <ellipse cx={0} cy={8} rx={5} ry={2} fill="rgba(0,0,0,0.4)" />
      </g>
    </g>
  )
}

/// ZON-32: el coste junto al destino («8 pasos · 8 min · llegas a las 07:45»).
export function EtiquetaCoste({ x, y, texto, escala }: { x: number; y: number; texto: string; escala: number }) {
  const ancho = texto.length * 6.2 + 14
  // Encima de la celda y dentro del lienzo (800 de ancho).
  const mitad = (ancho / 2) * escala
  const cx = Math.min(800 - mitad - 2, Math.max(mitad + 2, x))
  return (
    <g pointerEvents="none" data-testid="coste-ruta" style={{ transform: `translate(${cx}px, ${Math.max(14 * escala, y - CELDA_PX / 2 - 4)}px)` }}>
      <g transform={`scale(${escala})`}>
        <rect x={-ancho / 2} y={-18} width={ancho} height={18} rx={4} fill="rgba(20,16,12,0.88)" stroke="rgba(255,255,255,0.25)" />
        <text x={0} y={-5} textAnchor="middle" fontSize={11} fill="#f5f0e6">
          {texto}
        </text>
      </g>
    </g>
  )
}

/// ZON-33: celdas de la ruta prevista dentro del radio de un hostil conocido (rojo con un ojo).
export function CeldasEnRiesgo({ puntos, escala }: { puntos: { x: number; y: number }[]; escala: number }) {
  return (
    <g pointerEvents="none" data-testid="ruta-en-riesgo">
      {puntos.map((p, i) => (
        <g key={i} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
          <rect x={-CELDA_PX / 2 + 3} y={-CELDA_PX / 2 + 3} width={CELDA_PX - 6} height={CELDA_PX - 6} rx={6} fill="rgba(220,38,38,0.18)" stroke="var(--color-danger-400)" strokeWidth={1} />
          <text transform={`scale(${escala})`} textAnchor="middle" y={4} fontSize={11}>
            👁
          </text>
        </g>
      ))}
    </g>
  )
}

/// ZON-50: radio de persecución de un hostil conocido (círculo rojo discontinuo) y su estado.
export function RadioAmenaza({ x, y, escala, persigue }: { x: number; y: number; escala: number; persigue: boolean }) {
  const radio = (RADIO_PERSECUCION_CELDAS + 0.5) * CELDA_PX
  return (
    <g pointerEvents="none" data-testid="radio-amenaza" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle r={radio} fill={persigue ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.04)'} stroke="var(--color-danger-400)" strokeWidth={1.5 * escala} strokeDasharray={`${6 * escala} ${5 * escala}`} />
      <g transform={`translate(0, ${-22 * escala}) scale(${escala})`}>
        <rect x={-34} y={-11} width={68} height={14} rx={7} fill="rgba(20,16,12,0.85)" stroke="var(--color-danger-400)" strokeWidth={1} />
        <text textAnchor="middle" y={0} fontSize={9.5} fill={persigue ? 'var(--color-danger-400)' : '#f5f0e6'}>
          {persigue ? '¡te persigue!' : 'vigila'}
        </text>
      </g>
    </g>
  )
}

/// P106 (QA-27): marca de «objetivo de misión» sobre la ficha (aunque siga sin descubrir: «???»).
export function MarcaObjetivoMision({ x, y, escala }: { x: number; y: number; escala: number }) {
  // Se desliza con su ficha, al mismo paso (`ZonePointMarker`).
  const msPaso = useMsPaso()
  return (
    <g pointerEvents="none" data-testid="marca-objetivo-mision" style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${msPaso}ms linear` }}>
      <g transform={`translate(0, ${-24 * escala}) scale(${escala})`}>
        <rect x={-30} y={-11} width={60} height={14} rx={7} fill="rgba(20,16,12,0.85)" stroke="var(--color-quest-400)" strokeWidth={1} />
        <text textAnchor="middle" y={0} fontSize={9.5} fill="var(--color-quest-400)">
          🎯 misión
        </text>
      </g>
    </g>
  )
}

/// ZON-53: la patrulla de una ficha (en bucle), al pasar el ratón.
export function RutaPatrulla({ ruta, escala }: { ruta: { x: number; y: number }[]; escala: number }) {
  const puntos = [...ruta, ruta[0]!].map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <polyline
      data-testid="ruta-patrulla"
      points={puntos}
      fill="none"
      stroke="var(--color-cost-400)"
      strokeWidth={1.5 * escala}
      strokeDasharray={`${3 * escala} ${5 * escala}`}
      strokeLinecap="round"
      pointerEvents="none"
    />
  )
}
