import { prisma } from '../lib/prisma.js';
import { normalizeText } from './travel.js';
import { harvestSourceHomeLocationSlug } from '../scripts/worldCatalog.js';

/// Revelado progresivo (docs/14-combate-y-muerte.md § 3.1): para una búsqueda/recolección
/// GENÉRICA (sin especie concreta mencionada — eso lo cubre harvest.ts), el backend decide
/// antes de narrar una lista fija de 2-4 hallazgos leyendo el catálogo real del mundo. El
/// modelo solo narra la escena general; el frontend revela la lista ya decidida uno a uno.

const SEARCH_INTENT_REGEX = /busc|explor|rebusc|recog|recolect|rastre/;

export function detectsSearchIntent(action: string): boolean {
  return SEARCH_INTENT_REGEX.test(normalizeText(action));
}

export interface DiscoveryItem {
  itemCatalogSlug: string;
  name: string;
  cantidad: number;
}

const MIN_DISCOVERIES = 2;
const MAX_DISCOVERIES = 4;

/// Fisher-Yates real (auditoría 2026-07-22): `sort(() => Math.random() - 0.5)` no da una
/// permutación uniforme (sesga hacia ciertos órdenes según cómo implemente el sort el motor JS)
/// — sin impacto grave aquí (solo decide qué hallazgo de sabor sale primero), pero es una línea
/// arreglarlo del todo. No muta el array de entrada.
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Nombres "núcleo" de región (auditoría 2026-07-24, segunda vuelta — probado en vivo contra la
// partida real de Gorhorn: la primera versión de este filtro dejó pasar "Cuña de hielo sílice sin
// tallar", un material de `ItemCatalog` cuyo `lugarOrigen` dice explícitamente "Cristal Helado.",
// porque no tiene fila `Npc` propia — el filtro original solo cubría fauna). `Location.region` usa
// el artículo completo ("Las Llanuras del Viento Rojo"), pero `lugarOrigen` es texto libre que casi
// siempre lo abrevia sin artículo ("Clan Serhu, Llanuras del Viento Rojo.") — de ahí el núcleo sin
// "Las/El/La", comparado por subcadena en ambos sentidos.
export const REGION_CORE_NAMES = ['Llanuras del Viento Rojo', 'Cristal Helado', 'Ciénaga Troncal', 'Margen Silencioso', 'Meseta del Orden'];

function regionsMentionedIn(text: string): string[] {
  return REGION_CORE_NAMES.filter((r) => text.includes(r));
}

/// Exportado (2026-07-29, colapsables de fauna/flora por zona en la Enciclopedia) — mismo
/// criterio de "núcleo sin artículo, comparado por subcadena" que ya usa `selectDiscoveries` de
/// aquí mismo, reutilizado tal cual en world.ts en vez de duplicar la lista/lógica.
export function coreRegionOf(text: string | null | undefined): string | null {
  if (!text) return null;
  return REGION_CORE_NAMES.find((r) => text.includes(r)) ?? null;
}

/// Selecciona 2-4 hallazgos de los recursos ya cosechables del mundo — el backend decide QUÉ
/// hay, nunca el modelo.
///
/// Filtro por región (auditoría 2026-07-24, "revisa todo bien bien" — el propio comentario de
/// arriba ya admitía que esto era solo v1 "todo pertenece a Llanuras", pero el mundo lleva desde
/// entonces creciendo a 4-5 regiones sin que nadie volviera a tocar esto): explorar en Ciénaga
/// Troncal podía "encontrar" fauna que solo tiene sentido en Llanuras. Dos fuentes de dato real,
/// combinadas: (1) fauna cazable con `homeLocationSlug` fijo (mismo dato que ya usa `harvest.ts`/
/// `entityDiscovery.ts`); (2) el `lugarOrigen` de `ItemCatalog` cuando menciona una región
/// concreta (texto libre ya existente para la Enciclopedia, nunca escrito para esto pero
/// reutilizable). Lo que no tiene ninguna de las dos señales (fauna itinerante sin
/// `homeLocationSlug`, o un `lugarOrigen` sin ninguna región reconocible) se queda sin filtrar en
/// vez de inventar una región — mismo límite ya documentado en `harvest.ts`.
export async function selectDiscoveries(worldId: string, currentLocationId: string | null): Promise<DiscoveryItem[]> {
  const [allYields, currentLocation] = await Promise.all([
    // Solo PASIVO (2026-07-29, bug real jugando: "al explorar la zona me saca recursos que no
    // tiene sentido obtener directamente") — antes esta consulta traía TODA la tabla, fauna
    // incluida, así que pieles/huesos/colmillos (que exigen cazar+desollar) podían "aparecer"
    // solos al explorar. Lo que exige caza/tala/minería/extracción deliberada nunca sale aquí,
    // solo por harvest.ts nombrando la fuente y usando el verbo correcto.
    prisma.harvestYield.findMany({ where: { worldId, metodoObtencion: 'PASIVO' }, include: { item: true } }),
    currentLocationId ? prisma.location.findUnique({ where: { id: currentLocationId }, select: { region: true, slug: true } }) : Promise.resolve(null),
  ]);
  if (allYields.length === 0) return [];

  // Fuentes ligadas a una Location CONCRETA (auditoría 2026-08-14, "restos-personales-maktor"/
  // "ofrendas-tumulos-honor" — un mero acuerdo de región las dejaba salir en cualquier sitio de Las
  // Llanuras, incluida la primerísima escena) — se descarta ANTES de calcular `candidates` más
  // abajo, no dentro de su filtro: el fallback "si no queda nada, no filtres" de más abajo existe
  // para no devolver la lista vacía nunca, pero eso mismo anulaba el candado por completo en
  // cuanto TODO el bucket PASIVO quedaba ligado a un sitio (como pasa ahora mismo: hoy son los
  // únicos 6 yields PASIVO que existen) — sin este corte antes, el fallback los devolvía igual en
  // cualquier otro lado. Cortado aquí, ni el fallback puede resucitarlos fuera de su sitio.
  const yields = allYields.filter((y) => {
    const lockedLocationSlug = harvestSourceHomeLocationSlug[y.sourceSlug];
    return !lockedLocationSlug || currentLocation?.slug === lockedLocationSlug;
  });
  if (yields.length === 0) return [];

  let candidates = yields;
  if (currentLocation) {
    const currentRegionCore = REGION_CORE_NAMES.find((r) => currentLocation.region.includes(r));

    const faunaWithHome = await prisma.npc.findMany({
      where: { worldId, homeLocationSlug: { not: null } },
      select: { slug: true, homeLocationSlug: true },
    });
    const homeSlugs = [...new Set(faunaWithHome.map((n) => n.homeLocationSlug!))];
    const homeLocations = homeSlugs.length
      ? await prisma.location.findMany({ where: { worldId, slug: { in: homeSlugs } }, select: { slug: true, region: true } })
      : [];
    const regionByHomeSlug = new Map(homeLocations.map((l) => [l.slug, l.region]));
    const regionBySourceSlug = new Map(
      faunaWithHome.map((n) => [n.slug, n.homeLocationSlug ? regionByHomeSlug.get(n.homeLocationSlug) : undefined]),
    );

    candidates = yields.filter((y) => {
      // Ya ligadas a su Location exacta arriba — si sobrevivieron el corte de `yields`, ya están
      // en el sitio correcto, dejarlas pasar de largo el resto de reglas (región/lugarOrigen).
      if (harvestSourceHomeLocationSlug[y.sourceSlug]) return true;
      const faunaRegion = regionBySourceSlug.get(y.sourceSlug);
      if (faunaRegion) return faunaRegion === currentLocation.region;
      const mentioned = y.item.lugarOrigen ? regionsMentionedIn(y.item.lugarOrigen) : [];
      if (mentioned.length === 0 || !currentRegionCore) return true;
      return mentioned.includes(currentRegionCore);
    });
    if (candidates.length === 0) candidates = yields;
  }

  const desired = MIN_DISCOVERIES + Math.floor(Math.random() * (MAX_DISCOVERIES - MIN_DISCOVERIES + 1));
  const count = Math.min(desired, candidates.length);
  return shuffled(candidates)
    .slice(0, count)
    .map((y) => ({ itemCatalogSlug: y.item.slug, name: y.item.name, cantidad: y.cantidad }));
}
