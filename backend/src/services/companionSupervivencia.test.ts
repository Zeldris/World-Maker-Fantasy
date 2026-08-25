import { describe, it, expect } from 'vitest';
import {
  esDomador,
  felicidadUmbralFor,
  FELICIDAD_UMBRAL_GENERAL,
  FELICIDAD_UMBRAL_DOMADOR,
  FELICIDAD_GANANCIA,
  FELICIDAD_PERDIDA,
  resolverIntento,
  jaulaTamanoRequeridoFor,
  jaulaAlcanzaPara,
  jaulaRecipeKeyFor,
  porcentajeSupervivencia,
  comidaPct,
  aguaPct,
  AGUA_MINUTOS_POR_TRAMO,
  COMIDA_MINUTOS_POR_TRAMO,
  UMBRAL_DESCUIDO_PCT,
  condicionPorSupervivencia,
} from './companionSupervivencia.js';
import type { AttributeBlock } from './dice.js';

// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/companeros-y-supervivencia.md)

describe('esDomador', () => {
  it('true solo para Cazador/Domador exacto', () => {
    expect(esDomador('CAZADOR', 'DOMADOR')).toBe(true);
  });

  it('false para cualquier otra combinación', () => {
    expect(esDomador('CAZADOR', 'TIRADOR')).toBe(false);
    expect(esDomador('GUERRERO', 'DOMADOR')).toBe(false);
    expect(esDomador(null, null)).toBe(false);
  });
});

describe('felicidadUmbralFor', () => {
  it('el Domador necesita sustancialmente menos Felicidad (§2)', () => {
    expect(felicidadUmbralFor(true)).toBe(FELICIDAD_UMBRAL_DOMADOR);
    expect(felicidadUmbralFor(false)).toBe(FELICIDAD_UMBRAL_GENERAL);
    expect(FELICIDAD_UMBRAL_DOMADOR).toBeLessThan(FELICIDAD_UMBRAL_GENERAL);
  });
});

describe('resolverIntento', () => {
  const playerAttrs: AttributeBlock = { fuerza: 20, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 0 };
  const resistenciaAttrs: AttributeBlock = { fuerza: 2, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 0 };

  it('ganar sube Felicidad, el umbral general no se completa con un solo intento', () => {
    const result = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', 0, false, () => 0.9);
    expect(result.roll.gano).toBe(true);
    expect(result.felicidadTras).toBe(FELICIDAD_GANANCIA);
    expect(result.umbralCompletado).toBe(false);
  });

  it('perder resta Felicidad, nunca por debajo de 0', () => {
    const result = resolverIntento(resistenciaAttrs, 'fuerza', playerAttrs, 'fuerza', 5, false, () => 0.5);
    expect(result.roll.gano).toBe(false);
    expect(result.felicidadTras).toBe(0); // 5 - 10, topado en 0
  });

  it('el umbral se completa en cuanto la Felicidad acumulada lo alcanza', () => {
    const result = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', FELICIDAD_UMBRAL_DOMADOR - 1, true, () => 0.9);
    expect(result.umbralCompletado).toBe(true);
  });
});

describe('jaula', () => {
  it('tamaño requerido conocido por especie, PEQUENA por defecto si no está calibrada', () => {
    expect(jaulaTamanoRequeridoFor('gargantua-de-ceniza')).toBe('GRANDE');
    expect(jaulaTamanoRequeridoFor('buitre-cenizo')).toBe('PEQUENA');
    expect(jaulaTamanoRequeridoFor('especie-inventada-sin-calibrar')).toBe('PEQUENA');
  });

  it('una jaula grande aloja cualquier tamaño, una pequeña solo lo pequeño', () => {
    expect(jaulaAlcanzaPara('GRANDE', 'PEQUENA')).toBe(true);
    expect(jaulaAlcanzaPara('GRANDE', 'GRANDE')).toBe(true);
    expect(jaulaAlcanzaPara('PEQUENA', 'GRANDE')).toBe(false);
    expect(jaulaAlcanzaPara('MEDIANA', 'GRANDE')).toBe(false);
  });

  it('recipeKey determinista por tamaño', () => {
    expect(jaulaRecipeKeyFor('PEQUENA')).toBe('jaula-pequena');
    expect(jaulaRecipeKeyFor('GRANDE')).toBe('jaula-grande');
  });
});

describe('porcentajeSupervivencia / comidaPct / aguaPct', () => {
  it('null (nunca comió/bebió) = 100%, sin hambre/sed acumulada', () => {
    expect(comidaPct(null, 99999)).toBe(100);
    expect(aguaPct(null, 99999)).toBe(100);
  });

  it('agua baja un tramo de 25% cada 5h, comida cada 12h (§4/§5)', () => {
    expect(aguaPct(0, AGUA_MINUTOS_POR_TRAMO - 1)).toBe(100);
    expect(aguaPct(0, AGUA_MINUTOS_POR_TRAMO)).toBe(75);
    expect(aguaPct(0, AGUA_MINUTOS_POR_TRAMO * 2)).toBe(50);
    expect(comidaPct(0, COMIDA_MINUTOS_POR_TRAMO)).toBe(75);
  });

  it('nunca baja de 0%, aunque pase muchísimo tiempo', () => {
    expect(aguaPct(0, AGUA_MINUTOS_POR_TRAMO * 100)).toBe(0);
  });

  it('el umbral de descuido (§4) es 25%', () => {
    expect(UMBRAL_DESCUIDO_PCT).toBe(25);
  });
});

describe('condicionPorSupervivencia', () => {
  it('sin carencia (comida y agua ≥25%), no cambia nada', () => {
    expect(condicionPorSupervivencia(100, 100, 'ILESO')).toBeNull();
    expect(condicionPorSupervivencia(25, 25, 'ILESO')).toBeNull();
  });

  it('una sola carencia empeora un paso, topado en CONVALECIENTE', () => {
    expect(condicionPorSupervivencia(10, 100, 'ILESO')).toBe('HERIDO');
    expect(condicionPorSupervivencia(10, 100, 'GRAVE')).toBe('CONVALECIENTE');
    expect(condicionPorSupervivencia(10, 100, 'CONVALECIENTE')).toBeNull(); // ya en el tope
  });

  it('las dos carencias a la vez también topan en CONVALECIENTE en esta pasada (muerte real fuera de alcance)', () => {
    expect(condicionPorSupervivencia(0, 0, 'GRAVE')).toBe('CONVALECIENTE');
    expect(condicionPorSupervivencia(0, 0, 'CONVALECIENTE')).toBeNull();
  });

  it('nunca mejora la condición, solo la empeora', () => {
    expect(condicionPorSupervivencia(0, 0, 'MUERTO')).toBeNull();
  });
});
