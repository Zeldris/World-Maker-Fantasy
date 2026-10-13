import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPOS_CON_NOMBRE_DE_HABILIDAD, nombreActualDeHabilidad } from './habilidadesRenombradas.js';

// Los comentarios del esquema parten frases entre líneas («por NOMBRE de» / «/// `SavedAction`»).
const ESQUEMA = readFileSync(join(import.meta.dirname, '../../prisma/schema.prisma'), 'utf8').replace(/\s*\n\s*\/\/\/\s*/g, ' ');

describe('habilidades renombradas (P100, QA-68)', () => {
  it('el nombre viejo pasa al nuevo y el resto se queda igual', () => {
    expect(nombreActualDeHabilidad('Analisis Salvaje')).toBe('Análisis Salvaje');
    expect(nombreActualDeHabilidad('Esquivar')).toBe('Esquivar');
  });

  it('cada campo del esquema que guarda una habilidad «por NOMBRE» está en la lista de los que se renombran', () => {
    // Además de `SavedAction.name` (el propio nombre), los campos marcados en el esquema.
    const marcados = ESQUEMA.match(/por NOMBRE de `SavedAction`/g)?.length ?? 0;
    expect(CAMPOS_CON_NOMBRE_DE_HABILIDAD.length - 1).toBe(marcados);
  });
});
