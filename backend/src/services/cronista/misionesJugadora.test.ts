import { describe, it, expect } from 'vitest';
import { llevadoParaEntregar, motivoNoEntregable } from './misionesJugadora.js';

/// P183 (QA-27): el motivo por el que no se puede entregar sale de un solo sitio (entrega y resumen).
describe('motivoNoEntregable', () => {
  const huecos = { entregaEn: 'lugar-1', objeto: { slug: 'madera-jumba', nombre: 'Madera Jumba' } };

  it('fuera del lugar donde se aceptó, eso primero', () => {
    expect(motivoNoEntregable(huecos, 'otro', 3)).toBe('Tienes que entregarlo donde aceptaste el encargo');
  });

  it('en el lugar y sin el objeto', () => {
    expect(motivoNoEntregable(huecos, 'lugar-1', 0)).toBe('No llevas Madera Jumba');
  });

  it('en el lugar y con algo que entregar, se puede', () => {
    expect(motivoNoEntregable(huecos, 'lugar-1', 1)).toBeNull();
  });

  it('lo equipado, lo que lleva un compañero o un sujeto no cuenta', () => {
    expect(llevadoParaEntregar({ slot: null, companionId: null, subjectId: null })).toBe(true);
    expect(llevadoParaEntregar({ slot: 'MANO', companionId: null, subjectId: null })).toBe(false);
    expect(llevadoParaEntregar({ slot: null, companionId: 'c', subjectId: null })).toBe(false);
  });
});
