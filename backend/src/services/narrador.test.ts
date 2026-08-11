import { describe, it, expect } from 'vitest';
import {
  reinoIntentDetected,
  stripLeakedJson,
  stripNonLatinScript,
  deterministicFallbackNarration,
  isTooSimilarToLast,
  hasEnglishLeak,
  hasFalseCombatHit,
  hasPrematureCombatResolution,
  hasFalseItemUse,
  hasFalseInventoryReview,
  hasResurrectedDeadNpc,
  hasGisteraReencuentroSinNombrar,
  hasFalseTravelClaim,
  hasFalsePhantomTravel,
  hasAnachronism,
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

  it('no dispara si la lista viene vacía (ningún NPC incapacitado/muerto en escena este turno)', () => {
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
