import { describe, it, expect } from 'vitest';
import { advanceFictionalMinutes, dayForFictionalMinutes, formatFictionalDate, estacionFor, estacionNombreFor } from './worldClock.js';

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

// Sistema de estaciones (2026-08-24, Grupo 3 § Sistema de estaciones, ver
// docs/rpgtarkor/estaciones.md) — calendario único de 120 días/año, 30 por estación. Día 1 = Ur'gathek.
describe('estacionFor', () => {
  it('Día 1 empieza en Primavera', () => {
    expect(estacionFor(0)).toBe('PRIMAVERA');
  });

  it('cada estación dura 30 días exactos', () => {
    expect(estacionFor(1440 * 29)).toBe('PRIMAVERA'); // Día 30, último de Primavera
    expect(estacionFor(1440 * 30)).toBe('VERANO'); // Día 31, primero de Verano
    expect(estacionFor(1440 * 59)).toBe('VERANO'); // Día 60, último de Verano
    expect(estacionFor(1440 * 60)).toBe('OTONO'); // Día 61, primero de Otoño
    expect(estacionFor(1440 * 89)).toBe('OTONO'); // Día 90, último de Otoño
    expect(estacionFor(1440 * 90)).toBe('INVIERNO'); // Día 91, primero de Invierno
    expect(estacionFor(1440 * 119)).toBe('INVIERNO'); // Día 120, último del año
  });

  it('el año se repite: el Día 121 vuelve a Primavera', () => {
    expect(estacionFor(1440 * 120)).toBe('PRIMAVERA');
  });

  it('un año y medio después, misma estación que a mitad del primer año', () => {
    expect(estacionFor(1440 * (120 + 60))).toBe('OTONO');
  });
});

describe('estacionNombreFor', () => {
  it('para un personaje orco, usa el nombre Kektira', () => {
    expect(estacionNombreFor('PRIMAVERA', 'orcos')).toBe("Ur'gathek");
    expect(estacionNombreFor('VERANO', 'orcos')).toBe('Sohkar');
    expect(estacionNombreFor('OTONO', 'orcos')).toBe('Vungrat');
    expect(estacionNombreFor('INVIERNO', 'orcos')).toBe('Krenoth');
  });

  it('para cualquier otra raza, usa la glosa en lengua común', () => {
    expect(estacionNombreFor('OTONO', 'goirntes')).toBe('la estación de la cosecha');
  });

  it('con raza desconocida (null), también usa la glosa en lengua común', () => {
    expect(estacionNombreFor('INVIERNO', null)).toBe('la estación larga');
  });
});
