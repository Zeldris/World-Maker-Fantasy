import { describe, it, expect } from 'vitest';
import { repartirIntercambios } from './intercambiosContraJugadora.js';
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
