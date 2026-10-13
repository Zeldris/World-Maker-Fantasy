import { describe, it, expect } from 'vitest';
import { lineasTrasElGolpe, repartirIntercambios } from './intercambiosContraJugadora.js';
import type { CombatExchangeDisplay } from './combatExchange.js';

const intercambio = (resultado: string) => ({ atacanteEsJugador: false, resultado } as unknown as CombatExchangeDisplay);

/// P55 (QA-27): en combate de grupo, ningún ataque contra la jugadora se pierde.
describe('P55 — repartirIntercambios', () => {
  it('sin intercambio propio: el primer ataque recibido va en la narración y el resto aparte', () => {
    const r = repartirIntercambios(null, [
      { display: intercambio('defensor_contragolpea'), atacanteNombre: 'Guchapo 1' },
      { display: intercambio('golpe_pleno'), atacanteNombre: 'Guchapo 2' },
      { display: intercambio('golpe_pleno'), atacanteNombre: 'Guchapo 3' },
    ]);
    expect(r.principal?.rivalNombre).toBe('Guchapo 1');
    expect(r.aparte.map((a) => a.atacanteNombre)).toEqual(['Guchapo 2', 'Guchapo 3']);
  });

  it('con intercambio propio: ese manda y todos los ataques recibidos van aparte', () => {
    const propio = { atacanteEsJugador: true, resultado: 'golpe_normal' } as unknown as CombatExchangeDisplay;
    const r = repartirIntercambios(propio, [{ display: intercambio('golpe_pleno'), atacanteNombre: 'Guchapo 2' }]);
    expect(r.principal).toBe(propio);
    expect(r.aparte).toHaveLength(1);
  });

  it('sin nada que repartir', () => {
    expect(repartirIntercambios(null, [])).toEqual({ principal: null, aparte: [] });
  });
});

/// P117 (QA-70): la subida de nivel y sus desbloqueos los gana el golpe de la jugadora; van antes que
/// los ataques que recibe después, aunque uno la deje muerta.
describe('P117 — lineasTrasElGolpe', () => {
  it('subida de nivel y desbloqueos antes que los ataques recibidos y los golpes gratis', () => {
    const lineas = lineasTrasElGolpe({
      brujula: 'La brújula señala al norte.',
      subidaDeNivel: 'Gorhorn sube a nivel 3.',
      desbloqueos: ['Gorhorn desbloquea la habilidad de clase «Rugido».', 'Gorhorn desbloquea la habilidad de oficio «Desollar» (nivel 2 de Desollador).'],
      intercambiosAparte: [{ display: intercambio('golpe_pleno'), atacanteNombre: 'Guchapo 2' }],
      golpesGratis: [{ atacanteNombre: 'Guchapo 3', nuevaCondicion: 'MUERTO' }],
    });
    expect(lineas.map((l) => l.texto)).toEqual([
      'La brújula señala al norte.',
      'Gorhorn sube a nivel 3.',
      'Gorhorn desbloquea la habilidad de clase «Rugido».',
      'Gorhorn desbloquea la habilidad de oficio «Desollar» (nivel 2 de Desollador).',
      'Guchapo 2 te ataca.',
      'Guchapo 3 te golpea sin que puedas defenderte (estás ocupado con otro rival). Estado: Muerto.',
    ]);
    expect(lineas.map((l) => l.tipo)).toEqual(['aviso', 'aviso', 'aviso', 'aviso', 'intercambio', 'golpeGratis']);
  });

  it('sin subida ni golpes, nada de más', () => {
    expect(lineasTrasElGolpe({ brujula: null, subidaDeNivel: null, desbloqueos: [], intercambiosAparte: [], golpesGratis: [] })).toEqual([]);
  });
});
