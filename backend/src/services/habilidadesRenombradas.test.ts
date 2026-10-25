import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPOS_CON_NOMBRE_DE_HABILIDAD, HABILIDADES_RENOMBRADAS_POR_CLASE, nombreActualDeHabilidad } from './habilidadesRenombradas.js';
import { allClassAbilityUnlocks } from './classAbilities.js';

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

  it('QA-243: un nombre repetido entre clases cambia solo en la clase y la rama que lo pierden', () => {
    expect(nombreActualDeHabilidad('Golpe Certero', { clase: 'CAZADOR', especializacion: null })).toBe('Golpe Certero');
    expect(nombreActualDeHabilidad('Golpe Certero', { clase: 'ASESINO', especializacion: null })).toBe('Golpe Oportuno');
    expect(nombreActualDeHabilidad('Instinto Asesino', { clase: 'ASESINO', especializacion: 'MAESTRO_ASESINO' })).toBe('Instinto Asesino');
    expect(nombreActualDeHabilidad('Instinto Asesino', { clase: 'DRUIDA', especializacion: 'SALVAJE' })).toBe('Arrebato Salvaje');
    expect(nombreActualDeHabilidad('Postura de Tirador', { clase: 'ARQUERO', especializacion: 'MAESTRO_ARQUERO' })).toBe('Postura de Tirador');
    expect(nombreActualDeHabilidad('Golpe Certero')).toBe('Golpe Certero');
  });

  it('QA-243: el Asesino Selecto distingue sus dos «Golpe Certero» por la descripción', () => {
    const selecto = { clase: 'ASESINO', especializacion: 'ASESINO_SELECTO' };
    const deLaRama = allClassAbilityUnlocks().find((u) => u.especializacion === 'ASESINO_SELECTO' && u.level === 32)!.ability;
    expect(deLaRama.name).toBe('Golpe a la Marca');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto, deLaRama.description)).toBe('Golpe a la Marca');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto, 'Un golpe reactivo, soltado en el instante exacto en que el rival baja la guardia.')).toBe('Golpe Oportuno');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto)).toBe('Golpe Oportuno');
  });

  it('QA-243: ningún nombre de habilidad de clase se repite y cada nombre nuevo existe en el catálogo', () => {
    const nombres = allClassAbilityUnlocks().map((u) => u.ability.name);
    expect(nombres.filter((n, i) => nombres.indexOf(n) !== i)).toEqual([]);
    for (const r of HABILIDADES_RENOMBRADAS_POR_CLASE) expect(nombres).toContain(r.nuevo);
  });

  it('los campos marcados en el esquema son exactamente los que se renombran', () => {
    expect(camposMarcados()).toEqual([...CAMPOS_CON_NOMBRE_DE_HABILIDAD].sort());
  });
});
