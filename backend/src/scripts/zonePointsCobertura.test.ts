import { describe, it, expect } from 'vitest';
import {
  zonePoints,
  locations,
  locationTerrainTags,
  faunaTerrainTag,
  harvestSourceTerrainTag,
  harvestSourceHomeLocationSlug,
  harvestYields,
} from './worldCatalog.js';
import { worldPopulations } from './worldPopulation.js';
import { pasaFiltroTerreno } from '../services/terrain.js';
import { matchesHarvestSourceHome } from '../services/harvest.js';
import { stripRegionArticle } from '../services/population.js';

/// Test de cobertura de mapa — Fase 3 del plan "lo que funciona por zona se hace desde la zona"
/// (docs/registros/plan-mecanicas-por-zona-2026-09-28.md): con la caza/recolección pasando a
/// exigir colisión con un `ZonePoint` real, cualquier fuente con presencia en Las Llanuras del
/// Viento Rojo que no tenga NINGÚN `ZonePoint` en una Location de la región (compatible con el
/// mismo filtro de terreno/home que ya usa el motor) sería imposible de obtener. Test unitario
/// puro (sin BD): reconstruye el mismo cruce que `candidateFaunaFor` (cazar.ts) y
/// `candidateSourcesFor` (recolectar.ts) a partir solo de los datos del catálogo.

const REGION = 'Las Llanuras del Viento Rojo';

const llanurasLocationSlugs = new Set(
  locations.filter((l) => l.region === REGION).map((l) => l.slug),
);

/// Fauna cazable con presencia en la región — mismo criterio que `candidateFaunaFor` (cazar.ts):
/// `WorldPopulation.targetType === 'FAUNA'` con `distribucion[stripRegionArticle(region)] > 0`.
/// Incluye especies sin fila propia en `harvestYields` (p.ej. Ruptidar) — el propio comentario de
/// la tarea lo señala como el caso real que demuestra por qué `candidateFaunaFor` NO se limita a
/// `harvestYields`.
const faunaConPresenciaEnLlanuras = worldPopulations
  .filter((pop) => pop.targetType === 'FAUNA')
  .filter((pop) => (pop.distribucion[stripRegionArticle(REGION)] ?? 0) > 0)
  .map((pop) => pop.targetSlug);

/// Excepción documentada — NO se trata de fauna real cazable desde el mapa: son 3 Npc humanos
/// itinerantes (`kind: 'PLANTILLA'`, sin `homeLocationSlug` fijo, sin `faunaCategoria`) cuya fila
/// `WorldPopulation.targetType: 'FAUNA'` existe solo para alimentar la sugerencia ambiental de
/// encuentro de texto libre (`turnResolution.ts`, ver comentario junto a su siembra en
/// `worldPopulation.ts` § "NPCs itinerantes sin homeLocationSlug fijo") — nunca tuvieron intención
/// de ser "cazados" desde un punto fijo del mapa de zona, y anclarlos a una Location concreta
/// contradiría su propio diseño ("itinerante"). Confirmado contra la BD real (ninguno tiene NUNCA
/// un ZonePoint, en ninguna región) antes de excluirlos aquí.
const FAUNA_ITINERANTE_SIN_MAPA_EXCEPCION = new Set(['mercader-de-paso', 'orco-expulsado', 'peregrino-de-los-tumulos']);

/// Excepción documentada — Espina del Viento tiene fila `WorldPopulation.targetType: 'FAUNA'` Y
/// una fila `HarvestYield.metodoObtencion: 'CAZA'`, pero NINGÚN `Npc` propio en el catálogo (sin
/// `fauna.find(f => f.slug === 'espina-del-viento')`) — `candidateFaunaFor` (cazar.ts) hace un JOIN
/// contra `Npc` después del filtro de población, así que sin fila `Npc` NUNCA puede salir como
/// candidato real, con o sin `ZonePoint`; y su `HarvestYield` de método CAZA tampoco pasa nunca por
/// `candidateSourcesFor` (recolectar.ts): ese método solo alimenta la tabla de despiece/desuello
/// tras matarla (`carcassCandidatesFor`), un camino totalmente distinto. Su `ZonePoint` real
/// (RECURSO, Fosa Horadada, ya sembrado en la ampliación 2026-08-31) es un hito narrativo de
/// "madriguera", no una fuente cazable/recolectable de las que cubre este test.
const FAUNA_SIN_NPC_PROPIO_EXCEPCION = new Set(['espina-del-viento']);

/// Excepción documentada por diseño (no un fallo) — estas 6 especies de pez/marisco tienen fila
/// `WorldPopulation.targetType: 'FAUNA'` (así lo pide el pool de encuentro ambiental) Y su propio
/// `HarvestYield` de método PESCA/BUSQUEDA, pero esta misma ampliación las siembra como
/// `tipo: 'RECURSO'` (instrucción explícita del plan: "Pesca/Búsqueda como tipo: RECURSO en zonas
/// de agua") — se comprueban en el segundo test (RECURSO), no en este de fauna cazable con Cazar.
/// Nota aparte para Álvaro (no corregida aquí, fuera de alcance — ninguna especie/lore tocada): las
/// 6 fichas tienen `medio` por defecto (`@default([TERRESTRE])`, schema.prisma) sin `ACUATICO`
/// declarado en su catálogo pese a ser peces — si algún día se corrige, `candidateFaunaFor` SÍ las
/// devolvería también como candidatas de Cazar (no las excluye el filtro de "puramente acuático"
/// tal y como está hoy), y entonces necesitarían además su propio `ZonePoint` FAUNA.
const FAUNA_MODELADA_COMO_RECURSO_PESCA_EXCEPCION = new Set([
  'jashil-rojo', 'jashil-verde', 'negueo-solar', 'negueo-turquesa', 'toluh', 'bulco-de-arena',
]);

/// Excepción documentada — conflicto de datos YA EXISTENTE (no introducido por esta tarea, y fuera
/// de su alcance arreglar: solo se piden posiciones de mapa, no re-etiquetar terreno/lore):
/// `harvestSourceHomeLocationSlug`/`Npc.homeLocationSlug` ancla la fuente EN EXCLUSIVA a una única
/// Location cuyo propio `locationTerrainTags` NO incluye el `faunaTerrainTag`/`harvestSourceTerrainTag`
/// de la fuente — ninguna Location de la región puede pasar los dos filtros de
/// `candidateFaunaFor`/`candidateSourcesFor` a la vez, así que ningún `ZonePoint` real puede
/// cumplir la cobertura. Las 2 primeras son parte de la lista original de 23 fuentes de esta tarea;
/// las otras 3 (`ferike`, `telda-ceniza`, `temune`) las descubrió este mismo test al comprobar
/// TODA fuente con presencia en la región (no solo las 23) — `ferike`/`telda-ceniza` ya tenían
/// `ZonePoint` FAUNA/RECURSO real desde antes de esta tarea (2026-08-31), pero en la única
/// Location de su candado (`cruce-de-las-cenizas`), que nunca tuvo el tag 'humedo' que exige su
/// propia especie. Necesitan una decisión de lore (¿corregir el tag de terreno de la Location, o
/// el de la fuente?) que le corresponde a Álvaro, ver docs/runbooks/ampliar-lore.md — NO se relaja
/// el test para estos 5 casos, se documentan aquí y se reportan en el resumen de la tarea.
const CONFLICTO_TERRENO_VS_HOME_EXCEPCION: Record<string, string> = {
  // Vacía desde el 2026-09-29: Álvaro decidió corregir el terreno de las 6 fichas para que case con
  // el lugar donde viven (worldCatalog.ts).
};

function pasaFiltroFauna(locationSlug: string, targetSlug: string): boolean {
  if (!pasaFiltroTerreno(locationTerrainTags[locationSlug], faunaTerrainTag[targetSlug])) return false;
  if (!matchesHarvestSourceHome(harvestSourceHomeLocationSlug[targetSlug], locationSlug)) return false;
  return true;
}

function pasaFiltroRecurso(locationSlug: string, targetSlug: string, esFauna: boolean): boolean {
  const tag = esFauna ? faunaTerrainTag[targetSlug] : harvestSourceTerrainTag[targetSlug];
  if (!pasaFiltroTerreno(locationTerrainTags[locationSlug], tag)) return false;
  // Fauna (PESCA/BUSQUEDA) no usa `harvestSourceHomeLocationSlug` — mismo criterio exacto que
  // `candidateSourcesFor` (recolectar.ts): esas fuentes ya tienen `Npc.homeLocationSlug` propio.
  if (esFauna) return true;
  if (!matchesHarvestSourceHome(harvestSourceHomeLocationSlug[targetSlug], locationSlug)) return false;
  return true;
}

/// Métodos de `HarvestYield` cuya fuente es fauna (mismo criterio que `esFaunaMetodo`, recolectar.ts).
const METODOS_FAUNA = new Set(['PESCA', 'BUSQUEDA']);

/// Métodos que este test cubre como `tipo: 'RECURSO'` en `zonePoints` — CAZA queda fuera a
/// propósito: sus fuentes son `tipo: 'FAUNA'` en `zonePoints` y ya se comprueban en el test de
/// arriba (mismo criterio que `candidateFaunaFor`, no `candidateSourcesFor`). PASIVO también queda
/// fuera: usa `pasivoCandidatesFor` (recolectar.ts), un candado de Location OBLIGATORIO distinto
/// (nunca "sin candado = elegible en toda la región") y sus 2 fuentes reales
/// (`murgoles-domados-campamento`, `restos-personales-maktor`) ya tenían `ZonePoint` real antes de
/// esta tarea — fuera del alcance de la lista de 23 fuentes que faltaban (ver plan, Fase 3).
const METODOS_RECURSO_CUBIERTOS = new Set(['TALA', 'MINERIA', 'EXTRACCION', 'PESCA', 'BUSQUEDA']);

describe('cobertura de mapa — Las Llanuras del Viento Rojo (Fase 3)', () => {
  it('toda fauna cazable con presencia en la región tiene ≥1 ZonePoint FAUNA compatible', () => {
    const sinCobertura: string[] = [];
    for (const slug of new Set(faunaConPresenciaEnLlanuras)) {
      if (FAUNA_ITINERANTE_SIN_MAPA_EXCEPCION.has(slug)) continue;
      if (FAUNA_SIN_NPC_PROPIO_EXCEPCION.has(slug)) continue;
      if (FAUNA_MODELADA_COMO_RECURSO_PESCA_EXCEPCION.has(slug)) continue;
      if (CONFLICTO_TERRENO_VS_HOME_EXCEPCION[slug]) continue;
      const puntos = zonePoints.filter(
        (p) => p.tipo === 'FAUNA' && p.targetSlug === slug && llanurasLocationSlugs.has(p.locationSlug),
      );
      const algunoValido = puntos.some((p) => pasaFiltroFauna(p.locationSlug, slug));
      if (!algunoValido) sinCobertura.push(slug);
    }
    expect(sinCobertura).toEqual([]);
  });

  it('toda fuente de HarvestYield con presencia en la región tiene ≥1 ZonePoint compatible', () => {
    const sourceSlugs = new Set(harvestYields.map((r) => r.sourceSlug));
    const metodoBySlug = new Map(harvestYields.map((r) => [r.sourceSlug, r.metodoObtencion]));
    const poblacionSlugsConPresencia = new Set(
      worldPopulations
        .filter((pop) => (pop.distribucion[stripRegionArticle(REGION)] ?? 0) > 0)
        .map((pop) => pop.targetSlug),
    );
    const sinCobertura: string[] = [];
    for (const slug of sourceSlugs) {
      if (!poblacionSlugsConPresencia.has(slug)) continue;
      if (CONFLICTO_TERRENO_VS_HOME_EXCEPCION[slug]) continue;
      const metodo = metodoBySlug.get(slug)!;
      if (!METODOS_RECURSO_CUBIERTOS.has(metodo)) continue;
      const esFauna = METODOS_FAUNA.has(metodo);
      const puntos = zonePoints.filter(
        (p) => p.tipo === 'RECURSO' && p.targetSlug === slug && llanurasLocationSlugs.has(p.locationSlug),
      );
      const algunoValido = puntos.some((p) => pasaFiltroRecurso(p.locationSlug, slug, esFauna));
      if (!algunoValido) sinCobertura.push(slug);
    }
    expect(sinCobertura).toEqual([]);
  });

  it('ya no quedan conflictos de terreno contra hogar (resueltos el 2026-09-29)', () => {
    expect(Object.keys(CONFLICTO_TERRENO_VS_HOME_EXCEPCION)).toEqual([]);
  });

  /// Fase 6 (plan Oct 2026): toda Location de Las Llanuras debe tener >=1 ZonePoint, salvo las
  /// excepciones de esta lista. Hoy solo `jakut-ger-interior` (kind 'interior'): es el salón
  /// interior de Trono Rojo, "fuera del núcleo jugable actual" según el propio catálogo, y el
  /// lore (docs/rpgtarkor) no fija qué NPC/fuentes hay dentro — poblarlo exigiría lore nuevo, así que
  /// queda a la espera de una propuesta aprobada por Álvaro. Los demás interiores
  /// (`campamento-serhu-interior`) ya tienen puntos y no necesitan excepción.
  const LOCATION_SIN_PUNTOS_EXCEPCION = new Set(['jakut-ger-interior']);

  it('toda Location de Las Llanuras tiene >=1 ZonePoint (salvo excepciones justificadas)', () => {
    const conPuntos = new Set(zonePoints.map((p) => p.locationSlug));
    const sinPuntos = [...llanurasLocationSlugs].filter(
      (slug) => !conPuntos.has(slug) && !LOCATION_SIN_PUNTOS_EXCEPCION.has(slug),
    );
    expect(sinPuntos).toEqual([]);
    // La excepción solo puede ser un interior real; si alguien la puebla, hay que quitarla de la lista.
    for (const slug of LOCATION_SIN_PUNTOS_EXCEPCION) {
      expect(locations.find((l) => l.slug === slug)?.kind).toBe('interior');
      expect(conPuntos.has(slug)).toBe(false);
    }
  });

  it('ningún par de ZonePoint de la misma Location de Las Llanuras queda a menos de 60px', () => {
    const porLocation = new Map<string, { x: number; y: number; targetSlug: string }[]>();
    for (const p of zonePoints) {
      if (!llanurasLocationSlugs.has(p.locationSlug)) continue;
      if (!porLocation.has(p.locationSlug)) porLocation.set(p.locationSlug, []);
      porLocation.get(p.locationSlug)!.push({ x: p.x, y: p.y, targetSlug: p.targetSlug });
    }
    const violaciones: string[] = [];
    for (const [locationSlug, puntos] of porLocation) {
      for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
          const a = puntos[i];
          const b = puntos[j];
          const distancia = Math.hypot(a.x - b.x, a.y - b.y);
          if (distancia < 60) {
            violaciones.push(`${locationSlug}: ${a.targetSlug}(${a.x},${a.y}) vs ${b.targetSlug}(${b.x},${b.y}) = ${distancia.toFixed(1)}px`);
          }
        }
      }
    }
    expect(violaciones).toEqual([]);
  });

  it('todo ZonePoint de Las Llanuras queda dentro del lienzo [40,760]×[40,560]', () => {
    const fueraDeMargen: string[] = [];
    for (const p of zonePoints) {
      if (!llanurasLocationSlugs.has(p.locationSlug)) continue;
      if (p.x < 40 || p.x > 760 || p.y < 40 || p.y > 560) {
        fueraDeMargen.push(`${p.locationSlug}: ${p.targetSlug}(${p.x},${p.y})`);
      }
    }
    expect(fueraDeMargen).toEqual([]);
  });
});
