import { describe, expect, it } from 'vitest';
import { deNombre, narrarAperturaCombateForzado, nombreDeEncuentro, nombreEnFrase } from './dynamicMode.js';

describe('nombreEnFrase (P63, QA-27)', () => {
  it('el nombre oculto por raza lleva artículo y va en minúscula dentro de la frase', () => {
    expect(nombreEnFrase('Orco desconocido')).toBe('el orco desconocido');
    expect(nombreEnFrase('Orca desconocida')).toBe('la orca desconocida');
    expect(nombreEnFrase('Orco desconocido', true)).toBe('El orco desconocido');
  });

  it('cualquier otro nombre pasa tal cual', () => {
    expect(nombreEnFrase('Gistera Koh')).toBe('Gistera Koh');
  });

  it('«Alguien» va en minúscula a mitad de frase y en mayúscula al inicio', () => {
    expect(nombreEnFrase('Alguien')).toBe('alguien');
    expect(nombreEnFrase('Alguien', true)).toBe('Alguien');
  });

  it('la apertura del combate forzado ya no lo lee como nombre propio', () => {
    expect(narrarAperturaCombateForzado('Orco desconocido').narration).toContain('— el orco desconocido no tiene intención de dejarte pasar');
  });

  it('P90: un grupo de fauna se nombra como grupo, y «de el» se contrae', () => {
    expect(narrarAperturaCombateForzado('Kirelon Arenoso', 5).narration).toContain('— el grupo de 5 Kirelones Arenosos no tiene intención');
    expect(deNombre(nombreDeEncuentro('Kirelon Arenoso', 5))).toBe('del grupo de 5 Kirelones Arenosos');
    expect(deNombre(nombreDeEncuentro('Orco desconocido', 1))).toBe('del orco desconocido');
    expect(deNombre(nombreDeEncuentro('Gistera Koh'))).toBe('de Gistera Koh');
  });
});
