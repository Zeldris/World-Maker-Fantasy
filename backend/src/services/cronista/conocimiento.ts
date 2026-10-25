// Conocimiento y rumores (CR-18, hito 0.2 — roadmap-cronista.md § 9 y entrada CR-18, rondas 1 y 2
// de diseño con la usuaria, 2026-10-05).
//
// Solo se guarda lo que sabe el personaje (`Conocimiento`). Lo que sabe una región, una facción o un
// NPC se deduce aquí con la regla de alcance: la importancia del suceso dice hasta dónde llega por
// sí sola su noticia y la distancia, cuándo (los retrasos de CR-12).
//
// | Importancia | Lo saben | Retraso |
// |---|---|---|
// | 1-3 | Solo testigos y actores | — |
// | 4-6 | + facciones actoras y su región | al momento |
// | 7-8 | + regiones vecinas | 1 día |
// | 9-10 | Todo Berig | 1 día por salto, tope 3 |
//
// Al personaje le llega solo lo de importancia ≥ 5 (P316, usuaria 2026-10-25: un suceso grave del
// mundo tiene que llegar aunque no esté cerca): dentro del alcance de la tabla, con su retraso; más
// allá (y lo de 5-6 de otra región), como rumor a 1-3 días según la distancia. Y lo de las facciones
// aliadas o con tratado (Q10). Lo demás se sabe viéndolo, preguntando a un NPC o leyendo los bandos
// del tablón (Q9).
import { slugify } from '../../lib/slugify.js';
import { REGIONES_VECINAS } from './regiones.js';
import { distanciaRegiones, retrasoPorDistancia } from './noticias.js';

export type Via = 'TESTIGO' | 'OIDAS' | 'NPC' | 'BANDO' | 'ALIADA';

/// Importancia mínima para que la noticia llegue sola al personaje (nivel «destacado»). P316: antes
/// era 7 (Q10) y no llegaba nada de 5-6: tormentas terribles, plagas, hambrunas, incendios, muertes.
export const IMPORTANCIA_RUMOR_LEJANO = 5;
/// Importancia mínima para que un suceso se sepa más allá de testigos y actores.
export const IMPORTANCIA_SE_SABE = 4;

/// Lo que la regla necesita de un suceso. `origenes`: regiones (nombre de `Location.region`) donde
/// pasó, o de las facciones actoras si no tiene lugar; `facciones`: nombres de las facciones actoras.
export interface SucesoConAlcance {
  importancia: number;
  origenes: string[];
  facciones: string[];
}

/// Cuántos saltos de región llega por sí sola su noticia: null = solo testigos y actores.
export function radioDeAlcance(importancia: number): number | null {
  if (importancia < IMPORTANCIA_SE_SABE) return null;
  if (importancia <= 6) return 0;
  if (importancia <= 8) return 1;
  return Number.POSITIVE_INFINITY;
}

/// Días que tarda en saberse en `region`; null = no llega nunca por sí sola.
export function diasHastaRegion(s: Pick<SucesoConAlcance, 'importancia' | 'origenes'>, region: string): number | null {
  const radio = radioDeAlcance(s.importancia);
  if (radio === null) return null;
  // Sin lugar conocido: solo lo que llega a todo Berig, y a lo más lejos (como CR-12).
  if (s.origenes.length === 0) return radio === Number.POSITIVE_INFINITY ? retrasoPorDistancia(3) : null;
  let mejor: number | null = null;
  for (const origen of s.origenes) {
    const d = distanciaRegiones(origen, region) ?? (radio === Number.POSITIVE_INFINITY ? 3 : null);
    if (d === null || d > radio) continue;
    const dias = retrasoPorDistancia(d);
    if (mejor === null || dias < mejor) mejor = dias;
  }
  return mejor;
}

/// ¿Se sabe ya en `region` tras `diasPasados` días?
export function regionSabe(s: Pick<SucesoConAlcance, 'importancia' | 'origenes'>, region: string, diasPasados: number): boolean {
  const dias = diasHastaRegion(s, region);
  return dias !== null && diasPasados >= dias;
}

/// ¿Lo sabe una facción? Las actoras, al momento, si se sabe más allá de los testigos.
export function faccionSabe(s: Pick<SucesoConAlcance, 'importancia' | 'facciones'>, faccion: string): boolean {
  return s.importancia >= IMPORTANCIA_SE_SABE && s.facciones.includes(faccion);
}

/// ¿Lo sabe un NPC? Lo que se sabe en la región donde está o en su facción.
export function npcSabe(
  s: SucesoConAlcance,
  npc: { region: string | null; faccion: string | null },
  diasPasados: number,
): boolean {
  if (npc.faccion && faccionSabe(s, npc.faccion)) return true;
  return !!npc.region && regionSabe(s, npc.region, diasPasados);
}

/// Lo cuenta como hecho quien es de donde pasó o de una facción implicada; los demás, de oídas.
export function cuentaComoHecho(s: Pick<SucesoConAlcance, 'origenes' | 'facciones'>, npc: { region: string | null; faccion: string | null }): boolean {
  return (!!npc.region && s.origenes.includes(npc.region)) || (!!npc.faccion && s.facciones.includes(npc.faccion));
}

/// Días que tarda en llegar como rumor a `region` desde donde pasó (fuera del alcance de la tabla):
/// 1-3 según la distancia al origen más cercano; sin lugar o fuera del mapa, el máximo (como CR-12).
function diasComoRumorLejano(origenes: string[], region: string): number {
  const distancias = origenes.map((o) => distanciaRegiones(o, region) ?? 3);
  return retrasoPorDistancia(distancias.length > 0 ? Math.min(...distancias) : 3);
}

/// Cuándo y cómo le llega sola la noticia al personaje; null = no le llega sin hacer nada (Q10).
export function llegaSola(
  s: SucesoConAlcance,
  personaje: { region: string | null; aliadas: Set<string> },
): { dias: number; via: Via; confirmado: boolean } | null {
  if (s.importancia >= IMPORTANCIA_SE_SABE && s.facciones.some((f) => personaje.aliadas.has(f))) {
    return { dias: 0, via: 'ALIADA', confirmado: true };
  }
  if (s.importancia < IMPORTANCIA_RUMOR_LEJANO || !personaje.region) return null;
  // Dentro del alcance de la tabla (≥ 7 y vecinas, 5-6 en su región) lo de siempre; fuera, rumor lejano.
  const dias = diasHastaRegion(s, personaje.region) ?? diasComoRumorLejano(s.origenes, personaje.region);
  return { dias, via: 'OIDAS', confirmado: s.origenes.includes(personaje.region) };
}

const REGION_POR_SLUG = new Map(Object.keys(REGIONES_VECINAS).map((r) => [slugify(r), r]));

/// Nombre de región a partir de `Suceso.regionSlug`; null si no es una región del mapa.
export function regionDeSlug(slug: string | null | undefined): string | null {
  return slug ? (REGION_POR_SLUG.get(slug) ?? null) : null;
}
