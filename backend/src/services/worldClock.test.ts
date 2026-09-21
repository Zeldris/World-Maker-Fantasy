import { describe, it, expect } from 'vitest';
import {
  advanceFictionalMinutes,
  dayForFictionalMinutes,
  formatFictionalDate,
  estacionFor,
  yearFor,
  diaRelativoEnEstacionFor,
  calendarioFor,
  estacionNombreFor,
  climaFor,
  climaSeveridadAlMenos,
  climaNombreFor,
  momentoDelDiaFor,
  entornoTemporalFor,
} from './worldClock.js';

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

// Diario en pestañas jerárquicas (2026-09-04) — Año/Día relativo, complemento de estacionFor.
describe('yearFor', () => {
  it('todo el primer año (días 1-120) es Año 1', () => {
    expect(yearFor(0)).toBe(1);
    expect(yearFor(1440 * 119)).toBe(1); // Día 120, último del Año 1
  });

  it('el Día 121 cruza a Año 2', () => {
    expect(yearFor(1440 * 120)).toBe(2);
    expect(yearFor(1440 * 239)).toBe(2); // Día 240, último del Año 2
  });

  it('el Día 241 cruza a Año 3', () => {
    expect(yearFor(1440 * 240)).toBe(3);
  });
});

describe('diaRelativoEnEstacionFor', () => {
  it('Día 1 de partida es Día 1 de su estación', () => {
    expect(diaRelativoEnEstacionFor(0)).toBe(1);
  });

  it('Día 30 (último de Primavera) es Día 30 relativo', () => {
    expect(diaRelativoEnEstacionFor(1440 * 29)).toBe(30);
  });

  it('Día 31 (primero de Verano) vuelve a ser Día 1 relativo', () => {
    expect(diaRelativoEnEstacionFor(1440 * 30)).toBe(1);
  });

  it('Día 120 (último del año, fin de Invierno) es Día 30 relativo', () => {
    expect(diaRelativoEnEstacionFor(1440 * 119)).toBe(30);
  });

  it('Día 121 (primero del Año 2) vuelve a ser Día 1 relativo', () => {
    expect(diaRelativoEnEstacionFor(1440 * 120)).toBe(1);
  });
});

describe('calendarioFor', () => {
  it('agrega year/estacion/diaRelativo/diaAbsoluto de forma coherente', () => {
    expect(calendarioFor(1440 * 130)).toEqual({
      year: 2,
      estacion: 'PRIMAVERA', // Día 131, día 11 del Año 2 (1-30 del año = Primavera)
      diaRelativo: 11,
      diaAbsoluto: 131,
    });
  });
});

describe('momentoDelDiaFor', () => {
  it('6:00 a 19:59 es día', () => {
    expect(momentoDelDiaFor(6 * 60)).toBe('dia');
    expect(momentoDelDiaFor(12 * 60)).toBe('dia');
    expect(momentoDelDiaFor(19 * 60 + 59)).toBe('dia');
  });

  it('20:00 a 5:59 es noche, incluida la medianoche', () => {
    expect(momentoDelDiaFor(20 * 60)).toBe('noche');
    expect(momentoDelDiaFor(0)).toBe('noche');
    expect(momentoDelDiaFor(5 * 60 + 59)).toBe('noche');
  });

  it('se repite igual cada día, independientemente del día de ficción', () => {
    expect(momentoDelDiaFor(1440 * 7 + 6 * 60)).toBe('dia');
    expect(momentoDelDiaFor(1440 * 7 + 21 * 60)).toBe('noche');
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

// Clima de las 8 regiones (2026-08-24, Grupo 3 § Eventos de clima puntuales, ver
// docs/rpgtarkor/clima-tormentas.md; ampliado de 1 a 8 regiones el 2026-09-21, § 5-bis punto 13)
// — eje de tiempo distinto de estacionFor, por región.
describe('climaFor', () => {
  it('región desconocida (fuera de las 8 reales) o null, siempre null', () => {
    expect(climaFor(0, 'Región inventada que no existe')).toBeNull();
    expect(climaFor(0, null)).toBeNull();
  });

  it('las 8 regiones reales tienen clima propio (no null)', () => {
    const REGIONES = [
      'Las Llanuras del Viento Rojo',
      'Cristal Helado',
      'Ciénaga Troncal',
      'La Meseta del Orden',
      'El Margen Silencioso',
      'La Cicatriz de Cristal',
      'El Susurro de las Raíces',
      'La Costa del Azabache',
    ];
    for (const region of REGIONES) {
      expect(climaFor(0, region)).not.toBeNull();
    }
  });

  it('ciclo de 3 días (Tormenta/Viento/Calma) para Las Llanuras — sin cambios respecto al diseño original', () => {
    const region = 'Las Llanuras del Viento Rojo';
    expect(climaFor(1440 * 0, region)).toBe('TORMENTA_EXTREMA'); // Día 1, tormenta nº0 (0%3=0)
    expect(climaFor(1440 * 1, region)).toBe('VIENTO_FUERTE'); // Día 2
    expect(climaFor(1440 * 2, region)).toBe('CLIMA_LLEVABLE'); // Día 3
    expect(climaFor(1440 * 3, region)).toBe('TORMENTA_GRANDE'); // Día 4, tormenta nº1 (1%3≠0)
    expect(climaFor(1440 * 6, region)).toBe('TORMENTA_GRANDE'); // Día 7, tormenta nº2
    expect(climaFor(1440 * 9, region)).toBe('TORMENTA_EXTREMA'); // Día 10, tormenta nº3 (3%3=0)
  });

  it('Cristal Helado: extremas más frecuentes que Llanuras (1 de cada 2, no 3) — coherente con la adaptación física de los Helsig', () => {
    const region = 'Cristal Helado';
    // Muestreo día a día (no de 3 en 3, que cae siempre en la misma posición del ciclo) durante
    // 30 días — filtra solo los días de tormenta (GRANDE/EXTREMA) y comprueba la proporción.
    const dias = Array.from({ length: 30 }, (_, i) => climaFor(1440 * i, region));
    const tormentas = dias.filter((d) => d === 'TORMENTA_GRANDE' || d === 'TORMENTA_EXTREMA');
    const extremas = tormentas.filter((d) => d === 'TORMENTA_EXTREMA').length;
    expect(extremas / tormentas.length).toBeGreaterThan(0.4); // 1 de cada 2 ≈ 50%, más que Llanuras (1/3 ≈ 33%)
  });

  it('La Cicatriz de Cristal: clima más estable de las 8 (1 de cada 6 extrema) — la formación geológica protege la región', () => {
    const region = 'La Cicatriz de Cristal';
    const dias = Array.from({ length: 60 }, (_, i) => climaFor(1440 * i, region));
    const tormentas = dias.filter((d) => d === 'TORMENTA_GRANDE' || d === 'TORMENTA_EXTREMA');
    const extremas = tormentas.filter((d) => d === 'TORMENTA_EXTREMA').length;
    expect(extremas / tormentas.length).toBeLessThan(0.25); // 1 de cada 6 ≈ 17%, menos que Llanuras (1/3)
  });

  it('dos regiones con offset de fase distinto no siguen la misma secuencia de estados', () => {
    // Llanuras (offset 0) y Ciénaga Troncal (offset 2) tienen la misma proporción de severidad
    // (extremaCada: 3) pero fase distinta — la secuencia de los primeros 3 días debe diferir.
    const secuenciaLlanuras = [0, 1, 2].map((d) => climaFor(1440 * d, 'Las Llanuras del Viento Rojo'));
    const secuenciaCienaga = [0, 1, 2].map((d) => climaFor(1440 * d, 'Ciénaga Troncal'));
    expect(secuenciaLlanuras).not.toEqual(secuenciaCienaga);
  });

  it('el año se repite: el Día 121 vuelve a dar el mismo clima que el Día 1', () => {
    const region = 'Las Llanuras del Viento Rojo';
    expect(climaFor(1440 * 120, region)).toBe('TORMENTA_EXTREMA');
  });
});

describe('climaSeveridadAlMenos', () => {
  it('sin clima conocido (null), nunca satisface ningún requisito (fallo cerrado)', () => {
    expect(climaSeveridadAlMenos(null, 'CLIMA_LLEVABLE')).toBe(false);
  });

  it('una tormenta extrema satisface un requisito de tormenta grande (severidad mayor)', () => {
    expect(climaSeveridadAlMenos('TORMENTA_EXTREMA', 'TORMENTA_GRANDE')).toBe(true);
  });

  it('viento fuerte NO satisface un requisito de tormenta grande (severidad menor)', () => {
    expect(climaSeveridadAlMenos('VIENTO_FUERTE', 'TORMENTA_GRANDE')).toBe(false);
  });

  it('un clima satisface exactamente su propio umbral', () => {
    expect(climaSeveridadAlMenos('CLIMA_LLEVABLE', 'CLIMA_LLEVABLE')).toBe(true);
  });
});

describe('climaNombreFor', () => {
  it('para un personaje orco, usa el nombre Kektira', () => {
    expect(climaNombreFor('TORMENTA_GRANDE', 'orcos')).toBe('Rokthar');
    expect(climaNombreFor('TORMENTA_EXTREMA', 'orcos')).toBe("Rok'ithek");
  });

  it('para cualquier otra raza o raza desconocida, usa la glosa en lengua común', () => {
    expect(climaNombreFor('VIENTO_FUERTE', 'goirntes')).toBe('el viento cortante');
    expect(climaNombreFor('CLIMA_LLEVABLE', null)).toBe('el respiro');
  });
});

describe('entornoTemporalFor', () => {
  it('devuelve estación con nombre (glosa común) y clima null fuera de Las Llanuras', () => {
    const result = entornoTemporalFor(0, 'Meseta del Orden', 'goirntes');
    expect(result).toEqual({ estacion: { key: 'PRIMAVERA', nombre: 'la estación de las crecidas' }, clima: null });
  });

  it('en Las Llanuras, devuelve también el clima con nombre', () => {
    // Día 2 (diaDelAno=1) → posicionCiclo=1 → VIENTO_FUERTE, ver describe('climaFor') de arriba.
    const result = entornoTemporalFor(1440, 'Las Llanuras del Viento Rojo', 'orcos');
    expect(result.estacion.key).toBe('PRIMAVERA');
    expect(result.clima).toEqual({ key: 'VIENTO_FUERTE', nombre: "Sek'tar" });
  });

  it('usa el nombre Kektira para un orco, la glosa común para el resto', () => {
    const orco = entornoTemporalFor(0, null, 'orcos');
    const goirntes = entornoTemporalFor(0, null, 'goirntes');
    expect(orco.estacion.nombre).toBe("Ur'gathek");
    expect(goirntes.estacion.nombre).toBe('la estación de las crecidas');
  });
});
