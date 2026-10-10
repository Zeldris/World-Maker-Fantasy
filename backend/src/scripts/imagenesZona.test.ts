import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { locations } from './worldCatalog.js';

/// QA-32 (retro del 2026-10-09): el juego busca la ilustración de una zona por el slug exacto del
/// lugar (`<slug>[-<momento>][-<estacion>]-mapa.<ext>`, `zoneMapImageUrl` en `lib/imageAssets.ts`).
/// Una imagen con otro nombre no sale nunca, sin aviso: pasó con 11 de 21 al subirlas. Este test
/// dice qué archivo no corresponde a ningún lugar y cómo se llama el más parecido.
const DIR = path.resolve(import.meta.dirname, '../../uploads/images/zona');
const SUFIJOS = /(-(dia|noche))?(-(primavera|verano|otono|invierno))?-mapa\.(png|jpg|jpeg|webp)$/;

describe('imágenes de zona (QA-32)', () => {
  it('cada imagen de uploads/images/zona lleva el slug de un lugar del catálogo', () => {
    const slugs = new Set(locations.map((l) => l.slug));
    const sueltas = readdirSync(DIR)
      .filter((f) => SUFIJOS.test(f))
      .map((f) => ({ archivo: f, slug: f.replace(SUFIJOS, '') }))
      .filter(({ slug }) => !slugs.has(slug))
      .map(({ archivo, slug }) => {
        const palabras = slug.split('-').filter((p) => p.length > 3);
        const parecido = [...slugs].find((s) => palabras.some((p) => s.includes(p)));
        return `${archivo}${parecido ? ` (¿${parecido}?)` : ''}`;
      });
    expect(sueltas).toEqual([]);
  });

  it('solo hay imágenes de mapa (-mapa) en la carpeta', () => {
    expect(readdirSync(DIR).filter((f) => !SUFIJOS.test(f) && !f.startsWith('.'))).toEqual([]);
  });
});
