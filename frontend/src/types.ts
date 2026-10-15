/// Rediseño de atributos (2026-07-29, referencia Baldur's Gate 3/D&D — mismo motor de dados y
/// tablas de XP que ya usa Tarkor): los 6 clásicos de D&D (Voluntad = Sabiduría, mismo nombre que
/// ya usaba el proyecto) + Magia aparte (renombrado desde "Arcano" el 2026-09-01, ver
/// docs/rpgtarkor/sistemas-combate/clases.md § Atributo Magia), porque en el lore de Tarkor la magia es
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

/// Riesgo de cazar el grupo de una tarjeta de encuentro (F9-1) — calculado por el backend
/// (`riesgoDeCaza`, cazaRiesgo.ts); `motivo` viene vacío si es 'bajo'.
export interface RiesgoCazaInfo {
  riesgo: 'bajo' | 'alto' | 'mortal'
  motivo: string
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
  /// Array (hallazgo 13, 2026-09-06) — una receta puede exigir cualquiera de varias ubicaciones
  /// válidas (p.ej. "recoger agua", varios puntos de agua distintos), no solo una.
  requiredLocationName: string | string[] | null
  /// Reglas de reino (auditoría 2026-08-13: cupo de Ayuntamiento, misma región, distancia,
  /// nivel-anterior-correcto al mejorar, un solo Ayuntamiento) — solo viene relleno cuando
  /// materiales/atributos YA se cumplen (mismo criterio que el backend). null = no aplica o no
  /// bloquea.
  blockedReason: string | null
}

/// Icono de parcela en el mapa de Zona (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — una
/// por cada `Parcela` sembrada en la Location actual (`ZonaResponse.parcelas`, backend). Solo las
/// zonas-interior de Capital/Cuartel Avanzado tienen filas reales; el resto del mundo siempre `[]`.
/// Shape mínimo para pintar el icono/decidir qué modal abrir — el contenido real (candidatas,
/// `blockedReason`) se pide aparte bajo demanda, ver `ParcelaDetailInfo` abajo.
export interface ZonaParcelaInfo {
  id: string
  x: number
  y: number
  tipo: 'BASICA' | 'AVANZADA'
  /// Ya construido aquí — el icono/modal muestran el edificio real en vez de un hueco vacío, y
  /// nunca ofrecen "Construir".
  building: { id: string; name: string; status: string } | null
}

/// Detalle bajo demanda de una parcela concreta (GET /saves/:id/parcelas/:parcelaId) — se pide al
/// abrir el modal, mismo criterio que el resto de modales de detalle del proyecto (el mapa solo
/// pinta iconos con lo mínimo, el detalle real es una llamada aparte). `candidates` reutiliza
/// `RecipeStatusInfo` tal cual (mismo shape que ya devuelve /recipes-status, sin inventar un tipo
/// paralelo) — AVANZADA siempre trae 1 sola candidata (su `recipeKeyFijo`); BASICA trae todas las
/// que apliquen, el jugador elige cuál construir.
export interface ParcelaDetailInfo {
  parcela: { id: string; tipo: 'BASICA' | 'AVANZADA'; x: number; y: number; locationName?: string }
  ocupada: boolean
  building: { id: string; name: string; status: string } | null
  candidates: RecipeStatusInfo[]
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

// Fase 10 (2026-09-29, "todas las tiradas visibles") — tiradas que antes se descartaban en el
// backend y que ahora viajan en la respuesta y se guardan en `LogEntry.roll`, discriminadas por
// `kind` (un `RollInfo` de combate/huida/turno normal NO trae `kind`).

/// Segunda tirada de tier alto por objeto afectado (backend recolectar.ts § SegundaTiradaInfo).
export interface SegundaTiradaInfo {
  sourceSlug: string
  itemSlug: string
  itemName: string
  roll: GatheringRollInfo
  dificultad: number
  grado: 'fallo' | 'con_coste' | 'claro'
  paso: boolean
}

/// Recolección: tirada de Explorar (solo desde el mapa) + segundas tiradas de tier alto.
export interface RecoleccionLogRoll {
  kind: 'recoleccion'
  tirada?: GatheringRollInfo
  segundas?: SegundaTiradaInfo[]
}

export interface IniciativaEncuentroLado {
  attribute: 'destreza'
  value: number
  roll: number
  bono: number
  result: number
}

/// "¿Quién ve a quién primero?" — Destreza vs Destreza al toparse con un encuentro en Zona.
export interface IniciativaEncuentroLogRoll {
  kind: 'iniciativa-encuentro'
  quienInicia: 'jugador' | 'npc'
  jugador: IniciativaEncuentroLado
  npc: IniciativaEncuentroLado
  npcName: string
}

/// Caza sigilosa: d100 contra la probabilidad real (éxito si `roll <= chance`).
export interface CazaSigiloRoll {
  kind: 'caza-sigilo'
  chance: number
  roll: number
  exito: boolean
  npcName: string
}

/// "Cuántos del grupo entran al combate" (d6) por especie.
export interface TiradaGrupoInfo {
  slug: string
  name: string
  roll: number
  delta: -1 | 0 | 1
  cantidadElegida: number
  avistados: number
  cantidadTirada: number
  cantidadReal: number
}

/// Iniciativa de un participante del combate múltiple, ya en orden de actuación.
export interface IniciativaParticipanteInfo {
  participantId: string
  nombre: string
  bando: 'JUGADOR' | 'ENEMIGO'
  attribute: 'destreza'
  value: number
  roll: number
  result: number
  rolls: number[]
}

export interface CombateGrupoLogRoll {
  kind: 'combate-grupo'
  engagement: TiradaGrupoInfo[]
  iniciativa: IniciativaParticipanteInfo[]
}

export type ExtendedLogRoll = RecoleccionLogRoll | IniciativaEncuentroLogRoll | CazaSigiloRoll | CombateGrupoLogRoll

/// `LogEntry.roll` = tirada de combate/turno (`RollInfo`) o una de las tiradas de arriba.
export type LogEntryRoll = RollInfo | ExtendedLogRoll

export function isExtendedLogRoll(roll: LogEntryRoll | undefined | null): roll is ExtendedLogRoll {
  return !!roll && 'kind' in roll
}

export interface RollInfo {
  attribute: Attribute
  value: number
  /// Dado 1d20 en crudo (el backend ya lo manda dentro de este mismo objeto) — desglose real en
  /// RollBadge.tsx: 2026-07-24, "25 Destreza Éxito" no decía si fue un buen dado o buena estadística.
  roll: number
  difficulty: number
  result: number
  success: boolean
  /// Grados de éxito (2026-07-19, binario desde el 2026-09-07 — hallazgo 15/19b, "con coste"
  /// retirado por ser puramente cosmético) — opcional porque tiradas persistidas antes de este
  /// campo no lo tienen; el badge cae de vuelta a solo éxito/fallo en ese caso.
  gradoExito?: 'claro' | 'fallo'
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
  /// B23 (2026-09-28) — el atacante es un NPC que no ataca: su "golpe" nunca hace daño.
  atacanteInofensivo?: true
  /// P96 (QA-27): golpe de gracia a un convaleciente — acierta sin tirada de defensa.
  golpeDeGracia?: true
  /// Combate de grupo: nombre del rival en este intercambio (Fase G del 0.1, hallazgo G15).
  rivalNombre?: string
}

/// Tirada de iniciativa para el PRÓXIMO intercambio de combate (backend, combatExchange.ts §
/// InitiativeResult) — presente solo si hubo intercambio mecánico real este turno. Persistida en
/// LogEntry.initiativeRoll (2026-08-21, bug real jugando en vivo: "al recargar la página se está
/// perdiendo el mensaje de la iniciativa y la tirada de los dados").
/// Enriquecida (2026-09-04, centralización de todas las tiradas del juego) — antes solo
/// `{ganador, jugadorTirada, npcTirada}` (dos números planos, sin desglose); ahora cada lado es un
/// `CombatExchangeSideInfo` completo (roll crudo, malus por condición, attributeBonus, sin
/// multiplicador de tipo — ver comentario del backend en combatExchange.ts § rollInitiative), listo
/// para alimentar `DiceRollVs` (DiceRoll.tsx) igual que un intercambio de ataque/defensa.
export interface InitiativeRollInfo {
  ganador: 'jugador' | 'npc'
  jugador: CombatExchangeSideInfo
  npc: CombatExchangeSideInfo
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

/// UX-38 (hito 0.2) — metadatos de una noticia de «El mundo» (`LogEntry.noticia` en backend).
export interface NoticiaMeta {
  categoria?: 'CONFLICTO' | 'COMERCIO' | 'NATURALEZA' | 'REINO' | 'GENTE'
  /// Oportunidad que abre: dónde y hasta qué minuto de ficción.
  oportunidad?: { lugar: string; locationId: string; venceEn: number }
  /// Resumen de varios días: primera línea cabecera, el resto una noticia por línea.
  resumen?: true
  /// En un resumen: los metadatos de cada línea, en orden (null si la línea no tenía).
  lineas?: (NoticiaMeta | null)[]
  /// CR-34 (34e): propuesta de tratado o alianza de una facción al Reino, con plazo (minuto de
  /// ficción) y, si ya se cerró, la respuesta.
  propuesta?: { id: string; faccion: string; tipo: 'TRATADO' | 'ALIANZA'; venceEn: number; respuesta?: RespuestaPropuesta }
  /// CR-18: suceso del que es noticia (enlace a Leyendas).
  sucesoId?: string
  /// CFG-35: nivel del suceso (avisos emergentes según el umbral elegido).
  nivel?: 'NORMAL' | 'DESTACADO' | 'GRAVE'
  /// CR-18 / NAR-9: rumor sin confirmar; región donde pasó y minuto de ficción en que pasó.
  rumor?: { region: string | null; pasoEn: number }
}

export type RespuestaPropuesta = 'ACEPTADA' | 'RECHAZADA' | 'CADUCADA'

export interface LogEntry {
  id: string
  channel: LogChannel
  text: string
  timeLabel: string
  noticia?: NoticiaMeta
  roll?: LogEntryRoll
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
  /// Feedback de UX (2026-09-04, misma petición que `factionRepChange` de arriba, ver auditoría
  /// "representar siempre XP/profesión/reputación") — mismo patrón: el backend ya subía XP/nivel
  /// de oficio al craftear/construir con éxito, pero nunca llegaba al jugador salvo abriendo el
  /// panel de Habilidades a mano. `undefined` en la inmensa mayoría de turnos. Un único chip por
  /// `LogEntry` (a diferencia del array `professionXpGains` del backend) — hoy nunca hay más de
  /// uno por turno; si algún día lo hubiera, el caller añade un `LogEntry` extra por cada uno,
  /// mismo criterio que ya usa `questCompletedInfo` para no forzar un array aquí sin necesidad.
  professionXpGain?: { oficio: string; xpDelta: number; newLevel: number; leveledUp: boolean }
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
  npcAbilityUsed?: { npcName: string; abilityName: string; rol: 'ataque' | 'defensa'; inofensivo?: true }
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
  dynamicModeOffer?: {
    tipo: 'NPC' | 'FAUNA' | 'RECURSO'
    targetSlug: string
    targetName: string
    /// P141: a quién se dirige «Responder», ya en frase («al orco desconocido»). Solo NPC; ausente
    /// en ofertas guardadas antes (se usa «a <targetName>»).
    aQuien?: string
    busy?: boolean
    error?: string
    /// "¿Quién ve a quién primero?" (2026-09-17) — solo presente cuando la oferta viene de una
    /// colisión real de Zona (`MoverZonaResultado.dynamicModeOffer`); `undefined` en el resto de
    /// orígenes (turno normal de texto libre). Ver `interactuarModoDinamico`, api.ts.
    quienInicia?: 'jugador' | 'npc'
    /// AGRESIVO/ENEMIGO (2026-09-20) — true cuando este encuentro puede desembocar en combate real
    /// desde el propio botón de Interactuar (ver `interactuarModoDinamico`, api.ts). `undefined`
    /// para el resto de temperamentos, que siguen abriendo conversación normal.
    combateForzado?: boolean
    /// Grupos de fauna reales (Fase 1, 2026-09-28) — id del `ZonePoint` colisionado, ausente para un
    /// dinámico sin `ZonePoint` propio. Fase 2 (botón Cazar de la tarjeta) lo usa para exigir que se
    /// caza EXACTAMENTE lo que se tiene delante, nunca por sorteo.
    zonePointId?: string
    /// Cuántos individuos representa este encuentro AHORA MISMO — 1 para NPC/RECURSO/dinámicos
    /// (nunca se agrupan), puede ser >1 para un grupo de FAUNA real. Ver `LogPanel.tsx`, título de
    /// la tarjeta "Un grupo de N {nombre}" cuando es >1.
    cantidad?: number
    /// Aviso de riesgo de la tarjeta "Cazar" (F9-1, decisión de Álvaro, 2026-09-29) — solo FAUNA no
    /// forzada con `zonePointId`. Solo avisa, no cambia ninguna regla de caza.
    riesgoCaza?: RiesgoCazaInfo
    /// P124 (QA-27): plural del nombre para un grupo de fauna, del backend («Guchapos»).
    nombrePlural?: string
    /// Método de obtención de la fuente (solo RECURSO, 2026-09-29) — decide el verbo del botón del
    /// modal de detalle (`etiquetaAccionRecurso`). Ausente en ofertas antiguas persistidas.
    metodo?: MetodoObtencion | null
  }
  /// Menú contextual de interacción con NPC (2026-09-06) — mismo criterio exacto que
  /// `dynamicModeOffer`: tarjeta con un botón por opción, `busy`/`error` para no perder la tarjeta
  /// si la petición falla.
  /// `desdeEncuentro` (P142): abierto desde la tarjeta de un encuentro del mapa; sustituye a esa
  /// tarjeta mientras está abierto, y «Charlar» abre la escena libre del encuentro.
  npcInteractionOffer?: { npcSlug: string; npcName: string; options: string[]; busy?: boolean; error?: string; desdeEncuentro?: boolean }
  /// CONVALECIENTE deja de ser "victoria automática" (2026-08-26) — presente en el turno de
  /// combate en que uno o más NPC pasan a CONVALECIENTE por primera vez; LogPanel pinta, por cada
  /// uno, una tarjeta con Matar/Capturar/Clemente (mismo fondo amarillo que `questOffer`). Efímero
  /// tal cual, pero el estado de "ya resuelto" no se limpia aquí — se deriva en vivo comparando
  /// `combatKey` (participantId si existe, si no npcSlug — ver `combatKeyFor`) contra
  /// `combatNpcsDisplay` (useCombatFlow.ts), así que sigue siendo correcto incluso si la jugadora
  /// responde desde una tarjeta de un turno anterior a esta.
  /// `combatKey` (bug real, 2026-09-04, combate múltiple con 2+ individuos del mismo slug —
  /// "Zense Ceniza #1/#2/#3/#4"): antes solo se guardaba `npcSlug`, compartido por TODOS los
  /// individuos de la misma especie en el mismo `CombatEncounter` — el "¿ya resuelto?" de
  /// `LogPanel.tsx` siempre resolvía al PRIMERO de ese slug en `combatNpcsDisplay`, y el propio
  /// botón "Matar"/"Capturar"/"Clemente" llamaba a `handleMatarConvaleciente` con ese slug puro,
  /// que nunca coincide con ningún `combatKeyFor` real (siempre un `participantId` cuando hay
  /// varios) — el clic no hacía NADA en el backend, la tarjeta solo desaparecía por el falso
  /// positivo del "ya resuelto". Mismo patrón que el bug ya cerrado en `useCombatFlow.ts`
  /// (2026-08-29) y en la propia `LogPanel.tsx` (2026-09-03), reaparecido aquí porque esta
  /// oferta efímera nunca llegó a transportar el dato.
  convalecienteOffers?: { npcSlug: string; combatKey: string; npcName: string; capturable: boolean }[]
  /// Recolección por texto libre (Pieza 6d, 2026-09-03, "mundo determinista, el narrador solo
  /// narra") — presente en la LogEntry de bloqueo cuando el jugador citó una fuente real de
  /// recolección de terreno (MINERIA/TALA/EXTRACCION/PESCA/BUSQUEDA) por texto libre. Fase 4
  /// (2026-09-28, `plan-mecanicas-por-zona-2026-09-28.md`): esas fuentes ya no tienen ninguna
  /// habilidad/modal que abrir — el botón pasa a abrir el mapa de movimiento de zona (mismo
  /// `ZonaMovimientoModal` que ya abre el icono 🧭 en GameView), no `HarvestSelectionModal`.
  /// Mismo criterio efímero que `questOffer`/`dynamicModeOffer` — nunca sobrevive a una recarga.
  harvestSuggestion?: { sourceName: string }
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
  /// Habilidad "Comer/Beber" (2026-09-04, panel del mismo nombre) — null en objetos que no sacian
  /// hambre.
  curaHambre?: number | null
  /// Puntos porcentuales de Sed que restaura al usarlo (hallazgo 13, revisar-partida-hallazgos.md
  /// 2026-09-06) — mismo criterio que `curaHambre`. Sustituye al viejo botón fijo "Beber agua".
  curaAgua?: number | null
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
  /// Grupos de combate (2026-09-08) — 0 = Grupo 1 (el que entra a combate en directo, junto al
  /// jugador). Gestión real (mover/renombrar/crear) vive en CombatGroupsModal.tsx.
  combatGroupSlotIndex: number
  /// CR-15 (hito 0.3): lo que piensa de ti, 0-100 (null para animales y trabajadores del Reino).
  aprobacion?: number | null
  /// Producción de Reino estilo Bellwright (hueco D, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md
  /// § 4.4-ter) — a qué Building está asignado como trabajador; null = no asignado.
  buildingId: string | null
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

export type QuestStatus = 'ACTIVA' | 'COMPLETADA' | 'FALLIDA' | 'ABANDONADA'

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
  /// CR-40 (40g): misión secundaria del motor (sin él, del narrador o fija).
  tipoMision?: string | null
  progreso?: number
  cantidad?: number | null
  /// P183 (QA-27): por qué no se puede «Entregar» ahora (null o ausente: se puede). Lo decide el servidor.
  entregaBloqueada?: string | null
  /// Minuto de ficción en que vence.
  venceEn?: number | null
  /// Quién la encarga (NPC con nombre o facción).
  encarga?: string | null
  recompensa?: { xp: number; goirnos: number; reputacion: number } | null
}

/// 'profesion' (2026-08-07) — habilidades de oficio desbloqueadas por nivel, su propia pestaña
/// "Profesiones" en el panel de Habilidades (ver HabilidadesPanel.tsx), distinta de "Generales".
/// 'reino' (2026-08-13) — TODAS las recetas de construction.ts (Campamento, Ayuntamiento x3, y
/// cualquier edificio con oficio como la Choza), en su propia pestaña "Reino": tengan oficio o no,
/// son "edificar algo del mundo persistente", un concepto distinto de "craftear un objeto propio"
/// (profesion) o "acción de siempre disponible" (general) — nunca creable a mano por la jugadora
/// (ver AbilityForm.tsx, solo ofrece 'general').
export type SavedActionCategory = 'combate' | 'general' | 'profesion' | 'reino'

/// Barras de habilidades múltiples fuera de combate (2026-09-04, v2 de la SkillBar única de
/// 2026-08-29; v3 2026-09-06, hallazgo 10 de la sesión de pruebas: 3 barras EN GENERAL sin
/// distinguir categoría, en vez de 3 por cada una) — Combate NO participa aquí, sigue con su
/// cinturón propio. `SkillBarCategory` ya no describe una `SkillBarInfo` (que no tiene categoría
/// propia) — sigue viva solo como filtro de `SavedActionInfo.category` para los 3 tabs del editor.
export type SkillBarCategory = 'general' | 'profesion' | 'reino'

export interface SkillBarInfo {
  id: string
  /// 0-2 — la barra base (0) nunca se puede borrar.
  slotIndex: number
  name: string
  /// Nombres de SavedAction en orden (drag-and-drop), ya saneados por el backend contra las
  /// habilidades reales de las 3 categorías admitidas (General/Profesión/Reino, nunca Combate) —
  /// resolver icono/descripción cruzando contra `savedActions` por `name`, mismo patrón que ya usa
  /// CombatAbilityBelt.tsx. Una misma barra puede mezclar habilidades de varias categorías.
  abilityNames: string[]
}

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

/// Sistema de clases (2026-08-24, docs/rpgtarkor/sistemas-combate/clases.md) — mismo enum `Clase` que el backend
/// (schema.prisma), replicado a mano (sin cliente Prisma en frontend, mismo criterio que Dificultad).
export type Clase = 'GUERRERO' | 'CAZADOR' | 'CHAMAN' | 'ARQUERO' | 'CABALLERO' | 'MAGO' | 'SEGADOR' | 'ASESINO' | 'DRUIDA'

/// Especialización elegida a nivel 10 dentro de una Clase — mismo enum `Especializacion` del
/// backend, 30 valores (no todos con contenido real construido, ver `especializacionesConHuecosPara`).
export type Especializacion =
  | 'BERSERKER'
  | 'GUARDIAN'
  | 'LANCERO'
  | 'ESPECIALISTA'
  | 'DOMADOR'
  | 'SUPERVIVENCIA'
  | 'TIRADOR'
  | 'INSTINTIVO'
  | 'TOTEMICO'
  | 'RUNICO'
  | 'CONVOCADOR'
  | 'OPRESOR'
  | 'MAESTRO_ARQUERO'
  | 'MAESTRO_BALLESTERO'
  | 'CABALLERO_DEL_ORDEN'
  | 'CABALLERO_DEL_VALOR'
  | 'CABALLERO_DEL_DOLOR'
  | 'PODER_MAGIA'
  | 'PODER_SEMILLA'
  | 'PARCA'
  | 'MALDITO'
  | 'ILUSTRADO'
  | 'TRANSMUTADOR'
  | 'MAESTRO_ASESINO'
  | 'ASESINO_TOXICO'
  | 'ASESINO_DANZANTE'
  | 'ASESINO_SELECTO'
  | 'CAMBIAFORMAS'
  | 'AULLADOR'
  | 'SALVAJE'
  | 'ADAPTADO'

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
  /// P97 (QA-27): fauna: se desuella (panel de Desollar), no se saquea.
  esFauna?: boolean
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

/// Clave de estación, alias reutilizable (2026-09-04, Diario en pestañas Año/Estación/Día) — antes
/// solo vivía inline dentro de `EntornoTemporalInfo.estacion.key`.
export type EstacionKey = 'PRIMAVERA' | 'VERANO' | 'OTONO' | 'INVIERNO'

/// Estación/clima (2026-08-27, auditoría backend↔frontend + diseño/UX) — `clima` es null fuera de
/// Las Llanuras del Viento Rojo (única región con clima real diseñado hoy, ver `worldClock.ts`
/// backend). `nombre` ya viene resuelto por raza (Kektira para orcos, glosa común para el resto).
export interface EntornoTemporalInfo {
  estacion: { key: EstacionKey; nombre: string }
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
  /// CR-44: perdió el valor y huyó del combate este turno (sale del combate, sin botín).
  huido?: boolean
  /// CR-45: es el capitán de su bando y manda caer sobre este (`'ti'` o el nombre de un compañero).
  ordenaCaerSobre?: string
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
  /// "Matar" persistido (2026-09-05, bug real: se perdía al recargar) — mismo criterio que
  /// `analizado`: llega ya resuelto del backend (`NpcState.targetedForKill`), en vez de vivir solo
  /// en `combatNpcStates` de React. Solo combate 1v1 clásico por ahora, siempre `false` en combate
  /// múltiple (no soportado todavía en el backend para ese camino).
  targetedForKill?: boolean
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
  /// QA-27 P39: punto de agua real, se puede beber sin odre.
  puntoDeAgua?: boolean
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

/// Espejo de `enum MetodoObtencion` (backend, schema.prisma) — qué verbo exige una fuente de recolección.
export type MetodoObtencion = 'PASIVO' | 'CAZA' | 'TALA' | 'MINERIA' | 'EXTRACCION' | 'PESCA' | 'BUSQUEDA'
