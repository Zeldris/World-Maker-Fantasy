import { defineConfig } from 'vitest/config'

// Deuda técnica (2026-07-30, auditoría de deuda técnica): el frontend no tenía NINGÚN test runner
// configurado — cero seguridad ni siquiera para la lógica pura que espeja reglas del backend
// (progression.ts, combatDifficulty.ts...). Alcance deliberadamente acotado a `lib/` (lógica sin
// React) por ahora — testear componentes requeriría @testing-library/react, un paso más grande
// que queda fuera de esta primera pasada.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
})
