import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPOS_CON_NOMBRE_DE_HABILIDAD, nombreActualDeHabilidad } from './habilidadesRenombradas.js';

const ESQUEMA = readFileSync(join(import.meta.dirname, '../../prisma/schema.prisma'), 'utf8').split('\n');

/// «Modelo.campo» de cada campo marcado con «Guarda nombres de habilidad (QA-68)».
function camposMarcados(): string[] {
  const marcados: string[] = [];
  let modelo = '';
  ESQUEMA.forEach((linea, i) => {
    const m = /^model (\w+) \{/.exec(linea);
    if (m) modelo = m[1]!;
    if (linea.includes('Guarda nombres de habilidad (QA-68)')) {
      const campo = ESQUEMA.slice(i + 1).find((l) => !l.trim().startsWith('///'));
      marcados.push(`${modelo}.${/^\s+(\w+)\s/.exec(campo ?? '')?.[1]}`);
    }
  });
  return marcados.sort();
}

describe('habilidades renombradas (P100, QA-68)', () => {
  it('el nombre viejo pasa al nuevo y el resto se queda igual', () => {
    expect(nombreActualDeHabilidad('Analisis Salvaje')).toBe('Análisis Salvaje');
    expect(nombreActualDeHabilidad('Esquivar')).toBe('Esquivar');
  });

  it('los campos marcados en el esquema son exactamente los que se renombran', () => {
    expect(camposMarcados()).toEqual([...CAMPOS_CON_NOMBRE_DE_HABILIDAD].sort());
  });
});
