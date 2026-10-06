import { describe, expect, it } from 'vitest';
import { diaGanadoFaccion, PLAZAS_GANADO_FACCION, REBANO_INICIAL, type Cohorte, type DatosDiaFaccion } from './ganadoFacciones.js';

/// CR-55 (55f): el rebaño Serhu con las reglas del Reino, en agregado.
const inicial = (dia: number): Cohorte[] => REBANO_INICIAL['clan-serhu']!.map((c) => ({ especie: c.especie, sexo: c.sexo, nacidoEnDia: dia - c.edadDias, cantidad: c.cantidad }));
const datos = (dia: number, diasSinComer = 0, trabajadores = 359): DatosDiaFaccion => ({
  dia,
  trabajadores,
  pasto: true,
  plazas: PLAZAS_GANADO_FACCION['clan-serhu']!,
  categoria: { murgol: 'BESTIONES', corretolvas: 'ZANCUDOS', canizor: 'ACECHANTES' },
  carnePorAnimal: { murgol: 3, corretolvas: 1, canizor: 2 },
  comidaDisponible: 100,
  diasSinComer,
  bebidaDisponible: 1000,
  diasSinBeber: 0,
  valorComestible: { 'leche-murgol': 4, 'huevo-corretolvas': 4 },
});
const total = (cs: Cohorte[]) => cs.reduce((s, c) => s + c.cantidad, 0);

describe('ganado de las facciones (CR-55 55f)', () => {
  it('el rebaño Serhu ocupa 16 ganaderos y 4 fibreros y alimenta más de lo que esos 20 darían en pasivo (40)', () => {
    const r = diaGanadoFaccion(inicial(1), datos(1), () => 0.99);
    expect(r.ganaderos).toBe(16);
    expect(r.fibreros).toBe(4);
    expect(r.comido).toBe(true);
    // 36 Múrgol adultos × 3 de leche × 4 + 14 huevos × 4 = 488 de curaHambre → 48,8 de comida.
    expect(r.comidaNeta).toBeCloseTo(48.8);
    expect(r.otros['lana-murgol'] ?? 0).toBe(0); // la lana, cada 3 días
  });

  it('en un año el rebaño se sostiene dentro de sus plazas y sigue dando comida', () => {
    let cs = inicial(0);
    let comida = 0;
    let sinComer = 0;
    for (let dia = 1; dia <= 120; dia++) {
      const r = diaGanadoFaccion(cs, datos(dia, sinComer), () => 0.5);
      cs = r.cohortes;
      sinComer = r.diasSinComer;
      comida += r.comidaNeta;
      const murgol = cs.filter((c) => c.especie === 'murgol').reduce((s, c) => s + c.cantidad, 0);
      expect(murgol).toBeLessThanOrEqual(80);
    }
    expect(total(cs)).toBeGreaterThan(60);
    expect(comida / 120).toBeGreaterThan(40);
  });

  it('sin trabajadores para el forraje no comen: no producen y al tercer día mueren, primero las crías', () => {
    const r = diaGanadoFaccion(inicial(1), datos(1, 2, 16), () => 0.99);
    expect(r.comido).toBe(false);
    expect(r.comidaNeta).toBeCloseTo(0);
    expect(r.muertos).toBeGreaterThan(0);
    expect(total(r.cohortes.filter((c) => c.nacidoEnDia >= -10))).toBeLessThan(18);
  });

  it('cada semana nacen crías (una por corral de 20 plazas) si hay sitio', () => {
    const r = diaGanadoFaccion(inicial(7), datos(7), () => 0.99);
    // Múrgol: 80 plazas → 4 corrales; Corretolvas: 30 → 2; Canizores de guardia (CR-56): 20 → 1.
    expect(r.crias).toBe(7);
  });

  it('el rebaño bebe: sin agua no produce y desde el segundo día mueren', () => {
    const r = diaGanadoFaccion(inicial(1), { ...datos(1), bebidaDisponible: 0, diasSinBeber: 1 }, () => 0.99);
    expect(r.bebido).toBe(false);
    expect(r.comidaNeta).toBeCloseTo(0);
    expect(r.muertos).toBeGreaterThan(0);
  });

  it('sin macho adulto tras el sacrificio no nacen crías', () => {
    // Corral lleno de Corretolvas con un solo macho adulto: el sacrificio se lo lleva.
    const cs: Cohorte[] = [
      { especie: 'corretolvas', sexo: 'F', nacidoEnDia: -200, cantidad: 29 },
      { especie: 'corretolvas', sexo: 'M', nacidoEnDia: -200, cantidad: 1 },
    ]
    const r = diaGanadoFaccion(cs, datos(7), () => 0.99);
    expect(r.cohortes.some((c) => c.sexo === 'M' && c.nacidoEnDia < 7)).toBe(false);
    expect(r.crias).toBe(0);
  });

  it('los Canizores de guardia no ocupan ganaderos y comen carne cada 2 días (CR-56)', () => {
    const r = diaGanadoFaccion(inicial(2), datos(2), () => 0.99);
    expect(r.ganaderos).toBe(16);
    // 5 adultos y 1 joven: 6 de comida, menos de lo que dan la leche y los huevos.
    expect(r.comidaNeta).toBeCloseTo(48.8 - 6);
  });
});
