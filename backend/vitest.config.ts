import { defineConfig } from 'vitest/config';

// Roadmap de auditoría de typo-tolerance (2026-07-20): antes de esto, ningún test cargaba .env
// explícitamente — funcionaba de rebote porque el primer archivo en importar lib/prisma.js
// (PrismaClient carga .env como efecto secundario) lo hacía disponible al resto del proceso.
// narrador.ts importa config/env.js SIN pasar antes por prisma.js, así que un test que lo
// importe primero (narrador.test.ts, turnResolution.test.ts vía narrador.js) fallaba con
// "Falta la variable de entorno DATABASE_URL" — dependía de un orden de imports no garantizado.
/// Tests contra el Postgres real (sin `vi.mock` de `lib/prisma`) — convención `*.integration.test.ts`
/// más los pocos que no la siguen.
const TESTS_CON_BD_REAL = ['src/**/*.integration.test.ts', 'src/routes/saves/shared.test.ts'];

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Bug real encontrado 2026-09-14 (suite completa con 40 "fallos" fantasma tras un `tsc -b`
    // local): `dist/` está gitignoreado pero no excluido aquí, y el patrón por defecto de vitest
    // (`**/*.test.?(c|m)[jt]s?(x)`) SÍ matchea `.js` — cualquier build local deja los mismos tests
    // compilados en `dist/`, y vitest los descubre y corre EN PARALELO junto a los de `src/`, dos
    // copias mutando la misma fila de Postgres a la vez (visto con `recolectar.integration.test.ts`
    // vs. `cazar.integration.test.ts`, que comparten `WorldPopulation`). Excluir `dist/` es la
    // exclusión por defecto estándar de vitest en cualquier proyecto con build local — aquí faltaba.
    exclude: ['**/node_modules/**', '**/dist/**'],
    // B13 (pruebas en la nube 2026-09-28): la suite completa fallaba 1-6 tests distintos por
    // corrida (pasaban en solitario) — los archivos que usan el Postgres REAL comparten filas de
    // catálogo (`WorldPopulation`, `ZonePoint`, NPC de Hondonada...) y corrían en paralelo. Dos
    // proyectos: los de BD real en serie entre archivos, el resto (mocks) en paralelo como siempre.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: ['**/node_modules/**', '**/dist/**', ...TESTS_CON_BD_REAL],
        },
      },
      {
        extends: true,
        test: {
          name: 'bd-real',
          include: TESTS_CON_BD_REAL,
          fileParallelism: false,
          // QA-8: deja como estaba lo que los tests ensucian del catálogo compartido.
          globalSetup: ['./vitest.bdReal.globalSetup.ts'],
        },
      },
    ],
  },
});
