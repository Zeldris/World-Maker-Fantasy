import { useEffect, useState } from 'react'
import type { RegionControlInfo, ZonePointInfo } from './api'
import type { ZonaPinTipo } from '../components/ZonePointDetailModal'

/// Datos y medida de las fichas del mapa de zona (Z-A, hito 0.1) — fuera de `zona/FichaZona.tsx` para
/// que ese archivo solo exporte componentes.

/// ZON-10 (Z12) — colores de disposición desde los tokens de `index.css`, no hexes sueltos.
export const COLOR_DISPOSICION: Record<ZonePointInfo['color'], string> = {
  ALIADO: 'var(--color-moss-400)',
  NEUTRO: 'var(--color-wood-200)',
  ENEMIGO: 'var(--color-danger-400)',
  SIN_FACCION: 'var(--color-cost-400)',
  INERTE: 'var(--color-accent2-400)',
}

/// ZON-11 — unidades de viewBox por píxel de pantalla del `<svg>`. Devuelve una ref de callback (el
/// `<svg>` del mapa se monta cuando llegan los datos, después del primer render) y la escala; sin
/// `ResizeObserver` (tests) la escala es 1.
export function useEscalaPantalla(anchoViewBox = 800, altoViewBox = 600): { ref: (el: SVGSVGElement | null) => void; escala: number } {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    if (!svg || typeof ResizeObserver === 'undefined') return
    const medir = () => {
      // `preserveAspectRatio` por defecto (meet): manda el eje que más reduce.
      const { width, height } = svg.getBoundingClientRect()
      if (width > 0 && height > 0) setEscala(Math.max(anchoViewBox / width, altoViewBox / height))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [svg, anchoViewBox, altoViewBox])
  return { ref: setSvg, escala }
}

/// Etiqueta de cada tipo de punto de la zona (ZON-80: sale de ZonaPanel.tsx para compartirla con la leyenda).
export const TIPO_LABEL: Record<ZonaPinTipo, string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
  EDIFICIO: 'Edificio',
  // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — único tipo exclusivo de
  // `dinamicos` (instancia por partida, nunca `ZonePoint` de catálogo).
  OBJETO: 'Objeto en el suelo',
  CADAVER: 'Cadáver',
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
/// ZON-10 (hito 0.1, Z12) — ahora sale de los tokens del juego (`COLOR_DISPOSICION`, zona/FichaZona.tsx).
export const COLOR_HEX: Record<ZonePointInfo['color'], string> = COLOR_DISPOSICION

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

export function regionControlDisplay(control: RegionControlInfo): { text: string; tone: string } {
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

/// Disposición de un punto en palabras (ZON-40: tarjeta y menú de la ficha; también la ficha completa).
export const DISPOSICION_LABEL: Record<ZonePointInfo['color'], string> = {
  ALIADO: 'Aliado',
  NEUTRO: 'Neutro',
  ENEMIGO: 'Enemigo',
  SIN_FACCION: 'Sin facción',
  INERTE: 'Salvaje',
}

/// Distancia en celdas (de 50) entre dos puntos del lienzo: cuántos pasos hay como mínimo.
export function distanciaEnCeldas(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(Math.floor(a.x / 50) - Math.floor(b.x / 50)), Math.abs(Math.floor(a.y / 50) - Math.floor(b.y / 50)))
}

