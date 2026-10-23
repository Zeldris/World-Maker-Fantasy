import { describe, expect, it } from 'vitest';
import { monturaDePruebas, tieneMontura } from './monturas.js';

describe('monturas: interruptor de pruebas (P164, CR-57)', () => {
  it('sin variable no hay montura', () => {
    expect(monturaDePruebas({})).toBe(false);
  });
  it('WMF_MONTURA_PRUEBAS=1 da montura', () => {
    expect(monturaDePruebas({ WMF_MONTURA_PRUEBAS: '1' })).toBe(true);
    expect(monturaDePruebas({ WMF_MONTURA_PRUEBAS: '1', NODE_ENV: 'development' })).toBe(true);
  });
  it('en producción se ignora', () => {
    expect(monturaDePruebas({ WMF_MONTURA_PRUEBAS: '1', NODE_ENV: 'production' })).toBe(false);
  });
  it('otro valor no cuenta', () => {
    expect(monturaDePruebas({ WMF_MONTURA_PRUEBAS: 'true' })).toBe(false);
    expect(monturaDePruebas({ WMF_MONTURA_PRUEBAS: '0' })).toBe(false);
  });
  it('tieneMontura lee el entorno', async () => {
    const antes = process.env.WMF_MONTURA_PRUEBAS;
    try {
      delete process.env.WMF_MONTURA_PRUEBAS;
      expect(await tieneMontura(null as never, 's')).toBe(false);
      process.env.WMF_MONTURA_PRUEBAS = '1';
      expect(await tieneMontura(null as never, 's')).toBe(process.env.NODE_ENV !== 'production');
    } finally {
      if (antes === undefined) delete process.env.WMF_MONTURA_PRUEBAS;
      else process.env.WMF_MONTURA_PRUEBAS = antes;
    }
  });
});
