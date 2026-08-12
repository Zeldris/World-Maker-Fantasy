import { describe, it, expect } from 'vitest';
import {
  limiteMuertes,
  resolveDeathOutcome,
  whisperText,
  nextCondicionFisica,
  nextCondicionForAttack,
  isValidRestLocationKind,
  healCeilingFor,
  condicionMalus,
  npcRecoversFromIncapacitado,
  npcCorpseShouldDespawn,
} from './death.js';

describe('limiteMuertes', () => {
  it('NOVATO no tiene límite', () => {
    expect(limiteMuertes('NOVATO')).toBe(Infinity);
  });
  it('MEDIO = 4, AVANZADO = 2', () => {
    expect(limiteMuertes('MEDIO')).toBe(4);
    expect(limiteMuertes('AVANZADO')).toBe(2);
  });
});

describe('resolveDeathOutcome', () => {
  it('AVANZADO: 1ª muerte avisa y no acaba, 2ª es fin de partida', () => {
    expect(resolveDeathOutcome('AVANZADO', 0)).toEqual({ deathCount: 1, finDePartida: false, avisoUltimaVez: true });
    expect(resolveDeathOutcome('AVANZADO', 1)).toEqual({ deathCount: 2, finDePartida: true, avisoUltimaVez: false });
  });

  it('MEDIO: solo la 3ª (límite-1) avisa, la 4ª acaba la partida', () => {
    expect(resolveDeathOutcome('MEDIO', 0).avisoUltimaVez).toBe(false);
    expect(resolveDeathOutcome('MEDIO', 2)).toEqual({ deathCount: 3, finDePartida: false, avisoUltimaVez: true });
    expect(resolveDeathOutcome('MEDIO', 3)).toEqual({ deathCount: 4, finDePartida: true, avisoUltimaVez: false });
  });

  it('NOVATO nunca dispara fin de partida por muchas muertes que haya', () => {
    const result = resolveDeathOutcome('NOVATO', 50);
    expect(result.finDePartida).toBe(false);
    expect(result.deathCount).toBe(51);
  });
});

describe('whisperText', () => {
  it('incluye el nombre del personaje y el lugar de reaparición', () => {
    const text = whisperText('Gorhorn', 'La Hondonada del Eco', false);
    expect(text).toContain('Gorhorn');
    expect(text).toContain('La Hondonada del Eco');
    expect(text).not.toContain('no habrá una próxima vez');
  });
  it('añade el aviso de última oportunidad cuando corresponde', () => {
    const text = whisperText('Gorhorn', 'La Hondonada del Eco', true);
    expect(text).toContain('no habrá una próxima vez');
  });
});

describe('nextCondicionFisica', () => {
  it('fuera de combate nunca empeora, aunque el modelo lo proponga', () => {
    expect(nextCondicionFisica('ILESO', 'HERIDO', false, 'ILESO')).toBe('ILESO');
  });
  it('sin causa real (healCeiling = current), una mejora propuesta sin más NO se acepta (2026-07-29)', () => {
    expect(nextCondicionFisica('GRAVE', 'ILESO', false, 'GRAVE')).toBe('GRAVE');
  });
  it('con descanso válido (healCeiling = HERIDO), la mejora se topa en HERIDO aunque el modelo proponga ILESO', () => {
    expect(nextCondicionFisica('GRAVE', 'ILESO', false, 'HERIDO')).toBe('HERIDO');
  });
  it('con objeto médico (healCeiling = el curaHasta del objeto), la mejora puede llegar a ILESO', () => {
    expect(nextCondicionFisica('INCAPACITADO', 'ILESO', false, 'ILESO')).toBe('ILESO');
  });
  it('en combate empeora, pero tope de un escalón por turno', () => {
    expect(nextCondicionFisica('ILESO', 'HERIDO', true, 'ILESO')).toBe('HERIDO');
    expect(nextCondicionFisica('ILESO', 'MUERTO', true, 'ILESO')).toBe('HERIDO'); // nunca dos escalones de golpe
  });
  it('en combate, desde INCAPACITADO sí puede llegar a MUERTO (un solo escalón)', () => {
    expect(nextCondicionFisica('INCAPACITADO', 'MUERTO', true, 'INCAPACITADO')).toBe('MUERTO');
  });
  it('sin propuesta del modelo y sin causa real de mejora (healCeiling = current), se queda igual', () => {
    expect(nextCondicionFisica('HERIDO', null, true, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('HERIDO', undefined, true, 'HERIDO')).toBe('HERIDO');
  });

  it('bug real jugando en vivo (2026-07-31, "descansar no curó nada"): sin propuesta del modelo, un descanso/objeto médico válido (healCeiling mejor que current) SÍ cura igual', () => {
    expect(nextCondicionFisica('GRAVE', null, false, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('GRAVE', undefined, false, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('INCAPACITADO', null, false, 'ILESO')).toBe('ILESO'); // objeto médico fuerte
  });
});

describe('healCeilingFor', () => {
  it('sin descanso ni objeto médico, el techo es la condición actual (ninguna mejora posible)', () => {
    expect(healCeilingFor('GRAVE', false, false, null)).toBe('GRAVE');
  });
  it('descansar en un refugio/asentamiento real topa en HERIDO', () => {
    expect(healCeilingFor('GRAVE', true, true, null)).toBe('HERIDO');
    expect(healCeilingFor('HERIDO', true, true, null)).toBe('HERIDO');
  });
  // Auditoría 2026-08-11 ("Descansar promete curar en cualquier sitio, pero la mecánica solo
  // curaba en refugio/asentamiento" — aclarado con la usuaria: sí cura en cualquier sitio, pero
  // tope GRAVE; solo un refugio/asentamiento real llega a HERIDO).
  it('descansar en CUALQUIER sitio (sin refugio válido) topa en GRAVE, no en HERIDO', () => {
    expect(healCeilingFor('INCAPACITADO', true, false, null)).toBe('GRAVE');
    expect(healCeilingFor('GRAVE', true, false, null)).toBe('GRAVE');
  });
  it('un vivac sin refugio válido no hace nada si ya se está mejor que GRAVE (nunca empeora)', () => {
    expect(healCeilingFor('HERIDO', true, false, null)).toBe('HERIDO');
    expect(healCeilingFor('ILESO', true, false, null)).toBe('ILESO');
  });
  it('descansar en un refugio válido NO llega a HERIDO desde INCAPACITADO — hace falta objeto médico para eso, pero SÍ mejora a GRAVE (antes no hacía nada en absoluto)', () => {
    expect(healCeilingFor('INCAPACITADO', true, true, null)).toBe('GRAVE');
  });
  it('un objeto médico manda por encima de todo, incluso desde INCAPACITADO', () => {
    expect(healCeilingFor('INCAPACITADO', false, false, 'HERIDO')).toBe('HERIDO');
    expect(healCeilingFor('INCAPACITADO', false, false, 'ILESO')).toBe('ILESO');
    expect(healCeilingFor('GRAVE', true, true, 'ILESO')).toBe('ILESO');
  });
  it('el techo nunca es PEOR que la condición actual (bug real, auditoría 2026-07-30: un ILESO descansando con éxito se veía "curado" hasta HERIDO)', () => {
    expect(healCeilingFor('ILESO', true, true, null)).toBe('ILESO');
    // objeto médico débil (tope HERIDO) usado por alguien ya ILESO — tampoco debe empeorarlo.
    expect(healCeilingFor('ILESO', false, false, 'HERIDO')).toBe('ILESO');
  });
});

describe('condicionMalus', () => {
  it('ILESO sin malus, HERIDO/GRAVE con malus creciente', () => {
    expect(condicionMalus('ILESO')).toBe(0);
    expect(condicionMalus('HERIDO')).toBeGreaterThan(0);
    expect(condicionMalus('GRAVE')).toBeGreaterThan(condicionMalus('HERIDO'));
  });

  it('bug real jugando en vivo (2026-07-31, "he ganado estando yo incapacitado"): INCAPACITADO tiene malus real, mayor que GRAVE — antes era 0, igual que ILESO, y el jugador seguía peleando como si nada', () => {
    expect(condicionMalus('INCAPACITADO')).toBeGreaterThan(condicionMalus('GRAVE'));
  });
});

describe('nextCondicionForAttack', () => {
  it('ATAQUE normal (o sin effect) siempre empeora un solo escalón', () => {
    expect(nextCondicionForAttack('ATAQUE', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack(null, 'HERIDO')).toBe('GRAVE');
    expect(nextCondicionForAttack(undefined, 'GRAVE')).toBe('INCAPACITADO');
  });

  it('REMATE contra un NPC sano (ILESO/HERIDO) se comporta como ATAQUE normal', () => {
    expect(nextCondicionForAttack('REMATE', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack('REMATE', 'HERIDO')).toBe('GRAVE');
  });

  it('REMATE contra un NPC ya GRAVE o INCAPACITADO remata directamente a MUERTO', () => {
    expect(nextCondicionForAttack('REMATE', 'GRAVE')).toBe('MUERTO');
    expect(nextCondicionForAttack('REMATE', 'INCAPACITADO')).toBe('MUERTO');
  });

  it('otros efectos (ATURDIMIENTO/INTIMIDACION/AGUANTE) no cambian el escalonado normal', () => {
    expect(nextCondicionForAttack('ATURDIMIENTO', 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack('INTIMIDACION', 'HERIDO')).toBe('GRAVE');
  });
});

describe('isValidRestLocationKind', () => {
  it('refugio y asentamiento son válidos', () => {
    expect(isValidRestLocationKind('refugio')).toBe(true);
    expect(isValidRestLocationKind('asentamiento')).toBe(true);
  });
  it('hito y cruce no son válidos', () => {
    expect(isValidRestLocationKind('hito')).toBe(false);
    expect(isValidRestLocationKind('cruce')).toBe(false);
  });
});

describe('npcRecoversFromIncapacitado', () => {
  it('no se recupera antes de las 6h', () => {
    expect(npcRecoversFromIncapacitado(0, 6 * 60 - 1)).toBe(false);
  });
  it('se recupera justo a las 6h o más', () => {
    expect(npcRecoversFromIncapacitado(0, 6 * 60)).toBe(true);
    expect(npcRecoversFromIncapacitado(100, 100 + 6 * 60)).toBe(true);
  });
  it('sin marca de tiempo previa (null), no dispara', () => {
    expect(npcRecoversFromIncapacitado(null, 999_999)).toBe(false);
  });
});

describe('npcCorpseShouldDespawn', () => {
  it('no desaparece antes de las 48h', () => {
    expect(npcCorpseShouldDespawn(0, 48 * 60 - 1)).toBe(false);
  });
  it('desaparece justo a las 48h o más', () => {
    expect(npcCorpseShouldDespawn(0, 48 * 60)).toBe(true);
  });
  it('sin marca de tiempo previa (null), no dispara', () => {
    expect(npcCorpseShouldDespawn(null, 999_999)).toBe(false);
  });
});
