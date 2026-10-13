import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/// QA-67 (P87): `LogEntry.fictionalMinutes` no lleva `@default`, para que el compilador obligue a dar
/// la hora en cada entrada del diario. Con `@default(0)`, una entrada sin hora caía fuera de la ventana
/// de 24 h y desaparecía al recargar. Si alguien vuelve a ponerlo (p. ej. para una migración), este
/// test lo para.
const ESQUEMA = readFileSync(join(import.meta.dirname, '../../prisma/schema.prisma'), 'utf8');

describe('campos que siempre hay que dar (QA-67)', () => {
  it('LogEntry.fictionalMinutes no tiene valor por defecto', () => {
    const modelo = ESQUEMA.slice(ESQUEMA.indexOf('\nmodel LogEntry {'), ESQUEMA.indexOf('\n}', ESQUEMA.indexOf('\nmodel LogEntry {')));
    const campo = modelo.split('\n').find((l) => /^\s+fictionalMinutes\s/.test(l));
    expect(campo).toBeDefined();
    expect(campo).not.toMatch(/@default/);
  });
});
