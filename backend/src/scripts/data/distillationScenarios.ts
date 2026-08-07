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

export type ScenarioCategory = 'exploracion' | 'combate' | 'dialogo' | 'viaje' | 'crafteo' | 'descanso' | 'anacronismo_bait' | 'npc_muerto_bait';

/// Mismo personaje y resumen que ya usa test-turn.ts (el único script manual existente que ya
/// prueba turnos reales) — no se importa de ahí porque ese fichero ejecuta su propio main() al
/// cargarse, así que se duplica el texto (dato plano, no lógica) para mantener la consistencia.
const GORHORN_ATTRIBUTES: AttributeBlock = { fuerza: 18, destreza: 9, constitucion: 5, inteligencia: 5, voluntad: 12, carisma: 8, arcano: 8 };
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
