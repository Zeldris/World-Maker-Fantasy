import { describe, it, expect } from 'vitest';
import { reinoIntentDetected, stripLeakedJson, stripNonLatinScript, deterministicFallbackNarration } from './narrador.js';

describe('reinoIntentDetected', () => {
  it('detecta coincidencia exacta de un stem', () => {
    expect(reinoIntentDetected('Quiero reclamar este territorio para mi clan.')).toBe(true);
  });

  it('tolera una errata de distancia 2 en un stem literal (auditoría 2026-07-20, P0.4)', () => {
    expect(reinoIntentDetected('Empiezo a construri una muralla aquí.')).toBe(true);
  });

  it('no dispara con una acción sin ninguna intención de Reino', () => {
    expect(reinoIntentDetected('Miro con cuidado el horizonte.')).toBe(false);
  });

  it('no dispara con una errata demasiado lejana de cualquier stem', () => {
    expect(reinoIntentDetected('Camino tranquilo por el sendero.')).toBe(false);
  });
});

describe('stripLeakedJson', () => {
  it('bug real jugando (2026-07-23): corta el resto del JSON que se cuela dentro de "narration"', () => {
    const narration =
      'Gorhorn aprovecha el momento para lanzar su cuchillo, atravesando el amuleto de hueso y haciendo que el Orco retroceda con un jadeo de sorpresa y dolor. newItem": "Maza orca astillada", "condicionFisica": null, "combateIniciado": ["Orco enfurecido"], "hito": null, "questProgress": null';
    expect(stripLeakedJson(narration)).toBe(
      'Gorhorn aprovecha el momento para lanzar su cuchillo, atravesando el amuleto de hueso y haciendo que el Orco retroceda con un jadeo de sorpresa y dolor.',
    );
  });

  it('deja intacta una narración normal sin fuga de JSON', () => {
    const narration = 'Gorhorn avanza con cautela por la Hondonada del Eco.';
    expect(stripLeakedJson(narration)).toBe(narration);
  });
});

describe('stripNonLatinScript', () => {
  it('bug real jugando (2026-07-24): corta la narración en cuanto el modelo "cambia de idioma"', () => {
    const narration =
      'Gorhorn grita su desafío. 他挥舞着手中的破旧战斧，警觉地望向四周. Con la respiración entrecortada, se presenta.';
    expect(stripNonLatinScript(narration)).toBe('Gorhorn grita su desafío.');
  });

  it('deja intacta una narración normal en español (con acentos/ñ) sin ningún alfabeto no latino', () => {
    const narration = 'El niño camina años después, mañana será mejor — ¿qué hará Gorhorn?';
    expect(stripNonLatinScript(narration)).toBe(narration);
  });
});

describe('deterministicFallbackNarration', () => {
  it('nunca decide condicionFisica/combateIniciado — deja esas redes de seguridad a turnResolution.ts', () => {
    const result = deterministicFallbackNarration({ action: 'Ataco al orco' });
    expect(result.condicionFisica).toBeNull();
    expect(result.combateIniciado).toBeNull();
    expect(result.newFacts).toEqual([]);
  });

  it('narra distinto según el grado de éxito de la tirada ya resuelta', () => {
    const claro = deterministicFallbackNarration({
      action: 'Ataco',
      roll: { attribute: 'fuerza', value: 18, roll: 15, result: 24, difficulty: 12, success: true, gradoExito: 'claro' },
    });
    const fallo = deterministicFallbackNarration({
      action: 'Ataco',
      roll: { attribute: 'fuerza', value: 18, roll: 2, result: 11, difficulty: 12, success: false, gradoExito: 'fallo' },
    });
    expect(claro.narration).not.toBe(fallo.narration);
  });

  it('sin tirada, narra igualmente sin romper', () => {
    expect(deterministicFallbackNarration({ action: 'Miro el paisaje' }).narration.length).toBeGreaterThan(0);
  });
});
