import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/// QA-31 (retro del 2026-10-09): un lugar creado jugando es de su partida. Los interiores de Capital
/// y Cuartel se creaban sin `saveId` y los veían todas las partidas (P43-P44). El catálogo los siembra
/// `seed-catalog.ts` (sin dueña a propósito); cualquier otro `location.create` del código del juego
/// tiene que pasar `saveId`.
const SRC = path.resolve(import.meta.dirname, '..');
const DEL_CATALOGO = new Set(['scripts/seed-catalog.ts']);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = path.join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.ts$/.test(f) && !/\.test\.ts$/.test(f) ? [ruta] : [];
  });
}

describe('lugares con dueña (QA-31)', () => {
  it('cada location.create fuera del catálogo pasa saveId', () => {
    const sinDuena: string[] = [];
    for (const ruta of archivos(SRC)) {
      const rel = path.relative(SRC, ruta);
      if (DEL_CATALOGO.has(rel)) continue;
      const texto = readFileSync(ruta, 'utf8');
      for (const m of texto.matchAll(/location\.create\(\{/g)) {
        const bloque = texto.slice(m.index, texto.indexOf('});', m.index));
        if (!/\bsaveId\b/.test(bloque)) sinDuena.push(`${rel}:${texto.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(sinDuena).toEqual([]);
  });
});
