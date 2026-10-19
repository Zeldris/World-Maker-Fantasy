import type { zonePoints } from './worldCatalog.js';
/// QA-100 (retro de P189-P205): la fila de plantilla de un punto del catálogo. El origen es su sitio: sin él,
/// ningún animal tenía territorio (P189). `seedCatalog.test.ts` lo comprueba.
export function datosDePlantillaZonePoint(point: (typeof zonePoints)[number], locationId: string) {
  return {
    locationId, saveId: null, x: point.x, y: point.y, origenX: point.x, origenY: point.y, tipo: point.tipo, targetSlug: point.targetSlug,
    label: point.label ?? null, plantillaEspecifica: point.plantillaEspecifica ?? null, factionSlug: point.factionSlug ?? null,
    ...(point.cantidad ? { cantidad: point.cantidad } : {}),
  };
}
