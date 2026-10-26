import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchNpcAliases, contraataqueDifficultyFor, utilityDifficultyFor, tabulatedAttackAttribute, detectsAttackIntent, detectsHostileSearchIntent, detectsVerbalAcceptanceIntent, detectsLootIntent, detectsInventoryReviewIntent, detectsFarewellIntent, detectsGreetingOrQuestion, sinNombreReal, filterFarewellFacts, scopeFor, pickAmbientEncounterCandidate, npcSceneBlockFor, buildNpcInScene, type NpcInScene, type NpcWithItems } from './npcScene.js';
import type { AttributeBlock } from './dice.js';

const NPCS = [
  { id: 'rezagado', aliases: ['guerrero orco rezagado', 'rezagado', 'orco rezagado', 'un rezagado'] },
  { id: 'torgash', aliases: ['torgash', "kort'ikar torgash", 'el jefe de guerra serhu'] },
  { id: 'ulkha', aliases: ['ulkha', "terk'ikar ulkha", 'jefa del clan serhu'] },
  { id: 'hagar', aliases: ['hagar'] },
  { id: 'murgol', aliases: ['murgol', 'múrgol', 'murgoles', 'múrgoles', 'rebano', 'rebaño'] },
  // 4 casos reales de colisión encontrados auditando la partida en vivo (2026-09-16) — ver el
  // comentario de NPC_ALIAS_FUZZY_EXCLUSIONS en npcScene.ts para el hallazgo completo.
  { id: 'brenka', aliases: ['brenka', "terk'ikar brenka"] },
  { id: 'solgra', aliases: ['solgra', "kort'ikar solgra"] },
  { id: 'gistera', aliases: ['gistera koh', 'gistera'] },
  { id: 'sella', aliases: ['sella marn', 'sella'] },
  // Alias corto sintético (auditoría 2026-08-11) — reproduce exactamente el mecanismo documentado
  // en docs/runbooks/revisar-partida.md § 3 ("res" de múrgol matcheaba dentro de "presas"/"interesante").
  // Hoy ningún alias real del catálogo es tan corto (verificado, solo 'kael'/'kegi' a 4 letras),
  // pero el detector debe protegerse igual contra el PATRÓN, no solo contra los casos ya vistos.
  { id: 'corto', aliases: ['res'] },
];

// `detectNpcsInScene` (acotar el candidato, ver comentario en npcScene.ts) necesita prisma
// mockeado — mismo patrón que inventario.test.ts/turn.test.ts: `vi.fn()` a nivel de módulo +
// `vi.mock` + import dinámico DESPUÉS del mock, para la función que sí toca la base de datos.
const findManyNpc = vi.fn();
const findUniqueLocation = vi.fn();
const findManyLocation = vi.fn();
const findManyQuest = vi.fn();
const findManyNpcState = vi.fn();
const findUniqueSave = vi.fn();
const findManyDiscovered = vi.fn(async (..._args: unknown[]) => [] as { entitySlug: string }[]);

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    npc: { findMany: (...args: unknown[]) => findManyNpc(...args) },
    location: {
      findUnique: (...args: unknown[]) => findUniqueLocation(...args),
      findMany: (...args: unknown[]) => findManyLocation(...args),
    },
    quest: { findMany: (...args: unknown[]) => findManyQuest(...args) },
    npcState: { findMany: (...args: unknown[]) => findManyNpcState(...args) },
    // Bug real de sessionFacts reintroduciendo NPCs "retirados para siempre" (2026-08-27, cerrado
    // 2026-08-28) — `detectNpcsInScene` consulta `Save.npcsRetiredForever` ahora. `[]` por defecto
    // (ningún test de este archivo prueba ese caso en concreto todavía).
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    // P327: `detectNpcsInScene` consulta qué NPC con nombre propio ya conoce la jugadora.
    discoveredEntity: { findMany: (...args: unknown[]) => findManyDiscovered(...args) },
  },
}));

const { detectNpcsInScene, candidateNpcNamesNotInScene, conNombreVisible, nombreNarrado, npcSceneLineFor, calibrationLineFor } = await import('./npcScene.js');

// Tercer barrido (2026-09-28) — alias reales con colisiones contra palabras muy frecuentes.
const NPCS_BARRIDO_2026_09_28 = [
  { id: 'nuente', aliases: ['nuente', 'nuentes'] },
  { id: 'quio', aliases: ['quio', 'quios'] },
  { id: 'rugoconcha', aliases: ['rugoconcha', 'caracol de mar'] },
  { id: 'mercader', aliases: ['mercader de paso', 'mercader', 'comerciante'] },
];

describe('matchNpcAliases', () => {
  // Bug real jugando en vivo (2026-09-28): la habilidad de clase "Firmeza Férrea" ("Aprieto los
  // dientes y aguanto el golpe...") quedaba SIEMPRE bloqueada como "No hay ningún Nuente al que
  // dirigirse aquí" — Levenshtein("nuentes","dientes")=2. Ver `esErrataDeAlias`, npcScene.ts.
  it('palabras frecuentes a 1-2 letras de un alias corto con otra inicial no disparan a nadie (dientes/fuente/muerte/puente → Nuente, quien → Quio)', () => {
    expect(matchNpcAliases('Aprieto los dientes y aguanto el golpe por pura dureza física, sin ceder terreno.', NPCS_BARRIDO_2026_09_28)).toEqual([]);
    expect(matchNpcAliases('Bebo de la fuente junto al puente y pienso en la muerte.', NPCS_BARRIDO_2026_09_28)).toEqual([]);
    expect(matchNpcAliases('Me doy cuenta de que tengo al enemigo de frente, qué suerte.', NPCS_BARRIDO_2026_09_28)).toEqual([]);
    expect(matchNpcAliases('No sé quien anda por aquí.', NPCS_BARRIDO_2026_09_28)).toEqual([]);
  });

  it('palabras reales a 1 letra de un alias con la misma inicial están excluidas (mercado → Mercader)', () => {
    expect(matchNpcAliases('Busco un bulto de provisiones en el mercado.', NPCS_BARRIDO_2026_09_28)).toEqual([]);
  });

  it('la tolerancia a erratas sigue funcionando con la misma inicial: "nuemte" (1 cambio) sí es Nuente', () => {
    expect(matchNpcAliases('Veo un nuemte entre las rocas', NPCS_BARRIDO_2026_09_28)).toEqual(['nuente']);
    expect(matchNpcAliases('Veo un nuente entre las rocas', NPCS_BARRIDO_2026_09_28)).toEqual(['nuente']);
  });

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
    // en medio de una frase más larga ("el jefe de guerra serhu", "jefa del clan serhu"). Gistera
    // Koh SÍ se detecta a sí misma, correctamente, por su propio alias real (2026-09-16, fixture
    // NPCS ampliado con el caso real de colisión "gistera"~"estera"/"costera" — ver más abajo).
    expect(matchNpcAliases('Gistera Koh, una orca del Clan Serhu, ha aparecido ante Gorhorn', NPCS)).toEqual(['gistera']);
  });

  it('bug real jugando en vivo (2026-08-02): "lugar" no debe disparar a Hagar por tolerancia a erratas (Levenshtein("lugar","hagar")=2)', () => {
    expect(matchNpcAliases('Gorhorn se da cuenta de que este lugar ha sido escenario de conflictos', NPCS)).toEqual([]);
  });

  it('bug real jugando en vivo (2026-08-02): "remato"/"remata" no deben disparar al Múrgol por tolerancia a erratas (Levenshtein("remato","rebano")=2)', () => {
    expect(matchNpcAliases('Remato a Orco enfurecido, asestándoles el golpe de gracia final.', NPCS)).toEqual([]);
    expect(matchNpcAliases('Lo remata sin piedad.', NPCS)).toEqual([]);
  });

  it('bug real jugando en vivo (2026-08-08, revisión de partida): "hablar" no debe disparar a Hagar (Levenshtein("hablar","hagar")=2) — el propio bio de Orco Enfurecido ya usa "sin intentar hablar", así que esta colisión podía dispararse desde la primerísima escena de cualquier partida nueva', () => {
    expect(matchNpcAliases('Orco enfurecido ataca sin intentar hablar.', NPCS)).toEqual([]);
  });

  it('Hagar y el Múrgol siguen detectándose por su alias real, la exclusión no los deja invisibles del todo', () => {
    expect(matchNpcAliases('Hagar se acerca sonriendo', NPCS)).toEqual(['hagar']);
    expect(matchNpcAliases('Veo un múrgol pastando', NPCS)).toEqual(['murgol']);
  });

  // Bug real jugando en vivo (auditoría de pruebas, 2026-09-16): un simple "Grito para ver si hay
  // alguien cerca" en La Hondonada del Eco trajo a Brenka (Terk'ikar del Clan Helsig, en Cristal
  // Helado) a escena y hasta teletransportó al jugador hacia su posición real, solo porque un
  // SessionFact mencionaba "arena magnética" (Levenshtein("brenka","arena")=2). Brenka es
  // `PRINCIPAL` — candidato en cualquier región del mundo, sin filtro de ubicación — así que la
  // colisión no era un caso aislado, se disparaba desde cualquier mención de una palabra común.
  // Barrido sistemático del resto de alias cortos del catálogo (ver comentario de
  // NPC_ALIAS_FUZZY_EXCLUSIONS) encontró 3 colisiones reales más contra el propio corpus del juego.
  it('bug real jugando en vivo (2026-09-16): "arena" no debe disparar a Brenka (Levenshtein("brenka","arena")=2)', () => {
    expect(matchNpcAliases('La Hondonada del Eco es un refugio contra el viento y las tormentas de arena magnética.', NPCS)).toEqual([]);
  });

  it('mismo barrido (2026-09-16): "sombra" no debe disparar a Solgra (Levenshtein("solgra","sombra")=2) — agravado porque "sombra" es palabra muy frecuente en la propia prosa del motor', () => {
    expect(matchNpcAliases('Una sombra se acerca a gran velocidad por la llanura.', NPCS)).toEqual([]);
  });

  it('mismo barrido (2026-09-16): "estera"/"costera" no deben disparar a Gistera Koh (Levenshtein("gistera","estera")=2, Levenshtein("gistera","costera")=2)', () => {
    expect(matchNpcAliases('Duerme sobre una estera vieja junto a la zona costera.', NPCS)).toEqual([]);
  });

  it('mismo barrido (2026-09-16): "selva"/"semilla"/"senda"/"salta"/"huella" no deben disparar a Sella Marn — "selva" está a distancia Levenshtein 1, el peor caso del barrido', () => {
    expect(matchNpcAliases('Cruza la selva siguiendo la senda hasta encontrar una huella.', NPCS)).toEqual([]);
    expect(matchNpcAliases('Planta la semilla y salta el pequeño muro de piedra.', NPCS)).toEqual([]);
  });

  it('Brenka, Solgra, Gistera Koh y Sella Marn siguen detectándose por su alias real, las exclusiones no los dejan invisibles del todo', () => {
    expect(matchNpcAliases('Brenka reparte el botín del día.', NPCS)).toEqual(['brenka']);
    expect(matchNpcAliases('Solgra lidera la guerra del clan.', NPCS)).toEqual(['solgra']);
    expect(matchNpcAliases('Gistera Koh se presenta con prisas.', NPCS)).toEqual(['gistera']);
    expect(matchNpcAliases('Sella Marn compra información a ambos bandos.', NPCS)).toEqual(['sella']);
  });

  it('auditoría 2026-08-11 (docs/runbooks/puntos-de-codigo-nuevo-contenido.md § 7): un alias corto de una sola palabra no matchea como substring de otra palabra', () => {
    expect(matchNpcAliases('Busco presas para comer esta noche', NPCS)).toEqual([]);
    expect(matchNpcAliases('Eso me parece interesante', NPCS)).toEqual([]);
    expect(matchNpcAliases('Espero una respuesta clara', NPCS)).toEqual([]);
  });

  it('auditoría 2026-08-11: familia de verbos en "-ar" que a distancia Levenshtein ≤2 de "hagar" no deben disparar a Hagar por tolerancia a erratas', () => {
    expect(matchNpcAliases('Voy a cazar algo para cenar', NPCS)).toEqual([]);
    expect(matchNpcAliases('Uso la salvia del polvo para sanar la herida', NPCS)).toEqual([]);
    expect(matchNpcAliases('Voy a talar el matorral de cuerno', NPCS)).toEqual([]);
    expect(matchNpcAliases('No sé nadar en esta corriente', NPCS)).toEqual([]);
    expect(matchNpcAliases('Intento matar al Corredor de Cauce', NPCS)).toEqual([]);
    expect(matchNpcAliases('Voy a apagar el fuego del campamento', NPCS)).toEqual([]);
    expect(matchNpcAliases('Decido bajar por la hondonada', NPCS)).toEqual([]);
    expect(matchNpcAliases('No tengo con qué pagar al mercader', NPCS)).toEqual([]);
    expect(matchNpcAliases('Me niego a negar lo que vi', NPCS)).toEqual([]);
  });
});

describe('detectsFarewellIntent', () => {
  it('detecta una despedida real antes de un viaje', () => {
    expect(detectsFarewellIntent('Me despido de Gistera Koh por ahora y me dirijo hacia Los Restos de Maktor.')).toBe(true);
    expect(detectsFarewellIntent('Nos despedimos y parto hacia el norte.')).toBe(true);
    expect(detectsFarewellIntent('Dejo atras el campamento y a Gistera Koh, en busca de nuevos horizontes.')).toBe(true);
  });

  it('no dispara con una despedida dentro de una conversación que sigue en el mismo sitio', () => {
    expect(detectsFarewellIntent('Gistera Koh se despide entre risas antes de seguir hablando junto al fuego.')).toBe(false);
    expect(detectsFarewellIntent('Hablo con Gistera Koh sobre el clan Serhu.')).toBe(false);
  });
});

describe('filterFarewellFacts', () => {
  const GISTERA = { id: 'gistera', aliases: ['gistera', 'gistera koh'] };

  it('excluye un hecho de despedida antiguo del NPC mencionado', () => {
    const facts = [
      'Gistera Koh acompaña a Gorhorn por la Hondonada del Eco.',
      'Me despido de Gistera Koh por ahora y me dirijo hacia Los Restos de Maktor.',
      'Gorhorn llega a Los Restos de Maktor tras un largo viaje.',
    ];
    expect(filterFarewellFacts(facts, [GISTERA])).toEqual([
      'Gistera Koh acompaña a Gorhorn por la Hondonada del Eco.',
      'Gorhorn llega a Los Restos de Maktor tras un largo viaje.',
    ]);
  });

  it('conserva el hecho de despedida si es el último (mismo turno en que ocurre)', () => {
    const facts = ['Gorhorn viaja con Gistera Koh.', 'Me despido de Gistera Koh por ahora.'];
    expect(filterFarewellFacts(facts, [GISTERA])).toEqual(facts);
  });

  it('no toca hechos sin despedida, aunque mencionen al NPC', () => {
    const facts = ['Gistera Koh sigue junto al fuego, atenta.'];
    expect(filterFarewellFacts(facts, [GISTERA])).toEqual(facts);
  });

  it('no toca una despedida de un NPC que no está entre los candidatos', () => {
    const facts = ['Me despido de un mercader cualquiera y sigo mi camino.'];
    expect(filterFarewellFacts(facts, [GISTERA])).toEqual(facts);
  });
});

describe('contraataqueDifficultyFor', () => {
  it('resta la defensa sin bajar del suelo de 8', () => {
    expect(contraataqueDifficultyFor(2, 5, 0)).toBe(8);
    expect(contraataqueDifficultyFor(2, 5, 5)).toBe(8);
  });
});

// Hallazgo 12 (revisar-partida-hallazgos.md 2026-09-06) — escala de dificultad de utilidad por
// diferencia de SUMA de atributos (no nivel), tramos 6/12/15/18.
describe('utilityDifficultyFor', () => {
  const attrsTotal = (total: number): AttributeBlock => ({
    fuerza: total,
    destreza: 0,
    constitucion: 0,
    inteligencia: 0,
    voluntad: 0,
    carisma: 0,
    magia: 0,
  });

  it('objetivo mucho más débil (diff <= -8) → Fácil (6)', () => {
    expect(utilityDifficultyFor(attrsTotal(10), attrsTotal(30)).dificultad).toBe(6);
    expect(utilityDifficultyFor(attrsTotal(22), attrsTotal(30)).dificultad).toBe(6); // límite exacto, diff=-8
  });

  it('objetivo similar (diff entre -7 y 4) → Media (12)', () => {
    expect(utilityDifficultyFor(attrsTotal(30), attrsTotal(30)).dificultad).toBe(12); // diff=0
    expect(utilityDifficultyFor(attrsTotal(34), attrsTotal(30)).dificultad).toBe(12); // límite exacto, diff=4
  });

  it('objetivo más fuerte (diff entre 5 y 16) → Difícil (15)', () => {
    expect(utilityDifficultyFor(attrsTotal(40), attrsTotal(30)).dificultad).toBe(15); // diff=10
    expect(utilityDifficultyFor(attrsTotal(46), attrsTotal(30)).dificultad).toBe(15); // límite exacto, diff=16
  });

  it('objetivo mucho más fuerte (diff > 16) → Muy difícil (18)', () => {
    expect(utilityDifficultyFor(attrsTotal(60), attrsTotal(30)).dificultad).toBe(18);
  });
});

describe('tabulatedAttackAttribute', () => {
  it('usa fuerza por defecto', () => {
    expect(tabulatedAttackAttribute('Ataco con mi hacha')).toBe('fuerza');
  });
  it('usa destreza si se menciona una emboscada (sigilo bajó a atributo secundario, 2026-07-29)', () => {
    expect(tabulatedAttackAttribute('Ataco por la espalda con sigilo')).toBe('destreza');
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

  it('no confunde "hierro" con "hiere"/"hiero" (auditoría 2026-07-29, tras el bug real de "ataque"~"saque" en turnResolution.ts)', () => {
    expect(detectsAttackIntent('Aprieto los dientes, aguanto con mi Puño de Hierro y me preparo')).toBe(false)
    expect(detectsAttackIntent('Reviso mi armadura de hierro antes de seguir')).toBe(false)
  });

  it('P261: "hacer", "viene", "tiene", "quiero" no se confunden con "hiere"/"hiero"/"lacerar" por la tolerancia a erratas', () => {
    expect(detectsAttackIntent('Pienso en lo que me pidió Gistera Koh y qué hacer con el orco')).toBe(false)
    expect(detectsAttackIntent('Le digo al orco que Gistera Koh viene hacia aquí')).toBe(false)
    expect(detectsAttackIntent('Miro al orco mientras Gistera Koh tiene razón')).toBe(false)
    expect(detectsAttackIntent('Quiero hablar con el orco y con Gistera Koh')).toBe(false)
    // Lo literal sigue contando.
    expect(detectsAttackIntent('Hiero al orco con la espada')).toBe(true)
    expect(detectsAttackIntent('Intento lacerar al orco')).toBe(true)
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

  it('hallazgo real jugando en vivo (2026-09-15, "caza fantasma"): "cazar" cuenta como intención hostil, sin verbo de ataque literal', () => {
    expect(detectsHostileSearchIntent('Intento cazar a Quio con sigilo')).toBe(true)
    expect(detectsHostileSearchIntent('Cazo al Kirelon Arenoso')).toBe(true)
    expect(detectsHostileSearchIntent('Voy cazando por la zona en busca de algo')).toBe(true)
    expect(detectsHostileSearchIntent('Decido no cazar nada hoy')).toBe(false)
  });

  it('"cazar" no dispara por el sustantivo de nombre/clase, solo por el verbo conjugado (mismo riesgo que "Cazadora Serhu")', () => {
    expect(detectsHostileSearchIntent('Hablo con la Cazadora Serhu sobre el campamento')).toBe(false)
    expect(detectsHostileSearchIntent('Mi clase es Cazador, prefiero el arco')).toBe(false)
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

  it('bug real jugando en vivo (2026-07-30, "revisar partida"): "me ocupo de" (presente y futuro) también cuenta, no solo "me encargo"', () => {
    expect(detectsVerbalAcceptanceIntent('Yo me ocupo de él, no te preocupes.')).toBe(true)
    expect(detectsVerbalAcceptanceIntent('Me ocuparé de tu perseguidor')).toBe(true)
  });
});

describe('pickAmbientEncounterCandidate', () => {
  it('devuelve null sin candidatos', () => {
    expect(pickAmbientEncounterCandidate([])).toBeNull();
  });

  it('elige el candidato en el índice que dicte la función de aleatoriedad inyectada (sin peso = uniforme)', () => {
    const candidates = [
      { slug: 'orco-rezagado', name: 'Guerrero orco rezagado', role: 'Guerrero sin clan' },
      { slug: 'mercader-de-paso', name: 'Mercader de paso', role: 'Comerciante itinerante' },
    ];
    expect(pickAmbientEncounterCandidate(candidates, () => 0)).toEqual(candidates[0]);
    expect(pickAmbientEncounterCandidate(candidates, () => 0.99)).toEqual(candidates[1]);
  });

  // docs/mecanicas/16-poblacion-dinamica.md (2026-08-03): ponderado por población real en vez de uniforme.
  it('pondera por `weight` — una especie mucho más abundante sale elegida en un rango mucho más amplio', () => {
    const candidates = [
      { slug: 'corredor-de-cauce', name: 'Corredor de Cauce', role: 'Fauna itinerante', weight: 90 },
      { slug: 'gargantua-de-ceniza', name: 'Gargantúa de Ceniza', role: 'Fauna itinerante', weight: 10 },
    ];
    // totalWeight = 100: [0, 0.9) cae en el primero, [0.9, 1) en el segundo.
    expect(pickAmbientEncounterCandidate(candidates, () => 0.5)).toEqual(candidates[0]);
    expect(pickAmbientEncounterCandidate(candidates, () => 0.95)).toEqual(candidates[1]);
  });

  it('un candidato con weight 0 (especie extinta) nunca sale elegido si hay alternativa', () => {
    const candidates = [
      { slug: 'especie-extinta', name: 'Especie extinta', role: 'Fauna itinerante', weight: 0 },
      { slug: 'especie-viva', name: 'Especie viva', role: 'Fauna itinerante', weight: 5 },
    ];
    expect(pickAmbientEncounterCandidate(candidates, () => 0)).toEqual(candidates[1]);
    expect(pickAmbientEncounterCandidate(candidates, () => 0.99)).toEqual(candidates[1]);
  });
});

// Cobertura nueva (auditoría de arquitectura 2026-07-30, "acotar el candidato, no añadir IA" —
// ver npcScene.ts § detectNpcsInScene) — antes se comparaba contra TODO el roster del mundo sin
// acotar, causa raíz confirmada del falso positivo real "presas" (Levenshtein 2 de "brasas")
// enganchando a un NPC que no pintaba nada en la escena actual.
function baseNpc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'lurker', slug: 'acechador-de-brasas', name: 'Acechador de Brasas', kind: 'PLANTILLA',
    aliases: ['acechador', 'brasas', 'acechador de brasas', 'bestia de las brasas'],
    level: 3, role: 'Carroñero nocturno', faction: null, personality: 'Paciente', bio: 'x',
    items: [], attributes: {}, raza: null, clase: null, ataqueNatural: null, habilidadesRaciales: [],
    homeLocationSlug: 'campamento-cienaga',
    ...overrides,
  };
}

const HONDONADA = { slug: 'hondonada-del-eco', region: 'Llanuras del Viento Rojo' };
const CIENAGA_CAMPAMENTO = { slug: 'campamento-cienaga', region: 'Ciénaga Troncal' };

// 2026-09-28: salvo el primer test (el bug "presas"/"brasas" en sí), estos tests usaban ese mismo
// falso positivo como disparador cómodo para probar el filtro por escena — con la tolerancia a
// erratas acotada (`esErrataDeAlias`, npcScene.ts) ya no engancha en ninguna región, así que usan
// una mención real del NPC ("acechador"), que es lo que de verdad prueban.
describe('detectNpcsInScene — acotar el candidato por escena', () => {
  beforeEach(() => {
    findManyNpc.mockReset();
    findUniqueLocation.mockReset();
    findManyLocation.mockReset();
    findManyQuest.mockReset();
    findManyNpcState.mockReset();
    findUniqueSave.mockReset();
    findManyQuest.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([]);
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: [] });
  });

  it('bug real (2026-07-24): "presas" no engancha a un NPC cuya región de origen no es la actual, aunque esté a distancia Levenshtein 2 de uno de sus alias ("brasas")', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(HONDONADA); // jugador en Llanuras, NPC vive en Ciénaga Troncal
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await detectNpcsInScene({
      action: 'Busco presas por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result).toEqual([]);
  });

  it('la misma acción SÍ engancha cuando la región actual coincide con la de origen del NPC (no rompe el caso legítimo)', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(CIENAGA_CAMPAMENTO); // jugador ya en la región del NPC
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-cienaga',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  it('un NPC PRINCIPAL es candidato en cualquier escena, sin importar la ubicación', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ kind: 'PRINCIPAL', homeLocationSlug: null })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  // Cobertura nueva (auditoría 2026-08-14, bug real jugando en vivo: Sella Marn —Nabieus de una
  // región marcada "fuera del núcleo jugable actual"— apareció en combate real. `kind: PRINCIPAL`
  // Y `homeLocationSlug: null` (itinerante) a la vez, las dos rutas que antes se saltaban CUALQUIER
  // filtro de región — `nucleoJugable: false` tiene que bloquear ambas.
  it('un PRINCIPAL fuera del núcleo jugable (nucleoJugable: false) NO es candidato, aunque sea itinerante', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'sella', kind: 'PRINCIPAL', homeLocationSlug: null, nucleoJugable: false })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result).toEqual([]);
  });

  it('un PRINCIPAL fuera del núcleo jugable SÍ sigue siendo candidato si una misión activa lo apunta de verdad', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'sella', kind: 'PRINCIPAL', homeLocationSlug: null, nucleoJugable: false })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);
    findManyQuest.mockResolvedValue([{ targetNpcId: 'sella' }]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['sella']);
  });

  it('un PRINCIPAL fuera del núcleo jugable SÍ sigue siendo candidato si ya se estableció antes en esta partida (no desaparece retroactivamente)', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'sella', kind: 'PRINCIPAL', homeLocationSlug: null, nucleoJugable: false })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([{ npcId: 'sella' }]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['sella']);
  });

  it('el objetivo de una misión activa es candidato en cualquier escena', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);
    findManyQuest.mockResolvedValue([{ targetNpcId: 'lurker' }]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  it('un NPC ya establecido antes en esta partida (tiene NpcState propio) sigue siendo candidato aunque cambie de región', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);
    findManyNpcState.mockResolvedValue([{ npcId: 'lurker' }]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  it('un NPC itinerante (sin homeLocationSlug) sigue siendo candidato en cualquier escena, igual que antes', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ homeLocationSlug: null })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  it('sin ubicación actual resuelta (p.ej. viajando), no se acota nada — mismo comportamiento que antes de este cambio', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await detectNpcsInScene({
      action: 'Veo un acechador por la zona', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: null,
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  // Bug real (revisión de partida en 5 fases, 2026-08-27, cerrado 2026-08-28): un sessionFact que
  // MENCIONA al NPC para decir que se fue para siempre contiene su nombre literal, así que el
  // matcher lo reintroducía como candidato legítimo — camino determinista, no una alucinación del
  // LLM. `npcsRetiredForever` corta esto de raíz, sin importar qué diga el propio texto del fact.
  it('un NPC en npcsRetiredForever NUNCA se reintroduce, aunque un sessionFact lo mencione y matchee su alias', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);
    findManyNpcState.mockResolvedValue([{ npcId: 'lurker' }]); // "ya establecido antes" — candidato geográfico igual
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: ['acechador-de-brasas'] });

    const result = await detectNpcsInScene({
      action: 'Exploro la zona',
      worldId: 'w1',
      sessionFacts: ['El Acechador de Brasas se marchó para siempre — no volverá a aparecer.'],
      saveId: 's1',
      currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result).toEqual([]);
  });

  it('un NPC NO retirado sigue detectándose con normalidad (npcsRetiredForever con otros slugs no interfiere)', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);
    findManyNpcState.mockResolvedValue([{ npcId: 'lurker' }]);
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: ['otro-npc-cualquiera'] });

    const result = await detectNpcsInScene({
      action: 'Busco al acechador', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });

  // Pieza 5 (2026-09-03, hallazgo real jugando en vivo): Gistera Koh es `kind: 'PRINCIPAL'`, así
  // que el filtro geográfico (homeLocationSlug/región) nunca la bloquea — es candidata en
  // cualquier ubicación del mundo por diseño. Antes de este fix, un sessionFact de despedida
  // explícita seguía reintroduciéndola como "presente" en la ubicación NUEVA, turnos después de
  // haberse despedido y viajado. `filterFarewellFacts` es el único filtro real para este caso.
  it('Gistera Koh (PRINCIPAL) deja de detectarse en la nueva ubicación cuando el único hecho que la menciona es una despedida de un turno anterior', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', aliases: ['gistera', 'gistera koh'], homeLocationSlug: null })]);
    findUniqueLocation.mockResolvedValue({ slug: 'restos-de-maktor', region: 'Llanuras del Viento Rojo' });
    findManyLocation.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([{ npcId: 'gistera' }]);

    const result = await detectNpcsInScene({
      action: 'Exploro Los Restos de Maktor',
      worldId: 'w1',
      sessionFacts: [
        'Me despido de Gistera Koh por ahora y me dirijo hacia Los Restos de Maktor.',
        'Gorhorn llega a Los Restos de Maktor tras varias horas de viaje.',
      ],
      saveId: 's1',
      currentLocationId: 'loc-maktor',
      fictionalMinutes: 480,
    });
    expect(result).toEqual([]);
  });

  it('Gistera Koh (PRINCIPAL) SÍ se sigue detectando en el mismo turno de la despedida (el Narrador puede cerrar la escena)', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'gistera', slug: 'gistera-koh', name: 'Gistera Koh', kind: 'PRINCIPAL', aliases: ['gistera', 'gistera koh'], homeLocationSlug: null })]);
    findUniqueLocation.mockResolvedValue({ slug: 'hondonada-del-eco', region: 'Llanuras del Viento Rojo' });
    findManyLocation.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([{ npcId: 'gistera' }]);

    const result = await detectNpcsInScene({
      action: 'Me despido de Gistera Koh por ahora y me dirijo hacia Los Restos de Maktor.',
      worldId: 'w1',
      sessionFacts: ['Me despido de Gistera Koh por ahora y me dirijo hacia Los Restos de Maktor.'],
      saveId: 's1',
      currentLocationId: 'loc-hondonada',
      fictionalMinutes: 480,
    });
    expect(result.map((n) => n.id)).toEqual(['gistera']);
  });
});

// Fauna diurna/nocturna real (2026-09-02) — mención directa: decisión explícita de la usuaria, más
// estricta que el diseño inicial ("bloquear también la mención directa, no solo el encuentro
// ambiental"). `nuente` está en `faunaMomentoDelDia` como 'noche' (worldCatalog.ts, bio: "Solo sale
// de noche; caza Imanios") — slug real del catálogo, no sintético, para no depender de que el mock
// de `faunaMomentoDelDia` se mantenga sincronizado con datos inventados.
describe('detectNpcsInScene — fauna diurna/nocturna real', () => {
  beforeEach(() => {
    findManyNpc.mockReset();
    findUniqueLocation.mockReset();
    findManyLocation.mockReset();
    findManyQuest.mockReset();
    findManyNpcState.mockReset();
    findUniqueSave.mockReset();
    findManyQuest.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([]);
    findUniqueSave.mockResolvedValue({ npcsRetiredForever: [] });
  });

  function nuenteNpc(overrides: Partial<Record<string, unknown>> = {}) {
    return baseNpc({
      id: 'nuente-1', slug: 'nuente', name: 'Nuente', aliases: ['nuente', 'nuentes'],
      homeLocationSlug: 'agujas-iman', ...overrides,
    });
  }

  const AGUJAS_IMAN = { slug: 'agujas-iman', region: 'Llanuras del Viento Rojo' };

  it('mencionado de noche (fictionalMinutes en la banda nocturna): SÍ es candidato', async () => {
    findManyNpc.mockResolvedValue([nuenteNpc()]);
    findUniqueLocation.mockResolvedValue(AGUJAS_IMAN);
    findManyLocation.mockResolvedValue([AGUJAS_IMAN]);

    // hour=22 (22*60=1320) cae en la banda 'noche' de momentoDelDiaFor (hour>=20 || hour<6).
    const result = await detectNpcsInScene({
      action: 'Busco al Nuente', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-agujas',
      fictionalMinutes: 22 * 60,
    });
    expect(result.map((n) => n.id)).toEqual(['nuente-1']);
  });

  it('mencionado de día (fictionalMinutes en la banda diurna): NUNCA aparece en escena, aunque el jugador lo nombre', async () => {
    findManyNpc.mockResolvedValue([nuenteNpc()]);
    findUniqueLocation.mockResolvedValue(AGUJAS_IMAN);
    findManyLocation.mockResolvedValue([AGUJAS_IMAN]);

    // hour=12 (12*60=720) cae en la banda 'dia' de momentoDelDiaFor (6<=hour<20).
    const result = await detectNpcsInScene({
      action: 'Busco al Nuente', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-agujas',
      fictionalMinutes: 12 * 60,
    });
    expect(result).toEqual([]);
  });

  // Misma prioridad EXACTA que `nucleoJugable` (comentario de cabecera en npcScene.ts): quest
  // activa gana siempre, incluso de día contra una especie nocturna.
  it('un Nuente objetivo de una misión activa SÍ es candidato de día (la quest gana sobre el filtro de hora)', async () => {
    findManyNpc.mockResolvedValue([nuenteNpc()]);
    findUniqueLocation.mockResolvedValue(AGUJAS_IMAN);
    findManyLocation.mockResolvedValue([AGUJAS_IMAN]);
    findManyQuest.mockResolvedValue([{ targetNpcId: 'nuente-1' }]);

    const result = await detectNpcsInScene({
      action: 'Busco al Nuente', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-agujas',
      fictionalMinutes: 12 * 60,
    });
    expect(result.map((n) => n.id)).toEqual(['nuente-1']);
  });

  // Misma prioridad que "ya establecido antes en esta partida" (NpcState propio) — gana sobre el
  // filtro de hora igual que ya gana sobre `nucleoJugable === false`.
  it('un Nuente ya establecido antes en esta partida (NpcState propio) SÍ es candidato de día', async () => {
    findManyNpc.mockResolvedValue([nuenteNpc()]);
    findUniqueLocation.mockResolvedValue(AGUJAS_IMAN);
    findManyLocation.mockResolvedValue([AGUJAS_IMAN]);
    findManyNpcState.mockResolvedValue([{ npcId: 'nuente-1' }]);

    const result = await detectNpcsInScene({
      action: 'Busco al Nuente', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-agujas',
      fictionalMinutes: 12 * 60,
    });
    expect(result.map((n) => n.id)).toEqual(['nuente-1']);
  });

  it('un NPC sin entrada en faunaMomentoDelDia (p.ej. el fixture base) nunca se bloquea por hora, de día o de noche', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]); // slug: acechador-de-brasas, sin entrada en faunaMomentoDelDia
    findUniqueLocation.mockResolvedValue(CIENAGA_CAMPAMENTO);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await detectNpcsInScene({
      action: 'Busco al acechador', worldId: 'w1', sessionFacts: [], saveId: 's1', currentLocationId: 'loc-cienaga',
      fictionalMinutes: 12 * 60,
    });
    expect(result.map((n) => n.id)).toEqual(['lurker']);
  });
});

// Grupo 3 § Mundo determinista, Capa 3, pieza B (2026-08-25) — mismo filtro geográfico que
// `detectNpcsInScene — acotar el candidato por escena` (arriba), pero devolviendo nombres en vez
// de `NpcInScene[]`, y excluyendo explícitamente a quienes ya están autorizados este turno.
describe('candidateNpcNamesNotInScene', () => {
  beforeEach(() => {
    findManyNpc.mockReset();
    findUniqueLocation.mockReset();
    findManyLocation.mockReset();
    findManyQuest.mockReset();
    findManyNpcState.mockReset();
    findManyQuest.mockResolvedValue([]);
    findManyNpcState.mockResolvedValue([]);
  });

  it('un candidato plausible por región, no autorizado este turno, sale en la lista', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(CIENAGA_CAMPAMENTO);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await candidateNpcNamesNotInScene('w1', 's1', 'loc-cienaga', new Set());
    expect(result).toEqual(['Acechador de Brasas']);
  });

  it('un candidato ya autorizado este turno (en excludeIds) no sale en la lista', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]);
    findUniqueLocation.mockResolvedValue(CIENAGA_CAMPAMENTO);
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await candidateNpcNamesNotInScene('w1', 's1', 'loc-cienaga', new Set(['lurker']));
    expect(result).toEqual([]);
  });

  it('un NPC de otra región no es candidato — mismo filtro que detectNpcsInScene', async () => {
    findManyNpc.mockResolvedValue([baseNpc()]); // vive en Ciénaga Troncal
    findUniqueLocation.mockResolvedValue(HONDONADA); // jugador en Llanuras
    findManyLocation.mockResolvedValue([CIENAGA_CAMPAMENTO]);

    const result = await candidateNpcNamesNotInScene('w1', 's1', 'loc-hondonada', new Set());
    expect(result).toEqual([]);
  });

  it('un PRINCIPAL fuera del núcleo jugable (nucleoJugable: false) nunca es candidato', async () => {
    findManyNpc.mockResolvedValue([baseNpc({ id: 'sella', kind: 'PRINCIPAL', homeLocationSlug: null, nucleoJugable: false })]);
    findUniqueLocation.mockResolvedValue(HONDONADA);
    findManyLocation.mockResolvedValue([]);

    const result = await candidateNpcNamesNotInScene('w1', 's1', 'loc-hondonada', new Set());
    expect(result).toEqual([]);
  });
});

// Cobertura nueva (bug real jugando en vivo, 2026-07-31: "el saqueo mecánico funciona perfecto —
// la narración del saqueo está totalmente desconectada de él"): un cadáver ya resuelto pero sin
// saquear TODAVÍA no listaba su equipo, así que el Narrador inventaba objetos que no existen en el
// turno exacto de saquearlo.
function npcFixture(overrides: Partial<NpcInScene> = {}): NpcInScene {
  return {
    id: 'orco', slug: 'orco-enfurecido', name: 'Orco enfurecido', articulo: 'el', genero: null, kind: 'PRINCIPAL',
    level: 1, role: 'Guerrero deshonrado', faction: null, personality: 'Errático', bio: 'x',
    items: [
      { name: 'Maza orca', cantidad: 1, notas: 'Astillada', description: 'x', equipSlot: 'ARMA_PRINCIPAL', statBonuses: { fuerza: 2 }, catalogSlug: 'maza-orca', effectKey: null, category: 'arma', tipoArma: 'MAZA_1_MANO', tipo: 'EQUIPABLE' },
    ],
    attributes: { fuerza: 11, destreza: 10, constitucion: 9, inteligencia: 4, voluntad: 7, carisma: 2, magia: 2 },
    raza: 'orcos', clase: 'GUERRERO', especializacion: null, ataqueNatural: null, habilidadesRaciales: [], faunaCategoria: null,
    temperamento: 'AGRESIVO', condicionFisica: 'ILESO', saqueado: false, lootedItemNames: [], energia: null, analizado: false,
    capturable: false,
    groupSize: null, groupDefeated: 0, corpsesLooted: 0,
    abilityUsesThisEncounter: {},
    activeEffects: [],
    homeLocationSlug: null,
    comerciablePct: 0,
    reclutablePct: 0,
    domesticablePct: 0,
    cortejablePct: 0,
    capturablePct: 0,
    targetedForKill: false,
    interactionTypes: [],
    teachesProfession: null,
    ...overrides,
  };
}

describe('npcSceneBlockFor', () => {
  it('NPC activo: lista su equipo real', () => {
    const block = npcSceneBlockFor(npcFixture(), 1);
    expect(block).toContain('Maza orca');
    expect(block).toContain('PERSONAJE EN ESCENA');
  });

  it('convaleciente pero SIN saquear todavía: sigue listando su equipo real, para que el saqueo de este turno no se lo invente', () => {
    const block = npcSceneBlockFor(npcFixture({ condicionFisica: 'CONVALECIENTE', saqueado: false }), 1);
    expect(block).toContain('YA RESUELTO');
    expect(block).toContain('Maza orca');
    expect(block).not.toMatch(/no hay botín que ofrecer/);
  });

  it('convaleciente Y YA saqueado: no lista ningún equipo, dice explícitamente que no queda botín', () => {
    const block = npcSceneBlockFor(npcFixture({ condicionFisica: 'CONVALECIENTE', saqueado: true }), 1);
    expect(block).toContain('YA RESUELTO');
    expect(block).not.toContain('Maza orca');
    expect(block).toMatch(/no hay botín que ofrecer/);
  });

  it('muerto sin saquear: mismo criterio que convaleciente', () => {
    const block = npcSceneBlockFor(npcFixture({ condicionFisica: 'MUERTO', saqueado: false }), 1);
    expect(block).toContain('Maza orca');
  });

  // Bug real jugando en vivo (2026-07-31): "se gira hacia la orca enfurecida... el Orco Enfurecido
  // salta hacia él" — mismo NPC, dos géneros en el mismo párrafo. El nombre se refuerza con su
  // artículo correcto en el propio contexto, activo o ya resuelto.
  it('con articulo, presenta el nombre con el artículo delante (activo)', () => {
    const block = npcSceneBlockFor(npcFixture({ articulo: 'el' }), 1);
    expect(block).toContain('PERSONAJE EN ESCENA: el Orco enfurecido —');
  });

  it('con articulo, presenta el nombre con el artículo delante (ya resuelto)', () => {
    const block = npcSceneBlockFor(npcFixture({ articulo: 'el', condicionFisica: 'CONVALECIENTE', saqueado: false }), 1);
    expect(block).toContain('YA RESUELTO: el Orco enfurecido —');
  });

  it('sin articulo (nombre propio), no antepone nada', () => {
    const block = npcSceneBlockFor(npcFixture({ articulo: null, name: 'Gistera Koh' }), 1);
    expect(block).toContain('PERSONAJE EN ESCENA: Gistera Koh —');
  });

  // Bug real jugando en vivo (2026-08-15, "revisar partida"): el Zense Ceniza (fauna, sin habla)
  // dio una réplica completa entre comillas y llamó "humano" al jugador — nada en el prompt le
  // impedía inventar diálogo para un animal. `ataqueNatural !== null` es el mismo marcador ya
  // usado en todo el proyecto para "esto es fauna" (ver carcassCandidatesFor, recolectar.ts).
  it('fauna (ataqueNatural no nulo): añade la instrucción explícita de que no puede hablar', () => {
    const block = npcSceneBlockFor(npcFixture({ ataqueNatural: 'Picotea y araña con sus garras curvas.' }), 1);
    expect(block).toContain('ES UN ANIMAL, NO PUEDE HABLAR');
  });

  it('NPC sintiente (ataqueNatural null): no añade la instrucción de fauna', () => {
    const block = npcSceneBlockFor(npcFixture({ ataqueNatural: null }), 1);
    expect(block).not.toContain('ES UN ANIMAL, NO PUEDE HABLAR');
  });

  // Bug real jugando (2026-07-30): Gistera Koh, nombre propio femenino ("Orca" ya en su bio),
  // narrada como "el orco" al referirse a ella de forma genérica en vez de por su nombre —
  // `articulo` no ayuda aquí (su NOMBRE no lleva artículo, el problema es la prosa libre).
  it('con genero, refuerza explícitamente el género correcto y prohíbe el opuesto (activo)', () => {
    const block = npcSceneBlockFor(npcFixture({ articulo: null, name: 'Gistera Koh', genero: 'F' }), 1);
    expect(block).toContain('GÉNERO DE GISTERA KOH: femenino');
    expect(block).toContain('NUNCA en masculino');
  });

  it('con genero, refuerza también en el bloque YA RESUELTO (cadáver/recuerdo)', () => {
    const block = npcSceneBlockFor(npcFixture({ articulo: null, name: 'Gistera Koh', genero: 'F', condicionFisica: 'MUERTO', saqueado: true }), 1);
    expect(block).toContain('GÉNERO DE GISTERA KOH: femenino');
  });

  it('sin genero, no añade ningún refuerzo de género', () => {
    const block = npcSceneBlockFor(npcFixture({ genero: null }), 1);
    expect(block).not.toContain('GÉNERO DE');
  });

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 1): el narrador conocía el
  // nombre de la facción pero nunca si el jugador es Aliado/Enemigo real de ella en esta partida.
  describe('reputación de facción real', () => {
    it('con factionsStatus que desplaza el temperamento efectivo (banda ENEMIGO), anota la relación hostil', () => {
      const block = npcSceneBlockFor(npcFixture({ faction: 'Clan Serhu', temperamento: 'CAUTELOSO' }), 1, { 'Clan Serhu': 200 });
      expect(block).toContain('RELACIÓN CON CLAN SERHU');
      expect(block).toMatch(/hostilidad/);
    });

    it('sin factionsStatus (default {}), reputación neutra, no añade ninguna anotación', () => {
      const block = npcSceneBlockFor(npcFixture({ faction: 'Clan Serhu', temperamento: 'CAUTELOSO' }), 1);
      expect(block).not.toContain('RELACIÓN CON');
    });

    it('sin facción, nunca añade nada aunque haya factionsStatus', () => {
      const block = npcSceneBlockFor(npcFixture({ faction: null }), 1, { 'Clan Serhu': 200 });
      expect(block).not.toContain('RELACIÓN CON');
    });
  });

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 3): `clase`/`especializacion`
  // ya viajaban hasta el objeto pero nunca se traducían a texto.
  describe('clase/especialización', () => {
    it('con clase y especialización, las anota', () => {
      const block = npcSceneBlockFor(npcFixture({ clase: 'GUERRERO', especializacion: 'ORDEN' }), 1);
      expect(block).toContain('CLASE DE ORCO ENFURECIDO: GUERRERO, especializado en ORDEN');
    });

    it('sin clase, no añade nada', () => {
      const block = npcSceneBlockFor(npcFixture({ clase: null }), 1);
      expect(block).not.toContain('CLASE DE');
    });
  });

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 4): ejemplo real del
  // catálogo, Torgash Ketg con reclutablePct: 5 ("tan fácil de convencer como uno entre veinte").
  describe('receptividad a interacciones sociales', () => {
    it('con un porcentaje bajo, avisa de que es poco receptivo', () => {
      const block = npcSceneBlockFor(npcFixture({ reclutablePct: 5 }), 1);
      expect(block).toContain('MUY POCO RECEPTIVO');
      expect(block).toContain('reclutarlo/a');
    });

    it('con porcentaje alto (caso normal), no añade ninguna advertencia', () => {
      const block = npcSceneBlockFor(npcFixture({ reclutablePct: 80 }), 1);
      expect(block).not.toContain('MUY POCO RECEPTIVO');
    });

    it('con porcentaje 0 (no aplica esta interacción en absoluto), no añade advertencia', () => {
      const block = npcSceneBlockFor(npcFixture({ reclutablePct: 0 }), 1);
      expect(block).not.toContain('MUY POCO RECEPTIVO');
    });
  });

  // Auditoría "narrador vs. catálogo del mundo" (2026-08-30, hallazgo 6): `activeEffects` ya
  // viajaban hasta el objeto pero nunca se traducían a texto.
  describe('efectos activos', () => {
    it('con un efecto activo, lo anota con magnitud y turnos restantes', () => {
      const block = npcSceneBlockFor(npcFixture({ activeEffects: [{ attribute: 'fuerza', magnitude: -2, turnsRemaining: 2, sourceAbility: 'Debilitar' }] }), 1);
      expect(block).toContain('ESTADO ACTIVO DE ORCO ENFURECIDO');
      expect(block).toContain('-2 fuerza');
      expect(block).toContain('2 turnos restantes');
    });

    it('sin efectos activos, no añade nada', () => {
      const block = npcSceneBlockFor(npcFixture({ activeEffects: [] }), 1);
      expect(block).not.toContain('ESTADO ACTIVO DE');
    });
  });
});

// Extraído de detectNpcsInScene (2026-08-05, eventos de viaje interactivos) para que un NPC pueda
// entrar en escena por una vía distinta al matching de texto (ver travelInterruption.ts) —
// extracción pura, mismo resultado exacto que el `.map` inline de antes de extraerla.
describe('buildNpcInScene', () => {
  const NPC_WITH_ITEMS: NpcWithItems = {
    id: 'orco-1',
    slug: 'orco-rezagado',
    name: 'Guerrero orco rezagado',
    articulo: 'el',
    genero: null,
    kind: 'PLANTILLA',
    level: 2,
    role: 'Guerrero sin clan',
    faction: null,
    personality: 'Desconfiado',
    bio: 'x',
    attributes: { fuerza: 14, destreza: 9, constitucion: 11, inteligencia: 7, voluntad: 11, carisma: 7, magia: 6 },
    raza: 'orcos',
    clase: 'Guerrero',
    ataqueNatural: null,
    habilidadesRaciales: [],
    temperamento: 'CAUTELOSO',
    items: [
      {
        id: 'npcitem-1',
        npcId: 'orco-1',
        itemId: 'item-1',
        cantidad: 1,
        notas: 'Mellada',
        item: {
          id: 'item-1',
          slug: 'maza-orca',
          name: 'Maza orca',
          description: 'Pesada y desgastada',
          equipSlot: 'ARMA_PRINCIPAL',
          statBonuses: null,
          category: 'arma',
          tipoArma: 'MAZA_1_MANO',
          // Bug real jugando (2026-08-06): "Mapa de las Llanuras" saqueado en pleno turno no
          // activaba los puntos del mapa hasta recargar — effectKey no viajaba desde aquí.
          effectKey: 'reveal-map-llanuras',
        },
      },
    ],
  } as unknown as NpcWithItems;

  it('sin NpcState previo (nunca visto en esta partida), aplica los defaults ILESO/sin saquear', () => {
    const result = buildNpcInScene(NPC_WITH_ITEMS, undefined);
    expect(result.id).toBe('orco-1');
    expect(result.slug).toBe('orco-rezagado');
    expect(result.condicionFisica).toBe('ILESO');
    expect(result.saqueado).toBe(false);
    expect(result.lootedItemNames).toEqual([]);
    expect(result.energia).toBeNull();
    expect(result.items).toEqual([
      {
        name: 'Maza orca',
        cantidad: 1,
        notas: 'Mellada',
        description: 'Pesada y desgastada',
        equipSlot: 'ARMA_PRINCIPAL',
        statBonuses: null,
        catalogSlug: 'maza-orca',
        effectKey: 'reveal-map-llanuras',
        category: 'arma',
        tipoArma: 'MAZA_1_MANO',
      },
    ]);
  });

  it('con NpcState existente, usa el estado real persistido en vez de los defaults', () => {
    const state = {
      id: 'state-1', saveId: 'save-1', npcId: 'orco-1', scope: 'loc-x',
      condicionFisica: 'CONVALECIENTE', energia: 5, saqueado: true, lootedItemNames: ['Maza orca'],
      updatedAt: new Date(),
    } as unknown as Parameters<typeof buildNpcInScene>[1];
    const result = buildNpcInScene(NPC_WITH_ITEMS, state);
    expect(result.condicionFisica).toBe('CONVALECIENTE');
    expect(result.saqueado).toBe(true);
    expect(result.lootedItemNames).toEqual(['Maza orca']);
    expect(result.energia).toBe(5);
  });
});

// Movido desde turnResolution.test.ts (refactor de deuda técnica 2026-08-13, junto con
// detectsLootIntent/detectsInventoryReviewIntent — detectsExecuteIntent, tercero de esa lista
// original, se eliminó el 2026-09-15 como código muerto: "Decapitar"/"Matar" se rediseñó el
// 2026-08-30 a un ataque normal, sin ningún detector de texto libre aparte).
describe('detectsLootIntent', () => {
  it('detecta coincidencia exacta de un stem', () => {
    expect(detectsLootIntent('Registro el cuerpo del enemigo caído.')).toBe(true);
  });

  it('tolera una errata de distancia 2 en un stem literal (auditoría 2026-07-20, P0.4)', () => {
    expect(detectsLootIntent('Le saqeo el cadáver antes de seguir.')).toBe(true);
  });

  it('no dispara con una acción sin ninguna intención de saqueo', () => {
    expect(detectsLootIntent('Miro con cuidado el horizonte.')).toBe(false);
  });

  it('no confunde "ataque"/"atacar"/"ataco" con el stem "saque" (bug real 2026-07-29, jugando en vivo: forzaba lootMode y desactivaba el combate real en un turno de ataque)', () => {
    expect(detectsLootIntent("Lanzo un ataque rápido y calculado con mi filo, buscando precisión antes que fuerza 'Orco enfurecido'.")).toBe(false);
    expect(detectsLootIntent('Ataco desde un silencio que no debería esconder a nadie.')).toBe(false);
    expect(detectsLootIntent('Mi olfato lee el miedo de mi enemigo — ataco en el instante exacto en que flaquea.')).toBe(false);
  });

  it('no confunde "comer"/"comió" con el stem "compr" (auditoría 2026-07-29 tras el bug de "ataque": justo la palabra que usaría comer un consumible para recuperar energía)', () => {
    expect(detectsLootIntent('Quiero comer mi ración de carne ahumada para recuperar fuerzas.')).toBe(false);
    expect(detectsLootIntent('Ya comió la ración de carne ahumada antes de seguir camino.')).toBe(false);
  });
});

// Cobertura nueva (auditoría 2026-08-11, "pruebas por API" — ver hasFalseInventoryReview en
// narrador.ts).
describe('detectsInventoryReviewIntent', () => {
  it('detecta variantes reales de revisar equipo/inventario/mochila', () => {
    expect(detectsInventoryReviewIntent('Reviso mi equipo y observo con calma el terreno.')).toBe(true);
    expect(detectsInventoryReviewIntent('Compruebo mi inventario antes de seguir.')).toBe(true);
    expect(detectsInventoryReviewIntent('Miro mi mochila para ver qué llevo.')).toBe(true);
    expect(detectsInventoryReviewIntent('Inspecciono mi equipo con cuidado.')).toBe(true);
  });

  it('no dispara con una acción que no tiene nada que ver con revisar el inventario', () => {
    expect(detectsInventoryReviewIntent("Ataco a 'Orco enfurecido' con mi hacha.")).toBe(false);
    expect(detectsInventoryReviewIntent('Camino hacia el pozo a rellenar el odre.')).toBe(false);
  });
});

// P327 (2026-10-26): mientras Gorhorn no conoce a un NPC con nombre propio, lo que se cuenta al
// narrador lo llama «el orco desconocido», nunca por su nombre, aunque el motor lo siga emparejando
// por el real.
describe('P327 — nombre visible de un NPC aún no descubierto', () => {
  const oculto = () => npcFixture({ name: 'Gistera Koh', slug: 'gistera-koh', articulo: null, genero: 'F', raza: 'orcos', nombreVisible: 'Orca desconocida' });

  beforeEach(() => {
    findManyDiscovered.mockReset();
    findManyDiscovered.mockResolvedValue([]);
  });

  it('conNombreVisible oculta al PRINCIPAL sin descubrir y deja al conocido y al genérico', async () => {
    findManyDiscovered.mockResolvedValue([{ entitySlug: 'orco-enfurecido' }]);
    const principalOculto = npcFixture({ slug: 'gistera-koh', name: 'Gistera Koh', genero: 'F', raza: 'orcos', articulo: null });
    const principalConocido = npcFixture({ slug: 'orco-enfurecido' });
    const generico = npcFixture({ slug: 'guchapo', name: 'Guchapo', kind: 'GENERICO' as NpcInScene['kind'] });
    const [a, b, c] = await conNombreVisible({ discoveredEntity: { findMany: findManyDiscovered } } as never, 'save-1', [principalOculto, principalConocido, generico]);
    expect(a!.nombreVisible).toBe('Orca desconocida');
    expect(a!.name).toBe('Gistera Koh');
    expect(b!.nombreVisible).toBeUndefined();
    expect(c!.nombreVisible).toBeUndefined();
  });

  it('el bloque y la línea para el narrador usan «la orca desconocida» y prohíben el nombre propio', () => {
    const bloque = npcSceneBlockFor(oculto(), 1);
    expect(bloque).toContain('PERSONAJE EN ESCENA: la orca desconocida');
    expect(bloque).toContain('NOMBRE OCULTO');
    expect(bloque).toContain('GÉNERO DE LA ORCA DESCONOCIDA');
    expect(bloque.split('Descripción/hechos')[0]).not.toContain('Gistera');
    const linea = npcSceneLineFor(oculto(), 1);
    expect(linea).toContain('la orca desconocida');
    expect(linea).not.toContain('Gistera');
    expect(calibrationLineFor([oculto()], 1)).not.toContain('Gistera');
  });

  it('un NPC conocido sigue por su nombre y sin la nota de nombre oculto', () => {
    const conocido = npcFixture();
    expect(npcSceneBlockFor(conocido, 1)).toContain('PERSONAJE EN ESCENA: el Orco enfurecido');
    expect(npcSceneBlockFor(conocido, 1)).not.toContain('NOMBRE OCULTO');
    expect(nombreNarrado(conocido)).toBe('Orco enfurecido');
    expect(nombreNarrado(oculto(), true)).toBe('La orca desconocida');
  });
});

describe('detectsGreetingOrQuestion (P306)', () => {
  it('un saludo o una pregunta cuentan como saludo', () => {
    expect(detectsGreetingOrQuestion('¡Hola! ¿Qué tal el camino?')).toBe(true);
    expect(detectsGreetingOrQuestion('Le pregunto por el paso del norte.')).toBe(true);
  });

  it('«cómo va la caza» (la frase del hallazgo) es saludo: «caza» es el sustantivo, no el verbo', () => {
    expect(detectsGreetingOrQuestion('Saludo con un gesto del clan y le pregunto cómo va la caza')).toBe(true);
    expect(detectsGreetingOrQuestion('¿Qué tal tu caza, Torgash?')).toBe(true);
    expect(detectsGreetingOrQuestion('Le digo «te caza el orco» y le cazo.')).toBe(false);
  });

  it('una amenaza de muerte o un gesto violento no se cuelan como saludo', () => {
    expect(detectsGreetingOrQuestion('¡Hola! Te mato.')).toBe(false);
    expect(detectsGreetingOrQuestion('Le grito: «¡te voy a matar!»')).toBe(false);
    expect(detectsGreetingOrQuestion('Desenvaino y le digo «prepárate».')).toBe(false);
    expect(detectsGreetingOrQuestion('Le clavo la lanza y le digo adiós.')).toBe(false);
    expect(detectsGreetingOrQuestion('¡Muere, bestia!')).toBe(false);
  });

  it('atacar, amenazar o intentar influir no es un saludo', () => {
    expect(detectsGreetingOrQuestion('¡Ataco al orco con el hacha!')).toBe(false);
    expect(detectsGreetingOrQuestion('Le amenazo: «¡dame el oro!»')).toBe(false);
  });
});

describe('sinNombreReal (revisión P327)', () => {
  const oculto = { name: 'Ugrak Tuerto', nombreVisible: 'Orco desconocido' };
  it('con el nombre oculto, cambia el nombre completo por el visible, en mayúscula al empezar frase', () => {
    expect(sinNombreReal('Ugrak Tuerto guarda el paso. Dicen que Ugrak Tuerto no duerme.', oculto)).toBe(
      'El orco desconocido guarda el paso. Dicen que el orco desconocido no duerme.',
    );
  });
  it('sin nombre oculto, o dentro de otra palabra, no toca nada', () => {
    expect(sinNombreReal('Ugrak Tuerto guarda el paso.', { name: 'Ugrak Tuerto' })).toBe('Ugrak Tuerto guarda el paso.');
    expect(sinNombreReal('Los Ugrakos Tuertos del norte.', oculto)).toBe('Los Ugrakos Tuertos del norte.');
  });
  it('fase 1: también cambia el nombre de pila, pero no una palabra del visible ni un artículo', () => {
    expect(sinNombreReal('Ugrak guarda el paso. Todos temen a Ugrak.', oculto)).toBe('El orco desconocido guarda el paso. Todos temen a el orco desconocido.');
    expect(sinNombreReal('Orco enfurecido ruge. Otro Orco pasa.', { name: 'Orco enfurecido', nombreVisible: 'Orco desconocido' })).toBe('El orco desconocido ruge. Otro Orco pasa.');
    expect(sinNombreReal('La Sastre cose. La casa calla.', { name: 'La Sastre', nombreVisible: 'Orca desconocida' })).toBe('La orca desconocida cose. La casa calla.');
  });
});
