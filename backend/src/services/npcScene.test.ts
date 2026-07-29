import { describe, it, expect } from 'vitest';
import { matchNpcAliases, contraataqueDifficultyFor, tabulatedAttackAttribute, detectsAttackIntent, detectsHostileSearchIntent, detectsVerbalAcceptanceIntent, scopeFor, pickAmbientEncounterCandidate } from './npcScene.js';

const NPCS = [
  { id: 'rezagado', aliases: ['guerrero orco rezagado', 'rezagado', 'orco rezagado', 'un rezagado'] },
  { id: 'torgash', aliases: ['torgash', "kort'ikar torgash", 'el jefe de guerra serhu'] },
  { id: 'ulkha', aliases: ['ulkha', "terk'ikar ulkha", 'jefa del clan serhu'] },
];

describe('matchNpcAliases', () => {
  it('coincide con el alias exacto', () => {
    expect(matchNpcAliases('Ataco al orco rezagado', NPCS)).toEqual(['rezagado']);
  });

  it('bug real jugando (2026-07-19): tolera la errata "redazagado" por "rezagado"', () => {
    expect(matchNpcAliases('Atacar a un orco redazagado', NPCS)).toEqual(['rezagado']);
  });

  it('no da falso positivo con una palabra corta y común', () => {
    // "un" (2 letras) no debe disparar nada por sí solo, aunque "un rezagado" sea un alias.
    expect(matchNpcAliases('Camino un rato por la llanura', NPCS)).toEqual([]);
  });

  it('no confunde NPCs distintos entre sí', () => {
    expect(matchNpcAliases('Hablo con Torgash', NPCS)).toEqual(['torgash']);
  });

  it('bug real encontrado auditando la partida de Gorhorn (2026-07-23): una palabra genérica compartida (nombre de clan) dentro de un alias multi-palabra no debe disparar falsos positivos', () => {
    // Otro personaje (no Torgash ni Ulkha) se presenta como "del Clan Serhu" — eso NO debe bastar
    // para detectar a Torgash/Ulkha "en escena" solo porque sus alias también mencionan "serhu"
    // en medio de una frase más larga ("el jefe de guerra serhu", "jefa del clan serhu").
    expect(matchNpcAliases('Gistera Koh, una orca del Clan Serhu, ha aparecido ante Gorhorn', NPCS)).toEqual([]);
  });
});

describe('contraataqueDifficultyFor', () => {
  it('resta la defensa sin bajar del suelo de 8', () => {
    expect(contraataqueDifficultyFor(2, 5, 0)).toBe(8);
    expect(contraataqueDifficultyFor(2, 5, 5)).toBe(8);
  });
});

describe('tabulatedAttackAttribute', () => {
  it('usa fuerza por defecto', () => {
    expect(tabulatedAttackAttribute('Ataco con mi hacha')).toBe('fuerza');
  });
  it('usa sigilo si se menciona una emboscada', () => {
    expect(tabulatedAttackAttribute('Ataco por la espalda con sigilo')).toBe('sigilo');
  });
});

describe('scopeFor', () => {
  it('PRINCIPAL siempre usa el ámbito global, sin importar la ubicación', () => {
    expect(scopeFor('PRINCIPAL', 'loc-llanuras')).toBe('');
    expect(scopeFor('PRINCIPAL', null)).toBe('');
  });

  it('PLANTILLA usa la ubicación actual como ámbito (bug real 2026-07-20: antes una plantilla derrotada en un sitio quedaba derrotada para siempre en toda la partida)', () => {
    expect(scopeFor('PLANTILLA', 'loc-llanuras')).toBe('loc-llanuras');
    expect(scopeFor('PLANTILLA', 'loc-cienaga')).toBe('loc-cienaga');
  });

  it('PLANTILLA sin ubicación resuelta cae en "itinerante"', () => {
    expect(scopeFor('PLANTILLA', null)).toBe('itinerante');
  });
});

describe('detectsAttackIntent', () => {
  it('detecta verbos de ataque directo', () => {
    expect(detectsAttackIntent('Cargo contra mi enemigo')).toBe(true);
    expect(detectsAttackIntent('Miro el paisaje')).toBe(false);
  });

  it('tolera una errata de distancia 2 en un stem literal (auditoría 2026-07-20, P0.4)', () => {
    expect(detectsAttackIntent('Le doy un hachaso brutal con mi arma')).toBe(true)
    expect(detectsAttackIntent('Me arremte contra el enemigo sin dudar')).toBe(true)
  });

  it('no dispara si el verbo va negado cerca (auditoría 2026-07-24)', () => {
    expect(detectsAttackIntent('Decido no atacar todavía')).toBe(false)
    expect(detectsAttackIntent('Prefiero no golpear primero')).toBe(false)
    expect(detectsAttackIntent('Cargo contra mi enemigo')).toBe(true)
  });
});

describe('detectsHostileSearchIntent', () => {
  it('detecta intención hostil declarada sin verbo de ataque literal', () => {
    expect(detectsHostileSearchIntent("Busco combatir contra el Orco Enfurecido")).toBe(true)
    expect(detectsHostileSearchIntent("Entro en combate con 'Orco enfurecido'")).toBe(true)
    expect(detectsHostileSearchIntent('Miro el paisaje')).toBe(false)
  });

  it('bug real jugando en vivo (2026-07-24): "acabaré con" en futuro también cuenta, no solo el infinitivo', () => {
    expect(detectsHostileSearchIntent('Cuenta conmigo. Acabaré con el que te persigue.')).toBe(true)
    expect(detectsHostileSearchIntent('Acabar con el Orco Enfurecido es mi objetivo')).toBe(true)
  });

  it('bug real jugando en vivo (2026-07-28, "revisar partida"): "acabar con" seguido de posesivo también cuenta, no solo el listado de artículos', () => {
    expect(detectsHostileSearchIntent('Yo me encargare de acabar con tu perseguidor')).toBe(true)
    expect(detectsHostileSearchIntent('Acabaré con mi rival de una vez')).toBe(true)
  });

  it('no dispara si la intención hostil va negada cerca (auditoría 2026-07-24, "revisa todo bien bien")', () => {
    expect(detectsHostileSearchIntent('Decido no luchar por esto')).toBe(false)
    expect(detectsHostileSearchIntent('Prefiero no pelear ahora mismo')).toBe(false)
    expect(detectsHostileSearchIntent('Busco combatir contra el Orco Enfurecido')).toBe(true)
  });
});

describe('detectsVerbalAcceptanceIntent', () => {
  it('bug real jugando en vivo (2026-07-24): aceptar ayudar a Gistera Koh no debe leerse como ataque', () => {
    expect(detectsVerbalAcceptanceIntent('Cuenta conmigo. Acabaré con el que te persigue.')).toBe(true)
    expect(detectsVerbalAcceptanceIntent('De acuerdo, no te preocupes')).toBe(true)
  });

  it('no dispara con una declaración de intención hostil inmediata real', () => {
    expect(detectsVerbalAcceptanceIntent('Ataco al Orco Enfurecido')).toBe(false)
    expect(detectsVerbalAcceptanceIntent('Busco combatir contra el Orco Enfurecido')).toBe(false)
  });
});

describe('pickAmbientEncounterCandidate', () => {
  it('devuelve null sin candidatos', () => {
    expect(pickAmbientEncounterCandidate([])).toBeNull();
  });

  it('elige el candidato en el índice que dicte la función de aleatoriedad inyectada', () => {
    const candidates = [
      { slug: 'orco-rezagado', name: 'Guerrero orco rezagado', role: 'Guerrero sin clan' },
      { slug: 'mercader-de-paso', name: 'Mercader de paso', role: 'Comerciante itinerante' },
    ];
    expect(pickAmbientEncounterCandidate(candidates, () => 0)).toEqual(candidates[0]);
    expect(pickAmbientEncounterCandidate(candidates, () => 0.99)).toEqual(candidates[1]);
  });
});
