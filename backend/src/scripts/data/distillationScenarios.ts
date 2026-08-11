/// Banco de escenarios para el pipeline de destilación (plan "IA local propia", 2026-08-07) —
/// ver generate-distillation-dataset.ts. Cada escenario es un TurnContext realista, grounded en
/// datos REALES del catálogo (worldCatalog.ts): nunca se inventa a mano un slug/nombre de NPC o
/// ubicación, para no arrastrar lore falso al propio material de entrenamiento. Los NPC en escena
/// se construyen con la función real `npcSceneBlockFor` (npcScene.ts) para que el profesor cloud
/// reciba el mismo texto exacto que produce Ollama en producción, no una aproximación a mano.
///
/// Para ampliar el dataset: añadir más `ScenarioSeed` a `SEEDS` (o más `actionVariants`/
/// `rollVariants` a uno ya existente) — la expansión combinatoria de abajo hace el resto.

import type { Attribute, AttributeBlock, GradoExito, RollResult } from '../../services/dice.js';
import { npcSceneBlockFor, type NpcInScene } from '../../services/npcScene.js';
import type { Banda } from '../../services/narrador.js';
import { npcs, fauna, locations, type NpcInput } from '../worldCatalog.js';

// item_falso_bait/combate_prematuro_bait/repeticion_bait añadidas (2026-08-07, "barrido completo
// otra vez"): hasFalseItemUse/hasPrematureCombatResolution/isTooSimilarToLast son detectores REALES
// de narrador.ts que protegen la partida en producción hoy mismo, pero hasta ahora ningún seed del
// banco los ejercitaba — cero cobertura de entrenamiento para esas 3 clases de bug ya cazadas
// jugando en vivo, no solo "pocos ejemplos" en categorías existentes.
export type ScenarioCategory =
  | 'exploracion'
  | 'combate'
  | 'dialogo'
  | 'viaje'
  | 'crafteo'
  | 'descanso'
  | 'anacronismo_bait'
  | 'npc_muerto_bait'
  | 'item_falso_bait'
  | 'combate_prematuro_bait'
  | 'repeticion_bait';

/// Mismo personaje y resumen que ya usa test-turn.ts (el único script manual existente que ya
/// prueba turnos reales) — no se importa de ahí porque ese fichero ejecuta su propio main() al
/// cargarse, así que se duplica el texto (dato plano, no lógica) para mantener la consistencia.
const GORHORN_ATTRIBUTES: AttributeBlock = { fuerza: 10, destreza: 6, constitucion: 7, inteligencia: 7, voluntad: 8, carisma: 6, arcano: 2 };
const GORHORN_SUMMARY =
  'Gorhorn, guerrero orco, único superviviente del clan Maktor, aniquilado como carne de cañón por el mando Goirntes en la Concordia de Hierro. Viaja solo por las Llanuras del Viento Rojo buscando una forma de que la muerte de su clan signifique algo.';
const GORHORN_LEVEL = 1;

function locationFact(slug: string, extra?: string): string {
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) throw new Error(`[distillationScenarios] ubicación desconocida: ${slug}`);
  return `Gorhorn está en ${loc.name} (${loc.region}).${extra ? ` ${extra}` : ''}`;
}

function npcInSceneFromCatalog(npc: NpcInput, overrides: Partial<NpcInScene> = {}): NpcInScene {
  return {
    id: npc.slug,
    slug: npc.slug,
    name: npc.name,
    articulo: npc.articulo ?? null,
    genero: npc.genero ?? null,
    kind: npc.kind,
    level: npc.level,
    role: npc.role,
    faction: npc.faction,
    personality: npc.personality,
    bio: npc.bio,
    items: [],
    attributes: npc.attributes,
    raza: npc.raza ?? null,
    clase: npc.clase ?? null,
    ataqueNatural: npc.ataqueNatural ?? null,
    habilidadesRaciales: npc.habilidadesRaciales ?? [],
    temperamento: npc.temperamento ?? 'CAUTELOSO',
    condicionFisica: 'ILESO',
    saqueado: false,
    lootedItemNames: [],
    energia: null,
    analizado: false,
    ...overrides,
  };
}

function npcBySlug(slug: string): NpcInput {
  const npc = [...npcs, ...fauna].find((n) => n.slug === slug);
  if (!npc) throw new Error(`[distillationScenarios] NPC desconocido: ${slug}`);
  return npc;
}

/// Tirada determinista para un grado de éxito concreto — no usa rollCheck real (que tira dados de
/// verdad) porque aquí interesa reproducibilidad: el mismo escenario siempre genera la misma
/// tirada, para poder comparar ejecuciones del pipeline entre sí.
function makeRoll(attribute: Attribute, gradoExito: GradoExito): RollResult {
  const value = GORHORN_ATTRIBUTES[attribute];
  const difficulty = 12;
  const result = gradoExito === 'claro' ? difficulty + 6 : gradoExito === 'con_coste' ? difficulty + 1 : difficulty - 4;
  const roll = Math.max(1, Math.min(20, result - Math.floor(value / 2)));
  return { attribute, value, roll, result, difficulty, success: gradoExito !== 'fallo', gradoExito };
}

interface RollSpec {
  attribute: Attribute;
  gradoExito: GradoExito;
}

interface ScenarioBase {
  worldFacts: string[];
  characterSummary: string;
  enCombate?: boolean;
  npcSlugsInScene?: string[];
  banda?: Banda;
  combatBothMissed?: boolean;
  possiblyResurrectedNpcNames?: string[];
  possiblyFalseTravelDestinationNames?: string[];
  /// Mismos 3 campos que TurnContext (narrador.ts) para los detectores hasta ahora sin cobertura.
  possiblyFalseItemUseNames?: string[];
  combatNotYetResolved?: boolean;
  lastNarrationText?: string;
}

interface ScenarioSeed {
  id: string;
  category: ScenarioCategory;
  base: ScenarioBase;
  actionVariants: string[];
  rollVariants: (RollSpec | null)[];
}

export interface DistillationScenario {
  id: string;
  category: ScenarioCategory;
  ctx: ScenarioBase & { action: string; roll?: RollResult };
}

const corretolvasInScene = npcInSceneFromCatalog(npcBySlug('corretolvas'));
const orcoEnfurecidoInScene = npcInSceneFromCatalog(npcBySlug('orco-enfurecido-hondonada'));
const orcoEnfurecidoMuertoInScene = npcInSceneFromCatalog(npcBySlug('orco-enfurecido-hondonada'), { condicionFisica: 'MUERTO', saqueado: true });
const gisteraInScene = npcInSceneFromCatalog(npcBySlug('gistera-koh'));

// Ampliación (2026-08-07, "ampliar el dataset primero") — más fauna/NPCs reales del núcleo de
// las Llanuras, para que la diversidad de escenarios venga de situaciones genuinamente distintas
// y no solo de reformular las mismas 11 semillas originales.
const aulladorInScene = npcInSceneFromCatalog(npcBySlug('aullador-rojo'));
const gargantuaInScene = npcInSceneFromCatalog(npcBySlug('gargantua-de-ceniza'));
const rondadorInScene = npcInSceneFromCatalog(npcBySlug('rondador-de-brasas'));
const salamandraInScene = npcInSceneFromCatalog(npcBySlug('salamandra-de-escoria'));
const orcoRezagadoInScene = npcInSceneFromCatalog(npcBySlug('orco-rezagado'));
const orcoRezagadoMuertoInScene = npcInSceneFromCatalog(npcBySlug('orco-rezagado'), { condicionFisica: 'MUERTO', saqueado: true });
const soldadoInScene = npcInSceneFromCatalog(npcBySlug('soldado-concordia'));
const soldadoMuertoInScene = npcInSceneFromCatalog(npcBySlug('soldado-concordia'), { condicionFisica: 'MUERTO', saqueado: true });
const torgashInScene = npcInSceneFromCatalog(npcBySlug('torgash'));
const ulkhaInScene = npcInSceneFromCatalog(npcBySlug('ulkha'));
const mercaderInScene = npcInSceneFromCatalog(npcBySlug('mercader-de-paso'));
const oficialConcordiaInScene = npcInSceneFromCatalog(npcBySlug('oficial-concordia'));
const peregrinoInScene = npcInSceneFromCatalog(npcBySlug('peregrino-de-los-tumulos'));
const cazadorSerhuInScene = npcInSceneFromCatalog(npcBySlug('cazador-serhu'));

// Ampliación (2026-08-07, "barrido completo" tras encontrar que las 3 regresiones de la primera
// tanda de fine-tuning cayeron justo en las categorías con menos ejemplos — ver
// tarkor_rediseno_profesiones... no, ver memoria del propio entrenamiento): más fauna sin usar
// todavía en el banco (canizor, cruzavientos) + dos variantes "ya muerto" nuevas de PLANTILLAs
// desechables (cazador-serhu, oficial-concordia) para diversificar npc_muerto_bait sin tocar a
// ningún PRINCIPAL vivo relevante para la trama (Torgash/Ulkha/Gistera siguen vivos en todo
// momento, solo se les hace MENCIONAR a un tercero ya muerto en las semillas de diálogo nuevas).
const canizorInScene = npcInSceneFromCatalog(npcBySlug('canizor'));
const cruzavientosInScene = npcInSceneFromCatalog(npcBySlug('cruzavientos'));
const cazadorSerhuMuertoInScene = npcInSceneFromCatalog(npcBySlug('cazador-serhu'), { condicionFisica: 'MUERTO', saqueado: true });
const oficialConcordiaMuertoInScene = npcInSceneFromCatalog(npcBySlug('oficial-concordia'), { condicionFisica: 'MUERTO', saqueado: true });
// Última fauna sin usar en el banco (corredor de cauce, buitre cenizo, múrgol) — INOFENSIVO no
// significa "sin semilla de combate", corretolvas ya prueba que se caza fauna dócil (caza real,
// no dueleo) desde el principio del banco.
const corredorCauceInScene = npcInSceneFromCatalog(npcBySlug('corredor-de-cauce'));
const buitreCenizoInScene = npcInSceneFromCatalog(npcBySlug('buitre-cenizo'));
const murgolInScene = npcInSceneFromCatalog(npcBySlug('murgol'));

const SEEDS: ScenarioSeed[] = [
  // ── exploración (sin NPC — cualquier fauna/NPC inventado aquí es un rechazo automático) ──
  {
    id: 'exploracion-hondonada',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('hondonada-del-eco', 'Es de día. No hay ningún peligro conocido en la zona ahora mismo.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Exploro la hondonada en busca de algo útil.',
      'Reviso los alrededores con cuidado, atento a cualquier peligro.',
      'Camino despacio, fijándome en las paredes de arcilla.',
      'Busco algo que se me haya podido pasar por alto la última vez que estuve aquí.',
    ],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'inteligencia', gradoExito: 'fallo' }],
  },
  {
    id: 'exploracion-pozo',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo', 'Está anocheciendo.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Busco un lugar seguro para acampar junto al pozo.',
      'Inspecciono el pozo en busca de un buen sitio donde pasar la noche.',
      'Reviso la zona antes de instalarme a descansar.',
    ],
    rollVariants: [null, { attribute: 'constitucion', gradoExito: 'claro' }],
  },
  {
    id: 'exploracion-agujas',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('agujas-iman', 'El sentido de la orientación se pierde entre las rocas negras imantadas.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino las rocas imantadas de cerca.', 'Busco el Cardo Brújula del que había oído hablar.', 'Avanzo entre las rocas con cuidado de no perder el rumbo.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'con_coste' }],
  },
  {
    id: 'exploracion-cruce',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas', 'El polvo volcánico cubre el suelo hasta los tobillos.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Reviso el cruce en busca de restos de viajeros anteriores.', 'Examino las cenizas por si hay algo enterrado.', 'Avanzo con cuidado, atento al terreno inestable.', 'Busco alguna señal de qué camino han tomado otros antes que yo.'],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'destreza', gradoExito: 'fallo' }],
  },
  {
    id: 'exploracion-filo',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('filo-de-las-brasas', 'El calor del suelo se nota incluso a través de las botas.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino las grietas por donde escapa el calor.', 'Busco un paso seguro entre las brasas.', 'Reviso la zona con cuidado de no quemarme.'],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'con_coste' }],
  },
  {
    id: 'exploracion-osario',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('osario-de-la-manada', 'Huesos viejos, blanqueados por el sol, se acumulan entre la hierba.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino los huesos esparcidos por el suelo.', 'Busco algo útil entre los restos.', 'Reviso la zona en busca de pistas sobre qué pasó aquí.', 'Camino despacio entre los huesos, atento a cualquier movimiento.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'claro' }],
  },
  {
    id: 'exploracion-pastos',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('pastos-de-la-deriva', 'La hierba rojiza se mece con el viento constante de la llanura.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Recorro los pastos buscando rastros de fauna reciente.', 'Examino el terreno en busca de un buen lugar de caza.', 'Avanzo entre la hierba alta con cuidado.'],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'destreza', gradoExito: 'fallo' }],
  },
  {
    id: 'exploracion-tumulos',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('tumulos-del-honor', 'Los montículos de piedra apilada marcan a los caídos de los clanes.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Recorro los túmulos en silencio, respetando a los caídos.', 'Examino las marcas de clan grabadas en las piedras.', 'Busco si hay algún túmulo reciente.'],
    rollVariants: [null],
  },

  // ── exploración, segunda tanda (2026-08-07, "barrido completo otra vez") — ubicaciones de la
  // tercera ampliación del mapa (costa, desierto profundo) que hasta ahora no tenían NINGÚN
  // escenario, ni de exploración ni de ningún otro tipo ──
  {
    id: 'exploracion-oasis',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('oasis-de-juncos-rojos', 'Agua en superficie de verdad, disputada entre clanes y fauna.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Reviso el oasis en busca de algo útil.', 'Examino los juncos rojos con cuidado.', 'Busco rastros de quién ha pasado por aquí antes.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'claro' }],
  },
  {
    id: 'exploracion-desembocadura',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('desembocadura-callada', 'La corriente subterránea aflora al fin al mar, entre juncos y barro.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino la marisma en busca de algo útil.', 'Reviso el barro por si hay restos interesantes.', 'Avanzo con cuidado entre los juncos.'],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'con_coste' }],
  },
  {
    id: 'exploracion-playa-ceniza',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('playa-de-ceniza-blanca', 'Franja de arena clara entre dos brazos bajos de roca.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Recorro la playa buscando algo que el mar haya traído.', 'Examino la arena clara con calma.', 'Camino por la orilla sin prisa.'],
    rollVariants: [null],
  },
  {
    id: 'exploracion-acantilados',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('acantilados-partidos', 'El oleaje rompe con violencia bajo las grietas de la pared costera.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino las grietas del acantilado con cuidado de no resbalar.', 'Busco un paso seguro entre las cornisas.', 'Reviso los nidos de aves marinas desde lejos.'],
    rollVariants: [null, { attribute: 'destreza', gradoExito: 'fallo' }],
  },
  {
    id: 'exploracion-fosa-horadada',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('fosa-horadada', 'Decenas de bocas de túnel perforan las paredes de arena compactada — madriguera de Espina del Viento.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino las bocas de túnel sin acercarme demasiado.', 'Reviso el borde de la fosa con cuidado.', 'Busco alguna señal de actividad reciente en la fosa.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'con_coste' }],
  },
  {
    id: 'exploracion-dunas-ahogadas',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('dunas-ahogadas', 'Fragmentos de piedra tallada y metal ennegrecido asoman entre las dunas rojas.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino los fragmentos de piedra tallada que asoman en la arena.', 'Busco algo enterrado bajo las dunas.', 'Reviso la zona con cuidado del viento.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'claro' }],
  },
  {
    id: 'exploracion-vientre-engano',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('vientre-del-engano', 'Hondonada seca y estéril, donde nace la mayoría de las tormentas de arena magnética.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Examino la hondonada estéril con cautela.', 'Reviso el terreno en busca de alguna señal.', 'Avanzo con cuidado por la tierra muerta.'],
    rollVariants: [null, { attribute: 'voluntad', gradoExito: 'con_coste' }],
  },
  {
    id: 'exploracion-laberinto-canones',
    category: 'exploracion',
    base: {
      worldFacts: [locationFact('laberinto-de-canones', 'Badlands de paredes estrechas y sinuosas, fácil perderse, ecos que engañan al oído.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Avanzo con cuidado entre los cañones estrechos.', 'Examino las paredes de arcilla en busca de un atajo.', 'Reviso el terreno, atento a los ecos.'],
    rollVariants: [null, { attribute: 'inteligencia', gradoExito: 'fallo' }],
  },

  // ── combate ──
  {
    id: 'combate-corretolvas',
    category: 'combate',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(corretolvasInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['corretolvas'],
    },
    actionVariants: ['Ataco a la corretolva con mi hacha.', 'Cargo contra la corretolva antes de que escape.', 'Golpeo a la corretolva con todas mis fuerzas.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-orco',
    category: 'combate',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(orcoEnfurecidoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['orco-enfurecido-hondonada'],
    },
    actionVariants: ['Ataco al orco enfurecido con mi hacha.', 'Me lanzo contra el orco sin dudarlo.', 'Golpeo al orco antes de que reaccione.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'combate-orco-ambos-fallan',
    category: 'combate',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(orcoEnfurecidoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['orco-enfurecido-hondonada'],
      combatBothMissed: true,
    },
    actionVariants: ['Ataco al orco enfurecido, pero ninguno de los dos logra conectar.', 'Intercambio golpes con el orco sin que ninguno acierte.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'combate-aullador',
    category: 'combate',
    base: {
      worldFacts: [locationFact('pastos-de-la-deriva'), npcSceneBlockFor(aulladorInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['aullador-rojo'],
    },
    actionVariants: ['Ataco al aullador rojo antes de que llame a la jauría.', 'Golpeo al aullador con mi hacha.', 'Cargo contra el aullador rojo.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'destreza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-gargantua',
    category: 'combate',
    base: {
      worldFacts: [locationFact('osario-de-la-manada'), npcSceneBlockFor(gargantuaInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['gargantua-de-ceniza'],
    },
    actionVariants: ['Ataco a la gargantúa de ceniza con mi hacha.', 'Golpeo a la gargantúa antes de que embista.', 'Me lanzo contra la gargantúa a pesar de su tamaño.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-rondador',
    category: 'combate',
    base: {
      worldFacts: [locationFact('filo-de-las-brasas'), npcSceneBlockFor(rondadorInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['rondador-de-brasas'],
    },
    actionVariants: ['Ataco al rondador de brasas antes de que se acerque más.', 'Golpeo al rondador con mi hacha.', 'Cargo contra el rondador de brasas.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'combate-salamandra',
    category: 'combate',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas'), npcSceneBlockFor(salamandraInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['salamandra-de-escoria'],
    },
    actionVariants: ['Ataco a la salamandra de escoria con mi hacha.', 'Golpeo a la salamandra antes de que escupa fuego.', 'Me lanzo contra la salamandra.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'destreza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-orco-rezagado',
    category: 'combate',
    base: {
      worldFacts: [locationFact('tumulos-del-honor'), npcSceneBlockFor(orcoRezagadoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['orco-rezagado'],
    },
    actionVariants: ['Ataco al guerrero orco rezagado con mi hacha.', 'Golpeo al rezagado antes de que reaccione.', 'Me lanzo contra el guerrero sin clan.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-soldado',
    category: 'combate',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo'), npcSceneBlockFor(soldadoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['soldado-concordia'],
    },
    actionVariants: ['Ataco al soldado de la Concordia con mi hacha.', 'Golpeo al soldado antes de que dé la alarma.', 'Cargo contra el soldado de patrulla.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },

  // ── diálogo con NPC con nombre ──
  {
    id: 'dialogo-gistera',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(gisteraInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: false,
      npcSlugsInScene: ['gistera-koh'],
    },
    actionVariants: ['Le pregunto a Gistera Koh: "¿Quién te persigue?"', 'Le digo a Gistera Koh: "Puedes confiar en mí."', 'Le pregunto: "¿Qué te pasó con tu clan?"'],
    rollVariants: [null],
  },
  {
    id: 'dialogo-torgash',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('campamento-serhu'), npcSceneBlockFor(torgashInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['torgash'],
    },
    actionVariants: ['Le pregunto al Kort\'ikar Torgash: "¿Qué noticias hay del frente?"', 'Le digo a Torgash: "Vengo en son de paz."', 'Le pregunto a Torgash por el paradero de mi clan.'],
    rollVariants: [null, { attribute: 'carisma', gradoExito: 'claro' }],
  },
  {
    id: 'dialogo-ulkha',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('campamento-serhu'), npcSceneBlockFor(ulkhaInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['ulkha'],
    },
    actionVariants: ['Le pregunto a la Terk\'ikar Ulkha: "¿Puedo quedarme aquí una noche?"', 'Le digo a Ulkha: "Busco noticias de otros clanes."', 'Le pregunto a Ulkha por la guerra.'],
    rollVariants: [null, { attribute: 'carisma', gradoExito: 'con_coste' }],
  },
  {
    id: 'dialogo-mercader',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo'), npcSceneBlockFor(mercaderInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['mercader-de-paso'],
    },
    actionVariants: ['Le pregunto al mercader qué lleva para vender.', 'Le digo al mercader: "¿Qué noticias traes de otras tierras?"', 'Intento negociar con el mercader.'],
    rollVariants: [null, { attribute: 'carisma', gradoExito: 'claro' }],
  },
  {
    id: 'dialogo-oficial-concordia',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(oficialConcordiaInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['oficial-concordia'],
    },
    actionVariants: ['Le pregunto al oficial de la Concordia qué hace tan lejos de su territorio.', 'Le digo al oficial: "No busco pelea."', 'Le exijo al oficial que se identifique.'],
    rollVariants: [null, { attribute: 'carisma', gradoExito: 'fallo' }],
  },
  {
    id: 'dialogo-peregrino',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('tumulos-del-honor'), npcSceneBlockFor(peregrinoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['peregrino-de-los-tumulos'],
    },
    actionVariants: ['Le pregunto al peregrino a quién viene a honrar.', 'Le digo al peregrino: "Te acompaño en el duelo."', 'Le pregunto al peregrino por el camino hacia el sur.'],
    rollVariants: [null],
  },
  {
    id: 'dialogo-cazador-serhu',
    category: 'dialogo',
    base: {
      worldFacts: [locationFact('campamento-serhu'), npcSceneBlockFor(cazadorSerhuInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['cazador-serhu'],
    },
    actionVariants: ['Le pregunto al joven cazador Serhu por la caza de la zona.', 'Le digo al cazador: "¿Necesitas ayuda con algo?"', 'Le pregunto al cazador por el camino más seguro.'],
    rollVariants: [null],
  },

  // ── viaje ambiguo (2+ salidas reales, ninguna nombrada) ──
  {
    id: 'viaje-hondonada-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('hondonada-del-eco', 'Desde aquí hay caminos reales hacia El Pozo de Cauce Viejo y hacia Los Pilares Rotos.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['El Pozo de Cauce Viejo', 'Los Pilares Rotos'],
    },
    actionVariants: ['Avanzo hacia la siguiente zona.', 'Continúo camino sin rumbo fijo.', 'Sigo adelante, a ver qué encuentro.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-campamento-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('campamento-serhu', 'Desde aquí hay caminos reales hacia El Pozo de Cauce Viejo y hacia La Hondonada del Eco.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['El Pozo de Cauce Viejo', 'La Hondonada del Eco'],
    },
    actionVariants: ['Me pongo en marcha sin decidir aún el destino.', 'Salgo del campamento y sigo camino.', 'Avanzo hacia donde me lleve el viento.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-pilares-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('pilares-rotos', 'Desde aquí hay caminos reales hacia La Hondonada del Eco y hacia Las Agujas Imán.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['La Hondonada del Eco', 'Las Agujas Imán'],
    },
    actionVariants: ['Sigo camino sin rumbo fijo desde los pilares.', 'Continúo adelante, a ver qué encuentro.', 'Me alejo de los pilares sin pensarlo demasiado.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-agujas-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('agujas-iman', 'Desde aquí hay caminos reales hacia Los Pilares Rotos y hacia el Cruce de las Cenizas.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['Los Pilares Rotos', 'El Cruce de las Cenizas'],
    },
    actionVariants: ['Avanzo lejos de las rocas imantadas.', 'Prosigo camino sin destino claro.', 'Sigo adelante, dejando atrás las agujas.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-restos-maktor-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('restos-de-maktor', 'Desde aquí hay caminos reales hacia El Filo de las Brasas y hacia Los Túmulos del Honor.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['El Filo de las Brasas', 'Los Túmulos del Honor'],
    },
    actionVariants: ['Me alejo de las ruinas sin decidir aún hacia dónde.', 'Sigo camino, dejando atrás lo que queda de Maktor.', 'Avanzo sin rumbo fijo entre los cimientos quemados.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-pozo-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo', 'Desde aquí hay caminos reales hacia El Campamento del Clan Serhu y hacia Los Túmulos del Honor.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['El Campamento del Clan Serhu', 'Los Túmulos del Honor'],
    },
    actionVariants: ['Me alejo del pozo sin rumbo fijo.', 'Sigo camino tras llenar el odre de agua.', 'Continúo adelante, a ver qué encuentro.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-manaderos-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('manaderos', 'Desde aquí hay caminos reales hacia El Campamento del Clan Serhu y hacia Los Pastos de la Deriva.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['El Campamento del Clan Serhu', 'Los Pastos de la Deriva'],
    },
    actionVariants: ['Sigo camino desde los manaderos sin decidir aún hacia dónde.', 'Avanzo dejando atrás las charcas.', 'Continúo sin rumbo fijo.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-cruce-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas', 'Desde aquí hay caminos reales hacia Los Pilares Rotos y hacia El Pozo de Cauce Viejo.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['Los Pilares Rotos', 'El Pozo de Cauce Viejo'],
    },
    actionVariants: ['Me alejo del cruce sin rumbo fijo.', 'Sigo camino, dejando atrás la bifurcación.', 'Avanzo sin decidir aún hacia dónde.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-pozas-marea-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('pozas-de-marea', 'Desde aquí hay caminos reales hacia Playa de Ceniza Blanca y hacia Los Acantilados Partidos.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['Playa de Ceniza Blanca', 'Los Acantilados Partidos'],
    },
    actionVariants: ['Sigo la costa sin rumbo fijo.', 'Me alejo de las pozas de marea.', 'Continúo adelante por la orilla, a ver qué encuentro.'],
    rollVariants: [null],
  },
  {
    id: 'viaje-pastos-deriva-ambiguo',
    category: 'viaje',
    base: {
      worldFacts: [locationFact('pastos-de-la-deriva', 'Desde aquí hay caminos reales hacia Los Manaderos y hacia El Paso de los Huesos.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseTravelDestinationNames: ['Los Manaderos', 'El Paso de los Huesos'],
    },
    actionVariants: ['Avanzo entre la hierba alta sin rumbo fijo.', 'Sigo camino, dejando atrás los pastos.', 'Continúo adelante, a ver qué encuentro.'],
    rollVariants: [null],
  },

  // ── crafteo ──
  {
    id: 'crafteo-reparar',
    category: 'crafteo',
    base: {
      worldFacts: [locationFact('campamento-serhu'), 'Gorhorn lleva madera y cuero en su inventario.'],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Intento reparar mi hacha con lo que llevo encima.', 'Fabrico una antorcha de campo con lo que tengo a mano.', 'Trato de reforzar mi escudo de madera.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'crafteo-antorcha',
    category: 'crafteo',
    base: {
      worldFacts: [locationFact('hondonada-del-eco', 'Gorhorn lleva resina y leña seca en su inventario.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Fabrico una antorcha con la resina y la leña que llevo.', 'Preparo una antorcha para la noche.', 'Intento improvisar una antorcha con lo que tengo a mano.', 'Fabrico un par de antorchas de campo.'],
    rollVariants: [{ attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'destreza', gradoExito: 'fallo' }],
  },
  {
    id: 'crafteo-veneno',
    category: 'crafteo',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo', 'Gorhorn lleva raíz de fuego y espina venenosa en su inventario.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Preparo un veneno para mis armas con lo que llevo encima.', 'Intento extraer el veneno de la espina que llevo.', 'Trato de preparar algo con la raíz de fuego.'],
    rollVariants: [{ attribute: 'inteligencia', gradoExito: 'claro' }, { attribute: 'inteligencia', gradoExito: 'fallo' }],
  },
  {
    id: 'crafteo-armadura',
    category: 'crafteo',
    base: {
      worldFacts: [locationFact('osario-de-la-manada', 'Gorhorn lleva placas óseas y piel curtida en su inventario.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Refuerzo mi armadura con las placas óseas que llevo.', 'Intento coser las placas a mi peto de cuero.', 'Trato de mejorar mi protección con lo que tengo a mano.', 'Fabrico una hombrera de hueso improvisada.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },

  // ── descanso ──
  {
    id: 'descanso-herido',
    category: 'descanso',
    base: {
      worldFacts: [locationFact('hondonada-del-eco', 'Está anocheciendo.'), 'Gorhorn está HERIDO tras un combate reciente.'],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Descanso un rato para recuperarme.', 'Me tumbo a descansar junto al fuego.', 'Aprovecho para vendarme las heridas.'],
    rollVariants: [null],
  },
  {
    id: 'descanso-grave',
    category: 'descanso',
    base: {
      worldFacts: [locationFact('osario-de-la-manada'), 'Gorhorn está GRAVE tras un combate reciente, apenas puede moverse.'],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Me dejo caer para descansar, ya no puedo más.', 'Intento recuperar fuerzas como sea.', 'Busco un sitio donde tumbarme a salvo.'],
    rollVariants: [null],
  },
  {
    id: 'descanso-manaderos',
    category: 'descanso',
    base: {
      worldFacts: [locationFact('manaderos', 'El agua fresca corre entre los juncos rojizos.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Descanso junto al agua un rato.', 'Aprovecho para beber y descansar antes de seguir.', 'Me tomo un respiro junto a los manaderos.'],
    rollVariants: [null],
  },
  {
    id: 'descanso-pastos-deriva',
    category: 'descanso',
    base: {
      worldFacts: [locationFact('pastos-de-la-deriva', 'La hierba dura más aquí que en el resto de la llanura.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Descanso un rato entre la hierba alta.', 'Aprovecho el pasto abierto para acampar antes de seguir.', 'Me tumbo a descansar a cubierto de la hierba.'],
    rollVariants: [null],
  },
  {
    id: 'descanso-tumulos',
    category: 'descanso',
    base: {
      worldFacts: [locationFact('tumulos-del-honor', 'Terreno neutral y sagrado, ni Serhu ni Maktor pelearon jamás aquí.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: ['Descanso un rato entre los túmulos, en silencio.', 'Aprovecho la calma del lugar para recuperar fuerzas.', 'Me tomo un respiro respetando el terreno sagrado.'],
    rollVariants: [null],
  },

  // ── cebo de anacronismo ──
  {
    id: 'anacronismo-fuego',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('hondonada-del-eco', 'Es de noche, hace frío.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Busco algo con lo que encender fuego rápido, un mechero o algo parecido.',
      'Necesito luz — ¿tengo alguna linterna o algo eléctrico?',
      'Busco un arma de fuego entre mis cosas.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-metal',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('campamento-serhu')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Pregunto si alguien tiene acero industrial para reforzar mi hacha.',
      'Busco algo de metal moderno con lo que mejorar mi arma.',
      'Pido prestado algo de hormigón para reforzar el campamento.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-comunicacion',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('pilares-rotos')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Busco algo con lo que avisar a alguien a distancia, como un teléfono.',
      '¿Tengo alguna forma de comunicarme por electricidad con el campamento?',
      'Intento usar algún aparato eléctrico para pedir ayuda.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-forja',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('campamento-serhu', 'Hay una fragua improvisada donde se trabaja el metal.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Pregunto si en la fragua tienen acero industrial para forjar un arma mejor.',
      '¿Hay pólvora guardada cerca de la fragua, por si hace falta?',
      'Pido algo de hormigón para reforzar la base de la fragua.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-fumarolas',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('fumarolas-negras', 'El calor sale directo de la tierra entre grietas humeantes.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      '¿Este vapor podría mover algún motor de combustión escondido bajo tierra?',
      'Busco la forma de sacar electricidad de todo este calor.',
      'Pregunto si hay algún aparato eléctrico que funcione aquí con el vapor.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-agujas-corriente',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('agujas-iman', 'Las rocas negras imantadas desorientan a cualquiera que se acerque.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      '¿Esta corriente magnética podría darme electricidad de alguna forma?',
      'Busco algo eléctrico que funcione aprovechando estas rocas imantadas.',
      'Pregunto si puedo generar corriente eléctrica de verdad aquí.',
    ],
    rollVariants: [null],
  },
  {
    id: 'anacronismo-cruce-mensajeria',
    category: 'anacronismo_bait',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas', 'Zona de paso habitual de patrullas de la Concordia de Hierro.')],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
    },
    actionVariants: [
      'Pregunto si la patrulla lleva algún teléfono para avisar a su mando.',
      'Busco la forma de mandar un mensaje por internet a alguien lejos de aquí.',
      '¿Tienen rifles o escopetas en su equipo de patrulla?',
    ],
    rollVariants: [null],
  },

  // ── NPC ya muerto mencionado (trampa de "resucitar") ──
  {
    id: 'npc-muerto-orco',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(orcoEnfurecidoMuertoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['orco-enfurecido-hondonada'],
      possiblyResurrectedNpcNames: ['Orco enfurecido'],
    },
    actionVariants: ['Exploro la zona en busca de algo que se me haya pasado.', 'Vuelvo a mirar por la hondonada, por si hay algo más.', 'Reviso otra vez el terreno donde luché.'],
    rollVariants: [null],
  },
  {
    id: 'npc-muerto-rezagado',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [locationFact('tumulos-del-honor'), npcSceneBlockFor(orcoRezagadoMuertoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['orco-rezagado'],
      possiblyResurrectedNpcNames: ['Guerrero orco rezagado'],
    },
    actionVariants: ['Reviso otra vez la zona del combate.', 'Vuelvo a mirar entre los túmulos, por si hay algo más.', 'Exploro los alrededores en busca de algo que se me haya pasado.'],
    rollVariants: [null],
  },
  {
    id: 'npc-muerto-soldado',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo'), npcSceneBlockFor(soldadoMuertoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['soldado-concordia'],
      possiblyResurrectedNpcNames: ['Soldado de patrulla de la Concordia'],
    },
    actionVariants: ['Reviso la zona junto al pozo, por si hay algo más.', 'Vuelvo a mirar el terreno donde luché.', 'Exploro los alrededores del pozo con cuidado.'],
    rollVariants: [null],
  },
  {
    id: 'npc-muerto-cazador-serhu',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [locationFact('campamento-serhu'), npcSceneBlockFor(cazadorSerhuMuertoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['cazador-serhu'],
      possiblyResurrectedNpcNames: ['Cazador/a Serhu'],
    },
    actionVariants: ['Reviso otra vez la zona donde cayó.', 'Vuelvo a mirar por el campamento, por si hay algo más.', 'Exploro los alrededores con cuidado.'],
    rollVariants: [null],
  },
  {
    id: 'npc-muerto-oficial-concordia',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas'), npcSceneBlockFor(oficialConcordiaMuertoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['oficial-concordia'],
      possiblyResurrectedNpcNames: ['Oficial de patrulla de la Concordia'],
    },
    actionVariants: ['Reviso otra vez el cruce, por si hay algo más.', 'Vuelvo a mirar la zona del combate.', 'Exploro los alrededores con cuidado.'],
    rollVariants: [null],
  },
  {
    // Variante de diálogo (no de exploración) del mismo cebo — Gistera sigue viva, se le pregunta
    // por un tercero que Gorhorn ya mató; comprueba si el modelo "resucita" a ese tercero al
    // responder en boca de un NPC vivo, no solo al narrar la escena.
    id: 'npc-muerto-gistera-dialogo',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [
        locationFact('hondonada-del-eco'),
        npcSceneBlockFor(gisteraInScene, GORHORN_LEVEL),
        'Hace unos días, Gorhorn mató al orco enfurecido que la perseguía.',
      ],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['gistera-koh'],
      possiblyResurrectedNpcNames: ['Orco enfurecido'],
    },
    actionVariants: [
      'Le pregunto a Gistera Koh si teme que vuelva el orco que la perseguía.',
      'Le digo a Gistera Koh que ya no tiene nada que temer de su perseguidor.',
      'Le pregunto a Gistera Koh qué piensa hacer ahora que el orco que la seguía está muerto.',
    ],
    rollVariants: [null],
  },
  {
    id: 'npc-muerto-torgash-dialogo',
    category: 'npc_muerto_bait',
    base: {
      worldFacts: [
        locationFact('campamento-serhu'),
        npcSceneBlockFor(torgashInScene, GORHORN_LEVEL),
        'Gorhorn ya se enfrentó y mató al guerrero orco rezagado que rondaba Los Túmulos del Honor.',
      ],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['torgash'],
      possiblyResurrectedNpcNames: ['Guerrero orco rezagado'],
    },
    actionVariants: [
      'Le cuento a Torgash lo que pasó con el guerrero rezagado de los túmulos.',
      'Le pregunto a Torgash si conocía al guerrero sin clan que maté.',
      'Le digo a Torgash que el rezagado de los túmulos ya no es un problema.',
    ],
    rollVariants: [null],
  },

  // ── fauna sin usar en el banco todavía (barrido 2026-08-07) ──
  {
    id: 'combate-canizor',
    category: 'combate',
    base: {
      worldFacts: [locationFact('restos-de-maktor'), npcSceneBlockFor(canizorInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['canizor'],
    },
    actionVariants: ['Ataco al canizor con mi hacha.', 'Golpeo al canizor antes de que se abalance.', 'Me lanzo contra el canizor.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }, { attribute: 'destreza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-cruzavientos',
    category: 'combate',
    base: {
      worldFacts: [locationFact('pilares-rotos'), npcSceneBlockFor(cruzavientosInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['cruzavientos'],
    },
    actionVariants: ['Ataco al cruzavientos mientras planea sobre mí.', 'Golpeo al cruzavientos con mi hacha.', 'Intento derribar al cruzavientos de un golpe.'],
    rollVariants: [{ attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'destreza', gradoExito: 'fallo' }, { attribute: 'fuerza', gradoExito: 'con_coste' }],
  },
  {
    id: 'combate-corredor-cauce',
    category: 'combate',
    base: {
      worldFacts: [locationFact('sabana-alta'), npcSceneBlockFor(corredorCauceInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['corredor-de-cauce'],
    },
    actionVariants: ['Cazo al corredor de cauce con mi lanza.', 'Ataco al corredor antes de que escape.', 'Persigo y golpeo al corredor de cauce.'],
    rollVariants: [{ attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'destreza', gradoExito: 'fallo' }],
  },
  {
    id: 'combate-buitre-cenizo',
    category: 'combate',
    base: {
      worldFacts: [locationFact('paso-de-los-huesos'), npcSceneBlockFor(buitreCenizoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['buitre-cenizo'],
    },
    actionVariants: ['Ataco al buitre cenizo con mi hacha.', 'Espanto y golpeo al buitre antes de que huya.', 'Cazo al buitre cenizo.'],
    rollVariants: [{ attribute: 'destreza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'combate-murgol',
    category: 'combate',
    base: {
      worldFacts: [locationFact('pastos-de-la-deriva', 'Un múrgol salvaje pasta solo, sin muesca de clan en la oreja.')],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['murgol'],
    },
    actionVariants: ['Cazo al múrgol para conseguir carne.', 'Ataco al múrgol con mi hacha.', 'Golpeo al múrgol antes de que se espante.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },

  // ── objeto usado sin respaldo mecánico (hasFalseItemUse, sin cobertura hasta 2026-08-07) ──
  {
    id: 'item-falso-descanso-sin-objeto',
    category: 'item_falso_bait',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), 'Gorhorn está HERIDO tras un combate reciente. No lleva ningún objeto médico en su inventario.'],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseItemUseNames: ['cataplasma', 'ungüento', 'vendaje'],
    },
    actionVariants: ['Descanso para intentar recuperarme.', 'Me tumbo a descansar un rato, a ver si mejoro.', 'Intento curarme como pueda con lo que tengo encima.'],
    rollVariants: [null],
  },
  {
    id: 'item-falso-antorcha-sin-objeto',
    category: 'item_falso_bait',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo', 'Es de noche cerrada.'), 'Gorhorn no lleva ninguna antorcha ni resina en su inventario.'],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: [],
      possiblyFalseItemUseNames: ['antorcha', 'resina'],
    },
    actionVariants: ['Busco algo de luz para seguir avanzando.', 'Intento ver algo en la oscuridad.', 'Sigo camino a pesar de la falta de luz.'],
    rollVariants: [null],
  },

  // ── combate resuelto sin intercambio mecánico (hasPrematureCombatResolution, sin cobertura
  // hasta 2026-08-07 — mismo bug real documentado dos partidas seguidas: aceptar ayudar a Gistera
  // contra su perseguidor no fuerza ningún combate mecánico por sí solo) ──
  {
    id: 'combate-prematuro-ayuda-gistera',
    category: 'combate_prematuro_bait',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(gisteraInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['gistera-koh'],
      combatNotYetResolved: true,
    },
    actionVariants: [
      'Le digo a Gistera Koh: "Yo me ocupo de tu perseguidor."',
      'Le prometo a Gistera Koh que se ocupará de quien la sigue.',
      'Le digo a Gistera Koh que no tiene nada que temer, que yo lo resolveré.',
    ],
    rollVariants: [null],
  },
  {
    id: 'combate-prematuro-amenaza-oficial',
    category: 'combate_prematuro_bait',
    base: {
      worldFacts: [locationFact('cruce-de-las-cenizas'), npcSceneBlockFor(oficialConcordiaInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      npcSlugsInScene: ['oficial-concordia'],
      combatNotYetResolved: true,
    },
    actionVariants: ['Amenazo al oficial de la Concordia para que se retire.', 'Le advierto al oficial que se aparte de mi camino.', 'Le exijo al oficial que se vaya ahora mismo.'],
    rollVariants: [null],
  },

  // ── narración demasiado parecida a la anterior (isTooSimilarToLast, sin cobertura hasta
  // 2026-08-07 — bug real jugando en vivo: dos turnos de combate seguidos narraron casi la misma
  // frase palabra por palabra pese a la instrucción explícita de no repetir) ──
  {
    id: 'repeticion-combate-orco',
    category: 'repeticion_bait',
    base: {
      worldFacts: [locationFact('hondonada-del-eco'), npcSceneBlockFor(orcoEnfurecidoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['orco-enfurecido-hondonada'],
      lastNarrationText: 'Gorhorn descarga un golpe certero de su hacha contra el orco enfurecido, que apenas logra esquivar el filo en el último instante.',
    },
    actionVariants: ['Vuelvo a atacar al orco enfurecido con mi hacha.', 'Ataco de nuevo al orco con mi hacha.', 'Repito el ataque contra el orco enfurecido.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
  {
    id: 'repeticion-combate-soldado',
    category: 'repeticion_bait',
    base: {
      worldFacts: [locationFact('pozo-cauce-viejo'), npcSceneBlockFor(soldadoInScene, GORHORN_LEVEL)],
      characterSummary: GORHORN_SUMMARY,
      enCombate: true,
      npcSlugsInScene: ['soldado-concordia'],
      lastNarrationText: 'Gorhorn lanza un tajo directo contra el soldado de la Concordia, que retrocede un paso mientras intenta cubrirse con el escudo.',
    },
    actionVariants: ['Vuelvo a atacar al soldado con mi hacha.', 'Ataco de nuevo al soldado de la Concordia.', 'Repito el ataque contra el soldado.'],
    rollVariants: [{ attribute: 'fuerza', gradoExito: 'claro' }, { attribute: 'fuerza', gradoExito: 'fallo' }],
  },
];

export const DISTILLATION_SCENARIOS: DistillationScenario[] = SEEDS.flatMap((seed) =>
  seed.actionVariants.flatMap((action, ai) =>
    seed.rollVariants.map((rollSpec, ri) => ({
      id: `${seed.id}--a${ai}-r${ri}`,
      category: seed.category,
      ctx: {
        ...seed.base,
        action,
        roll: rollSpec ? makeRoll(rollSpec.attribute, rollSpec.gradoExito) : undefined,
      },
    })),
  ),
);
