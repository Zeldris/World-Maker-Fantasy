import type { MetodoObtencion } from '@prisma/client';
import type { Attribute } from './dice.js';
import type { StartingAbility } from './startingAbilities.js';

/// Habilidades BASE de oficio recolector (rediseño de profesiones, 2026-08-07) — a diferencia de
/// las de oficio creador (professionAbilities.ts, una por RECETA), aquí hay una sola habilidad
/// genérica por oficio recolector, desbloqueada a nivel 1 ("Minar", "Talar", "Desollar"). No manda
/// `promptText` directo al composer al pulsarla — el frontend abre un pop-up de selección
/// (HarvestSelectionModal) que primero busca fuentes ya localizadas en la escena
/// (`detectHarvestSourcesInScene`, harvest.ts) y, si no hay ninguna, ofrece "Explorar"
/// (`GET /saves/:id/recolectar/:oficio`, determinista, sin gastar turno — ver `metodoForOficio`
/// más abajo, que conecta cada oficio recolector con su `MetodoObtencion` real de HarvestYield).
///
/// Desuello usa el método CAZA (fauna ya derrotada) — no necesita una fila `WorldPopulation` tipo
/// RECURSO propia, ya usa la población FAUNA existente (ver population.ts). A diferencia de
/// minero/talador, su "ya localizado en la zona" (2026-08-09, petición explícita: "que al usar la
/// habilidad de profesión de desollar funcione como el resto y explore la zona con los cadáveres
/// derrotados") no mira `WorldPopulation` ni tiene "Explorar" propio — mira qué fauna en escena
/// (`detectNpcsInScene`, npcScene.ts) ya está derrotada (CONVALECIENTE/MUERTO) y sin despiezar
/// todavía (`carcassCandidatesFor`, recolectar.ts): solo puedes desollar lo que ya has vencido en
/// combate (y rematado o no) o lo que la propia narración ya ha descrito como cadáver en la zona.
export interface HarvestAbilityUnlock {
  /// Prefijo base del oficio recolector ("minero", "talador", "desollador"), SIN raza/región —
  /// professions.ts (2026-08-09) escala cada uno con sufijos distintos (minero/talador solo por
  /// región: "minero-llanuras"; desollador por raza+región, como su creadora peletero:
  /// "desollador-orcos-llanuras"). El emparejamiento real es por prefijo (ver
  /// `matchesOficioPrefix` más abajo), nunca por igualdad exacta.
  oficio: string;
  /// Clave de ruta exacta para `GET/POST /saves/:id/recolectar/:subOficio` (2026-09-02, profesión
  /// "pescador") — necesaria SOLO cuando un mismo `oficio` (una sola profesión con una sola fila
  /// de `ProfessionProgress`) desbloquea DOS habilidades base con métodos/atributos distintos
  /// (Pescar=PESCA/Fuerza, Buscar=BUSQUEDA/Voluntad): `matchesOficioPrefix` no puede distinguir
  /// entre ambas si comparten `oficio: 'pescador'` (las dos harían prefix-match contra cualquier
  /// string que empiece por "pescador-"). El resto del catálogo (minero/talador/desollador/
  /// herborista, 1 método por oficio) no lo necesita — `metodoForOficio`/`attributeForOficio`
  /// comprueban primero un match EXACTO de `subOficio` (si lo hay) antes de caer al prefijo normal
  /// de `oficio`. `harvestAbilityUnlocksFor` (desbloqueo a nivel 1) sigue mirando solo `oficio`
  /// —aprender "pescador" concede Pescar Y Buscar juntas, un solo oficio con dos verbos.
  subOficio?: string;
  metodo: MetodoObtencion;
  /// Atributo primario que mueve la tirada de "Explorar"/"Desollar" (rediseño de recolección,
  /// 2026-08-22, `rollGathering` en dice.ts): minero/talador → Fuerza (esfuerzo físico),
  /// herborista → Voluntad (percepción/paciencia, el equivalente de Sabiduría del proyecto),
  /// desollador → Destreza (precisión al despiezar). Nunca Sigilo ni ningún atributo secundario —
  /// esos se remodelaron justo para separarlos de toda tirada real (commit `1080c90`).
  attribute: Attribute;
  /// Segundo atributo, solo para candidatos de tier ALTO (2026-09-02, "doble tirada en tier alto",
  /// petición explícita: "1 tirada busca y si lo marcas para recolectar, por cada item especial se
  /// hace una tirada que es la que indica si lo conseguiste recolectar") — la tirada de Explorar
  /// (`attribute` de arriba) sigue decidiendo QUÉ aparece y CUÁNTO, sin tocar; `attributeSecundario`
  /// solo entra en juego al CONFIRMAR una selección cuyo `ItemCatalog.tier >= 6`
  /// (SEGUNDA_TIRADA_TIER_MINIMO, recolectar.ts), como una comprobación extra de conocimiento/
  /// pericia específico (leer la veta, aguante sostenido, anatomía, identificar sin confundir) que
  /// la tirada general de "encontrar algo" no cubre. Opcional: el resto del catálogo (tier <6, o un
  /// oficio sin este campo) nunca dispara la segunda tirada.
  attributeSecundario?: Attribute;
  ability: StartingAbility;
}

/// Compartida con `crafting.ts` § `hasToolForOficio`/`canCraft` (deuda técnica 2026-08-21: mismo
/// cuerpo de 2 líneas duplicado literal en ambos archivos).
export function matchesOficioPrefix(oficio: string, prefix: string): boolean {
  return oficio === prefix || oficio.startsWith(`${prefix}-`);
}

const HARVEST_ABILITIES: HarvestAbilityUnlock[] = [
  {
    oficio: 'minero',
    metodo: 'MINERIA',
    attribute: 'fuerza',
    // Segundo atributo (2026-09-02, "doble tirada en tier alto"): Inteligencia — leer la veta,
    // reconocer un mineral especial requiere entender lo que se tiene delante, no solo fuerza para
    // picar.
    attributeSecundario: 'inteligencia',
    ability: {
      name: 'Minar',
      icon: '⛏️',
      description: 'Busca vetas de mineral o piedra que ya se hayan localizado en la zona, o explora en busca de alguna nueva.',
      promptText: 'Busco vetas de mineral o piedra por la zona.',
      category: 'profesion',
    },
  },
  {
    oficio: 'talador',
    metodo: 'TALA',
    attribute: 'fuerza',
    // Segundo atributo (2026-09-02): Constitución — resistencia sostenida, un tronco/madera de
    // calidad excepcional exige seguir cortando más allá del esfuerzo puntual de siempre.
    attributeSecundario: 'constitucion',
    ability: {
      name: 'Talar',
      icon: '🪓',
      description: 'Busca madera ya localizada en la zona, o explora en busca de matorral o árboles que talar.',
      promptText: 'Busco madera que talar por la zona.',
      category: 'profesion',
    },
  },
  {
    oficio: 'desollador',
    metodo: 'CAZA',
    attribute: 'destreza',
    // Segundo atributo (2026-09-02): Inteligencia — conocimiento anatómico, saber dónde cortar
    // para sacar un material especial intacto (escamas, garras) sin destrozarlo.
    attributeSecundario: 'inteligencia',
    ability: {
      name: 'Desollar',
      icon: '🔪',
      // Pasa a pasiva (2026-08-25, petición explícita) — deja de ser un botón: los cadáveres
      // pendientes (cazados por ti, descritos como cadáver, o los que deja un Combate múltiple
      // real al resolverse) avisan solos en la escena, sin pulsar nada. `promptText` se queda sin
      // uso real (el frontend nunca la manda al composer, ver AbilityGrid/PASSIVE_ABILITY_NAMES),
      // pero no se quita — sigue siendo la acción determinista que dispara el saqueo real.
      description: 'Pasiva: si hay presas derrotadas sin desollar en la zona, avisa solo — no hace falta pulsarla.',
      promptText: 'Despiezo y desuello la presa que tengo delante.',
      category: 'profesion',
    },
  },
  // Bug real encontrado jugando en vivo (2026-08-13, "no veo la habilidad de recolección para
  // herborista"): existía la profesión (professions.ts) y el catálogo (HarvestYield método
  // EXTRACCION), pero nunca su botón — herborista se quedó fuera de HARVEST_ABILITIES desde el
  // rediseño de profesiones original, mismo hueco que ya se cerró antes para desollador.
  {
    oficio: 'herborista',
    metodo: 'EXTRACCION',
    attribute: 'voluntad',
    // Segundo atributo (2026-09-02): Inteligencia — identificar sin confundir, distinguir una
    // hierba realmente rara de una similar pero corriente (o tóxica) exige más que buena vista.
    attributeSecundario: 'inteligencia',
    ability: {
      name: 'Recolectar hierbas',
      icon: '🌿',
      description: 'Busca hierbas o flores medicinales ya localizadas en la zona, o explora en busca de alguna nueva.',
      promptText: 'Busco hierbas o flores medicinales por la zona.',
      category: 'profesion',
    },
  },
  // Profesión "pescador" (2026-09-02, zona 15 "Playa de Ceniza Blanca") — universal, sin variante
  // regional/racial (a diferencia de minero-llanuras/talador-llanuras, no hay "pescador-llanuras":
  // pescar no depende de dónde aprendiste, solo de estar junto al agua correcta). Concede DOS
  // habilidades base a la vez al llegar a nivel 1 en 'pescador' (mismo oficio, un único
  // `ProfessionProgress`): Pescar (peces, exige caña+cebo) y Buscar (marisco, sin herramienta,
  // solo Voluntad). Ver comentario de `HarvestAbilityUnlock.subOficio` arriba para por qué
  // necesitan una clave de ruta propia en vez de compartir el prefijo 'pescador' sin más.
  {
    oficio: 'pescador',
    subOficio: 'pescador-pescar',
    metodo: 'PESCA',
    attribute: 'fuerza',
    // Segundo atributo (2026-09-02): Inteligencia — dar con un Toluh (tier 7, migratorio y
    // rarísimo) entre los peces comunes exige reconocerlo, no solo tirar de la caña con fuerza.
    attributeSecundario: 'inteligencia',
    ability: {
      name: 'Pescar',
      icon: '🎣',
      description: 'Pesca con caña en las aguas ya localizadas, o explora la costa en busca de un buen sitio.',
      promptText: 'Pesco con caña en la costa.',
      category: 'profesion',
    },
  },
  {
    oficio: 'pescador',
    subOficio: 'pescador-buscar',
    metodo: 'BUSQUEDA',
    attribute: 'voluntad',
    // Segundo atributo (2026-09-02): Destreza — sacar un marisco especial de la arena sin
    // reventarlo exige manos finas, no solo paciencia para dar con él.
    attributeSecundario: 'destreza',
    ability: {
      name: 'Buscar',
      icon: '🐚',
      description: 'Busca marisco enterrado en la arena ya localizada, o explora la costa en busca de un buen sitio.',
      promptText: 'Busco marisco enterrado en la arena de la costa.',
      category: 'profesion',
    },
  },
  // "Recoger" (2026-08-25, retira el descubrimiento de texto libre — ver discovery.ts) — a
  // diferencia de los cuatro anteriores, NO es un oficio real de `professions.ts`: esta entrada
  // solo existe para que `metodoForOficio`/`attributeForOficio` sepan resolver
  // 'recolector-general' → PASIVO al pedir `GET /saves/:id/recolectar/recolector-general`. La
  // habilidad en sí NUNCA se concede por `harvestAbilityUnlocksFor` (nadie tiene asignado el
  // "oficio" 'recolector-general' de verdad) — vive como habilidad general universal en
  // `GORHORN_GENERAL_ABILITIES` (startingAbilities.ts), mismo criterio que Saquear/Curar/Cazar:
  // objetos, no recursos de oficio (criterio explícito de la usuaria).
  {
    oficio: 'recolector-general',
    metodo: 'PASIVO',
    attribute: 'destreza',
    ability: {
      name: 'Recoger',
      icon: '🖐️',
      description: 'Recoge objetos que veas por la zona — sin tirada, solo si de verdad están ahí.',
      promptText: 'Recojo lo que encuentro por la zona.',
      category: 'general',
    },
  },
];

/// Qué habilidad base recolectora se desbloquea al alcanzar nivel 1 en `oficio` — mismo criterio
/// que professionAbilityUnlocksFor, pero siempre nivel 1 (no hay recetas de tier superior aquí).
/// Sigue mirando solo `oficio` (nunca `subOficio`): aprender "pescador" concede Pescar Y Buscar
/// juntas de una vez, las dos entradas que comparten `oficio: 'pescador'`.
export function harvestAbilityUnlocksFor(oficio: string, nivel: number): StartingAbility[] {
  if (nivel !== 1) return [];
  return HARVEST_ABILITIES.filter((u) => matchesOficioPrefix(oficio, u.oficio)).map((u) => u.ability);
}

/// Busca la entrada real para una clave de ruta (`GET/POST /saves/:id/recolectar/:oficio`) —
/// primero por `subOficio` EXACTO (2026-09-02, pescador: distingue 'pescador-pescar' de
/// 'pescador-buscar', que de otro modo harían prefix-match ambiguo contra el mismo `oficio` base),
/// y solo si no hay ninguna coincidencia cae al prefijo normal de `oficio` (resto del catálogo,
/// 1 método por oficio, comportamiento idéntico a como era antes de `subOficio` existir).
function findHarvestAbility(oficioParam: string): HarvestAbilityUnlock | null {
  return HARVEST_ABILITIES.find((u) => u.subOficio === oficioParam) ?? HARVEST_ABILITIES.find((u) => matchesOficioPrefix(oficioParam, u.oficio)) ?? null;
}

/// A qué MetodoObtencion corresponde un oficio recolector — null si `oficio` no es recolector
/// (o no existe). Usado por el endpoint de "Explorar"/localizado para saber qué buscar.
export function metodoForOficio(oficio: string): MetodoObtencion | null {
  return findHarvestAbility(oficio)?.metodo ?? null;
}

/// Atributo primario que mueve `rollGathering` para este oficio recolector — mismo emparejamiento
/// que `metodoForOficio` (ver comentario de `attribute` en `HarvestAbilityUnlock`).
export function attributeForOficio(oficio: string): Attribute | null {
  return findHarvestAbility(oficio)?.attribute ?? null;
}

/// Segundo atributo para la tirada de confirmación de un candidato tier≥6 (2026-09-02, "doble
/// tirada en tier alto") — null si este oficio no tiene uno declarado (el resto del catálogo hoy
/// sigue sin dispararla, ver `SEGUNDA_TIRADA_TIER_MINIMO` en recolectar.ts).
export function attributeSecundarioForOficio(oficio: string): Attribute | null {
  return findHarvestAbility(oficio)?.attributeSecundario ?? null;
}

/// `oficio` REAL de `ProfessionProgress` (nivel/XP) para una clave de ruta dada — para el resto
/// del catálogo es la propia clave de ruta sin cambios (`oficio === professionId` de siempre,
/// p.ej. "minero-llanuras" es a la vez la clave de ruta Y el `professionId`: la entrada de
/// `HARVEST_ABILITIES` solo guarda el PREFIJO "minero", nunca la variante completa con región, así
/// que NUNCA se usa `entry.oficio` salvo que la entrada tenga `subOficio` — el único caso real es
/// pescador). Solo diverge para pescador (2026-09-02): 'pescador-pescar'/'pescador-buscar' son dos
/// claves de ruta DISTINTAS para un único oficio aprendido ('pescador', una sola fila de
/// `ProfessionProgress`, sin sufijo de región) — el nivel que hace de `bonusOficio` en
/// `rollGathering` tiene que mirar esa fila compartida, nunca una inexistente
/// 'pescador-pescar'/'pescador-buscar'.
export function professionIdForOficio(oficioParam: string): string {
  const entry = findHarvestAbility(oficioParam);
  return entry?.subOficio ? entry.oficio : oficioParam;
}

/// Entrada real de `HARVEST_ABILITIES` para un `MetodoObtencion` de `HarvestYield` (2026-09-02,
/// segunda tirada en tier alto) — `/saves/:id/recolectar/confirmar` no recibe ningún `oficio` de
/// ruta (solo `selections`), pero cada `yieldRow` YA trae su propio `metodoObtencion` real: 1:1 con
/// una única entrada del catálogo (incluido pescador — PESCA y BUSQUEDA son métodos distintos,
/// nunca ambiguos entre sí, a diferencia de la clave de ruta compartida 'pescador'). `null` para
/// PASIVO (nunca dispara la segunda tirada, ver comentario de cabecera en recolectar.ts).
function harvestAbilityForMetodo(metodo: MetodoObtencion): HarvestAbilityUnlock | null {
  return HARVEST_ABILITIES.find((u) => u.metodo === metodo) ?? null;
}

/// Segundo atributo + `oficio` real (para el nivel) de un `MetodoObtencion` — usado por
/// `/recolectar/confirmar` para la segunda tirada de un candidato tier≥6 sin depender de ningún
/// `oficio` de ruta. `null` si este método no declara segundo atributo (PASIVO, o cualquier oficio
/// futuro que no lo necesite).
export function attributeSecundarioForMetodo(metodo: MetodoObtencion): { attribute: Attribute; oficio: string } | null {
  const entry = harvestAbilityForMetodo(metodo);
  if (!entry?.attributeSecundario) return null;
  return { attribute: entry.attributeSecundario, oficio: entry.oficio };
}
