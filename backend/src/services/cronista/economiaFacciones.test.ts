import { describe, it, expect } from 'vitest';
import { muertesDelDia, repartirMuertes, sueldosDelDia, talleresDeFaccion } from './economiaFacciones.js';

describe('economía de las facciones (CR-54 54b) — en agregado', () => {
  it('mueren primero civiles, luego trabajadores y por último soldados', () => {
    expect(repartirMuertes({ civiles: 3, trabajadores: 5, soldados: 4 }, 6)).toEqual({ civiles: 3, trabajadores: 3, soldados: 0 });
  });

  it('hambre desde el día 3 (1 % al día) y sed desde el día 2 (2 %)', () => {
    const c = { civiles: 100, trabajadores: 100, soldados: 100 };
    expect(muertesDelDia(c, 2, 1)).toBe(0);
    expect(muertesDelDia(c, 3, 0)).toBe(3);
    expect(muertesDelDia(c, 3, 2)).toBe(9);
  });

  it('sueldos cada 7 días; sin Goirnos, −3 de felicidad al día y el 5 % de soldados deserta desde el día 7', () => {
    const s = { riqueza: 100, felicidad: 60, diasSinCobrar: 0, trabajadores: 10, soldados: 40 };
    expect(sueldosDelDia(s, 3)).toEqual({ riqueza: 100, felicidad: 60, diasSinCobrar: 0, desertores: 0 });
    expect(sueldosDelDia({ ...s, riqueza: 300 }, 7)).toEqual({ riqueza: 80, felicidad: 60, diasSinCobrar: 0, desertores: 0 });
    expect(sueldosDelDia(s, 7)).toEqual({ riqueza: 100, felicidad: 57, diasSinCobrar: 1, desertores: 0 });
    expect(sueldosDelDia({ ...s, diasSinCobrar: 6 }, 13)).toEqual({ riqueza: 100, felicidad: 57, diasSinCobrar: 7, desertores: 2 });
  });

  it('el equipo que no fabrican sus talleres va en la factura (CR-58)', () => {
    expect([...talleresDeFaccion(['herrero-orcos-llanuras', 'peletero-orcos-llanuras', 'sede'])].sort()).toEqual(['herreria', 'peleteria']);
    const s = { riqueza: 300, felicidad: 60, diasSinCobrar: 0, trabajadores: 10, soldados: 40 };
    expect(sueldosDelDia(s, 7, 50).riqueza).toBe(300 - 220 - 50);
  });
});
