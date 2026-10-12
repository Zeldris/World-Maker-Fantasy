import type { ReactNode } from 'react'
import { COLOR_DISPOSICION } from '../../lib/zonaFichas'
import type { ZonaPinTipo } from '../ZonePointDetailModal'

/// Fichas del mapa de zona — Z-A del hito 0.1 (roadmap-front-zona.md). Estilo "tablero de mesa" (Foundry
/// VTT): placa oscura con la FORMA por categoría ya aprendida (círculo fauna, escudo NPC, cuadrado
/// edificio, rombo recurso), un PICTOGRAMA claro dentro y el color de disposición en el ANILLO, con
/// tokens del juego (Z12). Todo se dibuja en píxeles de pantalla y se escala con `escala` (unidades de
/// viewBox por píxel, `useEscalaPantalla`), así una ficha mide ~28 px sea cual sea el tamaño del mapa
/// (ZON-11, Z7) y su área de clic es de 40 px.


export const FICHA_DIAMETRO_PX = 28
export const FICHA_AREA_CLIC_PX = 40
const PLACA = 'var(--color-wood-950)'
const PICTO = 'var(--color-wood-100)'

/// Pictogramas (BAS-2, parte del mapa) — trazos simples centrados en (0,0), caben en ±7 px.
function Pictograma({ tipo }: { tipo: ZonaPinTipo | 'JUGADOR' }) {
  switch (tipo) {
    case 'FAUNA': // huella
      return (
        <g fill={PICTO}>
          <ellipse cx={0} cy={2.8} rx={3.8} ry={3.1} />
          <circle cx={-4.6} cy={-1.6} r={1.6} />
          <circle cx={-1.7} cy={-4.6} r={1.6} />
          <circle cx={1.7} cy={-4.6} r={1.6} />
          <circle cx={4.6} cy={-1.6} r={1.6} />
        </g>
      )
    case 'NPC': // busto
      return (
        <g fill={PICTO}>
          <circle cx={0} cy={-3.2} r={3.1} />
          <path d="M -6 6 C -6 1.6 -3.2 0.6 0 0.6 C 3.2 0.6 6 1.6 6 6 Z" />
        </g>
      )
    case 'EDIFICIO': // casa
      return (
        <g>
          <path d="M -6.5 -0.5 L 0 -6.5 L 6.5 -0.5 L 4.6 -0.5 L 4.6 6 L -4.6 6 L -4.6 -0.5 Z" fill={PICTO} />
          <rect x={-1.4} y={2} width={2.8} height={4} fill={PLACA} />
        </g>
      )
    case 'RECURSO': // cristal / mineral
      return (
        <g>
          <path d="M 0 -6.5 L 4.4 -2 L 2.6 5.8 L -2.6 5.8 L -4.4 -2 Z" fill={PICTO} />
          <path d="M -4.4 -2 L 4.4 -2 M 0 -6.5 L 0 5.8" stroke={PLACA} strokeWidth={0.9} fill="none" />
        </g>
      )
    case 'OBJETO': // saco
      return <path d="M -2.6 -5.6 L 2.6 -5.6 L 1.3 -3.4 C 5.6 -1.4 6.4 6 0 6 C -6.4 6 -5.6 -1.4 -1.3 -3.4 Z" fill={PICTO} />
    case 'CADAVER': // calavera
      return (
        <g>
          <path d="M -5.5 -1 C -5.5 -5 -2.8 -6.6 0 -6.6 C 2.8 -6.6 5.5 -5 5.5 -1 C 5.5 1.4 4.2 2.4 3.3 2.8 L 3.3 5.4 L -3.3 5.4 L -3.3 2.8 C -4.2 2.4 -5.5 1.4 -5.5 -1 Z" fill={PICTO} />
          <circle cx={-2.2} cy={-1.4} r={1.5} fill={PLACA} />
          <circle cx={2.2} cy={-1.4} r={1.5} fill={PLACA} />
          <path d="M -1.2 5.4 L -1.2 3.6 M 1.2 5.4 L 1.2 3.6" stroke={PLACA} strokeWidth={0.8} />
        </g>
      )
    case 'JUGADOR': // silueta de pie
      return (
        <g fill={PICTO}>
          <circle cx={0} cy={-4.2} r={2.6} />
          <path d="M -3.6 6 L -2.6 -0.6 C -2.4 -1.4 -1.6 -1.6 0 -1.6 C 1.6 -1.6 2.4 -1.4 2.6 -0.6 L 3.6 6 Z" />
        </g>
      )
  }
}

/// Placa con la forma de su categoría (radio ~14 px). Se pinta dos veces en la ficha: relleno oscuro
/// y, encima, solo el trazo de color (el anillo).
export function FormaPlaca({ tipo, ...props }: { tipo: ZonaPinTipo } & React.SVGProps<SVGPathElement & SVGCircleElement & SVGRectElement>) {
  switch (tipo) {
    case 'NPC': // escudo
      return <path d="M -12 -12 L 12 -12 L 12 0 C 12 7.5 6.5 11.6 0 14 C -6.5 11.6 -12 7.5 -12 0 Z" {...(props as React.SVGProps<SVGPathElement>)} />
    case 'EDIFICIO':
      return <rect x={-12} y={-12} width={24} height={24} rx={4} {...(props as React.SVGProps<SVGRectElement>)} />
    case 'RECURSO':
    case 'OBJETO':
      return <path d="M 0 -15 L 12.5 0 L 0 15 L -12.5 0 Z" {...(props as React.SVGProps<SVGPathElement>)} />
    case 'FAUNA':
    case 'CADAVER':
      return <circle cx={0} cy={0} r={13} {...(props as React.SVGProps<SVGCircleElement>)} />
  }
}

/// `<defs>` compartidos por todas las fichas (sombra suave que las separa de la ilustración). Una
/// sola vez por lienzo.
export function DefsFichas() {
  return (
    <defs>
      <filter id="sombra-ficha" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx={0} dy={1.5} stdDeviation={1.6} floodColor="#000" floodOpacity={0.65} />
      </filter>
    </defs>
  )
}

interface FichaZonaProps {
  tipo: ZonaPinTipo
  color: string
  escala: number
  /// Compañero con nombre propio en el mismo punto: anillo punteado exterior (C10).
  hasCompanion?: boolean
  /// ZON-13 — tamaño del grupo: insignia "×N" fuera de la ficha y, desde 3, fichas apiladas detrás.
  cantidad?: number
  /// Sombra suave (necesita `DefsFichas` en el mismo `<svg>`; las leyendas sueltas la apagan).
  sombra?: boolean
  /// Contenido extra en píxeles de pantalla, dentro de la misma escala (etiqueta de nombre).
  children?: ReactNode
}

/// Ficha completa en coordenadas de pantalla (0,0 = su centro). Quien la usa la coloca con un
/// `<g transform=translate>` en coordenadas del lienzo (ver `MarcadorZona`).
export function FichaZona({ tipo, color, escala, hasCompanion, cantidad = 1, sombra = true, children }: FichaZonaProps) {
  const anillo = tipo === 'OBJETO' ? COLOR_DISPOSICION.INERTE : tipo === 'CADAVER' ? 'var(--color-danger-500)' : color
  return (
    <g transform={`scale(${escala})`}>
      {/* ZON-11 — área de clic de 40 px, invisible. */}
      <circle cx={0} cy={0} r={FICHA_AREA_CLIC_PX / 2} fill="transparent" />
      {hasCompanion && <circle cx={0} cy={0} r={17.5} fill="none" style={{ stroke: anillo }} strokeWidth={1.4} strokeDasharray="3 2.5" opacity={0.9} />}
      {/* ZON-13 (Z8) — "varios": dos placas desplazadas detrás de la principal. */}
      {cantidad >= 3 &&
        [6, 3].map((d) => (
          <g key={d} transform={`translate(${d}, ${-d})`} opacity={0.75}>
            <FormaPlaca tipo={tipo} fill={PLACA} style={{ stroke: anillo }} strokeWidth={1.5} />
          </g>
        ))}
      <g filter={sombra ? 'url(#sombra-ficha)' : undefined}>
        <FormaPlaca tipo={tipo} fill={PLACA} fillOpacity={0.92} />
      </g>
      <FormaPlaca tipo={tipo} fill="none" style={{ stroke: anillo }} strokeWidth={2.5} strokeLinejoin="round" />
      <g transform={tipo === 'RECURSO' || tipo === 'OBJETO' ? 'scale(0.85)' : undefined}>
        <Pictograma tipo={tipo} />
      </g>
      {cantidad > 1 && <InsigniaGrupo cantidad={cantidad} />}
      {children}
    </g>
  )
}

/// ZON-13 (Z8) — píldora clara con "×N" arriba a la derecha, fuera de la ficha, legible en cualquier
/// terreno (antes: número de 9 unidades dentro de un círculo de 8 de radio).
export function InsigniaGrupo({ cantidad }: { cantidad: number }) {
  const texto = `×${cantidad}`
  const ancho = 9 + texto.length * 6.2
  return (
    <g transform="translate(9, -21)" aria-hidden="true">
      <rect x={0} y={0} width={ancho} height={14} rx={7} fill="var(--color-wood-100)" stroke="var(--color-wood-950)" strokeWidth={1.2} />
      <text x={ancho / 2} y={10.4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--color-wood-950)" style={{ fontFamily: 'var(--font-sans)' }}>
        {texto}
      </text>
    </g>
  )
}

/// Pictograma suelto para leyendas fuera del lienzo.
export { Pictograma }

/// ZON-14 (hito 0.1, Z10) — ficha del personaje: placa con silueta, anillo de cristal `accent` (el color
/// de "tu personaje" en todo el juego), flecha de dirección según el último paso (`angulo` en grados,
/// 0 = derecha; `null` = aún no se ha movido) y halo que respira mientras está quieto.
export function FichaJugador({ escala, angulo, quieto, sombra = true }: { escala: number; angulo: number | null; quieto: boolean; sombra?: boolean }) {
  return (
    <g transform={`scale(${escala})`}>
      <circle cx={0} cy={0} r={FICHA_AREA_CLIC_PX / 2} fill="transparent" />
      {quieto && <circle cx={0} cy={0} r={19} fill="var(--color-accent-400)" opacity={0.28} className="animate-pulse-slow" pointerEvents="none" />}
      <g filter={sombra ? 'url(#sombra-ficha)' : undefined}>
        <circle cx={0} cy={0} r={14} fill={PLACA} fillOpacity={0.94} />
      </g>
      <circle cx={0} cy={0} r={14} fill="none" stroke="var(--color-accent-400)" strokeWidth={3} />
      <circle cx={0} cy={0} r={11.2} fill="none" stroke="var(--color-accent-300)" strokeWidth={0.8} opacity={0.7} />
      {angulo !== null && (
        <g transform={`rotate(${angulo})`} data-testid="flecha-direccion">
          <path d="M 15 -5 L 22 0 L 15 5 Z" fill="var(--color-accent-300)" stroke={PLACA} strokeWidth={1} strokeLinejoin="round" />
        </g>
      )}
      <Pictograma tipo="JUGADOR" />
    </g>
  )
}

/// Ancho de la placa de `EtiquetaNombre` (sin escalar), en píxeles del lienzo.
/// Ancho del lienzo del mapa de zona (viewBox 800×600, `ZonaPanel`).
export const ANCHO_LIENZO_ZONA = 800

export function anchoEtiqueta(texto: string): number {
  return Math.round(texto.length * 6.1 + 12)
}

/// P61 (QA-27): una etiqueta centrada en (x) que se saldría del lienzo crece hacia dentro (start en el
/// borde izquierdo, end en el derecho). `escala` es la de la ficha (la etiqueta se pinta escalada).
export function anclaEtiqueta(x: number, texto: string, escala: number, anchoLienzo = ANCHO_LIENZO_ZONA): 'start' | 'middle' | 'end' {
  const ancho = anchoEtiqueta(texto) * escala
  if (x - ancho / 2 >= 0 && x + ancho / 2 <= anchoLienzo) return 'middle'
  if (x + ancho <= anchoLienzo) return 'start'
  if (x - ancho >= 0) return 'end'
  // No cabe hacia ningún lado: crece hacia donde hay más sitio.
  return x < anchoLienzo / 2 ? 'start' : 'end'
}

/// ZON-19 (hito 0.1) — etiqueta de nombre: placa oscura semitransparente con texto claro, en píxeles de
/// pantalla. `anchor` decide hacia dónde crece desde (x, y).
export function EtiquetaNombre({ texto, x = 0, y = 24, anchor = 'middle' }: { texto: string; x?: number; y?: number; anchor?: 'start' | 'middle' | 'end' }) {
  const ancho = anchoEtiqueta(texto)
  const rectX = anchor === 'middle' ? x - ancho / 2 : anchor === 'start' ? x : x - ancho
  return (
    <g pointerEvents="none" data-testid="etiqueta-nombre">
      <rect x={rectX} y={y - 9} width={ancho} height={18} rx={4} fill="var(--color-wood-950)" fillOpacity={0.82} />
      <text
        x={rectX + ancho / 2}
        y={y + 3.8}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--color-wood-100)"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {texto}
      </text>
    </g>
  )
}

/// ZON-17 (hito 0.1) — salida de región como estandarte de camino: placa con una flecha grande hacia el
/// borde (`angulo` en grados, 0 = este) y una etiqueta hacia el interior del mapa con el destino, para
/// que no se salga del lienzo.
export function EstandarteSalida({ escala, angulo, texto }: { escala: number; angulo: number; texto: string }) {
  const rad = (angulo * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const etiqueta = horizontal
    ? { x: dx > 0 ? -20 : 20, y: 0, anchor: (dx > 0 ? 'end' : 'start') as 'start' | 'end' }
    : { x: 0, y: dy > 0 ? -26 : 26, anchor: 'middle' as const }
  return (
    <g transform={`scale(${escala})`}>
      <circle cx={0} cy={0} r={FICHA_AREA_CLIC_PX / 2} fill="transparent" />
      <g filter="url(#sombra-ficha)">
        <circle cx={0} cy={0} r={14} fill={PLACA} fillOpacity={0.92} />
      </g>
      <circle cx={0} cy={0} r={14} fill="none" stroke="var(--color-wood-200)" strokeWidth={2.5} strokeDasharray="5 3" />
      <g transform={`rotate(${angulo})`}>
        <path d="M -7 -7 L 4 0 L -7 7 L -4 0 Z M 1 -7 L 12 0 L 1 7 L 4 0 Z" fill="var(--color-wood-100)" />
      </g>
      {texto && <EtiquetaNombre texto={texto} x={etiqueta.x} y={etiqueta.y} anchor={etiqueta.anchor} />}
    </g>
  )
}
