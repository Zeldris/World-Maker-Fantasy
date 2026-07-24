import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ImagePromptEntityType, ImagePromptSizeProfile } from '../services/imagePromptGenerator.js';

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
