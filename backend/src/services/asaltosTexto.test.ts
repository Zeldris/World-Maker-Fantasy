import { describe, it, expect } from 'vitest';
import { textoDelAsalto } from './asaltos.js';

// P221: la línea del asalto de fondo concuerda, nombra el Reino y dice «nada» sin botín.
const base = { quien: 'Los nabieus enloquecidos', plural: true, lugar: 'Tor Gorhorn', defendido: false, caidosAsaltantes: 0, botin: { comida: 0, goirnos: 0, objetos: 0 }, empalizadaCaida: false, caidosReino: [], estadoPersonaje: null, condicionAntes: 'HERIDO' as const };

describe('textoDelAsalto (P221)', () => {
  it('plural, nombre del Reino y sin botín', () => {
    expect(textoDelAsalto(base)).toBe('Los nabieus enloquecidos toman Tor Gorhorn y no encuentran nada que llevarse.');
  });
  it('una partida de facción va en singular y lista solo lo que se lleva', () => {
    expect(textoDelAsalto({ ...base, quien: 'La partida de Kar', plural: false, botin: { comida: 3, goirnos: 0, objetos: 1 } }))
      .toBe('La partida de Kar toma Tor Gorhorn y se lleva 3 de comida y 1 cosa del Almacén.');
  });
  it('defendido: concuerda la retirada y los muertos', () => {
    expect(textoDelAsalto({ ...base, defendido: true, caidosAsaltantes: 1, caidosReino: ['Krarka'] }))
      .toBe('Tor Gorhorn aguanta el asalto: los nabieus enloquecidos se retiran dejando 1 muerto. Cae Krarka.');
  });
  it('el personaje presente que sale peor lo lee en la misma línea', () => {
    expect(textoDelAsalto({ ...base, estadoPersonaje: 'CONVALECIENTE' })).toMatch(/Estabas allí y sales convaleciente\.$/);
    expect(textoDelAsalto({ ...base, estadoPersonaje: 'ILESO' })).not.toMatch(/Estabas allí/);
  });
});

describe('textoDelAsalto: quién defendía (P295)', () => {
  it('sin defensores lo dice, también al saquear', () => {
    expect(textoDelAsalto({ ...base, defensores: { guarnicion: 0, milicianos: 0 } })).toContain('Nadie defendía: sin guarnición ni milicia.');
  });
  it('nombra guarnición y milicia', () => {
    expect(textoDelAsalto({ ...base, defensores: { guarnicion: 2, milicianos: 3 } })).toContain('Defendían 2 de guarnición y 3 de milicia.');
    expect(textoDelAsalto({ ...base, defendido: true, defensores: { guarnicion: 0, milicianos: 1 } })).toContain('Defendían 1 de milicia.');
  });
});
