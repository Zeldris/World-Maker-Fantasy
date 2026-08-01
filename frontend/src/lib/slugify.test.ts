import { describe, it, expect } from 'vitest'
import { slugify } from './slugify'

/// Cobertura nueva (deuda técnica 2026-07-30, auditoría técnica: "slugify.ts reimplementado a
/// mano en backend Y frontend, sin nada que garantice que sigan sincronizados"). Este fixture de
/// pares nombre→slug está DUPLICADO A PROPÓSITO en backend/src/lib/slugify.test.ts, palabra por
/// palabra — si alguien edita un lado sin el otro, el test de ESE lado falla solo con este mismo
/// fixture, sin depender de que nadie recuerde comparar los dos archivos a mano. Si tocas esta
/// lista, toca también la del backend.
const CASES: [string, string][] = [
  ['Puño de Hierro', 'puno-de-hierro'],
  ['Grito de Guerra', 'grito-de-guerra'],
  ['Sangre del Estallido', 'sangre-del-estallido'],
  ['Última Voluntad', 'ultima-voluntad'],
  ['  Espacios   Extra  ', 'espacios-extra'],
  ["Golpe de Águila'99", 'golpe-de-aguila-99'],
  ['MAYÚSCULAS', 'mayusculas'],
]

describe('slugify', () => {
  it.each(CASES)('%s -> %s', (name, expected) => {
    expect(slugify(name)).toBe(expected)
  })
})
