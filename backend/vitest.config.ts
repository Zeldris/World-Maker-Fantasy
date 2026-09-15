import { defineConfig } from 'vitest/config';

// Roadmap de auditoría de typo-tolerance (2026-07-20): antes de esto, ningún test cargaba .env
// explícitamente — funcionaba de rebote porque el primer archivo en importar lib/prisma.js
// (PrismaClient carga .env como efecto secundario) lo hacía disponible al resto del proceso.
// narrador.ts importa config/env.js SIN pasar antes por prisma.js, así que un test que lo
// importe primero (narrador.test.ts, turnResolution.test.ts vía narrador.js) fallaba con
// "Falta la variable de entorno DATABASE_URL" — dependía de un orden de imports no garantizado.
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
  },
});
