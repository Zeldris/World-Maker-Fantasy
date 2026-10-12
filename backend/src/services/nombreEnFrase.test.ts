import { describe, expect, it } from 'vitest';
import { narrarAperturaCombateForzado, nombreEnFrase } from './dynamicMode.js';

describe('nombreEnFrase (P63, QA-27)', () => {
  it('el nombre oculto por raza lleva artículo y va en minúscula dentro de la frase', () => {
    expect(nombreEnFrase('Orco desconocido')).toBe('el orco desconocido');
    expect(nombreEnFrase('Orca desconocida')).toBe('la orca desconocida');
    expect(nombreEnFrase('Orco desconocido', true)).toBe('El orco desconocido');
  });

  it('cualquier otro nombre pasa tal cual', () => {
    expect(nombreEnFrase('Gistera Koh')).toBe('Gistera Koh');
    expect(nombreEnFrase('Alguien')).toBe('Alguien');
  });

  it('la apertura del combate forzado ya no lo lee como nombre propio', () => {
    expect(narrarAperturaCombateForzado('Orco desconocido').narration).toContain('— el orco desconocido no tiene intención de dejarte pasar');
  });
});
