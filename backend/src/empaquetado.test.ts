import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { build } from 'esbuild';

/// INS-34: el instalador empaqueta el backend con esbuild desde `src/server.ts` y define
/// `process.env.TARKOR_EMPAQUETADO` como "1". Ese bundle no puede llevar curación ni proveedores cloud.
/// Aquí se hace el mismo build (ESM y con los paquetes externos: solo se miden los ficheros propios; el instalador
/// lo adapta a cjs) y se mira `metafile.inputs`.
const raiz = path.resolve(import.meta.dirname, '..');

async function empaquetar(empaquetado: boolean) {
  const res = await build({
    entryPoints: [path.join(raiz, 'src/server.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    metafile: true,
    // Requisito del empaquetador: sin `minifySyntax` esbuild no pliega `"1" !== '1'` y la rama de curación queda dentro.
    minifySyntax: true,
    logLevel: 'silent',
    packages: 'external',
    external: ['@prisma/client', '.prisma/client'],
    define: empaquetado ? { 'process.env.TARKOR_EMPAQUETADO': '"1"' } : {},
  });
  return {
    ficheros: Object.keys(res.metafile.inputs).map((f) => f.replaceAll('\\', '/')),
    codigo: res.outputFiles.map((o) => o.text).join('\n'),
  };
}

/// Los únicos scripts que el juego usa en runtime (catálogo y reparto de facciones); el resto son herramientas de
/// curación y mantenimiento. `seed-catalog` no lo importa `server.ts`: se ejecuta aparte (`npm run seed-catalog`).
const PROHIBIDOS = [/lib\/aiProviders\//, /services\/imagePromptGenerator/, /services\/liveTeacherCapture/, /src\/scripts\/(?!worldCatalog\.ts|repartoFacciones\.ts)/];

describe('build empaquetado (INS-34)', () => {
  it('con TARKOR_EMPAQUETADO no lleva curación, proveedores cloud ni scripts de curación', async () => {
    const { ficheros, codigo } = await empaquetar(true);
    expect(ficheros.some((f) => f.endsWith('src/server.ts'))).toBe(true);
    for (const patron of PROHIBIDOS) {
      expect(ficheros.filter((f) => patron.test(f)), String(patron)).toEqual([]);
    }
    // La ruta POST no se registra; el GET de la enciclopedia y el resto de rutas de image-prompt (lectura) se quedan.
    expect(codigo).not.toContain('generateImagePrompt');
    expect(codigo).not.toContain('captureLiveTeacherExample');
    expect(codigo).toContain('/world/:slug/enciclopedia');
  });

  it('sin la constante el mismo build sí los lleva (el test mide algo)', async () => {
    const { ficheros, codigo } = await empaquetar(false);
    expect(ficheros.some((f) => /lib\/aiProviders\/orchestrator/.test(f))).toBe(true);
    expect(ficheros.some((f) => /services\/liveTeacherCapture/.test(f))).toBe(true);
    expect(ficheros.some((f) => /services\/imagePromptGenerator/.test(f))).toBe(true);
    expect(codigo).toContain('generateImagePrompt');
  });
}, 60_000);
