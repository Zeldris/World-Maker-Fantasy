import { describe, expect, it } from 'vitest'

// Los fuentes del frontend, como texto (mismo método que comillasEnPantalla.test.tsx).
const FUENTES = import.meta.glob(['../**/*.{ts,tsx}', '!**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/// QA-71 (retro del PR #50): una línea del diario que cuenta algo del juego llega del backend con su
/// `logEntryId`, la misma que se ve tras recargar. El frontend solo inventa un id (`<prefijo>-${Date.now()}`)
/// para lo que nunca se guarda. Pasó con P117: el frontend añadía su propia «sube a nivel» y en vivo salía
/// en otro orden que tras recargar.
const PREFIJOS_LOCALES: Record<string, string> = {
  'combat-err': 'error de una acción de combate',
  'huir-err': 'error al intentar huir',
  err: 'error de reconexión',
  'turn-locked': 'aviso de turno ocupado',
  // `avisarErrorEnLog(prefijo, …)`: sus prefijos acaban en «-err» (lo comprueba el segundo test).
  '${prefijo}': 'errores de avisarErrorEnLog',
  // `nextId('p')` (`playerActionEntry`): la acción de la jugadora se pinta al pulsar Actuar, antes de
  // que el backend responda; el backend la guarda con el mismo texto («TU ACCIÓN»).
  p: 'acción de la jugadora, antes de la respuesta',
  // No es del diario: la ficha de un personaje creado a mano en la pantalla de selección.
  custom: 'personaje nuevo en CharacterSelect',
}

describe('líneas del diario que inventa el frontend (QA-71)', () => {
  it('solo los prefijos de id de lo que nunca se guarda', () => {
    // Las dos formas de inventar un id en el frontend: `<prefijo>-${Date.now()}` y `nextId('<prefijo>')`.
    const usados = Object.entries(FUENTES).flatMap(([ruta, texto]) =>
      [...texto.matchAll(/id:\s*`([\w${}-]+)-\$\{Date\.now\(\)\}`|nextId\('([^']+)'\)/g)].map((m) => ({ ruta, prefijo: (m[1] ?? m[2])! })),
    )
    expect(usados.length).toBeGreaterThan(0)
    const nuevos = usados.filter((u) => !(u.prefijo in PREFIJOS_LOCALES)).map((u) => `${u.ruta}: ${u.prefijo}`)
    expect(nuevos).toEqual([])
  })

  it('avisarErrorEnLog solo se usa con prefijos de error', () => {
    const prefijos = Object.values(FUENTES).flatMap((texto) => [...texto.matchAll(/avisarErrorEnLog\('([^']+)'/g)].map((m) => m[1]!))
    expect(prefijos.length).toBeGreaterThan(0)
    expect(prefijos.filter((p) => !p.endsWith('-err'))).toEqual([])
  })
})
