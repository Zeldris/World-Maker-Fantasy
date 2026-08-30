import { describe, it, expect } from 'vitest';
import {
  reinoIntentDetected,
  stripLeakedJson,
  stripNonLatinScript,
  deterministicFallbackNarration,
  isTooSimilarToLast,
  sanitizeSuggestions,
  hasFalseCombatMiss,
  hasFalseCombatAttacker,
  dropSuggestionsTargetingDownedNpc,
  dropSuggestionsAttackingHelpRequester,
  dropSuggestionsCompressingAcceptance,
  dropSuggestionsWrongGrammaticalPerson,
  npcsKnownFromLog,
  dropSuggestionsReferencingPlayerByName,
  lastLogHasDirectSpeech,
  dropSuggestionsCopyingExample,
  dropSuggestionsNamingStaleNpc,
  hasEnglishLeak,
  hasFalseCombatHit,
  hasPrematureCombatResolution,
  hasFalseUnconsciousNarration,
  hasFalseDeathClaim,
  hasFalseItemUse,
  hasFalseInventoryReview,
  hasResurrectedDeadNpc,
  hasFalseNpcAppearance,
  hasGisteraReencuentroSinNombrar,
  hasFalseGisteraNamedReturn,
  hasFalseKarotVekuAsRiver,
  hasFalseMaktorThreatClaim,
  hasFalseTravelClaim,
  hasFalsePhantomTravel,
  hasFalseWeaponThrowClaim,
  hasFalseEquipmentChangeClaim,
  hasFalseItemGivenAway,
  hasFalseHealingClaim,
  hasFalseNewItemClaim,
  hasFalsePassiveHarvestClaim,
  hasFalseCombatTargetName,
  hasWrongNpcName,
  hasWrongAggressorName,
  hasAnachronism,
  buildNarrationPrompt,
} from './narrador.js';

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

describe('isTooSimilarToLast', () => {
  it('bug real probando en vivo (2026-07-31): detecta una narración de combate casi verbatim del turno anterior', () => {
    const anterior = 'Gorhorn descarga una poderosa hachata hacia atrás contra el orco, haciendo que este tropiece y pierda el equilibrio.';
    const actual = 'Gorhorn descarga una poderosa hachata hacia atrás contra el orco, haciendo que este tropiece y caiga al suelo, jadeando de furia.';
    expect(isTooSimilarToLast(actual, anterior)).toBe(true);
  });

  it('no dispara si no hay narración anterior (primer turno de la partida)', () => {
    expect(isTooSimilarToLast('Gorhorn ataca al orco.', undefined)).toBe(false);
  });

  it('no dispara con dos narraciones genuinamente distintas, aunque compartan vocabulario normal de combate', () => {
    const anterior = 'Gorhorn descarga un golpe directo con su hacha rota, pero el orco esquiva sin problema.';
    const actual = 'El orco arremete con su maza astillada, pero Gorhorn se cubre a tiempo con el escudo y aguanta el impacto.';
    expect(isTooSimilarToLast(actual, anterior)).toBe(false);
  });
});

describe('sanitizeSuggestions', () => {
  it('deja pasar 3 sugerencias genuinamente distintas tal cual', () => {
    const suggestions = ['Ataco al Orco Enfurecido', 'Le pregunto al Orco Enfurecido por su clan', 'Reviso si hay alguien más cerca'];
    expect(sanitizeSuggestions(suggestions)).toEqual(suggestions);
  });

  it('descarta una variante casi idéntica a otra ya aceptada, quedándose con la primera', () => {
    const suggestions = ['Sigo explorando la zona', 'Continúo explorando la zona', 'Le pregunto a Gistera por el Clan Serhu'];
    expect(sanitizeSuggestions(suggestions)).toEqual(['Sigo explorando la zona', 'Le pregunto a Gistera por el Clan Serhu']);
  });

  it('quita vacíos o solo espacios', () => {
    expect(sanitizeSuggestions(['Ataco al orco', '   ', ''])).toEqual(['Ataco al orco']);
  });

  it('undefined (el modelo no rellenó el campo) da un array vacío, nunca lanza', () => {
    expect(sanitizeSuggestions(undefined)).toEqual([]);
  });

  it('nunca rellena de vuelta hasta 3 — puede devolver menos si hay duplicados', () => {
    // Contenido de verdad compartido ("orco enfurecido", "mi hacha"), no solo palabras de función
    // (petición explícita, 2026-08-20, ver comentario de `SUGGESTION_SIMILARITY_THRESHOLD`) — con
    // `factSimilarity` el único verbo distinto no basta para salvar la segunda de ser duplicado.
    const suggestions = ['Ataco al orco enfurecido con mi hacha', 'Golpeo al orco enfurecido con mi hacha', 'Reviso mi equipo'];
    expect(sanitizeSuggestions(suggestions).length).toBeLessThan(3);
  });
});

describe('dropSuggestionsTargetingDownedNpc', () => {
  it('bug real reportado en captura (2026-08-15): descarta "Ataco a X" cuando X ya está convaleciente', () => {
    const suggestions = ['Ataco a Orco Enfurecido', 'Registro el cuerpo del Orco Enfurecido', 'Sigo mi camino'];
    expect(dropSuggestionsTargetingDownedNpc(suggestions, ['Orco Enfurecido'])).toEqual([
      'Registro el cuerpo del Orco Enfurecido',
      'Sigo mi camino',
    ]);
  });

  it('no descarta "Remato a X" ni "Registro a X" para un NPC ya caído — siguen siendo coherentes', () => {
    const suggestions = ['Remato al Orco Enfurecido', 'Registro el cuerpo del Orco Enfurecido'];
    expect(dropSuggestionsTargetingDownedNpc(suggestions, ['Orco Enfurecido'])).toEqual(suggestions);
  });

  it('no toca nada si no hay NPCs caídos', () => {
    const suggestions = ['Ataco al Orco Enfurecido'];
    expect(dropSuggestionsTargetingDownedNpc(suggestions, [])).toEqual(suggestions);
  });

  it('no filtra un ataque a OTRO NPC distinto del que está caído', () => {
    const suggestions = ['Ataco al Cruzavientos que sobrevuela la escena'];
    expect(dropSuggestionsTargetingDownedNpc(suggestions, ['Orco Enfurecido'])).toEqual(suggestions);
  });
});

describe('dropSuggestionsAttackingHelpRequester', () => {
  const recentLog = [
    'Gistera Koh se presenta a toda prisa: "Soy Gistera Koh, del Clan Serhu. Empieza por quien me persigue — hazlo antes de que sea tarde."',
  ];

  it('bug real jugando en vivo (2026-08-20, "ahora funciona pero...muy mal"), primera variante: descarta "Remato a X" cuando X está ILESA pidiendo ayuda, sin combate de por medio', () => {
    const knownNpcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' }];
    const suggestions = ['Remato a Gistera Koh para evitar su pérdida', 'Le pregunto quién la persigue', 'Acepto ayudarla'];
    expect(dropSuggestionsAttackingHelpRequester(suggestions, knownNpcs, recentLog)).toEqual(['Le pregunto quién la persigue', 'Acepto ayudarla']);
  });

  it('segunda variante del mismo bug, reincidente: descarta también "Ataco a X" contra la misma peticionaria', () => {
    const knownNpcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' }];
    const suggestions = ['Ataco a Gistera Koh para acabar con su presencia', 'Le pregunto por qué se acelera tanto', 'Sigo explorando la zona'];
    expect(dropSuggestionsAttackingHelpRequester(suggestions, knownNpcs, recentLog)).toEqual([
      'Le pregunto por qué se acelera tanto',
      'Sigo explorando la zona',
    ]);
  });

  it('no descarta un ataque contra un NPC sano que NO es quien acaba de hablar (enemigo normal en pleno combate)', () => {
    const knownNpcs = [{ name: 'Orco Enfurecido', condicionFisica: 'ILESO' }];
    const suggestions = ['Ataco al Orco Enfurecido con mi hacha'];
    expect(dropSuggestionsAttackingHelpRequester(suggestions, knownNpcs, ['Gorhorn ataca al Orco Enfurecido.'])).toEqual(suggestions);
  });

  it('no descarta "Remato a X" cuando X SÍ está convaleciente/muerta — sigue siendo coherente', () => {
    const knownNpcs = [{ name: 'Gistera Koh', condicionFisica: 'CONVALECIENTE' }];
    const suggestions = ['Remato a Gistera Koh'];
    expect(dropSuggestionsAttackingHelpRequester(suggestions, knownNpcs, recentLog)).toEqual(suggestions);
  });

  it('no toca nada si la última entrada no tiene diálogo directo', () => {
    const knownNpcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' }];
    const suggestions = ['Ataco a Gistera Koh'];
    expect(dropSuggestionsAttackingHelpRequester(suggestions, knownNpcs, ['Gistera Koh se acerca corriendo, sin aliento.'])).toEqual(suggestions);
  });
});

describe('npcsKnownFromLog', () => {
  it('bug real reportado en captura (2026-08-15): descarta a un NPC cuyo nombre real todavía no aparece en el historial (encuentro guionizado sin presentar)', () => {
    const npcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' as const }];
    const recentLog = [
      'Una sombra se acerca a gran velocidad por la llanura. En cuanto la tiene a la vista, distingue que es una orca con la marca del Clan Serhu — se acerca a toda prisa, sin aliento, mirando constantemente hacia atrás, como si algo la persiguiera.',
    ];
    expect(npcsKnownFromLog(npcs, recentLog)).toEqual([]);
  });

  it('deja pasar a un NPC cuyo nombre SÍ aparece ya en el historial', () => {
    const npcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' as const }];
    const recentLog = ['Gistera Koh se presenta a toda prisa, sin dejar de mirar hacia atrás.'];
    expect(npcsKnownFromLog(npcs, recentLog)).toEqual(npcs);
  });

  it('un NPC activo en combate tiene su nombre por todo el log, así que nunca se filtra', () => {
    const npcs = [{ name: 'Orco Enfurecido', condicionFisica: 'CONVALECIENTE' as const }];
    const recentLog = ['Gorhorn ataca al Orco Enfurecido.', 'Gorhorn hunde su hacha en el hombro del Orco Enfurecido, dejándolo inmóvil.'];
    expect(npcsKnownFromLog(npcs, recentLog)).toEqual(npcs);
  });
});

describe('dropSuggestionsCompressingAcceptance', () => {
  it('bug real reincidente jugando en vivo (2026-08-20): descarta "Acepto ayudarla y..." — dos beats comprimidos en una frase, pese a que REGLA 4 ya lo prohíbe en el prompt', () => {
    const suggestions = [
      'Acepto ayudarla y busco al que me persigue',
      'Le pregunto por qué los Serhu se han vuelto contra su propio clan',
      'Me niego a ayudarla hasta que me explique mejor la situación',
    ];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual([
      'Le pregunto por qué los Serhu se han vuelto contra su propio clan',
      'Me niego a ayudarla hasta que me explique mejor la situación',
    ]);
  });

  it('descarta las variantes reales ya vistas ("voy a por", "ataco a", "decido ayudarla y", "ayudar a + nombre")', () => {
    const suggestions = [
      'Acepto ayudarla y voy a por quien la persigue',
      'Acepto ayudarla y ataco al que me persigue',
      'Decido ayudarla y me preparo para enfrentar al Orco Enfurecido',
      'Acepto ayudar a Gistera Koh y me giro para ver quién nos persigue.',
    ];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual([]);
  });

  it('descarta también la variante con PUNTO en vez de "y" uniendo la segunda frase ("Acepto ayudarte, Gistera Koh. Debo enfrentarme al que te persigue primero.")', () => {
    const suggestions = [
      'Acepto ayudarte, Gistera Koh. Debo enfrentarme al que te persigue primero.',
      'Le pregunto por qué le persiguen antes de tomar una decisión',
    ];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual(['Le pregunto por qué le persiguen antes de tomar una decisión']);
  });

  it('"Acepto ayudarla" sola, sin nada detrás, es justo la forma correcta y se mantiene', () => {
    const suggestions = ['Acepto ayudarla', 'Acepto ayudarte, Gistera'];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual(suggestions);
  });

  it('no descarta una aceptación CON CONDICIÓN legítima solo porque tenga una "y" más adelante en la frase', () => {
    const suggestions = [
      'Acepto ayudarla, pero solo si me cuentas todo lo que sabes sobre los Serhu y por qué están en guerra con nosotros.',
      'Acepto ayudarla si me explica bien la situación y me parece razonable.',
    ];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual(suggestions);
  });

  it('no toca sugerencias sin verbo de aceptar', () => {
    const suggestions = ['Le pregunto por qué la persiguen antes de decidir nada', 'Observo la orca detenidamente'];
    expect(dropSuggestionsCompressingAcceptance(suggestions)).toEqual(suggestions);
  });
});

describe('dropSuggestionsWrongGrammaticalPerson', () => {
  it('bug real reincidente jugando en vivo (2026-08-20, 2 de 2 veces seguidas): descarta "Examinó"/"Examine" — tercera persona/imperativo, nunca "Examino" (primera persona presente, la forma correcta)', () => {
    const suggestions = [
      'Examinó el terreno en busca de cualquier señal o trampa que pudiera indicar la dirección del perseguidor.',
      'Examine el terreno alrededor, buscando algún peligro que nos rodea.',
      'Le pregunto por qué los Serhu la han expulsado del clan antes de tomar una decisión.',
    ];
    expect(dropSuggestionsWrongGrammaticalPerson(suggestions)).toEqual([
      'Le pregunto por qué los Serhu la han expulsado del clan antes de tomar una decisión.',
    ]);
  });

  it('descarta el resto de verbos de la misma familia semántica (revisa/busca/inspecciona/observa/explora/registra, en sus 3 formas equivocadas)', () => {
    const suggestions = [
      'Revisa el campamento en busca de pistas',
      'Buscó rastros del perseguidor',
      'Inspeccione el terreno con cuidado',
      'Observa a la orca desde lejos',
      'Exploró la zona rocosa',
      'Registre el cuerpo caído',
    ];
    expect(dropSuggestionsWrongGrammaticalPerson(suggestions)).toEqual([]);
  });

  it('mantiene la forma correcta de primera persona ("Examino"/"Reviso"/"Busco"/"Inspecciono"/"Observo"/"Exploro"/"Registro")', () => {
    const suggestions = [
      'Examino el terreno en busca de cualquier señal',
      'Reviso los alrededores buscando al perseguidor',
      'Busco rastros del que persigue a Gistera',
      'Inspecciono la zona con cuidado',
      'Observo a la orca desde lejos',
      'Exploro la hondonada',
      'Registro el cuerpo caído',
    ];
    expect(dropSuggestionsWrongGrammaticalPerson(suggestions)).toEqual(suggestions);
  });

  it('solo mira la PRIMERA palabra — no descarta una frase que use esos verbos más adelante en otra persona dentro de una subordinada', () => {
    const suggestions = ['Le pregunto si ella examina el terreno también'];
    expect(dropSuggestionsWrongGrammaticalPerson(suggestions)).toEqual(suggestions);
  });
});

describe('dropSuggestionsReferencingPlayerByName', () => {
  it('bug real jugando en vivo (2026-08-15), reincidente pese a la instrucción del prompt: descarta una sugerencia que trata al propio personaje como si fuera otra persona', () => {
    const suggestions = [
      'Ataco a la orca para acabar con esta presencia',
      'Comienzo a caminar hacia Gorhorn, intentando descubrir si hay algo más que pueda ayudarme',
    ];
    expect(dropSuggestionsReferencingPlayerByName(suggestions, 'Gorhorn')).toEqual(['Ataco a la orca para acabar con esta presencia']);
  });

  it('no toca sugerencias que no mencionan el nombre del jugador', () => {
    const suggestions = ['Ataco a la orca', 'Le pregunto por el Clan Serhu'];
    expect(dropSuggestionsReferencingPlayerByName(suggestions, 'Gorhorn')).toEqual(suggestions);
  });

  it('no revienta si el nombre del personaje tiene caracteres especiales de regex', () => {
    expect(dropSuggestionsReferencingPlayerByName(['Ataco al enemigo'], 'Gor+horn (el Roto)')).toEqual(['Ataco al enemigo']);
  });
});

describe('lastLogHasDirectSpeech', () => {
  it('bug real jugando en vivo (2026-08-18): un NPC acercándose sin haber dicho nada todavía NO cuenta como diálogo', () => {
    const recentLog = [
      'Una sombra se acerca a gran velocidad por la llanura. En cuanto la tiene a la vista, distingue que es una orca con la marca del Clan Serhu — se acerca a toda prisa, sin aliento, mirando constantemente hacia atrás, como si algo la persiguiera.',
    ];
    expect(lastLogHasDirectSpeech(recentLog)).toBe(false);
  });

  it('una réplica real entre comillas en la última entrada sí cuenta', () => {
    const recentLog = ['Gistera Koh se presenta a toda prisa: "Soy Gistera Koh, del Clan Serhu, aunque ya no. Empieza por el que me persigue."'];
    expect(lastLogHasDirectSpeech(recentLog)).toBe(true);
  });

  it('solo mira la ÚLTIMA entrada — una réplica de turnos anteriores ya está resuelta', () => {
    const recentLog = ['Gistera Koh dice: "Ayúdame."', 'Gorhorn asiente y empieza a caminar hacia el borde de la hondonada.'];
    expect(lastLogHasDirectSpeech(recentLog)).toBe(false);
  });

  it('historial vacío no revienta', () => {
    expect(lastLogHasDirectSpeech([])).toBe(false);
  });
});

describe('dropSuggestionsCopyingExample', () => {
  it('bug real reportado en captura (2026-08-18): descarta un fragmento casi calcado de EJEMPLO 1/2 del prompt (rediseño a fragmentos cortos, 2026-08-20)', () => {
    const suggestions = ['Registro su cuerpo', 'Sigo mi camino sin decir nada', 'Miro alrededor buscando cobijo'];
    const kept = dropSuggestionsCopyingExample(suggestions);
    expect(kept).not.toContain('Registro su cuerpo');
  });

  it('no toca sugerencias genuinas de la partida real, aunque compartan alguna palabra suelta con el ejemplo', () => {
    const suggestions = ['Ataco al Orco Enfurecido con mi hacha', 'Le pregunto a Gistera Koh sobre sus planes y motivaciones'];
    expect(dropSuggestionsCopyingExample(suggestions)).toEqual(suggestions);
  });

  it('bug real jugando en vivo (2026-08-20, "al darle a sugerir no me está dando ninguna sugerencia"): no descarta una sugerencia sobre un tema totalmente distinto solo por compartir el mismo arranque de frase ("Le pregunto por...") que EJEMPLO 2 — con `similarity()` plana (antes del fix) esto cruzaba el umbral y se descartaban las 3 sugerencias generadas sin que ninguna copiara nada de verdad, devolviendo [] sin ningún error visible', () => {
    const suggestions = ['Le pregunto por su nombre antes de acercarme más', 'Reviso mi equipo antes de seguir', 'Sigo caminando hacia el norte'];
    expect(dropSuggestionsCopyingExample(suggestions)).toEqual(suggestions);
  });
});

describe('dropSuggestionsNamingStaleNpc', () => {
  it('bug real reportado en captura (2026-08-18): Gistera pide ayuda contra "uno de los suyos" sin nombrarlo — descarta la sugerencia que rellena el hueco con un NPC conocido de antes pero no nombrado ahora', () => {
    const knownNpcs = [
      { name: 'Gistera Koh', condicionFisica: 'ILESO' as const },
      { name: 'Orco Enfurecido', condicionFisica: 'ILESO' as const },
    ];
    const recentLog = [
      'Gorhorn se planta frente a la figura y le exige que hable. Con la respiración entrecortada, se presenta a toda prisa: "Soy Gistera Koh... del Clan Serhu, aunque ya no. No tengo tiempo para explicarte más — uno de los suyos me pisa los talones y quiere verme muerta. Empieza por el que me persigue."',
    ];
    const suggestions = [
      'Repite tu pregunta para asegurarte de que Gistera Koh entiende tu mensaje',
      'Mira hacia atrás en busca de una huella o rastro del Orco Enfurecido',
      'Preguntas a Gistera Koh sobre sus planes y motivaciones',
    ];
    expect(dropSuggestionsNamingStaleNpc(suggestions, knownNpcs, recentLog)).toEqual([
      'Repite tu pregunta para asegurarte de que Gistera Koh entiende tu mensaje',
      'Preguntas a Gistera Koh sobre sus planes y motivaciones',
    ]);
  });

  it('no filtra un NPC cuyo nombre SÍ aparece en la última entrada', () => {
    const knownNpcs = [{ name: 'Gistera Koh', condicionFisica: 'ILESO' as const }];
    const recentLog = ['Gistera Koh dice: "Ayúdame."'];
    const suggestions = ['Le pregunto a Gistera Koh qué necesita'];
    expect(dropSuggestionsNamingStaleNpc(suggestions, knownNpcs, recentLog)).toEqual(suggestions);
  });

  it('sin NPCs conocidos, no toca nada', () => {
    const suggestions = ['Sigo explorando la zona'];
    expect(dropSuggestionsNamingStaleNpc(suggestions, [], ['Algo pasa.'])).toEqual(suggestions);
  });

  it('bug reincidente jugando en vivo (2026-08-20): descarta también un NPC que el motor detecta en escena pero que JAMÁS ha aparecido en el historial (ni siquiera en una entrada anterior a la última) — antes solo se recibía `knownNpcs` (ya filtrado por `npcsKnownFromLog`), así que este caso quedaba completamente fuera de la red de seguridad', () => {
    const npcsEnEscena = [
      { name: 'Gistera Koh', condicionFisica: 'ILESO' as const },
      { name: 'Orco Enfurecido', condicionFisica: 'ILESO' as const },
    ];
    const recentLog = [
      'Gorhorn se planta frente a la figura y le exige que hable. Con la respiración entrecortada, se presenta a toda prisa: "Soy Gistera Koh... del Clan Serhu, aunque ya no. No tengo tiempo para explicarte más — uno de los suyos me pisa los talones y quiere verme muerta. Empieza por el que me persigue."',
    ];
    const suggestions = [
      'Le pregunto por qué su clan se volvió contra los Maktor y cómo puedo ayudarla.',
      'Inspecciono a la orca en busca de alguna señal o debilidad para el Orco Enfurecido que persigue a Gistera.',
      'Me niego a ayudarla hasta que me explique mejor por qué debe matar a uno de los suyos.',
    ];
    expect(dropSuggestionsNamingStaleNpc(suggestions, npcsEnEscena, recentLog)).toEqual([
      'Le pregunto por qué su clan se volvió contra los Maktor y cómo puedo ayudarla.',
      'Me niego a ayudarla hasta que me explique mejor por qué debe matar a uno de los suyos.',
    ]);
  });
});

describe('hasEnglishLeak', () => {
  it('bug real probando en vivo (2026-07-31): detecta una palabra inglesa suelta en medio de una frase en español', () => {
    expect(hasEnglishLeak('el eco de su own pisadas en el polvo rojizo')).toBe(true);
  });

  it('no dispara con una narración normal en español', () => {
    expect(hasEnglishLeak('Gorhorn camina cauteloso por las paredes de arcilla endurecida.')).toBe(false);
  });

  it('no confunde palabras españolas que casualmente empiezan igual (p.ej. "ownership" no es una palabra española, pero tampoco debe disparar por una palabra española que la contenga)', () => {
    expect(hasEnglishLeak('Gorhorn recupera el honor de su propio clan.')).toBe(false);
  });

  // Ronda de correcciones 2026-08-28 (P5.1) — 3 casos reales encontrados jugando en vivo que la
  // lista original (own/the/and/was/with/from) no cubría: "small clearing" (2026-08-13), "several
  // pasos" (2026-08-23), "lullaby" (2026-08-28).
  it('detecta "small clearing" colado en la narración (bug real 2026-08-13)', () => {
    expect(hasEnglishLeak('Gorhorn llega a un small clearing entre los árboles.')).toBe(true);
  });

  it('detecta "several" colado en la narración (bug real 2026-08-23)', () => {
    expect(hasEnglishLeak('Avanza several pasos antes de detenerse.')).toBe(true);
  });

  it('detecta "lullaby" colado en la narración (bug real 2026-08-28)', () => {
    expect(hasEnglishLeak('Una lullaby lejana se cuela entre los árboles.')).toBe(true);
  });

  it('detecta "accompanies" — verbo inglés conjugado sustituyendo al español (bug real, sesión de pruebas 2026-08-28)', () => {
    expect(hasEnglishLeak('El viento siseante lo accompanies en su búsqueda.')).toBe(true);
  });
});

describe('hasAnachronism', () => {
  it('detecta pólvora/armas de fuego', () => {
    expect(hasAnachronism('un fuerte olor a pólvora inunda el aire tras el disparo de rifle')).toBe(true);
  });

  it('detecta tecnología moderna (electricidad, plástico)', () => {
    expect(hasAnachronism('la luz eléctrica parpadea sobre el suelo de plástico')).toBe(true);
  });

  it('no dispara con una narración normal en español medieval-fantástico', () => {
    expect(hasAnachronism('Gorhorn afila su hacha de hierro junto al fuego de leña.')).toBe(false);
  });
});

describe('hasFalseCombatHit', () => {
  it('bug real jugando en vivo (2026-07-31, "sigo sin hacerle daño al enemigo"): detecta un golpe narrado cuando el intercambio resolvió que nadie conecta', () => {
    const narration =
      'Gorhorn lanza su hacha de guerra rota con todas sus fuerzas. La maza pesada golpea el cuello del orco, dejando un rastro de sangre y haciéndolo tropezar hacia atrás.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('no dispara si el intercambio sí tuvo un golpe real (combatBothMissed=false)', () => {
    const narration = 'Gorhorn golpea con fuerza el hombro del orco, que retrocede dolorido.';
    expect(hasFalseCombatHit(narration, false)).toBe(false);
  });

  it('no dispara con una narración de fallo/esquiva genuina, aunque combatBothMissed sea true', () => {
    const narration = 'Gorhorn lanza su cuchillo hacia el orco, fallando el tiro. La hoja zumba y se clava en la roca a su espalda.';
    expect(hasFalseCombatHit(narration, true)).toBe(false);
  });

  it('no dispara fuera de combate (combatBothMissed undefined)', () => {
    expect(hasFalseCombatHit('Gorhorn golpea la puerta con el puño, impaciente.', undefined)).toBe(false);
  });

  it('bug real jugando en vivo (2026-08-02): detecta "línea de sangre" como contradicción esquiva+impacto (hueco de vocabulario, no de lógica)', () => {
    const narration = 'Gorhorn lanza su hacha, pero este esquiva fácilmente, dejando una línea de sangre fría donde la hoja rozó su armadura.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (2026-08-08): detecta el gerundio "atravesando", no solo pasado/presente ("atravesó"/"atraviesa")', () => {
    expect(hasFalseCombatHit('Gorhorn da un fuerte golpe, atravesando el cuello del ave con una precisión sorprendente.', true)).toBe(true);
  });

  it('bug real jugando en vivo (sesión de pruebas 2026-08-28): detecta "clava con fuerza en" — "con" se cuela entre el verbo y el artículo, "clava\\s+(su|el|un|la)" no lo cazaba', () => {
    const narration =
      'Gorhorn levanta su maza orca y la clava con fuerza en el cuello del Kirelon Arenoso, haciendo que éste retroceda unos pasos.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (mismo combate, turno siguiente, 2026-08-28): detecta "derriba" — vocabulario de golpe conectado sin cubrir', () => {
    const narration = 'Gorhorn ataca con un golpe directo, apunto a Kirelon Arenoso y derriba su brazo de cuchillo.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (2026-08-15): detecta "golpea" en presente + "herida" (hueco de vocabulario — la lista solo cubría "golpeó"/"golpeo", nunca "golpea")', () => {
    const narration =
      'Gorhorn alza su Maza orca y la estrella con fuerza hacia el Buitre Cenizo, quien intenta esquivarla pero falla en el último instante. La maza golpea fuertemente el costado del Buitre Cenizo, dejando una herida visible antes de que este se desvanezca en el viento.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (2026-08-15): detecta "se desploma al suelo" tras un golpe narrado', () => {
    const narration =
      'Gorhorn clava su Maza orca en el cuello del Buitre Cenizo, rebotando un instante antes de clavarse firmemente. El ave grita y se desploma al suelo.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  it('sigue sin disparar con "golpea el aire" — el caso genuino de fallo que motivó excluir "golpea" en origen', () => {
    expect(hasFalseCombatHit('Gorhorn golpea el aire con fuerza, fallando por completo.', true)).toBe(false);
  });

  it('bug real jugando en vivo (2026-08-22, "revisa la partida otra vez"): detecta un golpe de muerte completo narrado sobre un "parada_en_seco" (nadie conectó nada) — texto real de esa partida', () => {
    const narration =
      'Gorhorn propina un potente zarpazo que corta la garganta del Buitre Cenizo, derramando una gran cantidad de sangre y causándole la muerte instantánea.';
    expect(hasFalseCombatHit(narration, true)).toBe(true);
  });

  // Hueco de vocabulario encontrado en auditoría de código (2026-08-25, sin reproducir en vivo
  // todavía): el sustantivo "golpe" a secas nunca disparaba nada, solo el verbo "golpeó"/"golpeo".
  it('detecta "asesta un golpe certero" — el sustantivo "golpe" con verbo/adjetivo de acierto, nunca cazado hasta ahora', () => {
    expect(hasFalseCombatHit('Gorhorn asesta un golpe certero al orco, que retrocede dolorido.', true)).toBe(true);
  });

  it('sigue sin disparar con "esquiva el golpe" — un golpe INTENTADO, no aterrizado, sigue siendo fraseo de fallo legítimo', () => {
    expect(hasFalseCombatHit('El orco esquiva el golpe de Gorhorn en el último instante.', true)).toBe(false);
  });

  it('detecta "ensarta"/"empala" y "clava su [arma]" como verbos de contacto ya resuelto', () => {
    expect(hasFalseCombatHit('Gorhorn ensarta al orco con su lanza.', true)).toBe(true);
    expect(hasFalseCombatHit('Gorhorn empala a la bestia contra el suelo.', true)).toBe(true);
    expect(hasFalseCombatHit('Gorhorn clava su daga en el costado del orco.', true)).toBe(true);
  });
});

describe('hasFalseCombatMiss', () => {
  it('bug real jugando en vivo (2026-08-15): detecta una esquiva narrada cuando el intercambio resolvió golpe_pleno (Éxito claro del jugador vs Fallo de la defensa)', () => {
    const narration =
      'Gorhorn levanta su hacha de guerra rota y la envía con toda la fuerza hacia el Orco enfurecido. La maza rasga el aire, pero el enemigo se mueve con una rapidez sorprendente, esquivándola por un pelo.';
    expect(hasFalseCombatMiss(narration, true)).toBe(true);
  });

  it('no dispara si el intercambio no tuvo ningún golpe real (combatRealHitLanded=false)', () => {
    const narration = 'El orco esquiva por un pelo el hachazo de Gorhorn.';
    expect(hasFalseCombatMiss(narration, false)).toBe(false);
  });

  it('no dispara fuera de combate (combatRealHitLanded undefined)', () => {
    expect(hasFalseCombatMiss('El orco esquiva por un pelo.', undefined)).toBe(false);
  });

  it('no dispara con una narración de golpe real genuina, aunque combatRealHitLanded sea true', () => {
    const narration = 'Gorhorn descarga su hacha con toda su fuerza y esta vez sí conecta de lleno contra el hombro del orco.';
    expect(hasFalseCombatMiss(narration, true)).toBe(false);
  });

  it('no dispara con un fallo parcial de UN lado en golpes_mutuos/defensor_contragolpea, mientras el otro sí conecta', () => {
    const narration = 'El orco falla su zarpazo por poco margen, pero el hacha de Gorhorn sí encuentra su hombro con fuerza.';
    expect(hasFalseCombatMiss(narration, true)).toBe(false);
  });

  it('bug real jugando en vivo (prueba con Playwright, 2026-08-27): detecta "bloquea el ataque" seguido de la herida en la misma frase, cuando el golpe sí conectó', () => {
    const narration =
      'Gorhorn con furia bestial. Tu Hacha de guerra rota bloquea el ataque, pero una mancha roja se abre en su pecho.';
    expect(hasFalseCombatMiss(narration, true)).toBe(true);
  });

  it('no dispara con "intenta bloquear" (fallo genuino de defensa, el otro lado sí conecta)', () => {
    const narration = 'El orco intenta bloquear el golpe, pero el hacha de Gorhorn sí encuentra su hombro.';
    expect(hasFalseCombatMiss(narration, true)).toBe(false);
  });

  it('2º bug real jugando en vivo el mismo día (prueba con Playwright, 2026-08-27, tras aplicar el fix de "bloquea el ataque"): detecta "se desvía" seguido de una mancha roja, cuando el golpe SÍ falló de verdad', () => {
    const narration = 'Gorhorn se desvía con agilidad, notando una mancha roja en su pecho. El golpe falla al último momento.';
    expect(hasFalseCombatMiss(narration, true)).toBe(true);
  });
});

describe('hasFalseCombatAttacker', () => {
  it('bug real jugando en vivo (prueba con Playwright, 2026-08-27): detecta al jugador narrado como quien acierta el golpe cuando fue el NPC quien conectó', () => {
    const narration =
      'Gorhorn clava su cuchillo en el costado del Orco enfurecido, que gruñe de dolor.';
    expect(hasFalseCombatAttacker(narration, 'Gorhorn', true)).toBe(true);
  });

  it('no dispara si el jugador no recibió ningún golpe real este turno (jugadorRecibeGolpeEsteTurno=false)', () => {
    const narration = 'Gorhorn descarga su hacha con toda su fuerza y esta vez sí conecta de lleno contra el hombro del orco.';
    expect(hasFalseCombatAttacker(narration, 'Gorhorn', false)).toBe(false);
  });

  it('no dispara sin characterName', () => {
    const narration = 'Gorhorn ataca de lleno al Orco enfurecido.';
    expect(hasFalseCombatAttacker(narration, undefined, true)).toBe(false);
  });

  it('dispara con un contragolpe legítimo del jugador (límite conocido, no un bug del guard)', () => {
    const narration = 'El Orco enfurecido ataca con su maza, pero Gorhorn logra contragolpear y clava su cuchillo en el costado del orco.';
    // Nota: este caso es un falso positivo aceptado del guard tal como está diseñado — un
    // contragolpe real del jugador narra igual que un golpe invertido (mismo vocabulario, mismo
    // orden sujeto-verbo-objeto). Se deja documentado como límite conocido, no como bug: el
    // criterio conservador (misma frase + nombre del jugador) es el mismo ya usado en
    // hasFalseItemUse/hasResurrectedDeadNpc, y el reintento en cascada de narrateAction ya absorbe
    // el coste de un falso positivo ocasional — mejor un reintento de más que dejar pasar la
    // inversión de roles real, que es mucho más grave (ver memoria de sesión
    // tarkor_bug_narracion_atacante_invertido_2026-08-27).
    expect(hasFalseCombatAttacker(narration, 'Gorhorn', true)).toBe(true);
  });

  it('no dispara si el jugador solo aparece como víctima del golpe, sin vocabulario de impacto en la frase siguiente', () => {
    const narration = 'El Orco enfurecido descarga su maza con fuerza brutal contra el costado de Gorhorn, que cae de rodillas. Gorhorn respira con dificultad.';
    expect(hasFalseCombatAttacker(narration, 'Gorhorn', true)).toBe(false);
  });

  it('bug real jugando en vivo (texto capturado exacto, prueba con Playwright, 2026-08-27): "línea roja" sin la palabra "sangre"', () => {
    const narration =
      'Gorhorn lanza su Cuchillo de hielo sílice en una estocada rápida y profunda hacia el Orco enfurecido. El cuchillo atrapa la piel del osoide en un ángulo mortal, dejando una línea roja que corre desde el omóplato hasta el costado.';
    expect(hasFalseCombatAttacker(narration, 'Gorhorn', true)).toBe(true);
  });
});

describe('hasPrematureCombatResolution', () => {
  it('bug real jugando en vivo, confirmado en dos partidas (2026-07-31 y 2026-08-01): detecta un combate narrado como ya resuelto en el turno de aceptar ayudar a Gistera Koh, sin ningún intercambio mecánico', () => {
    const narration =
      "Gorhorn se gira hacia el orco y lanza su cuchillo con fuerza. El arma acierta de lleno, y el orco huye cojeando entre la maleza.";
    expect(hasPrematureCombatResolution(narration, true)).toBe(true);
  });

  it('no dispara si el combate ya se resolvió de verdad este turno (combatNotYetResolved=false)', () => {
    const narration = 'Gorhorn lanza su cuchillo y acierta de lleno, dejando al orco tambaleante.';
    expect(hasPrematureCombatResolution(narration, false)).toBe(false);
  });

  it('no dispara con una narración de tensión/acercamiento genuina, sin combate ya resuelto', () => {
    const narration = 'Gorhorn se gira hacia el orco, empuñando su hacha, listo para lo que venga.';
    expect(hasPrematureCombatResolution(narration, true)).toBe(false);
  });

  it('no dispara fuera de este escenario concreto (combatNotYetResolved undefined)', () => {
    expect(hasPrematureCombatResolution('El orco huye cojeando, malherido.', undefined)).toBe(false);
  });

  it('bug real jugando en vivo (2026-08-08, habilidad "Cazar" nueva): detecta una caza narrada como ya atrapada/inmovilizada sin ningún intercambio mecánico', () => {
    const narration =
      'Gorhorn se agacha rápidamente, lanzando una astuta trampa que atrapa al Corretolva en un instante. Con el Corretolva ya inmovilizado, decide registrar su cuerpo para encontrar algo útil.';
    expect(hasPrematureCombatResolution(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (2026-08-08, mismo día): detecta el gerundio "atravesando" en el primer turno de "Salgo a cazar", antes de cualquier intercambio mecánico real', () => {
    const narration =
      'Gorhorn, sin perder tiempo, da un fuerte golpe con la hacha, atravesando el cuello del ave con una precisión sorprendente. El buitrón cae al suelo, con su plumaje negro ensangrentado.';
    expect(hasPrematureCombatResolution(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (2026-08-22, "Salgo a cazar y ataco a \'Buitre Cenizo\'."): detecta un ataque a una parte del cuerpo seguido de la reacción de dolor/huida del objetivo, sin usar ningún verbo de contacto de la lista de arriba', () => {
    const narration =
      'Con un rápido movimiento, ataca la pierna del Buitre Cenizo, haciendo que el carroñero chillé gigantesco y se lance hacia atrás en un intento de escapar.';
    expect(hasPrematureCombatResolution(narration, true)).toBe(true);
  });

  it('no dispara con "ataca a" + NPC (declara intención de enfrentarse, no un golpe a una parte del cuerpo)', () => {
    expect(hasPrematureCombatResolution('Gorhorn ataca al Buitre Cenizo, arma en mano.', true)).toBe(false);
  });
});

describe('hasFalseUnconsciousNarration', () => {
  it('bug real jugando en vivo (2026-08-22, "he matado a un buitre pero..."): detecta "cayendo inerte" el turno en que el rival queda CONVALECIENTE (no MUERTO) — texto real de esa partida', () => {
    const narration =
      'Gorhorn apuñala al Buitre Cenizo justo en la base del pico, dejando un rastro de sangre en su plumaje negro. El carroñero chirría y cae hacia atrás, cayendo inerte sobre el polvo.';
    expect(hasFalseUnconsciousNarration(narration, true)).toBe(true);
  });

  it('detecta "inconsciente"/"desmayado"/"sin sentido" además de "inerte"', () => {
    expect(hasFalseUnconsciousNarration('El orco queda inconsciente tras el golpe.', true)).toBe(true);
    expect(hasFalseUnconsciousNarration('El orco cae desmayado al suelo.', true)).toBe(true);
    expect(hasFalseUnconsciousNarration('El orco queda sin sentido y se desploma.', true)).toBe(true);
    expect(hasFalseUnconsciousNarration('El orco pierde el conocimiento y se desploma.', true)).toBe(true);
  });

  it('no dispara con una narración correcta de CONVALECIENTE (sigue consciente, sin fuerzas)', () => {
    const narration = 'El orco cae de rodillas, malherido, sin fuerzas para seguir luchando.';
    expect(hasFalseUnconsciousNarration(narration, true)).toBe(false);
  });

  it('no dispara para MUERTO ("inerte"/"sin vida" sí es correcto ahí) — npcFallsConvalecienteThisTurn false', () => {
    const narration = 'El golpe final corta la garganta del orco, dejándolo inerte sobre el polvo.';
    expect(hasFalseUnconsciousNarration(narration, false)).toBe(false);
  });

  it('no dispara fuera de este escenario concreto (npcFallsConvalecienteThisTurn undefined)', () => {
    expect(hasFalseUnconsciousNarration('El orco queda inconsciente.', undefined)).toBe(false);
  });

  // Hueco de vocabulario encontrado en auditoría de código (2026-08-25, sin reproducir en vivo
  // todavía): frases equivalentes que evitan las palabras clave originales por completo.
  it('detecta "no se mueve"/"no reacciona"/"inmóvil" — inconsciencia falsa sin ninguna de las palabras clave originales', () => {
    expect(hasFalseUnconsciousNarration('El buitre cae al suelo y no vuelve a moverse.', true)).toBe(true);
    expect(hasFalseUnconsciousNarration('El orco cae y no reacciona a nada.', true)).toBe(true);
    expect(hasFalseUnconsciousNarration('El orco queda tendido, inmóvil.', true)).toBe(true);
  });
});

describe('hasFalseDeathClaim', () => {
  // Bug real jugando en vivo (2026-08-22, "¿no queda nada más al revisar la partida?"): la PROSA
  // de este turno era honesta (un golpe real, no una muerte) — el hueco real estaba en `newFacts`,
  // no en `narration`. El call site real (narrador.ts) le pasa `[narration, ...newFacts].join(' ')`
  // a este guard, así que el test reproduce justo eso: el texto combinado.
  it('bug real jugando en vivo: la prosa dice "se desploma" (golpe real, GRAVE) pero newFacts reclama la muerte — texto real de esa partida', () => {
    const narration = 'Gorhorn clava su hacha rota en Buitre Cenizo, atravesándole un ala. El carroñero chirría y se desploma hacia atrás, dejando una mancha de sangre en el suelo.';
    const newFact = 'Buitre Cenizo ha sido derrotado y muerto.';
    expect(hasFalseDeathClaim(`${narration} ${newFact}`, true)).toBe(true);
  });

  it('detecta "muere"/"ha muerto"/"sin vida"/"cae muerto" además de "derrotado y muerto"', () => {
    expect(hasFalseDeathClaim('El orco muere en el acto.', true)).toBe(true);
    expect(hasFalseDeathClaim('El orco ha muerto.', true)).toBe(true);
    expect(hasFalseDeathClaim('El orco queda sin vida sobre la arena.', true)).toBe(true);
    expect(hasFalseDeathClaim('El orco cae muerto al instante.', true)).toBe(true);
  });

  it('no dispara con un golpe real que no reclama muerte ("se desploma"/"cae" a secas)', () => {
    expect(hasFalseDeathClaim('El orco se desploma hacia atrás, dejando una mancha de sangre.', true)).toBe(false);
  });

  it('no dispara si el golpe de este turno SÍ deja al rival MUERTO de verdad (combatNoRealDeathThisTurn=false)', () => {
    expect(hasFalseDeathClaim('El golpe final corta la garganta del orco, que muere en el acto.', false)).toBe(false);
  });

  it('no dispara fuera de este escenario concreto (combatNoRealDeathThisTurn undefined)', () => {
    expect(hasFalseDeathClaim('El orco muere.', undefined)).toBe(false);
  });

  // Hueco de vocabulario encontrado en auditoría de código (2026-08-25, sin reproducir en vivo
  // todavía): "fallece"/"cadáver" son sinónimos igual de comunes de "muere" que no se cazaban.
  it('detecta "fallece"/"cadáver" además de "muere"/"ha muerto"', () => {
    expect(hasFalseDeathClaim('El orco fallece entre estertores, dejando solo un cadáver tendido en la arena.', true)).toBe(true);
    expect(hasFalseDeathClaim('El orco deja de respirar tras el golpe final.', true)).toBe(true);
  });
});

describe('hasFalseItemUse', () => {
  it('bug real jugando en vivo (2026-08-01, "descansar no curó, y encima consumió un objeto sin pedirlo"): detecta un objeto médico narrado como usado sin haberse detectado de verdad', () => {
    const narration =
      'Gorhorn se detiene a descansar. Agarra la cataplasma de salvia del polvo y aplica una fina capa en una herida abierta en el brazo.';
    expect(hasFalseItemUse(narration, ['Cataplasma de salvia del polvo', 'Raciones de viaje'])).toBe(true);
  });

  it('no dispara si la lista viene vacía (algún objeto sí se usó de verdad este turno, o no hay ninguno médico/de energía)', () => {
    const narration = 'Gorhorn agarra la cataplasma de salvia del polvo y se la aplica en la herida.';
    expect(hasFalseItemUse(narration, [])).toBe(false);
    expect(hasFalseItemUse(narration, undefined)).toBe(false);
  });

  it('no dispara con una mención de pasada del objeto, sin verbo de consumo en la misma frase', () => {
    const narration = 'Gorhorn revisa su mochila. La cataplasma de salvia del polvo sigue intacta, guardada junto al resto de provisiones.';
    expect(hasFalseItemUse(narration, ['Cataplasma de salvia del polvo'])).toBe(false);
  });

  it('no dispara si el objeto mencionado no está en la lista de posibles falsos usos', () => {
    const narration = 'Gorhorn bebe un trago de agua de su cantimplora antes de seguir camino.';
    expect(hasFalseItemUse(narration, ['Cataplasma de salvia del polvo'])).toBe(false);
  });
});

describe('hasFalseInventoryReview', () => {
  it('bug real jugando por API (2026-08-11, "pruebas por API"): detecta una revisión de equipo que omite objetos reales tras afirmar exclusividad', () => {
    const narration =
      'Gorhorn revisa su equipo con calma, notando que el cuchillo de hielo sílice y el tótem Maktor son los únicos objetos que lleva consigo en este viaje.';
    const realInventory = ['Hacha de guerra rota', 'Cuchillo de hielo sílice', 'Tótem Maktor', 'Arnés de cuero', 'Raciones de viaje'];
    expect(hasFalseInventoryReview(narration, realInventory)).toBe(true);
  });

  it('no dispara si la narración menciona TODOS los objetos reales, aunque afirme exclusividad', () => {
    const narration = 'Gorhorn revisa su equipo: el hacha de guerra rota y las raciones de viaje son los únicos objetos que lleva.';
    expect(hasFalseInventoryReview(narration, ['Hacha de guerra rota', 'Raciones de viaje'])).toBe(false);
  });

  it('no dispara con una revisión vaga sin ninguna frase de exclusividad — no es una mentira, solo poco específica', () => {
    const narration = 'Gorhorn revisa su equipo, todo en su sitio, y sigue camino.';
    expect(hasFalseInventoryReview(narration, ['Hacha de guerra rota', 'Raciones de viaje'])).toBe(false);
  });

  it('no dispara si la lista viene vacía (la acción de este turno no era revisar el inventario)', () => {
    const narration = 'Gorhorn revisa su equipo: los únicos objetos que lleva son un hacha y una cuerda.';
    expect(hasFalseInventoryReview(narration, [])).toBe(false);
    expect(hasFalseInventoryReview(narration, undefined)).toBe(false);
  });
});

describe('hasResurrectedDeadNpc', () => {
  it('bug real jugando en vivo (2026-08-01, "el orco que maté volvió a aparecer"): detecta un NPC muerto narrado como si siguiera activo', () => {
    const narration =
      'Gorhorn examina la zona. Una mirada al oeste revela un conjunto de huellas recientes en la arcilla. Se fija con atención y reconoce el paso de un orco — probablemente el Orco Enfurecido.';
    expect(hasResurrectedDeadNpc(narration, ['Orco Enfurecido'])).toBe(true);
  });

  it('no dispara si la lista viene vacía (ningún NPC convaleciente/muerto en escena este turno)', () => {
    const narration = 'Gorhorn reconoce el paso de un orco entre la maleza.';
    expect(hasResurrectedDeadNpc(narration, [])).toBe(false);
    expect(hasResurrectedDeadNpc(narration, undefined)).toBe(false);
  });

  it('no dispara con un recuerdo legítimo en pasado, sin señales de presencia activa/reciente', () => {
    const narration = 'Gorhorn recuerda el día en que luchó contra el Orco Enfurecido, antes de acabar con él.';
    expect(hasResurrectedDeadNpc(narration, ['Orco Enfurecido'])).toBe(false);
  });

  it('no dispara si las huellas recientes son de otra criatura, no del NPC muerto', () => {
    const narration = 'Gorhorn encuentra huellas recientes de un jabalí cerca del río. El Orco Enfurecido sigue muerto donde lo dejó.';
    expect(hasResurrectedDeadNpc(narration, ['Orco Enfurecido'])).toBe(false);
  });

  it('bug real jugando en vivo (auditoría "revisar partida", 2026-08-12): detecta una iniciativa de ataque directa de un NPC ya resuelto, no solo señales de presencia pasiva', () => {
    // Texto real capturado en el log de una partida: con el Orco Enfurecido MUERTO/saqueado desde
    // hacía varios turnos y en otra ubicación, un "Salgo a cazar y ataco a 'Múrgol'" (sin
    // mencionarlo) narró esto. La versión anterior del regex (vocabulario de "sigue vivo"/
    // "reaparece") no lo cazaba.
    const narration =
      'El orco enfurecido se da la vuelta bruscamente, vislumbrando una sombra fugaz entre los áridos montículos de tierra. Antes de que Gorhorn pueda reaccionar, el orco se lanza hacia él con un rugido atronador.';
    expect(hasResurrectedDeadNpc(narration, ['Orco enfurecido'])).toBe(true);
  });

  // Hueco de vocabulario encontrado en auditoría de código (2026-08-25, sin reproducir en vivo
  // todavía): (1) verbos de "levantarse" tras quedar CONVALECIENTE/MUERTO; (2) "lanza [un arma]
  // contra" — el verbo pegado a un objeto intermedio, no directamente a la preposición.
  it('detecta "se incorpora" (levantarse tras caer) y "lanza un hachazo brutal contra" (verbo + objeto + preposición)', () => {
    const narration = 'El Orco Enfurecido se incorpora pese a sus heridas y lanza un hachazo brutal contra Gorhorn.';
    expect(hasResurrectedDeadNpc(narration, ['Orco Enfurecido'])).toBe(true);
  });
});

describe('hasFalseNpcAppearance', () => {
  it('Grupo 3 § Mundo determinista (2026-08-25): detecta a un NPC no autorizado "apareciendo" con vocabulario de presencia activa', () => {
    const narration = 'Gorhorn sigue explorando la hondonada cuando, de entre las sombras, aparece Hagar Kiugh y se acerca con paso decidido.';
    expect(hasFalseNpcAppearance(narration, ['Hagar Kiugh'])).toBe(true);
  });

  it('no dispara si la lista viene vacía (ningún candidato plausible sin autorizar este turno)', () => {
    const narration = 'Gorhorn sigue explorando la hondonada.';
    expect(hasFalseNpcAppearance(narration, [])).toBe(false);
    expect(hasFalseNpcAppearance(narration, undefined)).toBe(false);
  });

  it('no dispara con una mención de pasada, sin ningún verbo de presencia activa', () => {
    const narration = 'Gorhorn recuerda a Hagar Kiugh, su viejo amigo de las minas de Cristal Helado.';
    expect(hasFalseNpcAppearance(narration, ['Hagar Kiugh'])).toBe(false);
  });

  it('no dispara si el verbo de presencia está en la misma frase pero de otra persona/NPC', () => {
    const narration = 'De entre las sombras aparece un viajero desconocido. Gorhorn recuerda que Hagar Kiugh trabaja en las minas.';
    expect(hasFalseNpcAppearance(narration, ['Hagar Kiugh'])).toBe(false);
  });

  it('detecta también en newFacts, no solo en la prosa (mismo criterio que el resto de guards de esta familia)', () => {
    const textoCombinado = ['Gorhorn no nota nada raro.', 'Kael Dorn se lanza hacia Gorhorn desde la maleza.'].join(' ');
    expect(hasFalseNpcAppearance(textoCombinado, ['Kael Dorn'])).toBe(true);
  });
});

describe('hasGisteraReencuentroSinNombrar', () => {
  it('bug real jugando en vivo (visto 3 veces en 3 partidas): detecta la reintroducción de Gistera Koh sin nombrarla, reciclando su propia intro', () => {
    const narration =
      'Gorhorn rebusca entre los restos. Una orca marcada del Clan Serhu, sin nombre revelado, se acerca a Gorhorn con prisas, jadeante.';
    expect(hasGisteraReencuentroSinNombrar(narration, true)).toBe(true);
  });

  it('bug real jugando en vivo (variante confirmada, "el hocico húmedo de una orca Serhu... algo invisible persigue su silueta")', () => {
    const narration =
      'Gorhorn nota una presión inusual a su derecha y se gira, encontrándose con los ojos brillantes y el hocico húmedo de una orca Serhu. La bestia agita sus orejas mientras algo invisible persigue su silueta.';
    expect(hasGisteraReencuentroSinNombrar(narration, true)).toBe(true);
  });

  it('no dispara si Gistera Koh no se ha marchado todavía (su propia intro real, primer turno)', () => {
    const narration = 'Una orca marcada del Clan Serhu se acerca a Gorhorn con prisas — algo la persigue.';
    expect(hasGisteraReencuentroSinNombrar(narration, false)).toBe(false);
    expect(hasGisteraReencuentroSinNombrar(narration, undefined)).toBe(false);
  });

  it('no dispara con una mención neutra del Clan Serhu sin persecución/huida (p.ej. Ulkha, siempre nombrada, dando órdenes en su campamento)', () => {
    const narration = 'La Terk\'ikar Ulkha, una orca del Clan Serhu, ordena a sus guerreros que se preparen.';
    expect(hasGisteraReencuentroSinNombrar(narration, true)).toBe(false);
  });

  it('bug real jugando en vivo (checklist consolidado P0.1, 2026-08-27): reaparición tras un respawn narrada como amenaza estática, sin vocabulario de persecución/huida', () => {
    const narration =
      'Una orca marcada del Clan Serhu, sin nombre revelado todavía, aparece en la Hondonada del Eco, sus ojos fieros fijos en Gorhorn.';
    expect(hasGisteraReencuentroSinNombrar(narration, true)).toBe(true);
  });
});

describe('hasFalseGisteraNamedReturn', () => {
  it('bug real jugando en vivo (2026-08-13, revisar partida): detecta que se la nombre directamente en mitad de un combate contra otro NPC, pese a haberse marchado para siempre', () => {
    const narration = 'Gistera Koh se aproxima a Gorhorn con una expresión de furia en su rostro.';
    expect(hasFalseGisteraNamedReturn(narration, true)).toBe(true);
  });

  it('detecta también el alias corto "Gistera" a secas', () => {
    expect(hasFalseGisteraNamedReturn('Gistera se detiene un instante, observándolo.', true)).toBe(true);
  });

  it('no dispara si Gistera Koh no se ha marchado todavía', () => {
    const narration = 'Gistera Koh asiente, aliviada, y echa a andar hacia el sur.';
    expect(hasFalseGisteraNamedReturn(narration, false)).toBe(false);
    expect(hasFalseGisteraNamedReturn(narration, undefined)).toBe(false);
  });

  it('no dispara con un nombre que solo contiene "gistera" como subcadena de otra palabra', () => {
    expect(hasFalseGisteraNamedReturn('Gorhorn examina un gisteral extraño en el suelo.', true)).toBe(false);
  });
});

describe('hasFalseKarotVekuAsRiver', () => {
  it('bug real jugando en vivo (checklist consolidado P0.2, 2026-08-27): detecta "el río Karot Veku" — es el nombre nativo del campamento del Clan Serhu, nunca un río', () => {
    const narration = 'Una orca con colores oscuros, similar a las que se encuentran en el río Karot Veku.';
    expect(hasFalseKarotVekuAsRiver(narration)).toBe(true);
  });

  it('detecta otras variantes de accidente geográfico (lago, afluente)', () => {
    expect(hasFalseKarotVekuAsRiver('Cerca del lago Karot Veku se ven huellas frescas.')).toBe(true);
    expect(hasFalseKarotVekuAsRiver('El afluente de Karot Veku baja crecido esta estación.')).toBe(true);
  });

  it('no dispara con una mención correcta de Karot Veku como campamento/lugar', () => {
    expect(hasFalseKarotVekuAsRiver('Gorhorn se dirige hacia Karot Veku, el campamento del Clan Serhu.')).toBe(false);
    expect(hasFalseKarotVekuAsRiver('A pocos kilómetros del Karot Veku estuvo a punto de caer en una trampa.')).toBe(false);
  });
});

describe('hasFalseMaktorThreatClaim', () => {
  it('bug real jugando en vivo (ronda de correcciones 2026-08-28, P5.3): detecta "orcos del Clan Maktor" como amenaza externa — el clan fue aniquilado, Gorhorn es el único superviviente', () => {
    const narration =
      'Creo que es tiempo de irme por el camino principal antes de que lleguen más goirsentres o orcos del Clan Maktor.';
    expect(hasFalseMaktorThreatClaim(narration)).toBe(true);
  });

  it('detecta otras variantes de "quedan más" del clan', () => {
    expect(hasFalseMaktorThreatClaim('Un ejército del Clan Maktor se acerca desde el norte.')).toBe(true);
    expect(hasFalseMaktorThreatClaim('Teme que otros supervivientes del Clan Maktor lo reconozcan.')).toBe(true);
  });

  it('no dispara con una mención correcta del Clan Maktor (origen, historia, honor)', () => {
    expect(hasFalseMaktorThreatClaim('Gorhorn recuerda el honor perdido del Clan Maktor, su clan de origen.')).toBe(false);
    expect(hasFalseMaktorThreatClaim('El Clan Maktor fue aniquilado hace años — Gorhorn es el último.')).toBe(false);
  });
});

describe('hasFalseWeaponThrowClaim', () => {
  const WEAPONS = ['Hacha de guerra rota', 'Cuchillo de hielo sílice'];

  it('bug real jugando en vivo (2026-08-13, revisar partida): detecta el arma narrada como lanzada en un ataque cuerpo a cuerpo', () => {
    const narration =
      'Gorhorn lanza su hacha de guerra rota con fuerza hacia el orco, pero éste la esquiva con una torpezada del brazo, rebotando lejos en la pared de arcilla.';
    expect(hasFalseWeaponThrowClaim(narration, WEAPONS)).toBe(true);
  });

  it('detecta sin artículo/posesivo delante del nombre', () => {
    expect(hasFalseWeaponThrowClaim('Gorhorn lanza cuchillo de hielo sílice hacia el orco.', WEAPONS)).toBe(true);
  });

  it('no dispara con "lanza un golpe/una estocada... con" — el arma no es el objeto directo de "lanza"', () => {
    expect(hasFalseWeaponThrowClaim('Gorhorn lanza un golpe certero con su hacha de guerra rota.', WEAPONS)).toBe(false);
    expect(hasFalseWeaponThrowClaim('Gorhorn lanza una estocada rápida con el cuchillo de hielo sílice en la mano.', WEAPONS)).toBe(false);
  });

  it('no dispara fuera de combate (lista vacía)', () => {
    const narration = 'Gorhorn lanza su hacha de guerra rota con fuerza hacia el orco.';
    expect(hasFalseWeaponThrowClaim(narration, [])).toBe(false);
    expect(hasFalseWeaponThrowClaim(narration, undefined)).toBe(false);
  });

  it('no dispara si el arma lanzada no es ninguna de las equipadas (p. ej. un objeto arrojadizo real, si algún día existiera)', () => {
    expect(hasFalseWeaponThrowClaim('Gorhorn lanza una piedra hacia el orco.', WEAPONS)).toBe(false);
  });
});

describe('hasFalseEquipmentChangeClaim', () => {
  const ITEMS = ['Capa de piel de gargantúa', 'Arnés de cuero'];

  it('bug real jugando en vivo (2026-08-13, revisar partida): detecta un cambio de equipo narrado sin pedirlo, en un simple turno de viaje', () => {
    const narration =
      'Gorhorn arranca la capa de piel de gargantúa y la atóona a su cintura como una falda, revelando su pecho descubierto.';
    expect(hasFalseEquipmentChangeClaim(narration, ITEMS)).toBe(true);
  });

  it('detecta "ata"/"desata"/"ciñe"/"reviste" junto al nombre real del objeto', () => {
    expect(hasFalseEquipmentChangeClaim('Gorhorn se ata la capa de piel de gargantúa a la cintura.', ITEMS)).toBe(true);
    expect(hasFalseEquipmentChangeClaim('Gorhorn desata la capa de piel de gargantúa y la deja caer.', ITEMS)).toBe(true);
    expect(hasFalseEquipmentChangeClaim('Gorhorn se ciñe la capa de piel de gargantúa sobre los hombros.', ITEMS)).toBe(true);
    expect(hasFalseEquipmentChangeClaim('Gorhorn se reviste con la capa de piel de gargantúa antes de partir.', ITEMS)).toBe(true);
  });

  it('no dispara con "se pone"/"se quita" sueltos, sin nombrar ningún objeto real (demasiado genéricos)', () => {
    expect(hasFalseEquipmentChangeClaim('Gorhorn se pone en pie de un salto, furioso.', ITEMS)).toBe(false);
    expect(hasFalseEquipmentChangeClaim('Gorhorn se quita de en medio justo a tiempo.', ITEMS)).toBe(false);
  });

  it('no dispara si el verbo y el objeto están en frases distintas', () => {
    expect(hasFalseEquipmentChangeClaim('Gorhorn ata su montura al poste. Lleva la capa de piel de gargantúa sobre los hombros.', ITEMS)).toBe(false);
  });

  it('no dispara sin lista de objetos equipables (materia prima/recursos, o inventario vacío)', () => {
    const narration = 'Gorhorn arranca la capa de piel de gargantúa y la ata a su cintura.';
    expect(hasFalseEquipmentChangeClaim(narration, [])).toBe(false);
    expect(hasFalseEquipmentChangeClaim(narration, undefined)).toBe(false);
  });
});

// Categoría nueva sin guard hasta ahora (análisis de cierre de partida, 2026-08-28, FASE 1: "dar
// un objeto a un NPC no lo retira del inventario del jugador") — este juego no tiene mecánica de
// "entregar objeto", el InventoryItem nunca se retira sea lo que sea que narre el modelo.
describe('hasFalseItemGivenAway', () => {
  const ITEMS = ['Cuchillo de hielo sílice', 'Arnés de cuero'];

  it('bug real jugando en vivo (2026-08-28, análisis de cierre de partida): detecta la entrega de un objeto real a un NPC', () => {
    const narration =
      'Con un gesto seguro, le entrega su cuchillo de hielo sílice y dice: «Toma esto, quizás te ayude a mantenerlos a raya.»';
    expect(hasFalseItemGivenAway(narration, ITEMS)).toBe(true);
  });

  it('detecta "le da"/"le pasa"/"le ofrece"/"le tiende" junto al nombre real del objeto', () => {
    expect(hasFalseItemGivenAway('Gorhorn le da el cuchillo de hielo sílice sin dudarlo.', ITEMS)).toBe(true);
    expect(hasFalseItemGivenAway('Gorhorn le pasa el cuchillo de hielo sílice por encima de la mesa.', ITEMS)).toBe(true);
    expect(hasFalseItemGivenAway('Gorhorn le ofrece el cuchillo de hielo sílice como muestra de confianza.', ITEMS)).toBe(true);
    expect(hasFalseItemGivenAway('Gorhorn le tiende el cuchillo de hielo sílice con cuidado.', ITEMS)).toBe(true);
  });

  it('no dispara con "le da" sin nombrar ningún objeto real (demasiado genérico, o sobre otra cosa)', () => {
    expect(hasFalseItemGivenAway('Gorhorn le da un golpe seco en el hombro.', ITEMS)).toBe(false);
    expect(hasFalseItemGivenAway('Gorhorn le da las gracias por la ayuda.', ITEMS)).toBe(false);
  });

  it('no dispara si el verbo y el objeto están en frases distintas', () => {
    expect(hasFalseItemGivenAway('Gorhorn le da las gracias. Lleva el cuchillo de hielo sílice al cinto.', ITEMS)).toBe(false);
  });

  it('no dispara sin lista de objetos equipables (materia prima/recursos, o inventario vacío)', () => {
    const narration = 'Gorhorn le entrega su cuchillo de hielo sílice.';
    expect(hasFalseItemGivenAway(narration, [])).toBe(false);
    expect(hasFalseItemGivenAway(narration, undefined)).toBe(false);
  });
});

// Categoría nueva sin guard hasta ahora (auditoría de código 2026-08-25): "descansar" libre pasa
// por el LLM, pero el techo real de curación lo calcula healCeilingFor de forma determinista.
describe('hasFalseHealingClaim', () => {
  it('detecta una recuperación completa prometida cuando el techo real queda por debajo de ILESO', () => {
    expect(hasFalseHealingClaim('Gorhorn descansa un rato y queda completamente sano, como nuevo.', true)).toBe(true);
    expect(hasFalseHealingClaim('Tras el descanso, se recupera del todo y sigue camino.', true)).toBe(true);
    expect(hasFalseHealingClaim('Al despertar, sin ninguna herida en el cuerpo, sigue camino.', true)).toBe(true);
  });

  it('no dispara con una descripción honesta del descanso (mejora parcial, sigue con molestias)', () => {
    const narration = 'Gorhorn descansa un rato junto al fuego y recupera algo de fuerza, aunque las heridas siguen ahí.';
    expect(hasFalseHealingClaim(narration, true)).toBe(false);
  });

  it('no dispara fuera de este escenario concreto (restHealCeilingBelowIleso false/undefined — el techo real SÍ llega a ILESO, o no es un turno de descanso)', () => {
    expect(hasFalseHealingClaim('Gorhorn queda completamente sano, como nuevo.', false)).toBe(false);
    expect(hasFalseHealingClaim('Gorhorn queda completamente sano, como nuevo.', undefined)).toBe(false);
  });
});

// Categoría nueva sin guard hasta ahora (auditoría de código 2026-08-25): caso inverso de
// hasFalseItemUse — protege la OBTENCIÓN falsa de un objeto, no el consumo falso.
describe('hasFalseNewItemClaim', () => {
  const CATALOG = ['Cuchillo de hielo sílice', 'Tótem Maktor'];

  it('detecta que el personaje se queda con/guarda un objeto cuyo nombre no coincide con ningún ItemCatalog real', () => {
    expect(hasFalseNewItemClaim('Gorhorn guarda la Daga de Hueso curtida en su cinto.', 'Daga de Hueso curtida', CATALOG)).toBe(true);
    expect(hasFalseNewItemClaim('Gorhorn se queda con el amuleto encontrado entre las rocas.', 'Amuleto de las rocas', CATALOG)).toBe(true);
  });

  it('no dispara si el nombre propuesto SÍ coincide con el catálogo real (se materializará de verdad)', () => {
    expect(hasFalseNewItemClaim('Gorhorn guarda el cuchillo de hielo sílice en su cinto.', 'Cuchillo de hielo sílice', CATALOG)).toBe(false);
  });

  it('no dispara sin newItem propuesto, o sin lista de catálogo (turno sin newItem)', () => {
    expect(hasFalseNewItemClaim('Gorhorn guarda la daga en su cinto.', null, CATALOG)).toBe(false);
    expect(hasFalseNewItemClaim('Gorhorn guarda la daga en su cinto.', undefined, CATALOG)).toBe(false);
    expect(hasFalseNewItemClaim('Gorhorn guarda la daga en su cinto.', 'Daga de Hueso curtida', undefined)).toBe(false);
  });

  it('no dispara con una mención de pasada, sin verbo de posesión explícito', () => {
    expect(hasFalseNewItemClaim('Gorhorn observa la Daga de Hueso curtida, tirada entre las rocas.', 'Daga de Hueso curtida', CATALOG)).toBe(false);
  });
});

// Hallazgo real jugando en vivo (2026-08-28): "Recolecto más materiales de la zona antes de
// descansar." narrado como una recolección exitosa ("Encontrado un par de hojas duraderas, las
// añade a sus raciones") pese a que el turno no tenía ningún camino mecánico de recolección/
// saqueo activo y el modelo tampoco rellenó `newItem` — `hasFalseNewItemClaim` no lo cazaba
// porque solo mira `newItem`, y aquí quedó `null`.
describe('hasFalsePassiveHarvestClaim', () => {
  it('bug real jugando en vivo (2026-08-28): detecta la promesa de obtención sin ningún camino mecánico activo ni newItem', () => {
    const narration = 'Gorhorn se agacha junto a una veta de yerreo y recoge un par de hojas duraderas, las añade a sus raciones para el viaje.';
    expect(hasFalsePassiveHarvestClaim(narration, null, false)).toBe(true);
    expect(hasFalsePassiveHarvestClaim(narration, undefined, undefined)).toBe(true);
  });

  it('no dispara si ya hay un camino mecánico real de obtención activo este turno (recolección/saqueo/construcción/crafteo)', () => {
    const narration = 'Gorhorn recoge un par de hojas duraderas y las añade a sus raciones para el viaje.';
    expect(hasFalsePassiveHarvestClaim(narration, null, true)).toBe(false);
  });

  it('no dispara si el modelo SÍ rellenó newItem (lo cubre hasFalseNewItemClaim en su lugar)', () => {
    const narration = 'Gorhorn recoge un par de hojas duraderas y las añade a sus raciones para el viaje.';
    expect(hasFalsePassiveHarvestClaim(narration, 'Hojas duraderas', false)).toBe(false);
  });

  it('no dispara sin vocabulario de obtención en la narración', () => {
    expect(hasFalsePassiveHarvestClaim('Gorhorn descansa junto al fuego, atento a los ruidos de la noche.', null, false)).toBe(false);
  });
});

// Revisión de partida real (2026-08-14, "ataque a Múrgol narrado como si fuera contra
// Cruzavientos"): la capa determinista resolvió bien (XP, NpcState), pero la prosa nombró a otro
// NPC presente en la escena en vez del objetivo real del intercambio.
describe('hasFalseCombatTargetName', () => {
  it('bug real jugando en vivo (2026-08-14): detecta que la narración nombra a otro NPC de la escena en vez del objetivo real', () => {
    const narration =
      'El Cruzavientos se mete en medio de la huida del matorral de cuerno, haciendo que las hojas caigan sobre su piel.';
    expect(hasFalseCombatTargetName(narration, 'Múrgol', ['Cruzavientos'])).toBe(true);
  });

  it('no dispara si la narración nombra al objetivo real (aunque también mencione a otros de pasada)', () => {
    const narration = 'Gorhorn golpea al Múrgol con fuerza, mientras un Cruzavientos sobrevuela la escena sin intervenir.';
    expect(hasFalseCombatTargetName(narration, 'Múrgol', ['Cruzavientos'])).toBe(false);
  });

  it('no dispara sin objetivo real (sin intercambio resuelto este turno) ni sin otros NPC en escena', () => {
    expect(hasFalseCombatTargetName('Gorhorn golpea al enemigo.', undefined, ['Cruzavientos'])).toBe(false);
    expect(hasFalseCombatTargetName('Gorhorn golpea al enemigo.', 'Múrgol', [])).toBe(false);
    expect(hasFalseCombatTargetName('Gorhorn golpea al enemigo.', 'Múrgol', undefined)).toBe(false);
  });

  it('no dispara si la narración no nombra a NADIE (prosa genérica, sin evidencia de confusión)', () => {
    expect(hasFalseCombatTargetName('Gorhorn golpea con fuerza a su rival.', 'Múrgol', ['Cruzavientos'])).toBe(false);
  });
});

// Hallazgo real jugando en vivo (2026-08-28/29): encabezado mecánico "KIRELON ARENOSO ATACA CON
// 'CAZA POR VIBRACIÓN'" pero la prosa narró "El Quio retrocede gruñendo ante el ataque de
// Gorhorn" — Quio era el rival de un combate ANTERIOR de la misma sesión, ya ausente de la
// escena actual, así que `hasFalseCombatTargetName` (que solo mira NPCs presentes a la vez) no
// lo cazaba.
describe('hasWrongNpcName', () => {
  it('bug real jugando en vivo (2026-08-28/29): detecta que la narración nombra a un NPC de un combate anterior de la sesión, ausente de la escena actual', () => {
    const narration = 'El Quio retrocede gruñendo ante el ataque de Gorhorn.';
    expect(hasWrongNpcName(narration, 'Kirelon Arenoso', ['Quio'])).toBe(true);
  });

  it('no dispara si la narración nombra al rival real (aunque también mencione de pasada a un NPC de un combate anterior)', () => {
    const narration = 'Kirelon Arenoso retrocede gruñendo ante el ataque de Gorhorn, que recuerda vagamente su pelea con Quio.';
    expect(hasWrongNpcName(narration, 'Kirelon Arenoso', ['Quio'])).toBe(false);
  });

  it('no dispara sin objetivo real ni lista de NPCs previos de la partida', () => {
    expect(hasWrongNpcName('Gorhorn golpea al enemigo.', undefined, ['Quio'])).toBe(false);
    expect(hasWrongNpcName('Gorhorn golpea al enemigo.', 'Kirelon Arenoso', [])).toBe(false);
    expect(hasWrongNpcName('Gorhorn golpea al enemigo.', 'Kirelon Arenoso', undefined)).toBe(false);
  });
});

describe('hasWrongAggressorName', () => {
  it('bug real jugando en vivo (2026-08-30, "Exploro la zona" narró a Quio — INOFENSIVO por catálogo — como agresor mientras el combate real se abrió contra Kirelon Arenoso): detecta "combateIniciado" contra un NPC que no puede ser agresor', () => {
    expect(hasWrongAggressorName(['quio'], ['quio', 'imanio'])).toBe(true);
  });

  it('no dispara si "combateIniciado" solo incluye NPCs realmente hostiles', () => {
    expect(hasWrongAggressorName(['kirelon-arenoso'], ['quio', 'imanio'])).toBe(false);
  });

  it('no dispara sin propuesta de combate, sin lista de no-hostiles, o con listas vacías', () => {
    expect(hasWrongAggressorName(undefined, ['quio'])).toBe(false);
    expect(hasWrongAggressorName(null, ['quio'])).toBe(false);
    expect(hasWrongAggressorName([], ['quio'])).toBe(false);
    expect(hasWrongAggressorName(['kirelon-arenoso'], [])).toBe(false);
    expect(hasWrongAggressorName(['kirelon-arenoso'], undefined)).toBe(false);
  });
});

describe('hasFalseTravelClaim', () => {
  it('bug real jugando en vivo (2026-08-06, auditoría "revisa la partida" en directo): detecta una llegada narrada a un destino sin resolver mecánicamente', () => {
    const narration = {
      narration: 'Gorhorn se arrastra lentamente hacia los Pilares Rotos, cada paso una lucha contra su propia debilidad.',
      newFacts: ['Gorhorn ha dejado la Hondonada del Eco y avanza hacia los Pilares Rotos.'],
    };
    expect(hasFalseTravelClaim(narration, ['El Pozo de Cauce Viejo', 'Pilares Rotos'])).toBe(true);
  });

  it('no dispara si la lista viene vacía (viaje resuelto de verdad, un solo destino, o no era movimiento vago)', () => {
    const narration = { narration: 'Gorhorn llega a los Pilares Rotos tras una larga caminata.', newFacts: [] };
    expect(hasFalseTravelClaim(narration, [])).toBe(false);
    expect(hasFalseTravelClaim(narration, undefined)).toBe(false);
  });

  it('no dispara si el modelo pregunta cuál de los caminos elegir, sin narrar ninguna llegada', () => {
    const narration = {
      narration: 'Gorhorn se detiene donde el camino se bifurca: uno lleva al Pozo de Cauce Viejo, el otro a los Pilares Rotos. ¿Hacia dónde sigue?',
      newFacts: [],
    };
    expect(hasFalseTravelClaim(narration, ['El Pozo de Cauce Viejo', 'Pilares Rotos'])).toBe(false);
  });

  it('no dispara si el destino mencionado no está entre los ambiguos de este turno', () => {
    const narration = { narration: 'Gorhorn recuerda su paso por los Pilares Rotos hace tiempo.', newFacts: [] };
    expect(hasFalseTravelClaim(narration, ['El Pozo de Cauce Viejo'])).toBe(false);
  });
});

describe('hasFalsePhantomTravel', () => {
  it('bug real jugando por API (2026-08-11, "pruebas por API"): detecta que abandona la ubicación actual sin ningún viaje resuelto (destino inventado, "hacia el norte" no es ningún alias real)', () => {
    const narration = {
      narration: 'Gorhorn sale de la hondonada, caminando firme hacia el norte, alejándose del orco.',
      newFacts: [],
    };
    // El nombre completo Y sus alias reales, mismo criterio que turnResolution.ts pasa de verdad
    // (`[location.name, ...location.aliases]`) — el modelo suele usar la forma corta.
    expect(hasFalsePhantomTravel(narration, ['La Hondonada del Eco', 'hondonada', 'el eco'])).toBe(true);
  });

  it('también dispara si la mentira vive en newFacts, aunque la prosa sea más comedida', () => {
    const narration = {
      narration: 'Gorhorn se aleja con cautela, sin perder de vista el horizonte.',
      newFacts: ['Gorhorn ha dejado La Hondonada del Eco.'],
    };
    expect(hasFalsePhantomTravel(narration, ['La Hondonada del Eco'])).toBe(true);
  });

  it('no dispara si la lista viene vacía (viaje resuelto de verdad, o esta acción no era de movimiento)', () => {
    const narration = { narration: 'Gorhorn sale de la hondonada hacia el norte.', newFacts: [] };
    expect(hasFalsePhantomTravel(narration, [])).toBe(false);
    expect(hasFalsePhantomTravel(narration, undefined)).toBe(false);
  });

  it('no dispara con una narración que se queda en el sitio, sin verbo de abandono', () => {
    const narration = { narration: 'Gorhorn mira hacia el norte, pensativo, sin moverse todavía.', newFacts: [] };
    expect(hasFalsePhantomTravel(narration, ['La Hondonada del Eco'])).toBe(false);
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

describe('buildNarrationPrompt — narrar inconsciencia (docs/19-post-combate-y-recompensas-mision.md, pieza 1)', () => {
  const baseCtx = { worldFacts: [], characterSummary: 'Gorhorn', action: 'Ataco', enCombate: true };

  it('pide explícitamente narrarlo CONVALECIENTE (vivo, rematable) cuando npcFallsConvalecienteThisTurn es true', () => {
    const { prompt } = buildNarrationPrompt({ ...baseCtx, npcFallsUnconsciousThisTurn: true, npcFallsConvalecienteThisTurn: true });
    expect(prompt).toMatch(/CONVALECIENTE \(no MUERTO\)/);
    expect(prompt).toMatch(/NUNCA lo narres inconsciente/);
  });

  // Grupo que continúa (auditoría 2026-08-22, "revisa la partida otra vez"): `npcFallsConvalecienteThisTurn`
  // ya sale false para un individuo de grupo que auto-continúa a ILESO este mismo turno (ver
  // `grupoContinuaEsteTurno` en turnResolution.ts) — no hay ocasión real de rematarlo después, así
  // que aquí (igual que en MUERTO real) se narra como definitivo, nunca como "sigue con vida".
  it('pide narrarlo como definitivo (nunca "sigue vivo") cuando npcFallsConvalecienteThisTurn es false — cubre tanto MUERTO real como un individuo de grupo que auto-continúa', () => {
    const { prompt } = buildNarrationPrompt({ ...baseCtx, npcFallsUnconsciousThisTurn: true, npcFallsConvalecienteThisTurn: false });
    expect(prompt).toMatch(/acaba con este rival para siempre/);
    expect(prompt).not.toMatch(/NUNCA lo narres inconsciente/);
  });

  it('no añade ninguna instrucción especial en un turno de combate normal', () => {
    const { prompt } = buildNarrationPrompt({ ...baseCtx, npcFallsUnconsciousThisTurn: false });
    expect(prompt).not.toMatch(/CONVALECIENTE \(no MUERTO\)/);
    expect(prompt).not.toMatch(/acaba con este rival para siempre/);
  });
});

// Contradicción real encontrada jugando en vivo (2026-08-22, "Salgo a cazar y ataco a 'Buitre
// Cenizo'." narró un golpe conectado en el turno que INICIA combate): `ambushHint` (gradoExito
// 'claro') decía "actúa/golpea primero" en el MISMO prompt donde `combatNotYetResolved` prohíbe
// explícitamente narrar un golpe conectado — y ambas condiciones se activan siempre juntas para
// cualquier primer ataque libre contra un NPC todavía sin combate mecánico abierto (`enCombate`
// false). Se reescribió para hablar de ventaja de posición/iniciativa, nunca de contacto ya
// resuelto.
describe('buildNarrationPrompt — emboscada (ambushHint) ya no contradice a combatNotYetResolved (2026-08-22)', () => {
  const hostileCtx = {
    worldFacts: [],
    characterSummary: 'Gorhorn',
    action: "Salgo a cazar y ataco a 'Buitre Cenizo'.",
    enCombate: false,
    npcSlugsInScene: ['buitre-cenizo'],
    roll: { attribute: 'destreza' as const, value: 12, roll: 19, result: 25, difficulty: 15, success: true, gradoExito: 'claro' as const },
  };

  it('con gradoExito claro, ya no dice "golpea primero" — habla de ventaja de posición y prohíbe explícitamente narrar contacto', () => {
    const { prompt } = buildNarrationPrompt(hostileCtx);
    expect(prompt).not.toMatch(/golpea primero/);
    expect(prompt).toMatch(/NO describas ningún golpe ya conectado/);
  });

  it('con gradoExito fallo, ya no implica que el NPC ya actuó/golpeó — prohíbe explícitamente narrar un golpe ya recibido', () => {
    const { prompt } = buildNarrationPrompt({ ...hostileCtx, roll: { ...hostileCtx.roll, result: 10, gradoExito: 'fallo' as const } });
    expect(prompt).toMatch(/NO describas ningún golpe ya recibido/);
  });

  it('fuera de un enfrentamiento hostil (sin NPC en escena), no añade ningún hint de emboscada', () => {
    const { prompt } = buildNarrationPrompt({ ...hostileCtx, npcSlugsInScene: [] });
    expect(prompt).not.toMatch(/SORPRENDE/);
  });
});
