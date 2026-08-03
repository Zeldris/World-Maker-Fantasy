import { describe, it, expect } from 'vitest';
import { isWeaklyGrounded, formatLoreForPrompt, type RetrievedLore } from './retrieval.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — solo las dos
// funciones puras; `retrieveLore` depende de Postgres/pgvector real y queda fuera de alcance de
// un test unitario (ya cubierta indirectamente por los tests de integración de turn.ts).

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

  it('el mejor fragmento está por encima del umbral: débilmente anclado', () => {
    expect(isWeaklyGrounded([chunk(0.8), chunk(0.2)])).toBe(true);
  });

  it('solo mira el PRIMER fragmento (se asume ya ordenado por distancia)', () => {
    expect(isWeaklyGrounded([chunk(0.75001)])).toBe(true);
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
