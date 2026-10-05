// CR-20 (hito 0.2) — piezas de las Leyendas de la partida (ver `components/panels/LeyendasPanel.tsx`).
import type { EntradaLeyenda, FamiliaSuceso, NivelLeyenda } from './api'
import { diaDeFiccion } from './noticias'
import type { LogEntry } from '../types'

/// INT-1: cada familia de sucesos con su icono y su color, iguales en Leyendas, rumores y fichas.
export const FAMILIA_ESTILO: Record<FamiliaSuceso, { icono: string; label: string; color: string }> = {
  CLIMA: { icono: '🌦️', label: 'Clima', color: 'text-accent2-300' },
  NATURAL: { icono: '🌿', label: 'Naturaleza', color: 'text-moss-400' },
  VIDA_MUERTE: { icono: '🕯️', label: 'Vida y muerte', color: 'text-wood-200' },
  DIPLOMACIA: { icono: '🤝', label: 'Diplomacia', color: 'text-quest-400' },
  FACCION: { icono: '🚩', label: 'Facciones', color: 'text-wood-300' },
  ECONOMIA: { icono: '🐪', label: 'Economía', color: 'text-cost-400' },
  REINO: { icono: '🏰', label: 'Tu Reino', color: 'text-accent-300' },
  JUGADOR: { icono: '⚔️', label: 'Tus hechos', color: 'text-accent-300' },
  LORE: { icono: '📜', label: 'Leyenda antigua', color: 'text-wood-300' },
  SISTEMA: { icono: '✒️', label: 'Crónica', color: 'text-wood-400' },
}

/// Muertes en color de peligro (INT-1: vida y muerte, `danger` para las muertes).
export function colorDeEntrada(e: Pick<EntradaLeyenda, 'familia' | 'tipo'>): string {
  return e.familia === 'VIDA_MUERTE' && e.tipo.startsWith('MUERTE') ? 'text-danger-400' : FAMILIA_ESTILO[e.familia].color
}

/// INT-2: 1-4 sin marca, 5-7 con borde, 8-10 con sello de lacre.
export const NIVEL_CLASES: Record<NivelLeyenda, string> = {
  NORMAL: 'border-transparent',
  DESTACADO: 'border-iron-700',
  GRAVE: 'border-danger-600/70',
}

/// Día en que pasó; un rumor no lo sabe con certeza y va al día en que se supo.
export function diaDeEntrada(e: Pick<EntradaLeyenda, 'cuando' | 'sabidoEn'>): number {
  return diaDeFiccion(e.cuando ?? e.sabidoEn)
}

/// Crónica por días o por semanas (de 7 días), lo más reciente primero, con su etiqueta.
export function agruparCronica(entradas: EntradaLeyenda[], por: 'dia' | 'semana'): { clave: number; etiqueta: string; entradas: EntradaLeyenda[] }[] {
  const grupos = new Map<number, EntradaLeyenda[]>()
  for (const e of entradas) {
    const dia = diaDeEntrada(e)
    const clave = por === 'dia' ? dia : Math.floor((dia - 1) / 7) + 1
    grupos.set(clave, [...(grupos.get(clave) ?? []), e])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => b - a)
    .map(([clave, lista]) => ({
      clave,
      etiqueta: por === 'dia' ? `Día ${clave}` : `Semana ${clave} (días ${(clave - 1) * 7 + 1}-${clave * 7})`,
      entradas: lista,
    }))
}

export type SeccionEntidad = 'personajes' | 'facciones' | 'lugares'

const TIPOS_DE_SECCION: Record<SeccionEntidad, string[]> = {
  personajes: ['PERSONAJE', 'NPC', 'COMPANERO'],
  facciones: ['FACCION'],
  lugares: ['REGION', 'LOCATION', 'TERRITORIO', 'EDIFICIO'],
}

/// Entidades de una sección (Personajes, Facciones, Lugares) con lo que se sabe de cada una, las de
/// más sucesos primero. Los lugares cuentan también dónde pasó cada cosa (región y lugar).
export function porEntidad(entradas: EntradaLeyenda[], seccion: SeccionEntidad): { clave: string; nombre: string; entradas: EntradaLeyenda[] }[] {
  const grupos = new Map<string, { nombre: string; entradas: EntradaLeyenda[] }>()
  const anadir = (clave: string, nombre: string, e: EntradaLeyenda) => {
    const g = grupos.get(clave) ?? { nombre, entradas: [] }
    if (!g.entradas.includes(e)) g.entradas.push(e)
    grupos.set(clave, g)
  }
  for (const e of entradas) {
    for (const a of e.actores) if (TIPOS_DE_SECCION[seccion].includes(a.tipo)) anadir(`${a.tipo}|${a.id}`, a.nombre, e)
    if (seccion === 'lugares') {
      if (e.region) anadir(`REGION|${e.region}`, e.region, e)
      if (e.lugar) anadir(`LOCATION|${e.lugar.id}`, e.lugar.nombre, e)
    }
  }
  return [...grupos.entries()]
    .map(([clave, g]) => ({ clave, ...g }))
    .sort((a, b) => b.entradas.length - a.entradas.length || a.nombre.localeCompare(b.nombre))
}

/// Línea temporal: solo lo destacado y lo grave, de lo más antiguo a lo más reciente.
export function lineaTemporal(entradas: EntradaLeyenda[]): EntradaLeyenda[] {
  return entradas.filter((e) => e.nivel !== 'NORMAL').sort((a, b) => diaDeEntrada(a) - diaDeEntrada(b))
}

/// CR-20 (20b): fichas de la Enciclopedia con sección «En tu partida».
export type FichaConLeyendas = 'npc' | 'faction' | 'location'

export function esFichaConLeyendas(tipo: string | undefined): tipo is FichaConLeyendas {
  return tipo === 'npc' || tipo === 'faction' || tipo === 'location'
}

/// INT-9: un rumor de «El mundo» con lugar, para marcar su región en el mapa de Berig.
export interface RumorConLugar {
  sucesoId: string
  region: string
  texto: string
}

/// Rumores con región de las noticias de «El mundo» que aún no se han confirmado (una noticia
/// posterior del mismo suceso sin marca de rumor lo confirma), uno por suceso.
export function rumoresConLugar(log: LogEntry[]): RumorConLugar[] {
  // Un resumen de varios días (UX-31) guarda cada noticia como una línea con sus propios metadatos.
  const noticias = log.flatMap((e) => {
    if (!e.noticia?.resumen) return e.noticia ? [{ texto: e.text, meta: e.noticia }] : []
    const lineas = e.text.split('\n').slice(1).map((l) => l.replace(/^• /, ''))
    return lineas.flatMap((texto, i) => (e.noticia?.lineas?.[i] ? [{ texto, meta: e.noticia.lineas[i]! }] : []))
  })
  const confirmados = new Set(noticias.filter((n) => n.meta.sucesoId && !n.meta.rumor).map((n) => n.meta.sucesoId!))
  const vistos = new Set<string>()
  const rumores: RumorConLugar[] = []
  for (const { texto, meta } of noticias) {
    const id = meta.sucesoId
    const region = meta.rumor?.region
    if (!id || !region || confirmados.has(id) || vistos.has(id)) continue
    vistos.add(id)
    rumores.push({ sucesoId: id, region, texto })
  }
  return rumores
}

/// CR-46: dónde dibujar una expedición entre su origen y su destino (ida hasta la mitad del viaje,
/// vuelta después). Null si alguno de los dos no está en el mapa.
export function posicionDeExpedicion(
  origen: { x: number; y: number } | undefined,
  destino: { x: number; y: number } | undefined,
  progreso: number,
): { x: number; y: number; vuelve: boolean } | null {
  if (!origen || !destino) return null
  const vuelve = progreso > 0.5
  const t = vuelve ? (1 - progreso) * 2 : progreso * 2
  return { x: origen.x + (destino.x - origen.x) * t, y: origen.y + (destino.y - origen.y) * t, vuelve }
}
