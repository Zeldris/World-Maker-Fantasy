import { describe, it, expect } from 'vitest';
import { advanceFictionalMinutes, dayForFictionalMinutes, formatFictionalDate } from './worldClock.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"): el reloj ficticio
// no tenía ningún test pese a ser aritmética con varios puntos donde un signo o un módulo mal
// puesto rompería la fecha/hora mostrada en todo el juego (Diario, contexto del Narrador).

describe('advanceFictionalMinutes', () => {
  it('suma los minutos transcurridos', () => {
    expect(advanceFictionalMinutes(480, 30)).toBe(510);
  });

  it('nunca resta tiempo aunque el delta sea negativo (protección, no debería pasar en la práctica)', () => {
    expect(advanceFictionalMinutes(480, -30)).toBe(480);
  });

  it('un delta de 0 deja el reloj intacto', () => {
    expect(advanceFictionalMinutes(480, 0)).toBe(480);
  });
});

describe('dayForFictionalMinutes', () => {
  it('día 1 para cualquier minuto dentro de las primeras 24h', () => {
    expect(dayForFictionalMinutes(0)).toBe(1);
    expect(dayForFictionalMinutes(1439)).toBe(1);
  });

  it('día 2 en cuanto se cruzan los 1440 minutos', () => {
    expect(dayForFictionalMinutes(1440)).toBe(2);
    expect(dayForFictionalMinutes(2000)).toBe(2);
  });

  it('cuenta varios días completos', () => {
    expect(dayForFictionalMinutes(1440 * 5 + 10)).toBe(6);
  });
});

describe('formatFictionalDate', () => {
  it('formatea día y hora con ceros a la izquierda', () => {
    expect(formatFictionalDate(480)).toBe('Día 1, 08:00');
    expect(formatFictionalDate(0)).toBe('Día 1, 00:00');
    expect(formatFictionalDate(65)).toBe('Día 1, 01:05');
  });

  it('cruza de día exactamente a medianoche', () => {
    expect(formatFictionalDate(1440)).toBe('Día 2, 00:00');
    expect(formatFictionalDate(1439)).toBe('Día 1, 23:59');
  });

  it('nunca produce una hora u minuto negativo aunque el total sea negativo', () => {
    // Salvaguarda de la doble normalización del módulo — no debería ocurrir en la práctica
    // (advanceFictionalMinutes nunca resta), pero si alguna vez un valor negativo llegara aquí,
    // no debe producir "Día 0, -5:00" ni nada por el estilo.
    const result = formatFictionalDate(-5);
    expect(result).not.toMatch(/-/);
  });
});
