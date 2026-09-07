import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  locations,
  fauna,
  npcs,
  items,
  factions,
  harvestYields,
  harvestSourcesThatAreFaunaWithoutNpc,
} from './worldCatalog.js';

/// Hallazgo 35b (revisar-partida-hallazgos.md 2026-09-07) — `imageAssets.ts` hace match EXACTO de
/// string (`${entitySlug}-${sizeProfile}.${ext}`, sin normalización) contra los archivos subidos a
/// mano en `uploads/images/<entityType>/`. Cualquier nombre que no coincida carácter a carácter con
/// el slug real del catálogo queda invisible sin ningún error (`imageUrls` vuelve `null` en
/// silencio). Solo LECTURA — lista huérfanos (archivo en disco sin slug real que lo reclame) y
/// slugs sin imagen (entidad real sin ningún archivo que la cubra), para revisar a mano antes de
/// perseguir fichas una a una.
///
/// Match por PREFIJO, no igualdad exacta (descubierto corriendo este mismo script una primera vez:
/// tanto `location` — sufijos de momento/estación, hallazgo 32 — como `fauna` — sufijo de sexo
/// `-macho`/`-hembra` — ya usan nombres reales con variante, que el match exacto de `imageAssets.ts`
/// SÍ soporta vía `zoneMapImageUrl`/`iconoUrlFor` con fallback en cascada, pero este audit necesita
/// reconocerlos igual para no reportarlos como falsos huérfanos). Mismo criterio para todas las
/// categorías: se recorta el nombre desde la derecha, segmento a segmento, hasta encontrar un slug
/// real — más laxo que el motor real (que sí exige el orden exacto de sufijos), a propósito: este
/// script es solo para ORIENTAR una revisión manual, nunca decide nada por sí mismo.
///
/// Alcance: las 6 categorías que de verdad se suben a mano hoy (fauna/flora/npc/item/location/
/// faction) — `ability`/`crafteo`/`historia`/`personaje`/`raza`/`clase`/`especializacion`/
/// `construccion` no tienen array propio en `worldCatalog.ts` (viven en otros scripts o siguen sin
/// contenido subido, carpetas vacías salvo `.gitkeep`) y quedan fuera de este audit. `zona` usa el
/// mismo slug que `location` (mapa, sizeProfile 'mapa' fijo) — variantes parciales de momento/
/// estación son normales ahí (`zoneMapImageUrl` ya hace fallback en cascada), así que zona no
/// comprueba "missing" estricto, solo lista huérfanos.
///
/// Uso: npx tsx src/scripts/auditImages.ts

const UPLOADS_DIR = path.resolve(import.meta.dirname, '../../uploads/images');
const EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

interface CategoryConfig {
  entityType: string;
  /// Perfiles que de verdad se esperan para esta categoría (mismo criterio que sus callers reales
  /// en el backend — `imageUrlsFor` para thumbnail+banner, `iconoUrlFor` solo para location).
  sizeProfiles: string[];
  slugs: string[];
  /// true = comprueba "sin imagen" (slug real sin ningún archivo) además de huérfanos. `zona` lo
  /// desactiva porque una variante parcial de momento/estación es un estado normal, no un hueco.
  checkMissing: boolean;
}

function faunaSlugs(): string[] {
  const npcFauna = fauna.map((f) => f.slug);
  const sourceFaunaSinNpc = [...harvestSourcesThatAreFaunaWithoutNpc];
  return [...new Set([...npcFauna, ...sourceFaunaSinNpc])];
}

function floraSlugs(): string[] {
  const faunaSet = new Set(faunaSlugs());
  return [...new Set(harvestYields.map((h) => h.sourceSlug).filter((slug) => !faunaSet.has(slug)))];
}

const categories: CategoryConfig[] = [
  { entityType: 'fauna', sizeProfiles: ['thumbnail', 'banner'], slugs: faunaSlugs(), checkMissing: true },
  { entityType: 'flora', sizeProfiles: ['thumbnail', 'banner'], slugs: floraSlugs(), checkMissing: true },
  { entityType: 'npc', sizeProfiles: ['thumbnail', 'banner'], slugs: npcs.map((n) => n.slug), checkMissing: true },
  { entityType: 'item', sizeProfiles: ['thumbnail', 'banner'], slugs: items.map((i) => i.slug), checkMissing: true },
  { entityType: 'faction', sizeProfiles: ['thumbnail', 'banner'], slugs: factions.map((f) => f.slug), checkMissing: true },
  { entityType: 'location', sizeProfiles: ['banner', 'icono'], slugs: locations.map((l) => l.slug), checkMissing: true },
  { entityType: 'zona', sizeProfiles: ['mapa'], slugs: locations.map((l) => l.slug), checkMissing: false },
];

function parseFilename(filename: string): { base: string; sizeProfile: string; ext: string } | null {
  const match = filename.match(/^(.+)-([a-z]+)\.([a-z]+)$/);
  if (!match) return null;
  const [, base, sizeProfile, ext] = match;
  if (!EXTENSIONS.has(ext)) return null;
  return { base, sizeProfile, ext };
}

/// Resuelve el `slug` real que un `base` con posibles sufijos de variante (momento/estación/sexo)
/// reclama — prueba el `base` completo primero, luego recorta segmentos desde la derecha
/// (`hondonada-del-eco-dia-primavera` → ... → `hondonada-del-eco`). `null` si ningún prefijo
/// coincide con un slug real.
function resolvePrefixSlug(base: string, slugsValidos: Set<string>): string | null {
  if (slugsValidos.has(base)) return base;
  const partes = base.split('-');
  for (let corte = partes.length - 1; corte >= 1; corte--) {
    const candidato = partes.slice(0, corte).join('-');
    if (slugsValidos.has(candidato)) return candidato;
  }
  return null;
}

function auditCategory({ entityType, sizeProfiles, slugs, checkMissing }: CategoryConfig) {
  const dir = path.join(UPLOADS_DIR, entityType);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f !== '.gitkeep') : [];
  const slugSet = new Set(slugs);

  const orphans: string[] = [];
  const matched = new Set<string>(); // `${slug}|${sizeProfile}`
  for (const filename of files) {
    const parsed = parseFilename(filename);
    const slug = parsed && sizeProfiles.includes(parsed.sizeProfile) ? resolvePrefixSlug(parsed.base, slugSet) : null;
    if (!parsed || !slug) {
      orphans.push(filename);
      continue;
    }
    matched.add(`${slug}|${parsed.sizeProfile}`);
  }

  const missing: string[] = [];
  if (checkMissing) {
    for (const slug of slugs) {
      for (const sizeProfile of sizeProfiles) {
        if (!matched.has(`${slug}|${sizeProfile}`)) missing.push(`${slug} (${sizeProfile})`);
      }
    }
  }

  console.log(`=== ${entityType.toUpperCase()} — ${slugs.length} slugs reales, ${files.length} archivos en disco ===`);
  if (orphans.length > 0) {
    console.log(`  Huérfanos (${orphans.length}) — archivo sin ningún slug real (por prefijo) que lo reclame:`);
    for (const o of orphans) console.log(`    - ${o}`);
  }
  if (missing.length > 0) {
    console.log(`  Sin imagen (${missing.length}) — slug real sin ningún archivo que lo cubra${entityType === 'location' ? ' (ninguna variante)' : ''}:`);
    for (const m of missing) console.log(`    - ${m}`);
  }
  if (orphans.length === 0 && missing.length === 0) console.log('  OK — todo cuadra.');
  console.log('');
}

function main() {
  console.log('=== AUDITORÍA DE IMÁGENES (hallazgo 35b) — solo lectura ===\n');
  for (const category of categories) auditCategory(category);
}

main();
