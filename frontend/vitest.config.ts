import { defineConfig } from 'vitest/config'

// Deuda técnica (2026-07-30, auditoría de deuda técnica): el frontend no tenía NINGÚN test runner
// configurado — cero seguridad ni siquiera para la lógica pura que espeja reglas del backend
// (progression.ts, combatDifficulty.ts...). Alcance deliberadamente acotado a `lib/` (lógica sin
// React) en esa primera pasada — testear componentes/hooks requería @testing-library/react, un
// paso más grande que se dejó fuera a propósito.
//
// Ampliado (deuda técnica, auditoría 2026-08-25): `useCombatFlow.ts` (el hook con más lógica de
// decisión del proyecto) seguía sin ningún test, y toda la carpeta `hooks/` sin cobertura — se
// añade `@testing-library/react`/`jsdom` y se incluye `hooks/**/*.test.tsx` (extensión `.tsx`
// aparte de `.ts`, ya que `renderHook` necesita JSX para envolver providers si algún hook futuro
// los necesita). `environment: 'jsdom'` sustituye a `'node'` para TODO el runner (`lib/` sigue
// pasando igual bajo jsdom — es un superconjunto de las globals de node que esos tests usan).
export default defineConfig({
  test: {
    environment: 'jsdom',
    // QA-39 (retro de QA-27, 2026-10-12): todo `src/`. Con una lista de carpetas, un test puesto en
    // otra (`src/data/`) no se ejecutaba y pasaba «en verde» sin probar nada.
    include: ['src/**/*.test.{ts,tsx}'],
    // QA-94: un aviso de React por la consola hace fallar el test (src/test/avisosDeReact.ts).
    setupFiles: ['src/test/avisosDeReact.ts'],
  },
})
