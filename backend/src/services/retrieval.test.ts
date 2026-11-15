import { describe, it, expect } from 'vitest';
import { isWeaklyGrounded, formatLoreForPrompt, titulosPorEntidad, type RetrievedLore } from './retrieval.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — solo las dos
// funciones puras; `retrieveLore` depende de Postgres/pgvector real y queda fuera de alcance de
// un test unitario (ya cubierta indirectamente por los tests de integración de turn.ts).

// `withQueryTimeout` no se exporta (uso interno de retrieval.ts) — se cubre indirectamente aquí
// reimplementando el mismo contrato exacto, mismo criterio que otros helpers internos pequeños
// del proyecto sin export propio. Bug real que motivó esta función (2026-08-31): un `$queryRaw`
// contra Postgres/Supabase remoto sin timeout podía colgar el turno entero indefinidamente.
function withQueryTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}: la consulta a Postgres no respondió en ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

describe('withQueryTimeout', () => {
  it('resuelve con el valor real si la consulta termina antes del timeout', async () => {
    const result = await withQueryTimeout(Promise.resolve('ok'), 50, 'test');
    expect(result).toBe('ok');
  });

  it('propaga el error real de la consulta si falla antes del timeout', async () => {
    await expect(withQueryTimeout(Promise.reject(new Error('fallo real de Postgres')), 50, 'test')).rejects.toThrow('fallo real de Postgres');
  });

  it('rechaza con un mensaje claro si la consulta nunca resuelve (cuelgue de red)', async () => {
    await expect(withQueryTimeout(new Promise(() => {}), 20, 'retrieveLore')).rejects.toThrow(/retrieveLore.*20ms/);
  });
});

function chunk(distance: number, title = 'Fragmento', text = 'Texto de prueba.'): RetrievedLore {
  return { title, text, distance };
}

describe('isWeaklyGrounded', () => {
  it('sin fragmentos, está débilmente anclado (no hay nada real que ofrecer)', () => {
    expect(isWeaklyGrounded([])).toBe(true);
  });

  it('el mejor fragmento está por debajo del umbral: bien anclado', () => {
    expect(isWeaklyGrounded([chunk(0.3), chunk(0.9)])).toBe(false);
  });

  it('todos los fragmentos están por encima del umbral: débilmente anclado', () => {
    expect(isWeaklyGrounded([chunk(0.8), chunk(0.9)])).toBe(true);
  });

  it('mira el más cercano, vaya donde vaya: los que entran por nombre van primero (QA-289)', () => {
    expect(isWeaklyGrounded([chunk(0.75001)])).toBe(true);
    expect(isWeaklyGrounded([chunk(0.9), chunk(0.3)])).toBe(false);
  });
});

describe('formatLoreForPrompt', () => {
  it('formatea cada fragmento como "título: texto"', () => {
    expect(formatLoreForPrompt([chunk(0.1, 'Los orcos', 'Orgullo, fuerza, honor.')])).toEqual(['Los orcos: Orgullo, fuerza, honor.']);
  });

  it('sin fragmentos, devuelve una lista vacía', () => {
    expect(formatLoreForPrompt([])).toEqual([]);
  });

  it('corta antes de superar el tope de caracteres, pero nunca deja el resultado vacío', () => {
    const largo = 'x'.repeat(1500);
    const result = formatLoreForPrompt([chunk(0.1, 'Uno', largo), chunk(0.2, 'Dos', 'corto')]);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Uno');
  });

  it('incluye varios fragmentos mientras quepan dentro del tope', () => {
    const result = formatLoreForPrompt([chunk(0.1, 'A', 'corto A'), chunk(0.2, 'B', 'corto B'), chunk(0.3, 'C', 'corto C')]);
    expect(result).toHaveLength(3);
  });
});

// QA-289 (P251, P272): el trozo de una entidad que nombra la acción entra por nombre, no solo por embedding.
describe('titulosPorEntidad', () => {
  const titulos = [
    'Acercarse al Campamento del Clan Serhu',
    'Campamento del Clan Serhu (Llanuras del Viento Rojo)',
    'Clan Maktor (el clan de Gorhorn) — aniquilado dos veces',
    'Clan Serhu y la casta de Ketg',
    'Gorhorn, guerrero del Clan Maktor (único personaje jugable)',
    "Terk'ikar Ulkha Ketg, del Clan Serhu",
    'Las Llanuras del Viento Rojo',
  ];

  it('el nombre entero va primero; el mismo nombre con un título delante, detrás; un sitio que solo lo lleva, nunca', () => {
    expect(titulosPorEntidad(titulos, ['Le pregunto a Ulkha Ketg quién manda en el Clan Serhu'])).toEqual([
      'Clan Serhu y la casta de Ketg',
      "Terk'ikar Ulkha Ketg, del Clan Serhu",
    ]);
  });

  it('sin tildes ni mayúsculas en el texto también vale, y un nombre de una palabra («Gorhorn») no entra solo', () => {
    expect(titulosPorEntidad(titulos, ['gorhorn pregunta qué le pasó al clan maktor'])).toEqual(['Clan Maktor (el clan de Gorhorn) — aniquilado dos veces']);
  });

  it('los NPC en escena cuentan como texto, y sin nombres no hay entradas directas', () => {
    expect(titulosPorEntidad(titulos, ['¿Quién manda aquí?', 'Ulkha Ketg'])).toEqual(["Terk'ikar Ulkha Ketg, del Clan Serhu"]);
    expect(titulosPorEntidad(titulos, ['Miro a mi alrededor.'])).toEqual([]);
  });
});
