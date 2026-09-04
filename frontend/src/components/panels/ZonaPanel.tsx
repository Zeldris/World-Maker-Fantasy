import { useEffect, useState } from 'react'
import { getZona, resolveImageUrl, type ZonaResponse, type ZonePointInfo, type ZonaDinamicoInfo, type RegionControlInfo } from '../../lib/api'
import { ZonePointDetailModal, zonaDinamicoToDetailSource } from '../ZonePointDetailModal'

interface ZonaPanelProps {
  saveId: string
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
const TIPO_LABEL: Record<ZonePointInfo['tipo'], string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
  EDIFICIO: 'Edificio',
}

/// Color por reputación con la facción del punto (2026-08-27, Pieza 3 de "Dinamismo del mundo") —
/// verde=aliado, amarillo=neutro, rojo=enemigo; naranja para lo que no tiene facción asociada
/// (fauna salvaje, recursos, seres inertes) — nunca hereda el color de nadie.
///
/// B.11 (checklist frontend 2026-08-27) — mismos tonos exactos (`emerald-500`/`red-500`) que
/// `ReputacionPanel.tsx` usa para Amigable/Enemigo (`emerald-400`/`red-400` en texto), en vez de un
/// verde/rojo hex sueltos sin relación — dos representaciones del mismo concepto de reputación en
/// paneles distintos ahora comparten paleta, aunque cada una siga con su propio número de bandas
/// (aquí 3+SIN_FACCION por punto de mapa, allí 5 por temperamento de combate — legítimamente
/// distintas, no se tocan los umbrales de ninguna).
const COLOR_HEX: Record<ZonePointInfo['color'], string> = {
  ALIADO: '#10b981',
  NEUTRO: '#d4af37',
  ENEMIGO: '#ef4444',
  SIN_FACCION: '#f97316',
}

/// 4 formas fijas por categoría (2026-08-27, diseño cerrado con la usuaria) — círculo=seres vivos
/// genéricos (fauna, grupos sin nombre propio), triángulo=NPC con nombre propio (incluye
/// Companion, sin 5ª forma), cuadrado=edificio, rombo=seres inertes (RECURSO: flora/materiales).
///
/// Rombo alargado verticalmente (checklist frontend 2026-08-27, A.9) — con las mismas proporciones
/// que el círculo (semi-ejes ≈ su radio) ambas formas se confundían a tamaño de icono pequeño,
/// justo el par que separa "fauna cazable" (círculo) de "recurso recolectable" (rombo). El
/// alargado vertical (7 horizontal / 10 vertical, antes 9/9) mantiene el área similar pero rompe
/// la silueta redondeada que lo acercaba al círculo.
function ZonePointShape({ tipo, x, y, color }: { tipo: ZonePointInfo['tipo']; x: number; y: number; color: string }) {
  const common = { fill: color, stroke: 'white', strokeWidth: 1.5 }
  switch (tipo) {
    case 'NPC':
      return <polygon points={`${x},${y - 9} ${x - 8},${y + 7} ${x + 8},${y + 7}`} {...common} />
    case 'EDIFICIO':
      return <rect x={x - 7} y={y - 7} width={14} height={14} {...common} />
    case 'RECURSO':
      return <polygon points={`${x},${y - 10} ${x + 7},${y} ${x},${y + 10} ${x - 7},${y}`} {...common} />
    case 'FAUNA':
      return <circle cx={x} cy={y} r={8} {...common} />
  }
}

/// Punto del jugador en el mapa de Zona (2026-09-04, petición explícita jugando en vivo: "ahora
/// falto yo en la zona") — estrella de 5 puntas negra, forma nunca usada por las 4 categorías de
/// `ZonePointShape` (círculo/triángulo/cuadrado/rombo), color propio (negro, confirmado por la
/// usuaria) distinto de los 4 tonos de reputación. Halo blanco fino + radio algo mayor (11 vs 7-10
/// del resto) para que nunca quede tapado si el jugador coincide con un pin normal (caso real: justo
/// tras cazar/recolectar/combatir, el jugador aparece exactamente sobre ese ZonePoint).
function JugadorMarker({ x, y }: { x: number; y: number }) {
  const puntos = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 11 : 4.5
    const angle = (Math.PI / 5) * i - Math.PI / 2
    return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`
  }).join(' ')
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill="none" stroke="white" strokeWidth={1.5} opacity={0.8} />
      <polygon points={puntos} fill="#0a0a0a" stroke="white" strokeWidth={1.5} />
      <title>Tú estás aquí</title>
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

export function ZonaPanel({ saveId }: ZonaPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ZonaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Modal de detalle (2026-09-04) — comparte un mismo modal entre ZonePoint reales (`puntos`) y
  // dinámicos (`dinamicos`, sin ZonePoint sembrado), vía `zonaDinamicoToDetailSource`.
  const [selectedPoint, setSelectedPoint] = useState<ZonePointInfo | ZonaDinamicoInfo | null>(null)

  useEffect(() => {
    setLoading(true)
    getZona(saveId)
      .then(setData)
      .catch(() => setError('No se pudo cargar la zona.'))
      .finally(() => setLoading(false))
  }, [saveId])

  if (loading) return <p className="text-sm italic text-wood-500">Cargando zona...</p>
  if (error) return <p className="text-sm italic text-wood-500">{error}</p>
  if (!data?.disponible) {
    return <p className="text-sm italic text-wood-500">Esta ubicación todavía no tiene una zona explorable — vuelve al mapa con la otra pestaña.</p>
  }

  const imageUrl = resolveImageUrl(data.imageUrl ?? null)
  const dinamicos = data.dinamicos ?? []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-wood-100">{data.locationName}</p>
        {/* Control regional (2026-08-27, Pieza 5) — placeholder de texto, sin logo real todavía
            (pendiente de generación de imagen, mismo mecanismo que el resto de assets). Tono por
            estado (C.6) para que no se lea como metadata secundaria (mismo tono que un timestamp). */}
        {data.regionControl && <p className={`text-xs font-medium ${regionControlDisplay(data.regionControl).tone}`}>{regionControlDisplay(data.regionControl).text}</p>}
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
          <div className="overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60">
            <svg viewBox="0 0 800 600" className="h-auto w-full">
              {imageUrl && <image href={imageUrl} x={0} y={0} width={800} height={600} preserveAspectRatio="xMidYMid slice" />}
              {data.puntos.map((p) => (
                <g key={p.id} onClick={() => setSelectedPoint(p)} className="cursor-pointer">
                  <ZonePointShape tipo={p.tipo} x={p.x} y={p.y} color={COLOR_HEX[p.color]} />
                  {/* C.5 (checklist frontend 2026-08-27) — con 2 dígitos, el número centrado
                      dentro del icono podía sobresalir de formas estrechas (rombo/triángulo);
                      a partir de 10 se pinta como badge fuera del icono, arriba a la derecha. */}
                  {p.cantidad > 1 && p.cantidad < 10 && (
                    <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white" stroke="black" strokeWidth={0.3}>
                      {p.cantidad}
                    </text>
                  )}
                  {p.cantidad >= 10 && (
                    <>
                      <circle cx={p.x + 9} cy={p.y - 9} r={7} fill="#1a1410" stroke="white" strokeWidth={1} />
                      <text x={p.x + 9} y={p.y - 6} textAnchor="middle" fontSize={8} fontWeight="bold" fill="white">
                        {p.cantidad}
                      </text>
                    </>
                  )}
                  <title>{`${p.nombre}${p.cantidad > 1 ? ` ×${p.cantidad}` : ''} (${TIPO_LABEL[p.tipo]})`}</title>
                </g>
              ))}
              {/* NPC/fauna dinámicos (2026-09-04) — ahora también se pintan como pines reales, con
                  la posición asignada por el backend (`posicionAleatoriaEnLienzo`), reutilizando
                  `ZonePointShape` tal cual (su `tipo` ya es subconjunto válido). */}
              {dinamicos.map((d) => (
                <g key={d.slug} onClick={() => setSelectedPoint(d)} className="cursor-pointer">
                  <ZonePointShape tipo={d.tipo} x={d.x} y={d.y} color={COLOR_HEX[d.color]} />
                  <title>{`${d.nombre} (${TIPO_LABEL[d.tipo]})`}</title>
                </g>
              ))}
              {data.jugador && <JugadorMarker x={data.jugador.x} y={data.jugador.y} />}
            </svg>
          </div>
        )}
        {/* UX 2026-09-01 (hallazgo jugando en vivo): el mapa usa 4 formas (círculo=Fauna,
            triángulo=NPC, cuadrado=Edificio, rombo=Recurso) y 4 colores de reputación con la
            facción del punto, pero no explicaba el código a una jugadora nueva. `<details>` nativo
            — colapsable sin JS extra, cerrado por defecto para no competir visualmente con el
            mapa; mismos `COLOR_HEX`/`TIPO_LABEL` que usa el propio SVG de arriba, así que nunca
            puede desincronizarse de lo que de verdad se pinta. Formas dibujadas con el mismo
            `ZonePointShape` de los pines reales, a tamaño de leyenda (viewBox propio 20×20), en
            vez de reconstruir cada silueta a mano en CSS. */}
        {(data.puntos.length > 0 || dinamicos.length > 0 || data.jugador) && (
          <details className="group rounded-lg border border-iron-700 bg-wood-950/40 text-2xs text-wood-400">
            <summary className="tactile flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 font-semibold uppercase tracking-[0.1em] text-wood-500 marker:content-none">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
              Leyenda del mapa
            </summary>
            <div className="flex flex-col gap-2 border-t border-iron-800 px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(Object.keys(TIPO_LABEL) as ZonePointInfo['tipo'][]).map((tipo) => (
                  <span key={tipo} className="flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                      <ZonePointShape tipo={tipo} x={12} y={12} color="#8a8578" />
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
              </div>
            </div>
          </details>
        )}
        {data.puntos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {data.puntos.map((p) => (
              <button type="button"
                key={p.id}
                onClick={() => setSelectedPoint(p)}
                className="tactile flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-1.5 text-left text-xs transition-colors hover:border-accent-600/60"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_HEX[p.color] }} />
                <span className="text-wood-100">
                  {p.nombre}
                  {p.cantidad > 1 && <span className="text-wood-500"> ×{p.cantidad}</span>}
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
      {selectedPoint &&
        ('id' in selectedPoint ? (
          <ZonePointDetailModal point={selectedPoint} onClose={() => setSelectedPoint(null)} />
        ) : (
          <ZonePointDetailModal point={zonaDinamicoToDetailSource(selectedPoint)} onClose={() => setSelectedPoint(null)} />
        ))}
    </div>
  )
}
