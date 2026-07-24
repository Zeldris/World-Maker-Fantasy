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
  },
});
