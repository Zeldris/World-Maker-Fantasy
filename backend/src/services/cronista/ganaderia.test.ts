import { describe, expect, it } from 'vitest';
import {
  comidaDe,
  consumoCorral,
  etapaDe,
  etapasDe,
  esGanado,
  factorSacrificio,
  fraccionQueMuere,
  muertesPorCarencia,
  plazasCorral,
  probMuerteDeViejoPorDia,
  produccionDelDia,
  tocaCria,
  valorCrudo,
  type Animal,
  type Etapa,
} from './ganaderia.js';

const murgol = (sexo: 'M' | 'F', edadDias: number): Animal => ({ especie: 'murgol', sexo, edadDias });

describe('etapas (CR-55 Q13)', () => {
  it('un Múrgol es cría hasta los 30 días, joven hasta el año, adulto hasta los 12 años', () => {
    const e = etapasDe('murgol', 'BESTIONES');
    expect(etapaDe(e, 29)).toBe('CRIA');
    expect(etapaDe(e, 30)).toBe('JOVEN');
    expect(etapaDe(e, 120)).toBe('ADULTO');
    expect(etapaDe(e, 12 * 120)).toBe('VEJEZ');
  });

  it('la Gargantúa crece más despacio que el resto de Bestiones (ajuste por porte)', () => {
    const e = etapasDe('gargantua-de-ceniza', 'BESTIONES');
    expect(etapaDe(e, 2 * 120)).toBe('JOVEN');
    expect(etapaDe(e, 4 * 120)).toBe('ADULTO');
  });

  it('un Corretolvas es adulto a los 60 días', () => {
    expect(etapaDe(etapasDe('corretolvas', 'ZANCUDOS'), 60)).toBe('ADULTO');
  });

  it('el Corredor de Cauce nunca es ganado', () => {
    expect(esGanado('corredor-de-cauce')).toBe(false);
    expect(esGanado('murgol')).toBe(true);
  });
});

describe('consumo (Q13 de la Fase D)', () => {
  it('herbívoros comen forraje y la cría la mitad; todos beben', () => {
    const c = consumoCorral([{ a: murgol('M', 200), etapa: 'ADULTO' }, { a: murgol('F', 10), etapa: 'CRIA' }], 1);
    expect(c).toEqual({ forraje: 2, comida: 0, agua: 2 });
  });

  it('con pasto natural (las Llanuras) los herbívoros comen la mitad', () => {
    const c = consumoCorral([{ a: murgol('M', 200), etapa: 'ADULTO' }, { a: murgol('F', 200), etapa: 'ADULTO' }], 1, true);
    expect(c.forraje).toBe(1);
  });

  it('el carnívoro come 1 de comida cada 2 días', () => {
    const canizor = { a: { especie: 'canizor', sexo: 'M' as const, edadDias: 400 }, etapa: 'ADULTO' as Etapa };
    expect(consumoCorral([canizor], 2).comida).toBe(1);
    expect(consumoCorral([canizor], 3).comida).toBe(0);
  });
});

describe('producción (Q4, Q12)', () => {
  it('sin ganadero o sin comer no hay producción', () => {
    expect(produccionDelDia('murgol', ['ADULTO'], 0, 3, true)).toEqual({});
    expect(produccionDelDia('murgol', ['ADULTO'], 1, 3, false)).toEqual({});
  });

  it('cada adulto da 3 de leche al día y lana cada 3 días; las crías y los jóvenes nada', () => {
    expect(produccionDelDia('murgol', ['ADULTO', 'ADULTO', 'CRIA', 'JOVEN'], 1, 3, true)).toEqual({ 'leche-murgol': 6, 'lana-murgol': 2 });
    expect(produccionDelDia('murgol', ['ADULTO', 'ADULTO'], 1, 4, true)).toEqual({ 'leche-murgol': 6 });
  });

  it('un ganadero cuida a 5: el sexto adulto no produce', () => {
    expect(produccionDelDia('murgol', Array<Etapa>(6).fill('ADULTO'), 1, 1, true)['leche-murgol']).toBe(15);
    expect(produccionDelDia('murgol', Array<Etapa>(6).fill('ADULTO'), 2, 1, true)['leche-murgol']).toBe(18);
  });

  it('la vejez produce la mitad', () => {
    expect(produccionDelDia('murgol', ['VEJEZ', 'VEJEZ'], 1, 1, true)['leche-murgol']).toBe(3);
  });

  it('el Corretolvas da un huevo al día y plumas cada 2', () => {
    expect(produccionDelDia('corretolvas', ['ADULTO', 'ADULTO'], 1, 2, true)).toEqual({ 'huevo-corretolvas': 2, 'plumas-rojizas': 2 });
  });

  it('el Coracelo no produce hasta que Álvaro diga qué fibra da', () => {
    expect(produccionDelDia('coracelo', ['ADULTO'], 1, 6, true)).toEqual({});
  });
});

describe('crías', () => {
  const adultos = [{ a: murgol('M', 200), etapa: 'ADULTO' as Etapa }, { a: murgol('F', 200), etapa: 'ADULTO' as Etapa }];
  it('con macho y hembra adultos, plaza libre y comida, nace una cría', () => {
    expect(tocaCria(adultos, plazasCorral(1), true)).toBe(true);
  });
  it('sin plaza, sin comer o sin pareja, no', () => {
    expect(tocaCria(adultos, 2, true)).toBe(false);
    expect(tocaCria(adultos, 6, false)).toBe(false);
    expect(tocaCria([adultos[0]!], 6, true)).toBe(false);
  });
  it('los viejos no crían', () => {
    expect(tocaCria([adultos[0]!, { a: murgol('F', 2000), etapa: 'VEJEZ' }], 6, true)).toBe(false);
  });
});

describe('hambre, sed y vejez (Q6)', () => {
  it('hambre desde el día 3 (10 %) y sed desde el 2 (20 %)', () => {
    expect(fraccionQueMuere(2, 1)).toBe(0);
    expect(fraccionQueMuere(3, 0)).toBeCloseTo(0.1);
    expect(fraccionQueMuere(3, 2)).toBeCloseTo(0.3);
    expect(muertesPorCarencia(12, 0.1)).toBe(1);
    expect(muertesPorCarencia(0, 0.1)).toBe(0);
  });

  it('no muere de viejo antes de la vejez', () => {
    const e = etapasDe('murgol', 'BESTIONES');
    expect(probMuerteDeViejoPorDia(e, e.vejez - 1)).toBe(0);
    expect(probMuerteDeViejoPorDia(e, e.esperanza)).toBeGreaterThan(probMuerteDeViejoPorDia(e, e.vejez));
  });

  it('sacrificar un joven da la mitad y una cría nada', () => {
    expect(factorSacrificio('ADULTO')).toBe(1);
    expect(factorSacrificio('JOVEN')).toBe(0.5);
    expect(factorSacrificio('CRIA')).toBe(0);
  });
});

describe('comida cruda (Q15)', () => {
  it('la leche vale 4 y la carne cruda 8; lo del catálogo manda', () => {
    expect(valorCrudo('leche-murgol', null)).toBe(4);
    expect(valorCrudo('carne-toluh', null)).toBe(8);
    expect(valorCrudo('racion-carne', 10)).toBe(10);
    expect(valorCrudo('piedra', null)).toBe(0);
  });

  it('10 de curaHambre son 1 de comida', () => {
    expect(comidaDe(4, 6)).toBe(2);
    expect(comidaDe(10, 1)).toBe(1);
  });
});
