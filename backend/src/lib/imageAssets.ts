import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ImagePromptEntityType, ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';
import type { MomentoDelDia } from '../services/worldClock.js';
import type { EstacionSlug } from '../services/imagePromptContext.js';

/// Imágenes reales de la Enciclopedia (checklist 2026-07-21/22, punto 7): la usuaria sube el
/// archivo a mano a `uploads/images/<entityType>/<entitySlug>-<sizeProfile>.<ext>` (servido por
/// @fastify/static en server.ts, prefijo `/images/`) — mismo esquema de clave que ya usa
/// ImagePrompt (entityType+entitySlug+sizeProfile), así que un prompt ya generado y su imagen
/// real acaban con el mismo entitySlug sin tener que inventar otra convención.
const UPLOADS_DIR = path.resolve(import.meta.dirname, '../../uploads/images');
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

function findImage(entityType: ImagePromptEntityType, entitySlug: string, sizeProfile: ImagePromptSizeProfile): string | null {
  for (const ext of EXTENSIONS) {
    const filename = `${entitySlug}-${sizeProfile}.${ext}`;
    if (existsSync(path.join(UPLOADS_DIR, entityType, filename))) {
      return `/images/${entityType}/${filename}`;
    }
  }
  return null;
}

export function imageUrlsFor(
  entityType: ImagePromptEntityType,
  entitySlug: string,
): { thumbnail: string | null; banner: string | null } {
  return {
    thumbnail: findImage(entityType, entitySlug, 'thumbnail'),
    banner: findImage(entityType, entitySlug, 'banner'),
  };
}

/// Icono plano (2026-08-31, "las ciudades deben tener prompt de mapa como la zona y de icono, no
/// de banner") — perfil propio, fuera de `imageUrlsFor` (que ya usan 15+ sitios con el shape fijo
/// thumbnail/banner) para no tocar ningún caller existente. Hoy solo `entityType: 'location'`
/// (asentamientos) lo usa, pero la función en sí es genérica por si otro tipo lo necesita.
export function iconoUrlFor(entityType: ImagePromptEntityType, entitySlug: string): string | null {
  return findImage(entityType, entitySlug, 'icono');
}

/// Grupo 3 § Mundo determinista, Capa 1 (2026-08-25) — el mapa de zona usa su propio sizeProfile
/// ('mapa', 800×600) en vez de thumbnail/banner, así que no encaja en `imageUrlsFor` de arriba
/// (pensado para la pareja fija que usa la Enciclopedia). Mismo mecanismo de búsqueda por archivo.
///
/// Día/noche/estación (2026-08-27) — `momento`/`estacion` opcionales para la vista EN VIVO de
/// Zona (`routes/saves/zona.ts`, que ya conoce la hora/estación reales de la partida y elige sola,
/// sin selector manual). Degrada en cascada de lo más específico a lo más genérico: cruce completo
/// → solo estación → solo momento → imagen base sin sufijo — así que subir SOLO `-invierno` (sin
/// molestarse en las 8 combinaciones) ya cubre las 4 estaciones de noche igual que las de día,
/// nunca hace falta rellenar el cruce entero para que algo se vea.
export function zoneMapImageUrl(locationSlug: string, momento?: MomentoDelDia | null, estacion?: EstacionSlug | null): string | null {
  const candidateSlugs = [
    momento && estacion ? `${locationSlug}-${momento}-${estacion}` : null,
    estacion ? `${locationSlug}-${estacion}` : null,
    momento ? `${locationSlug}-${momento}` : null,
    locationSlug,
  ].filter((s): s is string => !!s);
  for (const slug of candidateSlugs) {
    const found = findImage('zona', slug, 'mapa');
    if (found) return found;
  }
  return null;
}
