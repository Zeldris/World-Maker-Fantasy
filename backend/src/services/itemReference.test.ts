import { describe, it, expect } from 'vitest';
import { detectItemReference, detectMedicalItemUse, detectEnergyItemUse, detectsOwnedItemQuote } from './itemReference.js';

describe('detectItemReference', () => {
  it('detecta un objeto de la lista curada que el personaje NO tiene', () => {
    const result = detectItemReference('Mirar el mapa', ['Hacha de guerra rota', 'Raciones de viaje (5 días)']);
    expect(result).toEqual({ noun: 'mapa', posee: false });
  });

  it('detecta que SÍ lo tiene si hay un InventoryItem con ese nombre', () => {
    const result = detectItemReference('Reviso mi cuchillo', ['Cuchillo de hielo sílice']);
    expect(result).toEqual({ noun: 'cuchillo', posee: true });
  });

  it('no dispara si no hay verbo de comprobación', () => {
    expect(detectItemReference('Camino hacia el mapa de las estrellas', [])).toBeNull();
  });

  it('no dispara con "busco" (reservado a harvest/npc/lugares, demasiado genérico)', () => {
    expect(detectItemReference('Busco un mapa entre mis cosas', [])).toBeNull();
  });

  it('no dispara con sustantivos fuera de la lista curada (evita falsos positivos tipo "mi pasado")', () => {
    expect(detectItemReference('Miro mi pasado con nostalgia', [])).toBeNull();
  });

  it('tolera una errata en un sustantivo de 5+ letras (roadmap 2026-07-20)', () => {
    // "cuchilo" en vez de "cuchillo" — ningún sustantivo curado matchea exacto con esta errata.
    const result = detectItemReference('Reviso mi cuchilo', []);
    expect(result).toEqual({ noun: 'cuchillo', posee: false });
  });
});

describe('detectEnergyItemUse', () => {
  const ENERGY_ITEMS = [
    { id: 'item-racion', name: 'Ración de carne ahumada', curaEnergia: 30 },
    { id: 'item-cataplasma', name: 'Cataplasma de salvia del polvo', curaEnergia: 10 },
  ];

  it('detecta el objeto real del inventario nombrado en la acción, con su id real', () => {
    expect(detectEnergyItemUse('Como mi ración de carne ahumada', ENERGY_ITEMS)).toEqual({ id: 'item-racion', curaEnergia: 30 });
  });

  it('sin ningún objeto de energía nombrado, devuelve null', () => {
    expect(detectEnergyItemUse('Descanso un momento', ENERGY_ITEMS)).toBeNull();
  });

  it('si coinciden varios, se queda con el que más restaura', () => {
    expect(detectEnergyItemUse('Uso mi ración de carne ahumada y mi cataplasma de salvia del polvo', ENERGY_ITEMS)).toEqual({
      id: 'item-racion',
      curaEnergia: 30,
    });
  });
});

describe('detectMedicalItemUse', () => {
  // Bug real jugando en vivo (2026-08-07, "he consumido una ración y no ha desaparecido del
  // inventario"): sin devolver el `id` real de la fila que matcheó, nada podía consumirla de
  // verdad — el efecto de curación se aplicaba pero el objeto se quedaba para siempre.
  const MEDICAL_ITEMS = [
    { id: 'item-cataplasma', name: 'Cataplasma de salvia del polvo', curaHasta: 'HERIDO' as const, curaUnPaso: false },
    { id: 'item-elixir', name: 'Elixir de sanación mayor', curaHasta: 'ILESO' as const, curaUnPaso: false },
  ];

  it('detecta el objeto médico real nombrado en la acción, con su id real', () => {
    expect(detectMedicalItemUse('Uso mi cataplasma de salvia del polvo', MEDICAL_ITEMS)).toEqual({
      id: 'item-cataplasma',
      curaHasta: 'HERIDO',
      curaUnPaso: false,
    });
  });

  it('sin ningún objeto médico nombrado, devuelve null', () => {
    expect(detectMedicalItemUse('Descanso un momento', MEDICAL_ITEMS)).toBeNull();
  });

  it('si coinciden varios, se queda con el de mayor tope de curación (ILESO antes que HERIDO)', () => {
    expect(detectMedicalItemUse('Uso mi cataplasma de salvia del polvo y mi elixir de sanación mayor', MEDICAL_ITEMS)).toEqual({
      id: 'item-elixir',
      curaHasta: 'ILESO',
      curaUnPaso: false,
    });
  });

  // Primeros auxilios (2026-08-13) — el `curaUnPaso` real del objeto viaja en la respuesta, para
  // que healCeilingFor (death.ts) sepa si romper el tope de golpe o subir solo un escalón.
  it('propaga curaUnPaso del objeto que matchea', () => {
    const items = [{ id: 'item-vendaje', name: 'Vendaje improvisado', curaHasta: 'GRAVE' as const, curaUnPaso: true }];
    expect(detectMedicalItemUse('Ato mi vendaje improvisado', items)).toEqual({ id: 'item-vendaje', curaHasta: 'GRAVE', curaUnPaso: true });
  });
});

describe('detectsOwnedItemQuote', () => {
  const INVENTORY = ['Raciones de viaje', 'Cuchillo de hielo sílice'];

  it('detecta el nombre exacto citado entre comillas simples', () => {
    expect(detectsOwnedItemQuote("Cosumo 'Raciones de viaje'", INVENTORY)).toBe(true);
  });

  it('ignora mayúsculas/acentos al comparar', () => {
    expect(detectsOwnedItemQuote("Uso 'RACIONES DE VIAJE'", INVENTORY)).toBe(true);
  });

  it('sin comillas, no dispara aunque el nombre aparezca suelto en el texto', () => {
    expect(detectsOwnedItemQuote('Cosumo mis raciones de viaje', INVENTORY)).toBe(false);
  });

  it('con comillas pero un nombre que no está en el inventario, no dispara', () => {
    expect(detectsOwnedItemQuote("Uso 'Espada legendaria'", INVENTORY)).toBe(false);
  });
});
