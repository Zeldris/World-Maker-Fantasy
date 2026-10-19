import { describe, it, expect } from 'vitest';
import {
  avisoCarenciaPersonaje,
  esDomador,
  felicidadUmbralFor,
  FELICIDAD_UMBRAL_GENERAL,
  FELICIDAD_UMBRAL_DOMADOR,
  FELICIDAD_GANANCIA,
  resolverIntento,
  jaulaTamanoRequeridoFor,
  jaulaAlcanzaPara,
  jaulaRecipeKeyFor,
  comidaPct,
  aguaPct,
  lastAtMinutesForGanancia,
  AGUA_MINUTOS_POR_TRAMO,
  COMIDA_MINUTOS_POR_TRAMO,
  UMBRAL_DESCUIDO_PCT,
  condicionPorSupervivencia,
  maxSlotsDomadorFor,
  alfaDeLaManadaBonusFor,
} from './companionSupervivencia.js';
import type { AttributeBlock } from './dice.js';

// Grupo 3 § Compañeros y supervivencia (2026-08-25, docs/rpgtarkor/sistemas-reino/companeros-y-supervivencia.md)

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

// Alfa de la Manada real (2026-09-14, docs/rpgtarkor/sistemas-combate/clases.md — Domador 40, capstone)
describe('maxSlotsDomadorFor', () => {
  it('sin ser Domador, siempre 0 (compite por companionSlotsForRecipeKey como cualquiera)', () => {
    expect(maxSlotsDomadorFor('GUERRERO', 'BERSERKER', 40)).toBe(0);
    expect(maxSlotsDomadorFor(null, null, 40)).toBe(0);
  });

  it('Domador por debajo de nivel 40 tiene 1 slot garantizado', () => {
    expect(maxSlotsDomadorFor('CAZADOR', 'DOMADOR', 1)).toBe(1);
    expect(maxSlotsDomadorFor('CAZADOR', 'DOMADOR', 39)).toBe(1);
  });

  it('Domador con nivel 40+ (Alfa de la Manada) tiene 2 slots garantizados', () => {
    expect(maxSlotsDomadorFor('CAZADOR', 'DOMADOR', 40)).toBe(2);
    expect(maxSlotsDomadorFor('CAZADOR', 'DOMADOR', 60)).toBe(2);
  });
});

describe('alfaDeLaManadaBonusFor', () => {
  const base: AttributeBlock = { fuerza: 6, destreza: 6, constitucion: 6, inteligencia: 4, voluntad: 6, carisma: 2, magia: 0 };

  it('con menos de 2 slots de Domador ocupados, sin ningún buff (ni siquiera al Alfa)', () => {
    expect(alfaDeLaManadaBonusFor(base, 0, false)).toEqual(base);
    expect(alfaDeLaManadaBonusFor(base, 1, true)).toEqual(base);
  });

  it('con los 2 slots cubiertos, +2 voluntad para AMBAS bestias, sin importar quién sea el Alfa', () => {
    expect(alfaDeLaManadaBonusFor(base, 2, false)).toEqual({ ...base, voluntad: 8 });
  });

  it('con los 2 slots cubiertos, el Alfa además recibe +2 fuerza extra', () => {
    expect(alfaDeLaManadaBonusFor(base, 2, true)).toEqual({ ...base, voluntad: 8, fuerza: 8 });
  });
});

describe('resolverIntento', () => {
  const playerAttrs: AttributeBlock = { fuerza: 20, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };
  const resistenciaAttrs: AttributeBlock = { fuerza: 2, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };

  it('ganar sube Felicidad, el umbral general no se completa con un solo intento', () => {
    const result = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', 0, false, 100, () => 0.9);
    expect(result.roll.gano).toBe(true);
    expect(result.felicidadTras).toBe(FELICIDAD_GANANCIA);
    expect(result.umbralCompletado).toBe(false);
  });

  it('perder resta Felicidad, nunca por debajo de 0', () => {
    const result = resolverIntento(resistenciaAttrs, 'fuerza', playerAttrs, 'fuerza', 5, false, 100, () => 0.5);
    expect(result.roll.gano).toBe(false);
    expect(result.felicidadTras).toBe(0); // 5 - 10, topado en 0
  });

  it('el umbral se completa en cuanto la Felicidad acumulada lo alcanza', () => {
    const result = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', FELICIDAD_UMBRAL_DOMADOR - 1, true, 100, () => 0.9);
    expect(result.umbralCompletado).toBe(true);
  });

  // Bug real (auditoría de lore 2026-08-25, decisión de la usuaria "hay que engancharlo"):
  // disposicionPct bajo debe poder tumbar una tirada que con atributos puros habría ganado.
  it('disposicionPct bajo puede convertir una victoria de atributos en derrota real (Torgash Ketg, reclutablePct 5)', () => {
    // Con disposicionPct=100 este roll gana de sobra (margen amplio, playerAttrs muy por encima).
    const ganaSinPenalizacion = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', 0, false, 100, () => 0.5);
    expect(ganaSinPenalizacion.roll.gano).toBe(true);

    // Con disposicionPct=5 (Torgash Ketg real, worldCatalog.ts) la resistencia extra (+9) tumba esa
    // misma tirada.
    const pierdeConPenalizacion = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', 0, false, 5, () => 0.5);
    expect(pierdeConPenalizacion.roll.gano).toBe(false);
  });

  it('disposicionPct=100 no penaliza nada (mismo resultado que antes del enganche)', () => {
    const result = resolverIntento(playerAttrs, 'fuerza', resistenciaAttrs, 'fuerza', 0, false, 100, () => 0.5);
    // random fijo (0.5) -> roll 11 en ambos lados; resistenciaResult = 11 + floor(fuerza=2/2) = 12,
    // sin ningún extra sumado por disposicionPct=100 (resistenciaExtra = floor((100-100)/10) = 0).
    expect(result.roll.resistenciaResult).toBe(12);
  });
});

describe('jaula', () => {
  it('tamaño requerido conocido por especie, PEQUENA por defecto si no está calibrada', () => {
    expect(jaulaTamanoRequeridoFor('gargantua-de-ceniza')).toBe('GRANDE');
    expect(jaulaTamanoRequeridoFor('zense-ceniza')).toBe('PEQUENA');
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

describe('lastAtMinutesForGanancia (habilidad "Comer/Beber")', () => {
  it('0% + ganancia que llega a 100 → lastAtMinutes = nowMinutes (recién comido/bebido)', () => {
    const now = 10_000;
    expect(lastAtMinutesForGanancia(0, now, AGUA_MINUTOS_POR_TRAMO, 100)).toBe(now);
  });

  it('nunca comió (null) + cualquier ganancia → ya estaba al 100%, se queda en nowMinutes', () => {
    const now = 5_000;
    expect(lastAtMinutesForGanancia(null, now, COMIDA_MINUTOS_POR_TRAMO, 20)).toBe(now);
  });

  it('50% + 30 de ganancia → objetivo 80%, redondea al tramo de 25 más cercano (75%, 1 tramo)', () => {
    const now = 10_000;
    const lastAt = now - 2 * AGUA_MINUTOS_POR_TRAMO; // 50%
    const resultado = lastAtMinutesForGanancia(lastAt, now, AGUA_MINUTOS_POR_TRAMO, 30);
    expect(aguaPct(resultado, now)).toBe(75);
  });

  it('ganancia negativa se ignora (nunca empeora), se queda igual que el pct actual', () => {
    const now = 10_000;
    const lastAt = now - AGUA_MINUTOS_POR_TRAMO; // 75%
    const resultado = lastAtMinutesForGanancia(lastAt, now, AGUA_MINUTOS_POR_TRAMO, -10);
    expect(aguaPct(resultado, now)).toBe(75);
  });

  it('ganancia grande desde 0% respeta el tope de 4 tramos (nunca antes de minuto 0)', () => {
    const now = 100;
    const resultado = lastAtMinutesForGanancia(0, now, AGUA_MINUTOS_POR_TRAMO, 24);
    expect(resultado).toBeGreaterThanOrEqual(0);
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

  it('CR-14: el bono de las etiquetas cambia el resultado de un intento justo', () => {
    const iguales = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 };
    const sinBono = resolverIntento(iguales, 'carisma', iguales, 'carisma', 0, false, 100, () => 0.5);
    const conMalus = resolverIntento(iguales, 'carisma', iguales, 'carisma', 0, false, 100, () => 0.5, -2);
    expect(conMalus.roll.margen).toBe(sinBono.roll.margen - 2);
  });
});

describe('avisoCarenciaPersonaje (P219)', () => {
  it('concuerda el verbo con la causa', () => {
    expect(avisoCarenciaPersonaje(0, 0)).toContain('el hambre y la sed te debilitan');
    expect(avisoCarenciaPersonaje(0, 100)).toContain('el hambre te debilita ');
    expect(avisoCarenciaPersonaje(100, 0)).toContain('la sed te debilita ');
  });
});
