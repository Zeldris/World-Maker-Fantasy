import { describe, expect, it } from 'vitest'

// Los fuentes del frontend, como texto (Vite los lee; el frontend no tiene los tipos de Node).
const FUENTES = import.meta.glob(['../**/*.{ts,tsx}', '!**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/// Lo que no se lee como texto: la acción que se manda al backend, que reconoce al objetivo o al objeto
/// por las comillas simples (`contra 'X'`, `QUOTED_NAME_REGEX` en
/// `backend/src/services/playerActionValidation.ts`). Va por coincidencia exacta, no por archivo, para que
/// un texto nuevo en el mismo archivo sí se vigile.
const ACCIONES_PARA_EL_BACKEND = new Set([
  "./ChatComposer.tsx: '${node.dataset[CHIP_VALUE_KEY]}'",
  "../pages/GameModals.tsx: '${target.name}'",
  "../hooks/useCombatFlow.ts: '${combatDisplayNameFor(npc)}'",
  "../hooks/useCombatFlow.ts: '${combatDisplayNameFor(selectedNpc)}'",
  "../hooks/useCombatFlow.ts: '${selectedItem.name}'",
  "../hooks/useModoDinamico.ts: '${npcName}'",
])

const PATRONES = [/"\$\{[^}]+\}"/, /'\$\{[^}]+\}'/, /"\s*\{[^}]+\}\s*"/]

describe('comillas en pantalla (QA-59)', () => {
  it('ningún nombre interpolado se lee entre comillas rectas', () => {
    const hallados = Object.entries(FUENTES)
      .flatMap(([ruta, texto]) =>
        PATRONES.flatMap((p) => [...texto.matchAll(new RegExp(p.source, 'g'))].map((m) => `${ruta}: ${m[0].replace(/\s+/g, ' ')}`)),
      )
      .filter((hallado) => !ACCIONES_PARA_EL_BACKEND.has(hallado))
    expect(Object.keys(FUENTES).length).toBeGreaterThan(50)
    expect(hallados).toEqual([])
  })
})
