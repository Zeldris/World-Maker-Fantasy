/// Rediseño de atributos (2026-07-29, referencia Baldur's Gate 3/D&D — mismo motor de dados y
/// tablas de XP que ya usa Tarkor): los 6 clásicos de D&D (Voluntad = Sabiduría, mismo nombre que
/// ya usaba el proyecto) + Magia aparte (renombrado desde "Arcano" el 2026-09-01, ver
/// docs/rpgtarkor/clases.md § Atributo Magia), porque en el lore de Tarkor la magia es
/// salvaje/innata, no intelecto (a diferencia de D&D puro). Sigilo baja a SecondaryAttribute — ni
/// en D&D es un atributo primario, ahí es una habilidad bajo Destreza.
export type Attribute = 'fuerza' | 'destreza' | 'constitucion' | 'inteligencia' | 'voluntad' | 'carisma' | 'magia'

export type AttributeBlock = Record<Attribute, number>

/// Espejo del enum `AbilityEffect` de Prisma (backend/prisma/schema.prisma) — qué hace
/// mecánicamente una habilidad de clase al conectar (2026-08-30, para exponer el bono/efecto real
/// en la Ficha del Rival una vez analizada, en vez de solo texto de lore). Ver ese enum para el
/// comentario de diseño de cada valor.
export type AbilityEffect =
  | 'ATAQUE'
  | 'ATURDIMIENTO'
  | 'INTIMIDACION'
  | 'AGUANTE'
  | 'ANALISIS'
  | 'INVOCACION'
  | 'DEBILIDAD'
  | 'AUMENTO'
  | 'RETIRAR'
  | 'CANALIZAR'
  | 'CURAZION'
  | 'REFLEJAR'
  | 'EXPULSAR'
  | 'CONTROL'
  | 'MULTIPLE'
  | 'LETAL'
  | 'DESVIAR'
  | 'PROVOCACION'
  | 'OCULTACION'
  | 'CONTRA'
  | 'REFRACTAR'
  | 'RECUPERACION'
  | 'PURIFICAR'
  | 'COMPANERO'
  | 'LIMITADA'
  | 'CONVERSION'

/// Atributos secundarios de PJ (sesión de diseño 2026-07-23, remodelados 2026-08-22) — nunca
/// alimentan una tirada (dice.ts), solo comprobaciones de umbral (requisitos de objetos/
/// construcciones/oficios). Ver el comentario completo en el backend (secondaryAttributes.ts)
/// para el porqué de cada uno: `sigilo` salió de aquí (pasa a ser habilidad activa de Destreza,
/// no un rasgo aparte); `resistenciaFisica`/`resistenciaMagica`/`resistenciaSemilla` se
/// eliminaron (duplicaban el papel de Constitución); `magia`/`poderSemilla` se RETIRARON de aquí
/// el 2026-09-01: pasaron a vivir en el atributo primario `magia` (antes `arcano`, ver dice.ts),
/// con tirada real propia — dejan de ser color narrativo puro para ser un atributo jugable como
/// los otros 6; `suerte`/`honor` son nuevos.
export type SecondaryAttribute = 'moral' | 'resistenciaFrio' | 'resistenciaCalor' | 'suerte' | 'honor'

export type SecondaryAttributeBlock = Record<SecondaryAttribute, number>

/// Nivel de oficio (sesión de diseño 2026-07-23) — eje independiente del nivel de personaje, uno
/// por profesión practicada alguna vez (`professionId` es el `id` de data/professions.ts).
export interface ProfessionProgressInfo {
  professionId: string
  nivel: number
  xp: number
}

/// Tirada visible de Explorar/Desollar (rediseño de recolección, 2026-08-22, backend dice.ts §
/// `rollGathering`) — deliberadamente NO extiende `RollInfo` (más abajo, el de combate): no tiene
/// `difficulty`/`success` propios (el resultado se compara contra la dificultad de CADA recurso
/// candidato por separado, no una sola), y puede traer uno o dos d20 en `rolls` según hubo o no
/// ventaja por Suerte.
export interface GatheringRollInfo {
  attribute: Attribute
  value: number
  bonusOficio: number
  /// Un elemento si no hubo ventaja, dos (los dos d20 tirados) si sí la hubo — el descartado (el
  /// que no es `usedRoll`) se anima tachado.
  rolls: number[]
  usedRoll: number
  result: number
  advantage: boolean
}

/// Fuente recolectable "ya localizada" o recién "explorada" (rediseño de profesiones, 2026-08-07)
/// — GET/POST /saves/:id/recolectar/:oficio[/explorar].
export interface HarvestSourceCandidate {
  /// Categoría amplia de la fuente (2026-08-15, sustituye a sourceName) — lo que de verdad se
  /// pinta como cabecera de esta tarjeta ("Mineral", "Fauna"...), no el nombre de la especie
  /// concreta. Ver SOURCE_CATEGORY_NAMES en el backend (worldCatalog.ts).
  sourceCategoryName: string
  /// `disponible` vive DENTRO de cada yield, no aquí arriba (bug real, 2026-08-20: "0/NaN" en el
  /// modal — el agrupado por categoría de 2026-08-15 movió `disponible` al nivel de yield, porque
  /// dos fuentes de la misma categoría pueden tener poblaciones distintas, pero este tipo se quedó
  /// con un `disponible` de nivel superior que la respuesta real del backend ya no manda, así que
  /// `source.disponible` era `undefined` en tiempo de ejecución sin que TypeScript lo detectara).
  yields: { sourceSlug: string; itemSlug: string; itemName: string; cantidadMaxima: number; disponible: number }[]
}

/// Fauna real YA LOCALIZADA en la zona (revisión de partida 2026-08-08, habilidad "Cazar") —
/// GET/POST /saves/:id/cazar[/explorar], mismo patrón en dos pasos que HarvestSourceCandidate.
/// `debil` = nivel de la presa ≤ nivel del jugador − 2, el único caso en el que elegir UNA sola
/// presa ofrece una caza limpia sin combate (ver HuntSelectionModal). `avistados` es una cantidad
/// realista para esta visita (nunca la población mundial real, que puede ser de miles) — baja sola
/// según se caza de verdad, sin ser un contador que haya que persistir aparte.
export interface HuntCandidate {
  slug: string
  name: string
  level: number
  debil: boolean
  avistados: number
  /// Dificultad real de enfrentarse a esta presa (petición explícita, 2026-08-14: fondo verde/
  /// amarillo/rojo según dificultad + hover con el texto) — mismo `difficultyHintFor` que calibra
  /// la tirada de ataque normal (backend/src/services/npcScene.ts), nunca recalculado en el cliente.
  dificultad: number
  dificultadLabel: string
}

/// Roster ESTÁTICO de recetas de oficio (rediseño de profesiones, 2026-08-07) — GET /profession-recipes,
/// independiente de partida. Habilidades > Profesiones lo cruza con `ProfessionProgressInfo` para
/// decidir qué tarjetas van bloqueadas.
export interface ProfessionRecipeInfo {
  oficio: string
  nivel: number
  recipeKey: string
  /// Qué sección de la Enciclopedia indexa esta receta ('crafteo' para crafting.ts, 'construccion'
  /// para construction.ts, ej. la Choza) — 2026-08-13, ver `recipeCategory` en SavedActionInfo.
  recipeCategory: 'crafteo' | 'construccion'
  ability: {
    name: string
    icon: string
    description: string
    promptText: string
    category: SavedActionCategory
  }
}

/// Cuánto tienes de cada ingrediente de una receta ya conocida, AHORA MISMO en esta partida
/// (2026-08-13, petición explícita: "que salgan deshabilitadas si no cumples las condiciones...
/// el hover con... 5/10"). A diferencia de ProfessionRecipeInfo (estático, sin partida), esto
/// viene de GET /saves/:id/recipes-status — depende del inventario/atributos/ubicación reales.
export interface IngredientStatusInfo {
  label: string
  tienes: number
  necesitas: number
  met: boolean
}

export interface RecipeStatusInfo {
  recipeKey: string
  recipeCategory: 'crafteo' | 'construccion'
  met: boolean
  ingredients: IngredientStatusInfo[]
  missingRequisitos: string[]
  locationOk: boolean
  requiredLocationName: string | null
  /// Reglas de reino (auditoría 2026-08-13: cupo de Ayuntamiento, misma región, distancia,
  /// nivel-anterior-correcto al mejorar, un solo Ayuntamiento) — solo viene relleno cuando
  /// materiales/atributos YA se cumplen (mismo criterio que el backend). null = no aplica o no
  /// bloquea.
  blockedReason: string | null
}

/// Economía de Reino (sesión de diseño 2026-07-23) — null hasta que se funda el primer Territory.
export interface KingdomStatsInfo {
  poblacion: number
  felicidad: number
  comida: number
  bebida: number
  riqueza: number
  soldados: number
  trabajadores: number
  visitantes: number
  /// B.19 (checklist frontend 2026-08-27) — causa REAL de que un territorio pase a DISPUTADO/
  /// PERDIDO (felicidad baja sostenida, 7 días) o se consolide (felicidad alta sostenida) —
  /// nunca el conflicto de facciones del mundo, que es un sistema completamente distinto.
  diasFelicidadBaja: number
  diasFelicidadAlta: number
}

export interface WorldTheme {
  accent300: string
  accent400: string
  accent500: string
  accent600: string
  accent2300: string
  accent2400: string
  accent2500: string
  accent2600: string
}

export interface World {
  id: string
  name: string
  tagline: string
  synopsis: string
  tone: string
  lethality: 'baja' | 'media' | 'alta'
  factions: string[]
  cover: string
  theme: WorldTheme
}

export interface Character {
  id: string
  name: string
  archetype: string
  origin: string
  motivation: string
  attributes: AttributeBlock
  isPregenerated: boolean
  portraitInitial: string
  /// Intro narrativa propia de este personaje pregenerado (2026-07-28, petición explícita) para
  /// las 2 primeras entradas de log (canal personaje/mundo) al empezar una partida nueva con él —
  /// ausente en personajes sin intro propia o custom, cae a la plantilla genérica (GameView.tsx).
  introCharacterText?: string
  introWorldText?: string
}

export type LogChannel = 'character' | 'world' | 'kingdom'

export interface RollInfo {
  attribute: Attribute
  value: number
  /// Dado 1d20 en crudo (el backend ya lo manda dentro de este mismo objeto) — desglose real en
  /// RollBadge.tsx: 2026-07-24, "25 Destreza Éxito" no decía si fue un buen dado o buena estadística.
  roll: number
  difficulty: number
  result: number
  success: boolean
  /// Grados de éxito (2026-07-19) — opcional porque tiradas persistidas antes de este cambio no
  /// lo tienen; el badge cae de vuelta a solo éxito/fallo en ese caso.
  gradoExito?: 'claro' | 'con_coste' | 'fallo'
}

/// Un lado del intercambio de combate (revisión de partida 2026-08-08, petición explícita: "que
/// aparezca el resultado de las tiradas... indicando qué atributo y valor sacaste tú y el del
/// enemigo, y por qué perdiste o ganaste la tirada"). Mismo shape que `RollInfo` + `valorEfectivo`
/// (el valor de atributo YA con el multiplicador de la árbol de ventajas aplicado — distinto
/// del `value` crudo, que es el que se ve en la ficha de personaje).
export interface CombatExchangeSideInfo extends RollInfo {
  valorEfectivo: number
  /// Multiplicador de la árbol de ventajas SIN aplicar (2026-08-14) — >1 ventaja de tipo, <1
  /// desventaja, 1 sin relación. Ver comentario homónimo en combatExchange.ts (backend). Opcional
  /// de verdad: LogEntry.combatExchange persistidas ANTES de este campo no lo traen — el JSON
  /// guardado en BD nunca se migra retroactivamente, solo los turnos nuevos lo incluyen.
  multiplicador?: number
  /// Resta al atributo crudo por condición física (petición explícita, 2026-08-15) — 0/2/5/10
  /// según ILESO/HERIDO/GRAVE/CONVALECIENTE, ver combatExchange.ts (backend). Mismo criterio de
  /// opcional que `multiplicador`: ausente en LogEntry.combatExchange persistidas antes de este
  /// campo.
  malus?: number
  /// Bug real (2026-08-28, "en los cálculos de la tirada tampoco se está viendo") — bonus fijo de
  /// la habilidad usada este intercambio (ver SavedActionInfo.attributeBonus), ya sumado dentro de
  /// `valorEfectivo`/`result` pero nunca expuesto por separado hasta ahora. Mismo criterio de
  /// opcional que `malus`/`multiplicador`.
  attributeBonus?: number
  /// Pasivas raciales (2026-08-28, pendiente 2026-08-27 punto 4) — `rolls` tiene 2 elementos si
  /// `rollMode !== 'normal'` (ventaja = mejor de los dos, desventaja = peor), 1 si 'normal'.
  /// `racialAdvantageReason` es el texto listo para mostrar de por qué se tiró así.
  rolls?: number[]
  rollMode?: 'normal' | 'ventaja' | 'desventaja'
  racialAdvantageReason?: string
}

// 'independiente' (bug real, 2026-08-13: faltaba en este type — el backend YA lo manda para
// cualquier habilidad de utilidad/ANALISIS, combatExchange.ts § resolveIndependentExchange, pero
// como no estaba declarado aquí el mapa de etiquetas del badge lo pintaba en blanco).
//
// `'golpes_mutuos'` eliminado (rediseño a check opuesto de D&D, 2026-08-21, petición explícita:
// "en D&D que tu saques un 22 y el enemigo un 24, no quiere decir que el 24 sea el que gana?") —
// con los dos totales comparados DIRECTAMENTE (margen positivo/negativo/cero), ya no puede pasar
// que "los dos ganen a la vez". Partidas con turnos de combate ANTERIORES a este cambio pueden
// seguir teniendo esta cadena persistida en `LogEntry.combatExchange` (el JSON guardado nunca se
// migra retroactivamente) — `CombatExchangeBadge`/`outcomeLabelFor` necesitan seguir aceptándola
// como valor de entrada válido aunque ya no se genere nunca más.
export type CombatExchangeOutcome =
  | 'defensor_contragolpea'
  | 'ataque_falla'
  | 'parada_en_seco'
  | 'golpes_mutuos'
  | 'golpe_normal'
  | 'golpe_pleno'
  | 'independiente'

/// Las dos tiradas reales de un intercambio de combate de ESTE turno (backend, combatExchange.ts
/// § CombatExchangeDisplay) — `atacanteEsJugador` es necesario porque quién ataca y quién defiende
/// cambia turno a turno según la iniciativa, el frontend no puede asumirlo.
export interface CombatExchangeInfo {
  atacanteEsJugador: boolean
  atacante: CombatExchangeSideInfo
  defensor: CombatExchangeSideInfo
  resultado: CombatExchangeOutcome
  /// `atacante.result - defensor.result` (rediseño a check opuesto, 2026-08-21) — lo que de verdad
  /// decide el desenlace ahora. Opcional de verdad: turnos de combate persistidos ANTES de este
  /// campo no lo traen, mismo criterio que `multiplicador`/`malus` de arriba.
  margen?: number
}

/// Tirada de iniciativa para el PRÓXIMO intercambio de combate (backend, combatExchange.ts §
/// InitiativeResult) — presente solo si hubo intercambio mecánico real este turno. Persistida en
/// LogEntry.initiativeRoll (2026-08-21, bug real jugando en vivo: "al recargar la página se está
/// perdiendo el mensaje de la iniciativa y la tirada de los dados").
export interface InitiativeRollInfo {
  ganador: 'jugador' | 'npc'
  jugadorTirada: number
  npcTirada: number
}

/// Banner de elemento citado bajo la narración (petición explícita de la usuaria, 2026-07-24) —
/// forma mínima y autocontenida a propósito (nunca importa `EnciclopediaLinkTarget`/`DetailTarget`
/// de components/DetailModal.tsx: crearía un import circular, ya que ese módulo importa tipos de
/// aquí). `name` es la clave real: al hacer clic se vuelve a resolver el target completo contra el
/// índice de la Enciclopedia por nombre, en vez de guardar aquí una copia que podría desincronizarse.
export interface MentionedEntityBanner {
  name: string
  icon: string
  imageUrl: string
}

export interface LogEntry {
  id: string
  channel: LogChannel
  text: string
  timeLabel: string
  roll?: RollInfo
  isPlayerAction?: boolean
  createdAt: string
  xpDelta?: number
  /// Desglose de `xpDelta` (UX 2026-09-01, hallazgo jugando en vivo: un turno FALLIDO con un hito
  /// grande detrás — p.ej. "capitulo", 500 XP — se veía como un único "+500 XP" pegado a un
  /// "Fallo" en rojo, como si el juego premiara el fracaso). `xpHitoDelta` es la parte de
  /// `xpDelta` que vino de un hito/evento de Reino, no de la tirada normal; se pinta en su propia
  /// línea separada del chip de XP normal. Ambos undefined si el turno no tuvo hito.
  xpHitoDelta?: number
  xpHitoLabel?: string
  /// Feedback de UX (2026-08-30, petición explícita: "falta que la suma de repu o la perdida se
  /// refleje en la UX... sino el usuario ni se entera") — mismo patrón que `xpDelta`: el backend
  /// ya calculaba y persistía el delta de reputación de facción al matar/dejar convaleciente a un
  /// NPC con `faction` real, pero nunca llegaba al jugador salvo abriendo el panel de Reputación a
  /// mano. `undefined` en la inmensa mayoría de turnos.
  factionRepChange?: { faction: string; delta: number; newValue: number }
  /// Marca la entrada de "sube a nivel N" (roadmap de animaciones 2026-07-20) para que LogPanel
  /// le dé su propio marco/gema/barrido en vez de tratarla como una narración más.
  isLevelUp?: boolean
  /// Imagen del elemento más relevante citado en esta narración (banner real de la Enciclopedia),
  /// si había alguno con imagen subida y no se enseñó hace poco — ver lib/mentionedEntityBanner.ts.
  /// Resuelto en cliente: o bien recién calculado en esta misma sesión, o bien reconstruido a
  /// partir de `entityBannerType`/`entityBannerSlug` (lo que sí viene persistido del backend) en
  /// cuanto la Enciclopedia termina de cargar tras un `syncFromSave`.
  entityBanner?: MentionedEntityBanner
  /// Referencia persistida (rework 2026-07-24) de qué entidad se mostró como banner — puesta por
  /// GET /saves/:id para las entradas ya guardadas; nunca se usa directamente para pintar, solo
  /// para reconstruir `entityBanner` al cargar (ver GameView.tsx).
  entityBannerType?: string
  entityBannerSlug?: string
  /// Rediseño de la vista de combate (2026-07-28) — marca si esta entrada se generó durante un
  /// turno de combate; LogPanel la pinta con fondo/borde rojo en vez del estilo normal.
  combate?: boolean
  /// Bug real (2026-07-29, "no sé qué ataques usa el enemigo... es poco claro el combate"): nombre
  /// real de la habilidad de ataque/defensa que el NPC usó en el intercambio de ESTE turno, para
  /// que LogPanel lo muestre como badge estructurado en vez de depender de que la prosa del
  /// narrador la mencione.
  npcAbilityUsed?: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa' }
  /// Mismo hueco exacto que `npcAbilityUsed` pero para el lado del jugador (revisión de partida
  /// 2026-08-08, petición explícita: "cuando seleccione una habilidad esta se refleje en la
  /// narración con su descripción, para que así sepamos que usamos y la respuesta a ese uso").
  playerAbilityUsed?: { name: string; icon: string; description: string; rol: 'ataque' | 'defensa' }
  /// Las dos tiradas reales de este intercambio de combate — ver `CombatExchangeInfo`. Presente
  /// solo si hubo intercambio mecánico real este turno.
  combatExchange?: CombatExchangeInfo
  /// Tercer bug gemelo de `combatExchange`/`npcAbilityUsed` (2026-08-21) — ver `InitiativeRollInfo`.
  initiativeRoll?: InitiativeRollInfo
  /// Notificación de misión aceptada (2026-07-31, petición explícita: "que aparezca en la
  /// narración del personaje el título de la misión y el objetivo") — presente solo en el turno
  /// EXACTO en que se crea una misión nueva; LogPanel la pinta con fondo/borde amarillo y una
  /// tarjeta con el título+objetivo, en vez del estilo normal.
  newQuest?: { title: string; objetivo: string }
  /// Notificación de misión COMPLETADA (2026-08-13, hallazgo real jugando: la recompensa se
  /// narraba y persistía bien, pero sin ninguna marca visual — indistinguible de la narración
  /// normal) — presente solo en la LogEntry real de recompensa (questRewardNarrationFor); LogPanel
  /// la pinta con el mismo fondo/borde amarillo que `newQuest`, pero con su propia tarjeta.
  questCompleted?: { title: string; grantedItems: string[]; rewardXp: number }
  /// Eventos de viaje interactivos (2026-08-05) — marca el aviso determinista de que un viaje
  /// largo se interrumpió antes de llegar al destino pedido; LogPanel la pinta con fondo/borde
  /// ámbar, mismo criterio que `combate` (rojo) y `newQuest` (amarillo).
  travelInterrupted?: boolean
  /// Oferta de misión SIN aceptar todavía (2026-08-26, botones Aceptar/Cancelar) — presente solo
  /// en el turno en que un NPC propone una misión con anclaje real; LogPanel la pinta con el mismo
  /// fondo amarillo que `newQuest`, más los dos botones. Se limpia localmente en cuanto la
  /// jugadora responde (aceptar/cancelar) — nunca sobrevive a una recarga, mismo criterio efímero
  /// que `newQuest`/`questCompleted`.
  questOffer?: { title: string; description: string }
  /// Bug real jugando en vivo (2026-08-30, "el cuadro del log de gistera deberia seguir siendo
  /// amarillo...no azul") — al aceptar/cancelar, `questOffer` se limpia (los botones deben
  /// desaparecer), pero sin este flag la entrada perdía TODO rastro amarillo y caía al fondo azul
  /// normal, aunque la narración de presentación siga siendo, de hecho, la oferta de una misión.
  /// Se marca al limpiar `questOffer`, nunca se borra — la entrada se queda amarilla para siempre,
  /// coherente con que sigue siendo "sobre una oferta de misión" aunque ya esté resuelta.
  questOfferResolved?: boolean
  /// "Modo dinámico" (2026-08-27) — botón "Interactuar" al final de un turno normal, nunca lo
  /// interrumpe; mismo criterio efímero/local que `questOffer` (se limpia al pulsar Interactuar o
  /// Ignorar, nunca sobrevive a una recarga). `busy`/`error` (checklist frontend 2026-08-27, A.7):
  /// antes la tarjeta se limpiaba ANTES de saber si la petición tuvo éxito — si fallaba, la
  /// jugadora se quedaba sin ningún rastro de la oferta ni explicación. Ahora la tarjeta sigue
  /// visible con el error inline y puede reintentar con el mismo botón.
  dynamicModeOffer?: { tipo: 'NPC' | 'FAUNA'; targetSlug: string; targetName: string; busy?: boolean; error?: string }
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — presente en el turno de
  /// combate en que uno o más NPC pasan a CONVALECIENTE por primera vez; LogPanel pinta, por cada
  /// uno, una tarjeta con Matar/Capturar/Clemente (mismo fondo amarillo que `questOffer`). Efímero
  /// tal cual, pero el estado de "ya resuelto" no se limpia aquí — se deriva en vivo comparando
  /// `npcSlug` contra `combatNpcsDisplay` (useCombatFlow.ts), así que sigue siendo correcto incluso
  /// si la jugadora responde desde una tarjeta de un turno anterior a esta.
  convalecienteOffers?: { npcSlug: string; npcName: string; capturable: boolean }[]
}

export type EquipSlot =
  | 'CASCO'
  | 'CAMISA'
  | 'ARMADURA_SUPERIOR'
  | 'GUANTES'
  | 'ARMADURA_INFERIOR'
  | 'ACCESORIO'
  | 'BOTAS'
  | 'ARMA_PRINCIPAL'
  | 'ARMA_SECUNDARIA'
  | 'ANILLO_1'
  | 'ANILLO_2'
  | 'CINTURON'
  | 'CONSUMIBLE_1'
  | 'CONSUMIBLE_2'
  | 'CONSUMIBLE_3'
  | 'CONSUMIBLE_4'
  | 'CONSUMIBLE_5'
  | 'CONSUMIBLE_6'
  // 3 ranuras de cosmético puro (2026-08-03) — sustituyen a ABALORIO, ver equipment.prisma /
  // equipSlots.ts. 1:1 exactas, sin familia compartida.
  | 'COSMETICO_ESPALDA'
  | 'COSMETICO_CABEZA'
  | 'COSMETICO_CINTURA'

/// Categorización mecánica de objetos (2026-07-29) — ver itemTaxonomy.ts (backend). RECURSO: se
/// recoge/caza/tala/mina directo de la naturaleza. MATERIAL: sale de un proceso de crafteo.
/// EQUIPABLE/CONSUMIBLE/NARRATIVO: los de siempre, ahora agrupados bajo un bucket mecánico.
export type ItemTipo = 'RECURSO' | 'MATERIAL' | 'EQUIPABLE' | 'CONSUMIBLE' | 'NARRATIVO' | 'ESPECIAL'

export interface InventoryItemInfo {
  id: string
  name: string
  description: string
  origin?: string
  slot: EquipSlot | null
  /// Mapa de bonificadores (2026-08-03, sustituye al par statBonusAttribute/statBonusAmount — un
  /// solo par no dejaba a un objeto sumar, p.ej., fuerza Y defensa a la vez). 'defensa' incluido
  /// junto a los 7 atributos jugables, mismo criterio que el backend (equipment.ts). 'inventorySlots'
  /// (2026-08-07, rediseño de profesiones) — bonus de cosméticos a la capacidad de inventario.
  statBonuses: Partial<Record<Attribute | 'defensa' | 'inventorySlots', number>> | null
  /// Sesión de diseño 2026-07-23: slug de ItemCatalog de origen (null en objetos narrativos
  /// sueltos), nivel de rareza/dificultad (1-5, 1 = común), y mínimos de atributo para equiparlo
  /// — el backend ya rechaza el PATCH de equipar si no se cumplen (ver lib/api.ts, setItemSlot).
  catalogSlug?: string | null
  /// Ranura de equipo real del catálogo (2026-07-30, "categorizar por ranura para que no pueda
  /// poner un casco en los pies") — null en objetos narrativos sin categorizar (permisivo, ver
  /// `isCompatibleWithSlot`, equipSlots.ts) o sin catalogSlug.
  equipSlot?: EquipSlot | null
  tier?: number
  requisitos?: Partial<Record<Attribute | SecondaryAttribute, number>>
  /// Categorización mecánica (2026-07-29) — ausente en objetos narrativos sueltos sin
  /// catalogSlug (la IA los inventa sobre la marcha, sin fila de catálogo que consultar).
  tipo?: ItemTipo
  category?: string
  /// Solo si `tipo: 'ESPECIAL'` (2026-08-03) — clave estable que un sistema concreto del
  /// frontend consulta (p.ej. MapaPanel.tsx) y texto explicando el efecto, para mostrar en un
  /// sitio propio y diferenciado de `description`.
  effectKey?: string | null
  effectDescription?: string | null
  /// Imagen real de la Enciclopedia para este objeto (petición explícita de la usuaria,
  /// 2026-07-24: "las imágenes no salen" al ver un objeto desde Inventario/Equipo) — solo
  /// presente si `catalogSlug` existe y hay un banner subido de verdad (ver imageAssets.ts).
  imageUrls?: { thumbnail: string | null; banner: string | null }
  /// Datos de curación (2026-08-17, panel "Curar") — null/false/null en objetos que no curan.
  curaHasta?: 'GRAVE' | 'HERIDO' | 'ILESO' | null
  curaUnPaso?: boolean
  curaEnergia?: number | null
  /// Grupo 3 § Compañeros y supervivencia (2026-08-25) — ambos null = equipado en el propio
  /// personaje o sin equipar (comportamiento de siempre); con valor = equipado en ESE compañero/
  /// súbdito, nunca los dos a la vez.
  companionId?: string | null
  subjectId?: string | null
  /// Rediseño de captura (2026-08-28) — no null = esta fila ES una captura en tránsito (fauna/NPC
  /// atado, sin depositar en Jaula/Celda todavía). Ver `capturaExpiraAtMinutes` para el plazo antes
  /// de que se escape sola (null = tier 7 de cuerda, nunca expira — ninguna cuerda de ese tier
  /// existe en el catálogo real todavía).
  capturaNpcId?: string | null
  capturaExpiraAtMinutes?: number | null
}

/// Grupo 3 § Compañeros y supervivencia (2026-08-25) — `felicidad: null` = compañero de quest/
/// narración libre, sin capa mecánica (comportamiento de siempre, sin barras que mostrar).
export interface CompanionInfo {
  id: string
  name: string
  role: string
  notes: string
  tipo: 'FAUNA' | 'NPC'
  felicidad: number | null
  comida: number | null
  agua: number | null
  esSlotDomador: boolean
  rolReino: string | null
  plantillaEquipoId: string | null
  /// B.14 (checklist frontend 2026-08-27) — el campo ya existía en el backend (Companion,
  /// participa de verdad en combate múltiple) pero nunca se exponía aquí: el panel de Compañeros
  /// no tenía forma de saber si uno estaba GRAVE/CONVALECIENTE fuera de la pantalla de combate.
  /// `null` para compañeros sin capa mecánica real (de quest/narración libre), mismo criterio que
  /// `comida`/`agua`.
  condicionFisica: CondicionFisica | null
}

export interface AlmacenItemInfo {
  id: string
  name: string
  description: string
  catalogSlug: string | null
}

export interface PlantillaEquipoInfo {
  id: string
  name: string
  personalizada: boolean
  rol: string
  slots: Record<string, { catalogSlug?: string; category?: string }>
  prioridad: number
}

export type TerritoryControl = 'RECLAMADO' | 'DISPUTADO' | 'CONSOLIDADO' | 'PERDIDO'
export type BuildingStatus = 'EN_CONSTRUCCION' | 'ACTIVO' | 'DANADO' | 'ABANDONADO'

export interface TerritoryInfo {
  id: string
  name: string
  region?: string | null
  description: string
  control: TerritoryControl
  population: number
}

/// Notificación de fundación de reino (2026-08-04, "el Ayuntamiento") — solo al construir el
/// Ayuntamiento tier 1 desde cero, nunca en una mejora.
export interface KingdomFoundedInfo {
  title: string
  region: string
  outcome: 'SIN_DUENO' | 'CONQUISTADA' | 'CONFLICTO'
  /// "Maktor" precargado si el personaje es Gorhorn, si no null (formulario en blanco).
  suggestedName: string | null
  /// true solo para Gorhorn — el campo de nombre del popup queda bloqueado.
  nameLocked: boolean
}

export interface BuildingInfo {
  id: string
  territoryId?: string | null
  /// Dónde se plantó de verdad (2026-08-04, "el campamento" — primera construcción anclada al
  /// mapa) — null si es una construcción libre del modelo sin Location conocida.
  locationId?: string | null
  /// Clave de ConstructionRecipe ('campamento'/'choza'/'ayuntamiento'...) si vino de una receta
  /// fija — null para construcciones libres. Decide qué icono mostrar en el mapa. El Ayuntamiento
  /// SIEMPRE guarda 'ayuntamiento' aquí sin importar el tier — mejorarlo no cambia esta clave.
  recipeKey?: string | null
  /// Nivel del Ayuntamiento (1/2/3 = pequeño/mediano/grande, 2026-08-04) — null para el resto.
  tier?: number | null
  name: string
  kind: string
  status: BuildingStatus
  description: string
}

export interface SubjectInfo {
  id: string
  territoryId?: string | null
  name: string
  role: string
  notes: string
  plantillaEquipoId: string | null
}

export interface SessionSummaryInfo {
  chapterNumber: number
  summary: string
}

export type QuestStatus = 'ACTIVA' | 'COMPLETADA' | 'FALLIDA'

export interface QuestInfo {
  id: string
  title: string
  description: string
  status: QuestStatus
  /// Frase corta y accionable de qué hay que hacer (2026-07-25) — null en misiones creadas antes
  /// de este campo, o en las que el modelo propone en juego (todavía sin objetivo estructurado).
  objetivo: string | null
  /// Recompensa estática, nunca decidida por el modelo (2026-07-25) — null/[] si no se ha
  /// definido ninguna para esta misión.
  rewardXp: number | null
  rewardItems: string[]
  /// Slug de la Location donde marcar el objetivo en el mapa (punto 3 del diseño de Gistera Koh,
  /// 2026-07-23) — resuelto en el backend desde `targetLocationId` o, si la misión apunta a un
  /// NPC en vez de a un sitio, desde su `homeLocationSlug`. Null si no hay objetivo geográfico
  /// conocido todavía.
  targetLocationSlug: string | null
}

/// 'profesion' (2026-08-07) — habilidades de oficio desbloqueadas por nivel, su propia pestaña
/// "Profesiones" en el panel de Habilidades (ver HabilidadesPanel.tsx), distinta de "Generales".
/// 'reino' (2026-08-13) — TODAS las recetas de construction.ts (Campamento, Ayuntamiento x3, y
/// cualquier edificio con oficio como la Choza), en su propia pestaña "Reino": tengan oficio o no,
/// son "edificar algo del mundo persistente", un concepto distinto de "craftear un objeto propio"
/// (profesion) o "acción de siempre disponible" (general) — nunca creable a mano por la jugadora
/// (ver AbilityForm.tsx, solo ofrece 'general').
export type SavedActionCategory = 'combate' | 'general' | 'profesion' | 'reino'

export interface SavedActionInfo {
  id: string
  name: string
  promptText: string
  icon: string
  description: string
  isStarting: boolean
  /// Habilidad racial/de arma resincronizada sola (2026-07-29, sistema de habilidades por arma) —
  /// igual que `isStarting`, nunca editable/borrable a mano (ver DetailModal.tsx), pero se
  /// actualiza al cambiar de equipo o subir de nivel en vez de ser fija de por vida.
  isDynamic: boolean
  category: SavedActionCategory
  /// SOLO frontend, nunca viene del backend (rediseño de profesiones, 2026-08-07) — resuelto en
  /// GameView.tsx cruzando esta habilidad contra ProfessionRecipeInfo[] (GET /profession-recipes)
  /// por `name` cuando category === 'profesion' (o contra un mapeo fijo local para las habilidades
  /// GENERALES de construcción sin oficio — Campamento/Ayuntamiento, 2026-08-13), para poder
  /// enlazar a su entrada de Enciclopedia desde DetailModal.tsx. Undefined si no hay receta que
  /// enlazar.
  recipeKey?: string
  /// Qué sección de la Enciclopedia usar para el enlace de arriba ('crafteo' si se omite, por
  /// compatibilidad con las habilidades de oficio ya existentes antes de sumar 'construccion'
  /// 2026-08-13) — ver DetailModal.tsx.
  recipeCategory?: 'crafteo' | 'construccion'
  /// Rediseño del turno de combate (2026-07-28) — "tipo" para la árbol de ventajas (backend)
  /// y el color del chip (UI). Null en habilidades 'general' o en partidas de antes de este campo.
  preferredAttribute: Attribute | null
  /// Sistema de fatiga (2026-07-29) — coste de energía fijo por tramo. Ver CombatPanel.tsx.
  energyCost: number
  /// Rediseño 2026-07-31 — energía que RECUPERA usar esta habilidad en un intercambio real
  /// (Defenderse=10/Esquivar=5); 0 en el resto, incluido Ataque Básico (que solo cuesta).
  energyRegen: number
  /// Rediseño 2026-07-31 (petición explícita: "ataque básico no es una habilidad como las demás,
  /// ni defenderse ni esquivar... son acciones que tienen todos los personajes") — marca los 3
  /// genéricos (Ataque Básico/Defenderse/Esquivar) para su propio bloque en la UI, separado de las
  /// habilidades reales (de clase/raciales/de arma). Sustituye a la vieja heurística
  /// `energyCost === 0` (dejó de servir en cuanto Ataque Básico pasó a costar 5).
  isGeneric: boolean
  /// Rediseño 2026-07-31 — habilidad real por categoría de arma (p.ej. "Tajo Horizontal" del
  /// hacha) colapsada en una sola tarjeta por llevar la MISMA categoría en las dos manos — mejor
  /// dificultad al usarla (backend), nunca un segundo golpe real. Ver CombatPanel.tsx.
  dualWield: boolean
  /// Rediseño de combate (2026-08-09) — 'ataque' (único rol que hace daño incondicional al
  /// conectar), 'defensa' (nunca hace daño) o 'utilidad' (reactiva/condicionada al rival, ver
  /// CombatExchangeBadge.tsx y el backend). Null en habilidades 'general' o partidas antiguas.
  rol: 'ataque' | 'defensa' | 'utilidad' | null
  /// Bug real (2026-08-28, "jugando no se ve el +2/+4 de las habilidades de arma/clase") —
  /// bonus fijo al atributo CRUDO (ANTES del multiplicador de tipo) que esta habilidad concreta
  /// suma al usarla, ver ExchangeParticipant.attributeBonus (backend). 0/null = sin bonus propio
  /// (Ataque Básico y el resto de habilidades genéricas).
  attributeBonus?: number | null
}

export type CondicionFisica = 'ILESO' | 'HERIDO' | 'GRAVE' | 'CONVALECIENTE' | 'MUERTO'
export type Dificultad = 'NOVATO' | 'MEDIO' | 'AVANZADO'

/// Interacción con un NPC/fauna ya convaleciente o muerto, fuera de combate (docs/19-post-combate-
/// y-recompensas-mision.md pieza 2) — lo que devuelve /turn/classify en vez de la clasificación
/// normal cuando el jugador nombra a alguien ya resuelto que sigue en escena.
/// Restringido a MUERTO (2026-08-30, rediseño de "Matar") — antes también cubría CONVALECIENTE;
/// ese caso ahora fluye como acción normal (`explicitTargetVivo`, backend), nunca corta el turno
/// aquí. Ver `postCombatInteraction.ts` (backend) para el detalle completo.
export interface PostCombatInteractionInfo {
  slug: string
  name: string
  condicionFisica: 'MUERTO'
  saqueado: boolean
}

/// Fase 2 de efectos de clase (2026-08-27, AUMENTO/DEBILIDAD con duración real por turnos — ver
/// activeEffects.ts en el backend). `magnitude` viaja con signo (positivo AUMENTO, negativo
/// DEBILIDAD); `attribute` es siempre el mismo que el atributo con el que se tiró la habilidad que
/// lo generó, nunca uno distinto.
export interface ActiveEffect {
  attribute: Attribute
  magnitude: number
  turnsRemaining: number
  sourceAbility: string
}

/// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX) — `clima` es null fuera de
/// Las Llanuras del Viento Rojo (única región con clima real diseñado hoy, ver `worldClock.ts`
/// backend). `nombre` ya viene resuelto por raza (Kektira para orcos, glosa común para el resto).
export interface EntornoTemporalInfo {
  estacion: { key: 'PRIMAVERA' | 'VERANO' | 'OTONO' | 'INVIERNO'; nombre: string }
  clima: { key: 'CLIMA_LLEVABLE' | 'VIENTO_FUERTE' | 'TORMENTA_GRANDE' | 'TORMENTA_EXTREMA'; nombre: string } | null
}

/// WorldState.agenda (2026-08-27, auditoría backend↔frontend + diseño/UX § 2.3) — hito de mundo
/// real que avanza solo con el tiempo de ficción si nadie interviene (worldAgenda.ts, backend).
export interface AgendaEntryInfo {
  id: string
  title: string
  stage: number
  maxStage: number
}

export interface NpcInSceneInfo {
  slug: string
  name: string
  // Estado real de NpcState al empezar este combate (2026-07-19) — evita que el popup asuma
  // siempre ILESO/sin saquear para un NPC que ya venía herido o saqueado de un encuentro anterior.
  condicionFisica: CondicionFisica
  saqueado: boolean
  // Saqueo parcial (2026-07-31) — nombres de objeto ya copiados al inventario de este NPC en esta
  // partida, para que el modal de saqueo pueda dejar de ofrecer lo que ya te llevaste.
  lootedItemNames: string[]
  // Rediseño de combate (2026-08-09, "Analizar rival") — gatea si CombatPanel.tsx § EnemyFicha
  // muestra el atributo recomendado contra este rival. Sin analizar, la ficha no muestra nada.
  analizado: boolean
  // Bug real jugando en vivo (2026-08-26, "le doy a Capturar y no hace nada") — gatea el botón
  // "Capturar" de la tarjeta Matar/Capturar/Clemente (LogPanel.tsx § convalecienteOffers): sin
  // `atributoResistencia` en el backend no hay tirada opuesta posible, el POST siempre rechaza.
  capturable: boolean
  /// Fase 2 de efectos de clase (2026-08-27, indicador de combate) — AUMENTO/DEBILIDAD activos
  /// sobre este NPC ahora mismo.
  activeEffects: ActiveEffect[]
  /// Identificador de combatientes duplicados (2026-08-27, bug real jugando: "ataqué a los dos
  /// buitres a la vez" — en realidad no podía dirigir el golpe al segundo, `slug` no basta cuando
  /// dos `CombatParticipant` de un `CombatEncounter` de grupo comparten el mismo Npc de catálogo).
  /// `participantId` = `CombatParticipant.id` real, siempre único — sustituye a `slug` como key/
  /// identificador en la UI de combate. `instanceNumber` = 1/2/3... SOLO cuando hay más de un
  /// combatiente con el mismo `slug` en esta lista (null en el caso normal, un único enemigo, para
  /// no mostrar "#1" cuando no hace falta desambiguar nada). Ambos undefined en combate 1v1 clásico
  /// (sin `CombatEncounter` de por medio, no hay `CombatParticipant` que exponer).
  participantId?: string
  instanceNumber?: number | null
}

/// Un enlace de objeto/habilidad estilo World of Warcraft, insertado dentro del propio texto
/// libre del composer (no como adjunto aparte): chip no editable con icono + nombre, tooltip con
/// la descripción al pasar el ratón. Ver ChatComposer.tsx.
export interface ComposerChip {
  icon: string
  label: string
  description?: string
  /// Texto real que se manda al backend al serializar (ver ChatComposer.tsx) — por defecto, si no
  /// se da, se usa `label`. Necesario para habilidades: el chip muestra el nombre corto ("Furia de
  /// Maktor"), pero lo que debe leer el modelo es el `promptText` completo de la acción, no el
  /// nombre (bug real encontrado 2026-07-21: sin esto, usar cualquier habilidad mandaba solo su
  /// nombre entre comillas, sin ninguna descripción de la acción física).
  value?: string
}

export interface CurrentLocationInfo {
  id: string
  slug: string
  name: string
  region: string
  description: string
}

export interface DestinationInfo {
  locationId: string
  slug: string
  name: string
  minutos: number
}

export interface ProgressionResult {
  xpDelta: number
  newXp: number
  newLevel: number
  leveledUp: boolean
  attributePointsGained: number
  /// Espejo de `ProgressionResult` en el backend (progression.ts) — desglose opcional de `xpDelta`
  /// entre XP de tirada normal y XP de hito/capítulo (UX 2026-09-01).
  xpTirada?: number
  xpHito?: number
  xpHitoLabel?: string | null
}
