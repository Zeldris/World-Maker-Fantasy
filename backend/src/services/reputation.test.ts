import { describe, it, expect } from 'vitest';
import { FACTION_REP_MAX, FACTION_REP_MIN, applyFactionRepDelta, effectiveTemperamento, factionRepFor, resolveFoundingOutcome, esRegionDisputable, regionesDisputables, REGION_OWNING_FACTIONS } from './reputation.js';
import { continentForRegion } from '../lib/continent.js';
import { locations } from '../scripts/worldCatalog.js';

describe('factionRepFor', () => {
  it('devuelve el default neutro (2500) si la facción no tiene fila todavía', () => {
    expect(factionRepFor({}, 'Clan Serhu')).toBe(2500);
  });

  it('devuelve el valor guardado si ya existe', () => {
    expect(factionRepFor({ 'Clan Serhu': 4000 }, 'Clan Serhu')).toBe(4000);
  });
});

describe('applyFactionRepDelta', () => {
  it('acota por arriba en 5000', () => {
    const result = applyFactionRepDelta({ 'Clan Serhu': 4990 }, 'Clan Serhu', 30);
    expect(result['Clan Serhu']).toBe(FACTION_REP_MAX);
  });

  it('acota por abajo en 0', () => {
    const result = applyFactionRepDelta({ 'Clan Serhu': 100 }, 'Clan Serhu', -150);
    expect(result['Clan Serhu']).toBe(FACTION_REP_MIN);
  });

  it('parte del default neutro si la facción no tiene fila todavía', () => {
    const result = applyFactionRepDelta({}, 'Concordia de Hierro', -150);
    expect(result['Concordia de Hierro']).toBe(2350);
  });

  it('no muta el objeto original', () => {
    const original = { 'Clan Serhu': 2500 };
    applyFactionRepDelta(original, 'Clan Serhu', -150);
    expect(original['Clan Serhu']).toBe(2500);
  });
});

describe('effectiveTemperamento', () => {
  it('sin facción (fauna/independientes), devuelve el de catálogo sin tocar', () => {
    expect(effectiveTemperamento('CAUTELOSO', null, { 'Clan Serhu': 0 })).toBe('CAUTELOSO');
  });

  it('reputación neutra (2500, sin fila) no desplaza nada', () => {
    expect(effectiveTemperamento('INOFENSIVO', 'Clan Serhu', {})).toBe('INOFENSIVO');
  });

  it('reputación pésima (banda 0) empuja +2 escalones hacia ENEMIGO', () => {
    expect(effectiveTemperamento('INOFENSIVO', 'Clan Serhu', { 'Clan Serhu': 0 })).toBe('AGRESIVO');
    expect(effectiveTemperamento('CAUTELOSO', 'Clan Serhu', { 'Clan Serhu': 999 })).toBe('ENEMIGO');
  });

  it('reputación excelente (banda 4) empuja -2 escalones hacia AMIGABLE', () => {
    expect(effectiveTemperamento('AGRESIVO', 'Clan Serhu', { 'Clan Serhu': 5000 })).toBe('INOFENSIVO');
    expect(effectiveTemperamento('CAUTELOSO', 'Clan Serhu', { 'Clan Serhu': 4000 })).toBe('AMIGABLE');
  });

  it('nunca se sale de los extremos AMIGABLE/ENEMIGO por mucho que empuje la reputación', () => {
    expect(effectiveTemperamento('AMIGABLE', 'Clan Serhu', { 'Clan Serhu': 0 })).toBe('CAUTELOSO');
    expect(effectiveTemperamento('ENEMIGO', 'Clan Serhu', { 'Clan Serhu': 5000 })).toBe('CAUTELOSO');
  });
});

describe('resolveFoundingOutcome', () => {
  // Ciénaga Troncal ganó dueña (Clan Goshg) el 2026-08-15, y El Margen Silencioso ganó dos
  // (Keseg Sael + Feg Tusha) en la tanda OpenCode 2026-09-27/28 (A-02/A-04) — las 5 regiones reales
  // de Berig tienen ya alguna facción dueña en REGION_OWNING_FACTIONS. El único caso "sin dueño"
  // real que queda es una región fuera del mapa (nombre inventado o `null`).
  it('región fuera de REGION_OWNING_FACTIONS (nombre inventado, o null): sin dueño', () => {
    expect(resolveFoundingOutcome('Una Región Que No Existe', {})).toBe('SIN_DUENO');
    expect(resolveFoundingOutcome(null, {})).toBe('SIN_DUENO');
  });

  // El Margen Silencioso tiene DOS dueñas (Keseg Sael y Feg Tusha, A-02/A-04) — CONFLICTO si la
  // reputación es hostil con cualquiera de las dos, no solo con la primera de la lista.
  it('El Margen Silencioso: dos dueñas (Keseg Sael y Feg Tusha), hostil con cualquiera basta para CONFLICTO', () => {
    expect(resolveFoundingOutcome('El Margen Silencioso', {})).toBe('CONQUISTADA');
    expect(resolveFoundingOutcome('El Margen Silencioso', { 'Keseg Sael': 500 })).toBe('CONFLICTO');
    expect(resolveFoundingOutcome('El Margen Silencioso', { 'Feg Tusha': 500 })).toBe('CONFLICTO');
  });

  // Renombrado de PACIFICA a CONQUISTADA (2026-08-15, confirmado) — mismo criterio (reputación
  // neutra o mejor con la(s) facción(es) dueña), solo cambia el nombre del resultado.
  it('región con dueña y reputación neutra o mejor (sin fila = default 2500): fundación conquistada, sin conflicto', () => {
    expect(resolveFoundingOutcome('Las Llanuras del Viento Rojo', {})).toBe('CONQUISTADA');
    expect(resolveFoundingOutcome('Las Llanuras del Viento Rojo', { 'Clan Serhu': 4000 })).toBe('CONQUISTADA');
  });

  it('Ciénaga Troncal ahora tiene dueña (Clan Goshg) — ya no sale SIN_DUENO', () => {
    expect(resolveFoundingOutcome('Ciénaga Troncal', {})).toBe('CONQUISTADA');
    expect(resolveFoundingOutcome('Ciénaga Troncal', { 'Clan Goshg': 1000 })).toBe('CONFLICTO');
  });

  it('región con dueña y reputación por debajo del neutro: conflicto', () => {
    expect(resolveFoundingOutcome('Las Llanuras del Viento Rojo', { 'Clan Serhu': 1000 })).toBe('CONFLICTO');
  });

  it('región desconocida (typo/región nueva sin seedear): tratada como sin dueño, no revienta', () => {
    expect(resolveFoundingOutcome('Región inventada', {})).toBe('SIN_DUENO');
  });
});

describe('D-12 restringida a Berig (P-4, decisión de Álvaro, 2026-09-29)', () => {
  it('las regiones sin dueño de Vaelira nunca son disputables', () => {
    for (const r of ['La Cicatriz de Cristal', 'El Susurro de las Raíces', 'La Costa del Azabache']) {
      expect(esRegionDisputable(r), r).toBe(false);
    }
  });

  it('una región sin dueño de Berig sí lo es; con dueño, no; null o desconocida, no', () => {
    // Ninguna región real de Berig queda hoy sin dueño (A-02/A-04): se simula quitándosela a una.
    const dueños = REGION_OWNING_FACTIONS['El Margen Silencioso'];
    delete REGION_OWNING_FACTIONS['El Margen Silencioso'];
    try {
      expect(esRegionDisputable('El Margen Silencioso')).toBe(true);
    } finally {
      REGION_OWNING_FACTIONS['El Margen Silencioso'] = dueños;
    }
    expect(esRegionDisputable('El Margen Silencioso')).toBe(false);
    expect(esRegionDisputable('La Meseta del Orden')).toBe(false);
    expect(esRegionDisputable(null)).toBe(false);
    expect(esRegionDisputable('Región inventada')).toBe(false);
  });

  it('sobre las regiones reales del catálogo, todas las disputables son de Berig', () => {
    const regiones = [...new Set(locations.map((l) => l.region).filter((r): r is string => !!r))];
    const disputables = regionesDisputables(regiones);
    for (const r of disputables) expect(continentForRegion(r)).toBe('berig');
    expect(disputables.some((r) => /cicatriz|susurro|azabache/i.test(r))).toBe(false);
  });
});
