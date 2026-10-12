import { describe, expect, it } from 'vitest';
import { descansoRechazadoPorEnfriamiento } from './timedActions.js';

describe('descansoRechazadoPorEnfriamiento (P74, QA-27)', () => {
  const base = { action: 'Descanso ocho horas', hayViaje: false, hayLugar: true, roll: null, lastRestAtMinutes: 600, ahoraMinutos: 660 };

  it('descansar con el último descanso hace menos de 3 h se rechaza', () => {
    expect(descansoRechazadoPorEnfriamiento(base)).toBe(true);
  });

  it('con la misma condición que el turno: sin lugar, de viaje o con la tirada fallada no cuenta como descanso', () => {
    expect(descansoRechazadoPorEnfriamiento({ ...base, hayLugar: false })).toBe(false);
    expect(descansoRechazadoPorEnfriamiento({ ...base, hayViaje: true })).toBe(false);
    expect(descansoRechazadoPorEnfriamiento({ ...base, roll: { success: false } })).toBe(false);
  });

  it('pasadas 3 h, o sin descanso previo, no hay enfriamiento', () => {
    expect(descansoRechazadoPorEnfriamiento({ ...base, ahoraMinutos: 600 + 180 })).toBe(false);
    expect(descansoRechazadoPorEnfriamiento({ ...base, lastRestAtMinutes: null })).toBe(false);
  });
});
