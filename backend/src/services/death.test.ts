import { describe, it, expect } from 'vitest';
import {
  limiteMuertes,
  resolveDeathOutcome,
  whisperText,
  nextCondicionFisica,
  nextCondicionForAttack,
  isValidRestLocationKind,
  healCeilingFor,
  applySequentialHeals,
  condicionMalus,
  npcRecoversFromConvaleciente,
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
    expect(nextCondicionFisica('CONVALECIENTE', 'ILESO', false, 'ILESO')).toBe('ILESO');
  });
  it('en combate empeora, pero tope de un escalón por turno', () => {
    expect(nextCondicionFisica('ILESO', 'HERIDO', true, 'ILESO')).toBe('HERIDO');
    expect(nextCondicionFisica('ILESO', 'MUERTO', true, 'ILESO')).toBe('HERIDO'); // nunca dos escalones de golpe
  });
  it('en combate, desde CONVALECIENTE sí puede llegar a MUERTO (un solo escalón)', () => {
    expect(nextCondicionFisica('CONVALECIENTE', 'MUERTO', true, 'CONVALECIENTE')).toBe('MUERTO');
  });
  it('sin propuesta del modelo y sin causa real de mejora (healCeiling = current), se queda igual', () => {
    expect(nextCondicionFisica('HERIDO', null, true, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('HERIDO', undefined, true, 'HERIDO')).toBe('HERIDO');
  });

  it('bug real jugando en vivo (2026-07-31, "descansar no curó nada"): sin propuesta del modelo, un descanso/objeto médico válido (healCeiling mejor que current) SÍ cura igual', () => {
    expect(nextCondicionFisica('GRAVE', null, false, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('GRAVE', undefined, false, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('CONVALECIENTE', null, false, 'ILESO')).toBe('ILESO'); // objeto médico fuerte
  });

  it('bug real jugando en vivo (2026-08-26, batida de pruebas: "curarme/descansar falla en silencio ~50% de las veces"): el modelo REPITE la condición actual (proposedIdx === currentIdx, ni mejora ni empeora) en vez de omitir el campo — debe curar igual que si no hubiera propuesto nada', () => {
    expect(nextCondicionFisica('GRAVE', 'GRAVE', false, 'HERIDO')).toBe('HERIDO');
    expect(nextCondicionFisica('CONVALECIENTE', 'CONVALECIENTE', false, 'ILESO')).toBe('ILESO');
    // Sin causa real (healCeiling = current), repetir la condición sigue sin curar nada — coherente
    // con el caso ya cubierto arriba de "una mejora propuesta sin más NO se acepta".
    expect(nextCondicionFisica('GRAVE', 'GRAVE', false, 'GRAVE')).toBe('GRAVE');
  });

  it('una mejora GENUINA propuesta por el modelo sigue topándose en el techo mecánico real, nunca curando de más (distinto del caso de repetir la condición actual)', () => {
    // El modelo narra una curación completa a ILESO, pero el descanso solo alcanza HERIDO — el
    // techo real manda, igual que antes del fix de arriba.
    expect(nextCondicionFisica('GRAVE', 'ILESO', false, 'HERIDO')).toBe('HERIDO');
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
    expect(healCeilingFor('CONVALECIENTE', true, false, null)).toBe('GRAVE');
    expect(healCeilingFor('GRAVE', true, false, null)).toBe('GRAVE');
  });
  it('un vivac sin refugio válido no hace nada si ya se está mejor que GRAVE (nunca empeora)', () => {
    expect(healCeilingFor('HERIDO', true, false, null)).toBe('HERIDO');
    expect(healCeilingFor('ILESO', true, false, null)).toBe('ILESO');
  });
  it('descansar en un refugio válido NO llega a HERIDO desde CONVALECIENTE — hace falta objeto médico para eso, pero SÍ mejora a GRAVE (antes no hacía nada en absoluto)', () => {
    expect(healCeilingFor('CONVALECIENTE', true, true, null)).toBe('GRAVE');
  });
  it('un objeto médico manda por encima de todo, incluso desde CONVALECIENTE', () => {
    expect(healCeilingFor('CONVALECIENTE', false, false, 'HERIDO')).toBe('HERIDO');
    expect(healCeilingFor('CONVALECIENTE', false, false, 'ILESO')).toBe('ILESO');
    expect(healCeilingFor('GRAVE', true, true, 'ILESO')).toBe('ILESO');
  });
  it('el techo nunca es PEOR que la condición actual (bug real, auditoría 2026-07-30: un ILESO descansando con éxito se veía "curado" hasta HERIDO)', () => {
    expect(healCeilingFor('ILESO', true, true, null)).toBe('ILESO');
    // objeto médico débil (tope HERIDO) usado por alguien ya ILESO — tampoco debe empeorarlo.
    expect(healCeilingFor('ILESO', false, false, 'HERIDO')).toBe('ILESO');
  });

  // Primeros auxilios (2026-08-13, petición explícita: "si es convaleciente solo hay un item que te
  // lleva a grave... luego otro que mejora el estado al siguiente, de grave a herido y de herido a
  // ileso" — cada objeto sube COMO MUCHO un escalón, nunca de golpe hasta su curaHasta).
  describe('curaUnPaso (objetos de primeros auxilios, un escalón como mucho)', () => {
    it('objeto tier 1 (tope GRAVE) usado desde CONVALECIENTE sube exactamente a GRAVE', () => {
      expect(healCeilingFor('CONVALECIENTE', false, false, 'GRAVE', true)).toBe('GRAVE');
    });
    it('objeto tier 1 (tope GRAVE) usado desde GRAVE no hace nada más — es su propio techo', () => {
      expect(healCeilingFor('GRAVE', false, false, 'GRAVE', true)).toBe('GRAVE');
    });
    it('objeto tier 1 (tope GRAVE) usado desde HERIDO/ILESO no hace nada — ya se está mejor que su techo', () => {
      expect(healCeilingFor('HERIDO', false, false, 'GRAVE', true)).toBe('HERIDO');
      expect(healCeilingFor('ILESO', false, false, 'GRAVE', true)).toBe('ILESO');
    });
    it('objeto tier 2 (tope HERIDO) usado desde GRAVE sube exactamente a HERIDO', () => {
      expect(healCeilingFor('GRAVE', false, false, 'HERIDO', true)).toBe('HERIDO');
    });
    // El caso clave que distingue esto del objeto "de techo" normal: usado desde MÁS de un
    // escalón por debajo de su tope, solo sube UNO — nunca salta directo a su curaHasta.
    it('objeto tier 2 (tope HERIDO) usado desde CONVALECIENTE solo sube UN escalón, a GRAVE — no salta a HERIDO', () => {
      expect(healCeilingFor('CONVALECIENTE', false, false, 'HERIDO', true)).toBe('GRAVE');
    });
    it('objeto tier 3 (tope ILESO, la receta final) usado desde HERIDO sube exactamente a ILESO', () => {
      expect(healCeilingFor('HERIDO', false, false, 'ILESO', true)).toBe('ILESO');
    });
    it('objeto tier 3 (tope ILESO) usado desde CONVALECIENTE solo sube UN escalón, a GRAVE — no salta a ILESO', () => {
      expect(healCeilingFor('CONVALECIENTE', false, false, 'ILESO', true)).toBe('GRAVE');
    });
    it('el mismo objeto con curaUnPaso false (comportamiento normal) sí rompe el tope de golpe, para contraste', () => {
      expect(healCeilingFor('CONVALECIENTE', false, false, 'ILESO', false)).toBe('ILESO');
    });
  });
});

// Panel "Curar" con varios objetos/usos a la vez (petición explícita, 2026-08-18).
describe('applySequentialHeals', () => {
  it('sin usos, se queda igual', () => {
    expect(applySequentialHeals('CONVALECIENTE', [])).toBe('CONVALECIENTE');
  });

  it('un único uso da el mismo resultado que llamar a healCeilingFor directamente', () => {
    expect(applySequentialHeals('CONVALECIENTE', [{ curaHasta: 'ILESO', curaUnPaso: true }])).toBe(
      healCeilingFor('CONVALECIENTE', false, false, 'ILESO', true),
    );
  });

  it('dos usos del mismo objeto curaUnPaso encadenan un escalón cada uno: CONVALECIENTE → GRAVE → HERIDO', () => {
    const uso = { curaHasta: 'ILESO' as const, curaUnPaso: true };
    expect(applySequentialHeals('CONVALECIENTE', [uso, uso])).toBe('HERIDO');
  });

  it('tres usos seguidos del mismo objeto llegan hasta ILESO, nunca más allá', () => {
    const uso = { curaHasta: 'ILESO' as const, curaUnPaso: true };
    expect(applySequentialHeals('CONVALECIENTE', [uso, uso, uso])).toBe('ILESO');
    expect(applySequentialHeals('CONVALECIENTE', [uso, uso, uso, uso])).toBe('ILESO'); // un 4º uso no empeora ni rompe nada
  });

  it('EL ORDEN IMPORTA: objeto débil (tope GRAVE) primero y fuerte (tope ILESO) después llega más lejos que al revés', () => {
    const debil = { curaHasta: 'GRAVE' as const, curaUnPaso: true };
    const fuerte = { curaHasta: 'ILESO' as const, curaUnPaso: true };
    expect(applySequentialHeals('CONVALECIENTE', [debil, fuerte])).toBe('HERIDO');
    expect(applySequentialHeals('CONVALECIENTE', [fuerte, debil])).toBe('GRAVE');
  });

  it('mezcla de curaUnPaso y objeto normal (rompe el tope de golpe) en la misma lista', () => {
    const unPaso = { curaHasta: 'GRAVE' as const, curaUnPaso: true };
    const normal = { curaHasta: 'ILESO' as const, curaUnPaso: false };
    expect(applySequentialHeals('CONVALECIENTE', [unPaso, normal])).toBe('ILESO');
  });
});

describe('condicionMalus', () => {
  it('ILESO sin malus, HERIDO/GRAVE con malus creciente', () => {
    expect(condicionMalus('ILESO')).toBe(0);
    expect(condicionMalus('HERIDO')).toBeGreaterThan(0);
    expect(condicionMalus('GRAVE')).toBeGreaterThan(condicionMalus('HERIDO'));
  });

  it('bug real jugando en vivo (2026-07-31, "he ganado estando yo convaleciente"): CONVALECIENTE tiene malus real, mayor que GRAVE — antes era 0, igual que ILESO, y el jugador seguía peleando como si nada', () => {
    expect(condicionMalus('CONVALECIENTE')).toBeGreaterThan(condicionMalus('GRAVE'));
  });
});

describe('nextCondicionForAttack', () => {
  it('ATAQUE normal (o sin efectos) siempre empeora un solo escalón', () => {
    expect(nextCondicionForAttack(['ATAQUE'], 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack([], 'HERIDO')).toBe('GRAVE');
    expect(nextCondicionForAttack([], 'GRAVE')).toBe('CONVALECIENTE');
  });

  // LETAL sustituye a REMATE (2026-08-15, confirmado explícitamente): ya no exige que el rival
  // esté GRAVE/CONVALECIENTE — mata de un golpe a cualquiera, sin condición previa.
  it('LETAL mata directo sin importar la condición actual del rival, ni siquiera ILESO', () => {
    expect(nextCondicionForAttack(['LETAL'], 'ILESO')).toBe('MUERTO');
    expect(nextCondicionForAttack(['LETAL'], 'HERIDO')).toBe('MUERTO');
    expect(nextCondicionForAttack(['LETAL'], 'GRAVE')).toBe('MUERTO');
    expect(nextCondicionForAttack(['LETAL'], 'CONVALECIENTE')).toBe('MUERTO');
  });

  it('una habilidad con varios efectos a la vez, si incluye LETAL, mata igual', () => {
    expect(nextCondicionForAttack(['ATAQUE', 'LETAL', 'LIMITADA'], 'ILESO')).toBe('MUERTO');
  });

  it('otros efectos (ATURDIMIENTO/INTIMIDACION/AGUANTE) no cambian el escalonado normal', () => {
    expect(nextCondicionForAttack(['ATURDIMIENTO'], 'ILESO')).toBe('HERIDO');
    expect(nextCondicionForAttack(['INTIMIDACION'], 'HERIDO')).toBe('GRAVE');
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

describe('npcRecoversFromConvaleciente', () => {
  it('no se recupera antes de las 6h', () => {
    expect(npcRecoversFromConvaleciente(0, 6 * 60 - 1)).toBe(false);
  });
  it('se recupera justo a las 6h o más', () => {
    expect(npcRecoversFromConvaleciente(0, 6 * 60)).toBe(true);
    expect(npcRecoversFromConvaleciente(100, 100 + 6 * 60)).toBe(true);
  });
  it('sin marca de tiempo previa (null), no dispara', () => {
    expect(npcRecoversFromConvaleciente(null, 999_999)).toBe(false);
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
