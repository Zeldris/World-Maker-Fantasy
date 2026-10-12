import { describe, expect, it } from 'vitest'

// Los fuentes de componentes y páginas, como texto (Vite los lee; el frontend no tiene los tipos de Node).
const FUENTES = import.meta.glob(['../components/**/*.{ts,tsx}', '../pages/**/*.{ts,tsx}', '!**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/// Texto que no se lee como tal: la acción que se manda al backend, que reconoce al objetivo por las
/// comillas simples (`contra 'X'`, `QUOTED_NAME_REGEX` en `backend/src/services/playerActionValidation.ts`).
const EXCEPCIONES: Record<string, string> = {
  './ChatComposer.tsx': 'el chip de un objeto entra en la acción con comillas simples',
  '../pages/GameModals.tsx': '«Saqueo el cuerpo de \'X\'» es una acción para el backend',
}

const PATRONES = [/"\$\{[^}]+\}"/, /'\$\{[^}]+\}'/, /"\s*\{[^}]+\}\s*"/]

describe('comillas en pantalla (QA-59)', () => {
  it('ningún nombre interpolado va entre comillas rectas en componentes y páginas', () => {
    const hallados = Object.entries(FUENTES)
      .filter(([ruta]) => !(ruta in EXCEPCIONES))
      .flatMap(([ruta, texto]) =>
        PATRONES.flatMap((p) => [...texto.matchAll(new RegExp(p.source, 'g'))].map((m) => `${ruta}: ${m[0].replace(/\s+/g, ' ')}`)),
      )
    expect(Object.keys(FUENTES).length).toBeGreaterThan(50)
    expect(hallados).toEqual([])
  })
})
