import { CELDA_PX, type Celda } from '../../lib/zonaRuta'

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
export function LineaRuta({ desde, puntos, escala, tipo }: { desde: { x: number; y: number }; puntos: { x: number; y: number }[]; escala: number; tipo: 'prevista' | 'en-curso' }) {
  if (puntos.length === 0) return null
  const linea = [desde, ...puntos].map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <g pointerEvents="none" data-testid={`ruta-${tipo}`}>
      <polyline points={linea} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4 * escala} strokeLinecap="round" strokeLinejoin="round" />
      <polyline
        points={linea}
        fill="none"
        stroke={tipo === 'en-curso' ? 'var(--color-accent-300)' : 'rgba(255,255,255,0.85)'}
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
