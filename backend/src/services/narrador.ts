import { ollamaGenerate, ollamaGenerateStream } from '../lib/ollama.js';
import { extractStreamingNarration } from './narrationStream.js';
import { env } from '../config/env.js';
import { normalizeText, fuzzyMatchCandidates, findFuzzyStemMatch } from './travel.js';
import { includesNameOrPlural } from './itemReference.js';
import { detectsAttackIntent, detectsHostileSearchIntent } from './npcScene.js';
import { similarity, factSimilarity } from './worldFacts.js';
import type { Attribute, RollResult } from './dice.js';
import type { CondicionFisica, Clase } from '@prisma/client';

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia'];

/// Ejemplo few-shot (2026-07-31, "brainstorming de mejora de narración" — idea de la usuaria:
/// enseñar ejemplos reales en vez de solo acumular más reglas de prosa). Un modelo pequeño sigue
/// un ejemplo concreto mejor de lo que obedece una instrucción abstracta — extraído de un turno
/// real de partida (auditoría "revisar partida" 2026-07-30) que ya cumplía todo lo que se le pide
/// en `fixedInstructions`: frase corta, una consecuencia concreta (cae y jadea, no solo "lo
/// golpea"), y el NPC respondiendo en primera persona con SU propio carácter — justo el fallo más
/// grave y repetido que se ha visto en partida real (el modelo perdiendo el nombre/personalidad/
/// sexo de un NPC en un diálogo, ver comentario de `combatBlock` más abajo). Constante a nivel de
/// módulo, va PRIMERO en el prompt (antes de `fixedInstructions`) para que sea la parte más
/// estable posible de cara al caché de prefijo de Ollama — nunca cambia turno a turno.
const GOOD_NARRATION_EXAMPLE = `EJEMPLO DE BUEN ESTILO (referencia de tono/extensión — el contenido es de OTRA partida, ignóralo como hecho, fíjate solo en la forma): "Gorhorn aprovecha para darle una patada certera a las costillas del orco, haciendo que este tropiece y caiga al suelo, jadeando. «¡Maldita sea! ¿Crees que podrás contenerme? Espera a que me des la señal...»" — directo, sin relleno, con una consecuencia física concreta, y el NPC hablando en primera persona con su propio carácter (nunca genérico, nunca puesto en boca del personaje del jugador).`;

export type Banda = 'instantanea' | 'corta' | 'extendida' | 'larga';

export interface ClassificationResult {
  requiereTirada: boolean;
  atributo: Attribute;
  dificultad: number;
  razon: string;
  /// Bandas de tiempo (docs/mecanicas/08-acciones-por-tiempo.md § 2) — cuánto tarda la acción EN LA
  /// FICCIÓN, no en tiempo real de espera. "instantanea" son segundos (examinar, hablar,
  /// atacar); "corta" minutos (cortar leña, buscar en una zona); "extendida" horas (descanso
  /// corto, tramo de viaje); "larga" días+ (construir un campamento, viaje regional).
  banda: Banda;
  duracionEstimadaMinutos: number;
}

export type HitoTipo = 'descubrimiento' | 'objetivo_menor' | 'objetivo_mayor';

export interface NarrationResult {
  narration: string;
  newFacts: string[];
  /// Solo presente cuando la acción resulta de verdad en conseguir/fabricar un objeto físico
  /// duradero — la mayoría de turnos no tocan esto (ver instrucción en el prompt).
  newItem?: { name: string; description: string } | null;
  /// Solo presente cuando la acción resulta de verdad en ganar un aliado/compañero real — poco
  /// frecuente a propósito, y nunca contradice que el personaje vaya solo salvo que la acción
  /// sea explícitamente sobre reclutar/aliarse con alguien.
  newCompanion?: { name: string; role: string; notes: string } | null;
  /// docs/mecanicas/10-niveles-xp-reino.md § 3.2: el modelo solo propone el TIPO de hito narrativo, el
  /// backend traduce a XP. "capitulo" no está aquí porque ese lo emite el backend, no el modelo.
  hito?: HitoTipo | null;
  /// docs/mecanicas/10-niveles-xp-reino.md § 5: eventos de Reino, uno por turno como mucho, poco frecuentes
  /// a propósito — el backend valida y materializa (mismo patrón que newItem/newCompanion).
  newTerritory?: { name: string; region?: string; description: string } | null;
  newBuilding?: { name: string; kind: string; description: string; territoryName?: string } | null;
  newSubject?: { name: string; role: string; notes: string; territoryName?: string } | null;
  /// docs/mecanicas/09-panel-personaje.md (pestaña Misiones): solo cuando la escena establece de verdad un
  /// objetivo narrativo con entidad propia (no cualquier intención pasajera) — mismo patrón que
  /// newTerritory/newBuilding/newSubject, el backend valida y materializa.
  newQuest?: { title: string; description: string } | null;
  /// Cierra una misión ACTIVA ya existente (matchea por título, backend valida que exista) —
  /// "completada" o "fallida" según cómo se resuelva en la narración.
  questProgress?: { title: string; status: 'COMPLETADA' | 'FALLIDA' } | null;
  /// docs/mecanicas/14-combate-y-muerte.md § 2.1: el Narrador marca esto cuando la escena deriva en un
  /// enfrentamiento real (no lo infiere el backend por regex, a diferencia de viajar/recolectar
  /// — un inicio de combate depende demasiado de contexto narrativo). `npcSlugs` viene acotado
  /// por enum a los NPCs ya detectados en escena (§ 2.5 de docs/12): el modelo nunca inventa uno.
  combateIniciado?: { npcSlugs: string[] } | null;
  /// docs/mecanicas/14-combate-y-muerte.md § 1: opcional, el backend valida con nextCondicionFisica()
  /// antes de aplicarla — nunca confía en este valor a ciegas.
  condicionFisica?: CondicionFisica | null;
}

interface TurnContext {
  worldFacts: string[];
  characterSummary: string;
  /// Ver `hasFalseCombatAttacker` más abajo (bug real jugando en vivo, prueba con Playwright,
  /// 2026-08-27) — nombre real del personaje del jugador, solo para comparar sujeto/verbo en ese
  /// guard. A diferencia de las otras 2 interfaces de este archivo con `characterName` (líneas
  /// 420/815), esta no lo tenía hasta ahora — `buildNarrationPrompt` seguía usando solo
  /// `characterSummary` (string libre) para todo lo demás, este campo es exclusivamente para el
  /// guard nuevo.
  characterName?: string;
  action: string;
  /// true si la recuperación de lore (RAG) no encontró nada realmente relevante para esta
  /// acción — en ese caso, exigir "no inventes nada" sin darle material real puede dejar al
  /// modelo sin forma de responder (hipótesis de la usuaria, 2026-07-18, tras un cuelgue
  /// reproducible en una acción de este tipo: "busca un lugar seguro para acampar", donde no
  /// tenemos ningún hecho sobre qué hace seguro un sitio concreto).
  weaklyGrounded?: boolean;
  /// docs/mecanicas/14-combate-y-muerte.md § 2.3: true dentro del popup de combate — cambia el tono a
  /// intercambios cortos y directos, y habilita que el Narrador proponga condicionFisica/
  /// combateIniciado con más margen (ver nextCondicionFisica en services/death.ts).
  enCombate?: boolean;
  /// Slugs de los NPCs ya detectados en escena (docs/12 § 2.5) — lista cerrada para el campo
  /// "combateIniciado.npcSlugs"; vacío = no hay NPC conocido, así que no puede haber combate.
  npcSlugsInScene?: string[];
  /// Ver `hasWrongAggressorName` más abajo — nombres de NPCs en escena que NO pueden ser agresores
  /// por catálogo (temperamento distinto de AGRESIVO/ENEMIGO, ya combinado con reputación real de
  /// facción de esta partida). Auditoría "narrador vs. motor determinista" (2026-08-30, bug real:
  /// "Exploro la zona" narró a un NPC INOFENSIVO como agresor mientras el combate real que el motor
  /// abrió fue contra otro NPC completamente distinto, el único de verdad AGRESIVO en la escena) —
  /// a diferencia de `combatRealTargetName`/`otherNpcNamesInScene` (que solo existen tras un
  /// intercambio de combate ya resuelto), esto está disponible en CUALQUIER turno con NPC vivo en
  /// escena, cubriendo también la apertura de combate desde una acción pasiva sin ataque explícito.
  nonHostileNpcNamesInScene?: string[];
  /// Igual que `nonHostileNpcNamesInScene`, en slug (no nombre) — usado por el guard
  /// `hasWrongAggressorName` para comparar directamente contra el campo estructurado
  /// "combateIniciado.npcSlugs" que el propio LLM devuelve, sin depender de parsear texto libre.
  nonHostileNpcSlugsInScene?: string[];
  /// Ver `hasWrongCelestialReference` más abajo (bug real, sesión autónoma de pruebas 2026-09-04:
  /// "el resplandor de la luna" narrado a las 08:16 de la mañana) — momento del día YA calculado
  /// por el motor determinista (`momentoDelDiaFor`, worldClock.ts, mismo dato que usan las imágenes
  /// de escena y la fauna diurna/nocturna), nunca decidido por el modelo.
  momentoDelDia?: 'dia' | 'noche';
  /// Streaming (roadmap de velocidad, 2026-07-20, punto 13): si se pasa, el intento principal
  /// (el que de verdad ocurre en la inmensa mayoría de turnos) transmite el texto de "narration"
  /// según se va generando, en vez de esperar a tener el JSON entero. Solo cubre el intento 1 —
  /// los reintentos en cascada (attempt2/3, cuelgues/anacronismos reales pero raros) se quedan
  /// no-streaming a propósito, para no complicar el camino que casi nunca se ejecuta.
  onNarrationChunk?: (delta: string) => void;
  /// Se llama si el borrador transmitido por streaming había que descartarlo (el intento 1 falló
  /// o contenía un anacronismo) — el caller debe limpiar cualquier texto parcial ya mostrado,
  /// el siguiente intento no vuelve a transmitir en vivo.
  onNarrationReset?: () => void;
  /// Banda de duración ya decidida en /turn/classify (docs/08 § 2) — usada solo para calibrar
  /// cuánto espacio darle a la narración (2026-07-22, petición explícita: "narraciones cortas
  /// cuando son acciones... quizás largas cuando son de lore, conversaciones, descripciones de
  /// resultados de una acción larga"), nunca para decidir nada mecánico (eso ya lo hizo classify).
  banda?: Banda;
  /// Cuántos de los primeros `worldFacts` son bloques DETERMINISTAS de turnResolution.ts
  /// (contextBlocks: hechos protegidos, ubicación, NPC en escena, escenas obligatorias como la de
  /// Gistera Koh...) en vez de lore recuperado por RAG o `sessionFacts` acumulados. Bug real
  /// (2026-07-23, "revisar partida"): `attempt2` recortaba `worldFacts` a los 2 primeros elementos
  /// a ciegas para acortar un reintento tras timeout/cuelgue — si un bloque obligatorio caía más
  /// allá de esa posición 2 (nada raro, `contextBlocks` suele tener bastantes más), desaparecía
  /// del prompt sin dejar rastro, y con él cualquier escena que ese turno debía forzar sí o sí.
  /// Con esto, el recorte nunca toca los bloques deterministas — solo acorta RAG/sessionFacts,
  /// que es lo realmente prescindible en un reintento de emergencia.
  criticalFactsCount?: number;
  /// Lore recuperado por RAG (roadmap 2026-07-24, "revisar partida" — bug real jugando: Hagar y
  /// Sella Marn, dos NPCs reales del canon pero de OTRAS regiones/tramas, aparecían en persona
  /// en escenas donde no pintaban nada). Antes este lore vivía mezclado dentro de `worldFacts`
  /// bajo el mismo epígrafe "HECHOS DEL MUNDO" que los hechos deterministas de la escena actual
  /// — el prompt nunca distinguía "esto es trasfondo del mundo" de "esto está pasando aquí
  /// ahora", así que un NPC traído por similitud semántica con la acción (p. ej. "hielo sílice"
  /// → Hagar) quedaba con la misma licencia para aparecer que un NPC realmente en escena. Ahora
  /// va en su propio bloque, con la instrucción explícita de que es solo trasfondo/ambientación.
  backgroundLore?: string[];
  /// Repetición casi verbatim entre un turno de combate y el siguiente (2026-07-31, bug real
  /// probando en vivo — "Gorhorn descarga una poderosa hachata hacia atrás contra el orco" salió
  /// dos turnos seguidos, palabra por palabra, pese a que `worldFacts` YA incluye la instrucción
  /// de no repetir — ver comentario de `isTooSimilarToLast` más abajo). Idéntico texto que el
  /// bloque "TU PROPIA NARRACIÓN DEL TURNO ANTERIOR" de `worldFacts` (turnResolution.ts), pero
  /// aparte y sin formatear — aquí hace falta el texto crudo para comparar, no la instrucción.
  lastNarrationText?: string;
  /// Ver `hasFalseCombatHit` más abajo — true cuando el intercambio de combate de este turno
  /// (resolveExchange) resolvió 'ataque_falla' o 'parada_en_seco': los dos únicos resultados donde
  /// NINGÚN lado conecta un golpe de verdad. Si la narración describe contacto/daño de todos
  /// modos, es una alucinación del modelo, no una licencia narrativa — se reintenta.
  combatBothMissed?: boolean;
  /// Ver `hasFalseCombatMiss` más abajo — inverso de `combatBothMissed` (petición explícita,
  /// 2026-08-15, bug real jugando en vivo: tirada 30 vs Media(15) del jugador con Éxito claro
  /// contra la Voluntad(11) del NPC con Fallo — 'golpe_pleno' por OUTCOME_TABLE, `exchangeContextBlock`
  /// ya dice explícitamente "el ataque conecta de lleno, narra el golpe con toda su fuerza" — pero
  /// la narración describió al NPC esquivando "por un pelo"). True cuando el intercambio de este
  /// turno resolvió en un golpe real para algún lado (`golpe_normal`/`golpe_pleno`/`golpes_mutuos`/
  /// `defensor_contragolpea` cuando de verdad contragolpea) — si la narración describe una esquiva o
  /// bloqueo limpio de todos modos, es una alucinación, no una licencia narrativa — se reintenta.
  combatRealHitLanded?: boolean;
  /// Ver `hasFalseCombatMiss` más abajo — mismo bug que `combatRealHitLanded`, pero para un ataque
  /// que nunca pasó por el sistema de combate por intercambios (bug real jugando en vivo, sesión
  /// autónoma 2026-09-05: atacar a fauna/NPC pasivo ANTES de que se abra combate formal se resuelve
  /// como tirada de acción libre — roll con `success:true`/`gradoExito:'claro'`, pero la narración
  /// describió una esquiva limpia). True cuando la acción de este turno era un ataque
  /// (`countsAsAttack`) resuelto FUERA de un intercambio de combate, con éxito real en la tirada.
  nonExchangeAttackHitLanded?: boolean;
  /// Ver `hasFalseDefenseNarration` más abajo — bug real, hallazgo 1 de la sesión autónoma de
  /// pruebas 2026-09-04 (cerrado el 2026-09-05): true cuando el jugador está en el bloque "CASO
  /// DEFENSA" de `turnResolution.ts` (responde a ciegas a un ataque del NPC ya decidido el
  /// intercambio anterior). Si la narración describe una escena de búsqueda/reconocimiento del
  /// enemigo en vez de bloquear/esquivar el golpe recibido, es una alucinación de tipo de acción,
  /// no una licencia narrativa — se reintenta.
  playerActedAsDefenderThisExchange?: boolean;
  /// Ver `hasPrematureCombatResolution` más abajo — true cuando hay un NPC real en escena pero
  /// NINGÚN intercambio de combate se ha resuelto todavía este turno (ni ataque ni "Decapitar"),
  /// típicamente un turno de aceptación/promesa verbal ("Yo me ocupo de tu perseguidor"). Si la
  /// narración describe de todos modos un golpe ya conectado/un enemigo ya herido huyendo, es una
  /// alucinación adelantada del combate, no una licencia narrativa — se reintenta.
  combatNotYetResolved?: boolean;
  /// docs/mecanicas/19-post-combate-y-recompensas-mision.md, pieza 1 — true SOLO en el turno exacto en que
  /// el NPC objetivo pasa a CONVALECIENTE/MUERTO (no si ya estaba así de antes). Usado en
  /// `combatBlock` para pedir explícitamente que se narre el momento de caer inconsciente/morir,
  /// en vez de dejarlo implícito (hoy el panel de victoria puede aparecer sin que la propia
  /// narración del golpe final lo haya descrito).
  npcFallsUnconsciousThisTurn?: boolean;
  /// Ver `hasInoffensiveNpcNarratedAttacking` más abajo — bug real jugando en vivo (2026-09-06,
  /// "Bulco de Arena" narrado atacando en combate): true cuando `npcParaIntercambio` de este
  /// intercambio tiene `temperamento: 'INOFENSIVO'` o `ataqueNatural` empieza por "No ataca" —
  /// `turnResolution.ts` ya usa este mismo dato para bloquear el daño mecánico
  /// (`jugadorRecibeGolpe = false`), pero nada impedía que el LLM narrara de todos modos un ataque
  /// activo en prosa. Si la narración describe al NPC embistiendo/golpeando/atacando, es una
  /// alucinación de comportamiento — el propio catálogo dice que esa criatura no ataca.
  npcAttackerIsInoffensive?: boolean;
  /// Ver `hasGorhornPronouncingOrcoEnfurecidoName` más abajo — bug real jugando en vivo (2026-09-06):
  /// pese a la instrucción explícita en el contextBlock de la escena de Gistera Koh ("Gorhorn NUNCA
  /// ha oído ese nombre"), el modelo igual le hizo decir "vamos a acabar con ese Orco enfurecido" en
  /// el turno exacto de aceptar ayudarla — una instrucción de prompt reforzada no bastó, hace falta
  /// un guard real. True solo en ese turno concreto (`gisteraSeHaMarchado` sin `gisteraQuestYaExiste`
  /// todavía, mismo criterio que ya usa `gisteraAceptaEsteTurno` más abajo en este archivo).
  gisteraAcceptanceTurnRisksOrcoName?: boolean;
  /// Igual que `npcFallsUnconsciousThisTurn`, pero SOLO cuando el desenlace de este turno es
  /// CONVALECIENTE (nunca MUERTO) — bug real jugando en vivo, 2026-08-22, "he matado a un buitre
  /// pero..." (revisando el log completo: un turno ANTES del remate real, con el rival todavía
  /// CONVALECIENTE, la narración dijo "cae hacia atrás, cayendo inerte sobre el polvo" — justo el
  /// "inconsciente/desmayado/sin sentido" que `combatBlock` ya prohíbe explícitamente para este
  /// caso, sin ningún guard post-generación que lo pillara si el modelo lo ignoraba). Ver
  /// `hasFalseUnconsciousNarration` más abajo.
  npcFallsConvalecienteThisTurn?: boolean;
  /// Ver `hasFalseDeathClaim` más abajo — bug real jugando en vivo (auditoría 2026-08-22, "¿no
  /// queda nada más al revisar la partida?"): un golpe real que solo dejó al rival GRAVE (no
  /// CONVALECIENTE/MUERTO, así que `npcFallsUnconsciousThisTurn` no protege nada aquí) se narró en
  /// prosa honesta ("se desploma hacia atrás, dejando una mancha de sangre") pero escribió en
  /// `newFacts` "Zense Ceniza ha sido derrotado y muerto." — un SessionFact falso persistido para
  /// siempre. True en cualquier turno con un golpe real contra el NPC que NO lo deja MUERTO de
  /// verdad — el caso contrario a `npcFallsUnconsciousThisTurn`/`npcFallsConvalecienteThisTurn`.
  combatNoRealDeathThisTurn?: boolean;
  /// True cuando ESTE intercambio incluye un golpe de vuelta real contra el jugador (petición
  /// explícita, 2026-08-15, bug real jugando en vivo: "acabé con el buitre pero se resistió al
  /// final dándome un golpe... la narración no lo ha explicado" — un contragolpe/golpes_mutuos en
  /// el mismo turno que remata al rival tiende a perderse porque `npcFallsUnconsciousThisTurn` ya
  /// dirige toda la atención del modelo hacia narrar la muerte/caída del rival, sin recordarle que
  /// TAMBIÉN pasó algo real del otro lado). Mismo criterio que `npcFallsUnconsciousThisTurn`: un
  /// hecho mecánico ya resuelto que la narración tiene que reflejar, no una opción.
  jugadorRecibeGolpeEsteTurno?: boolean;
  /// Ver `hasFalseItemUse` más abajo — nombres reales de objetos médicos/de energía que el
  /// personaje lleva encima PERO que este turno no se detectó que usara de verdad (ni
  /// `detectMedicalItemUse` ni `detectEnergyItemUse` los reconocieron en la acción del jugador).
  /// Si la narración de todos modos describe aplicárselos/consumirlos, es una alucinación — el
  /// objeto sigue intacto en el inventario y el jugador se lleva la falsa impresión de haberlo
  /// gastado (y de haberse curado) sin que ninguno de los dos pase de verdad. Vacío = no hace
  /// falta comprobar nada este turno (algún objeto SÍ se usó de verdad, o no hay ninguno médico/
  /// de energía en el inventario).
  possiblyFalseItemUseNames?: string[];
  /// Ver `hasResurrectedDeadNpc` más abajo — nombres reales de NPCs CONVALECIENTE/MUERTO presentes
  /// este turno (ver `npcSceneBlockFor`, npcScene.ts: ya reciben la instrucción explícita "no lo
  /// narres como una amenaza activa... nunca un encuentro nuevo"). Bug documentado en el propio
  /// runbook del proyecto (docs/runbooks/revisar-partida.md § "NPCs que resucitan") — un modelo pequeño a
  /// veces la ignora igual que ignoraba el resto de instrucciones "no hagas X" de esta lista.
  possiblyResurrectedNpcNames?: string[];
  /// Ver `hasFalseNpcAppearance` más abajo (Grupo 3 § Mundo determinista, Capa 3, 2026-08-25) —
  /// nombres reales de NPCs geográficamente plausibles aquí (`candidateNpcNamesNotInScene`,
  /// npcScene.ts) que NINGÚN mecanismo determinista puso en escena este turno concreto. Vacío = no
  /// hay ningún candidato plausible que pueda "colarse" (p.ej. zona sin nadie más en el catálogo).
  possiblyUnauthorizedNpcNames?: string[];
  /// Ver `hasFalseTravelClaim` más abajo — nombres reales de los 2+ destinos posibles cuando
  /// `resolveTravel` (travel.ts) no pudo auto-resolver un "avanzo"/"continúo" sin destino nombrado
  /// (turnResolution.ts ya le pide al modelo explícitamente que pregunte cuál elige, en vez de
  /// inventar una llegada). Vacío = no aplica este turno (viaje resuelto de verdad, un solo
  /// destino, o esta acción no era movimiento vago).
  possiblyFalseTravelDestinationNames?: string[];
  /// Ver `hasFalsePhantomTravel` más abajo — nombre real de la ubicación ACTUAL, solo cuando hubo
  /// intención de viaje real (nombrada o vaga) que `resolveTravel` no pudo resolver mecánicamente
  /// este turno (destino inventado/sin alias real, no el caso de 2+ destinos ambiguos de arriba).
  /// Vacío = no aplica (viaje resuelto de verdad, o esta acción no era de movimiento).
  phantomTravelLocationNames?: string[];
  /// Ver `hasGisteraReencuentroSinNombrar` más abajo — true cuando Gistera Koh ya se marchó para
  /// siempre (mismo cálculo que excluye su slug de `npcsInScene`, turnResolution.ts). Bug real
  /// jugando en vivo, visto ya varias veces: el modelo la reintroduce SIN nombrarla ("una orca
  /// marcada del Clan Serhu, sin nombre revelado") — la exclusión por slug no puede cazar esto
  /// porque nunca la nombra.
  gisteraSeHaMarchado?: boolean;
  /// Ver `hasFalseInventoryReview` más abajo — nombres reales (ya sin sufijo de cantidad, ver
  /// `baseNameOf`) de TODO lo que el personaje lleva encima, solo cuando la acción de este turno
  /// es una revisión de inventario/equipo (`detectsInventoryReviewIntent`, npcScene.ts).
  /// Vacío = no aplica este turno (no es una acción de revisar equipo, o el inventario tiene 0-1
  /// objetos y no hay nada real que omitir).
  possiblyFalseInventoryReviewNames?: string[];
  /// Ver `hasFalseWeaponThrowClaim` más abajo — nombres reales de las armas que el personaje lleva
  /// equipadas (ARMA_PRINCIPAL/ARMA_SECUNDARIA), solo en turnos de combate. Este juego no tiene
  /// ninguna mecánica de "lanzar arma" (sin habilidad, sin recuperarla después) — si la narración
  /// describe el arma saliendo volando de la mano, es una alucinación, nunca una licencia
  /// narrativa: el turno siguiente el jugador sigue atacando con la misma arma sin haberla
  /// recogido. Vacío = no aplica (fuera de combate, o sin arma equipada).
  equippedWeaponNamesInCombat?: string[];
  /// Ver `hasFalseEquipmentChangeClaim` más abajo — nombres reales (sin sufijo de cantidad) de
  /// TODO objeto equipable que el personaje lleva encima, en CUALQUIER turno (equipar/desequipar
  /// es una decisión manual de la jugadora vía `PATCH /saves/:id/inventario/:itemId` — el modelo
  /// nunca lo decide ni lo narra de verdad, así que un cambio de equipo narrado siempre es una
  /// alucinación, sin depender de la intención de este turno). Vacío = no lleva ningún objeto
  /// equipable encima.
  equippableItemNames?: string[];
  /// Ver `hasFalseHealingClaim` más abajo (auditoría de código 2026-08-25, categoría sin guard
  /// hasta ahora) — true solo en un turno de "descansar" libre (sin panel "Curar" explícito) cuyo
  /// techo mecánico real (`healCeilingFor`, death.ts) queda por DEBAJO de ILESO (terreno salvaje,
  /// o refugio/asentamiento que solo llega a HERIDO). Si esto es true, la prosa no puede prometer
  /// una recuperación completa — el resultado mecánico real es peor.
  restHealCeilingBelowIleso?: boolean;
  /// Ver `hasFalseNewItemClaim` más abajo (auditoría de código 2026-08-25, categoría sin guard
  /// hasta ahora) — nombres reales (normalizados) de TODO `ItemCatalog` de este mundo. Un
  /// `newItem` propuesto por el modelo solo se materializa de verdad si su nombre coincide con
  /// uno de esta lista (turnResolution.ts, `catalogMatch`) — si no coincide, la prosa no puede
  /// afirmar que el personaje se queda con/guarda el objeto, porque el inventario real no cambia.
  worldItemCatalogNames?: string[];
  /// Ver `hasFalsePassiveHarvestClaim` más abajo (hallazgo real jugando en vivo, 2026-08-28) —
  /// true si ESTE turno ya tiene algún camino mecánico real de obtención de objeto activo
  /// (recolección/saqueo/construcción/crafteo, ya calculados en turnResolution.ts antes de llamar
  /// aquí). false/undefined = la prosa no tiene ningún respaldo mecánico este turno.
  harvestOrLootActiveThisTurn?: boolean;
  /// Ver `hasFalseCombatTargetName` más abajo (revisión de partida real, 2026-08-14/2026-08-26,
  /// "ataque a Múrgol narrado como si fuera contra Cruzavientos") — nombre real del NPC que este
  /// turno recibió de verdad el intercambio de combate (`npcAttackTarget`, turnResolution.ts).
  /// `undefined` = no aplica (sin intercambio real este turno).
  combatRealTargetName?: string;
  /// Nombres de OTROS NPC/fauna real presentes en la misma escena que `combatRealTargetName` —
  /// candidatos a "colarse" en la prosa en su lugar. Vacío = solo hay un NPC en escena, no hay con
  /// quién confundirlo.
  otherNpcNamesInScene?: string[];
  /// Ver `hasWrongNpcName` más abajo (hallazgo real jugando en vivo, 2026-08-28/29: encabezado
  /// mecánico decía "KIRELON ARENOSO ATACA..." pero la prosa narró "El Quio retrocede..." — Quio
  /// era el rival de un combate ANTERIOR de la misma sesión, ya ausente de la escena actual, así
  /// que `otherNpcNamesInScene` no lo cazaba). Nombres reales de NPCs ya conocidos por esta
  /// partida (`NpcState` propio) que NO son el NPC actual del combate ni están en la escena de
  /// este turno — candidatos a "arrastrarse" del historial de la sesión en vez del rival real.
  possiblyStaleNpcNames?: string[];
  /// Ver `hasIllegitimateMagicVocabulary` más abajo — bug real jugando en vivo (2026-09-01):
  /// Gorhorn (Cazador, orco, sin ninguna clase/habilidad mágica) tuvo su curación por descanso
  /// normal narrada DOS turnos seguidos con imaginería mágica ("un fino escudo de energía
  /// arcana", "el escudo arcáneo se ha fortalecido") — vocabulario que solo tiene sentido para
  /// las 2 clases con vertiente mágica real del catálogo (MAGO por diseño; CHAMAN porque varias
  /// de sus habilidades reales usan `preferredAttribute: 'magia'`, ver classAbilities.ts). Clase
  /// del personaje de esta partida (`Save.clase`, enum Prisma) — null = sin clase asignada
  /// todavía (tampoco legítimo para vocabulario mágico).
  characterClase?: Clase | null;
}

interface ClassifyContext {
  characterSummary: string;
  action: string;
  /// Línea de calibración de dificultad cuando hay un NPC con nivel conocido en escena
  /// (docs/mecanicas/12-mundo-estructurado.md § 2.2) — el backend calcula la diferencia de nivel y le
  /// pasa la frase ya masticada; el modelo conecta, no aritmetiza.
  npcCalibration?: string | null;
}

function factsBlock(facts: string[]): string {
  return facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(sin hechos previos registrados todavía)';
}

/// Roadmap de velocidad (Fable, 2026-07-19), prioridad 1: con Reino en pausa (foco en explorar +
/// combatir), pedir siempre los 3 campos de Reino cuesta tokens de schema/instrucciones para nada
/// en la inmensa mayoría de turnos — el modelo los rellena de "newTerritory": null, etc. Mismo
/// patrón que LOOT_INTENT_REGEX/COMBAT_INTENT_REGEX (turnResolution.ts): un regex barato decide si
/// vale la pena ofrecérselos este turno, sin tocar la funcionalidad para cuando Reino se retome.
const REINO_INTENT_REGEX = /reclam|territorio|fund[oa]|construy|edificio|cuartel|muralla|s[uu]bdito|vasall|coloniz|jura fidelidad|dominio propio/;

// Auditoría de typo-tolerance (roadmap 2026-07-19, P0.4 de Fable): estos stems son de INTENCIÓN
// sobre un verbo/sustantivo común, no coincidencia de nombre propio (menor riesgo de la misma
// clase de fallo que "orco redazagado" en matchNpcAliases) — pero el mismo patrón de erratas
// puede darse igual. Solo los stems literales de 5+ letras entran en la lista de tolerancia; las
// alternativas con clase de caracteres (fund[oa], s[uu]bdito) o frase de varias palabras (jura
// fidelidad, dominio propio) se quedan solo con la coincidencia exacta del regex — no tienen un
// equivalente literal limpio de una sola palabra con el que comparar distancia de edición.
const REINO_INTENT_STEMS = ['reclam', 'territorio', 'construy', 'edificio', 'cuartel', 'muralla', 'vasall', 'coloniz'];

export function reinoIntentDetected(action: string): boolean {
  const normalized = normalizeText(action);
  if (REINO_INTENT_REGEX.test(normalized)) return true;
  return !!findFuzzyStemMatch(fuzzyMatchCandidates(normalized), REINO_INTENT_STEMS);
}

/// Reintento único de red (auditoría de deuda técnica 2026-08-21): mismo patrón que aparecía
/// duplicado en `classifyAction` y en el `attempt` interno de `generateSuggestions` — llama una
/// vez, si falla loguea y reintenta UNA sola vez más (sin try/catch en el segundo intento: si
/// también falla, se propaga tal cual, cortando el turno). No es la cascada de 3 intentos con
/// fallback de `narrateAction` (ahí hay modelo grande + fallback determinista) — aquí solo se
/// amortigua un hipo puntual de Ollama en llamadas al modelo pequeño.
async function ollamaCallWithOneRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    console.warn(`[${label}] llamada al modelo falló, reintentando: ${err instanceof Error ? err.message : err}`);
    return call();
  }
}

/// Paso 1 del turno (decisión de mecánicas 2, docs/mecanicas/06-decisiones-mecanicas.md): decide si la
/// acción libre del jugador necesita tirada y con qué atributo/dificultad, ANTES de narrar nada.
/// Usa el modelo pequeño (env.ollamaModelCronista): es una tarea de clasificación estructurada,
/// no necesita la profundidad narrativa del modelo grande — y así se libera tiempo para narrar.
/// Deliberadamente SIN hechos del mundo (ni RAG): elegir atributo/dificultad depende de la
/// naturaleza de la acción, no de datos de fauna/NPCs — meter ese contexto aquí solo alargaba
/// el prompt (y por tanto el prefill) sin cambiar la decisión. Ese lore se reserva para narrar,
/// que es donde de verdad hace falta para no inventar nada (ver narrateAction).
export async function classifyAction(ctx: ClassifyContext): Promise<ClassificationResult> {
  const system =
    'Eres un clasificador de acciones para un juego de rol de mesa. Tu única tarea es decidir qué atributo y dificultad corresponde a una acción, siguiendo las reglas que se te den. Responde solo con el JSON pedido.';

  // Roadmap de velocidad (Fable, 2026-07-20): mismo criterio de caché de prefijo que
  // narrateAction (D1, más arriba) — este bloque es IDÉNTICO letra a letra en cada llamada al
  // Cronista, así que va primero para que Ollama reutilice el KV-cache. Antes iba al final (con
  // PERSONAJE/ACCIÓN, lo variable, primero), invalidando el caché en cada turno.
  const fixedInstructions = `Clasifica esta acción para resolverla con una tirada de d20 + atributo/2 vs dificultad.
Dificultades posibles: 8 (trivial), 12 (fácil), 15 (media), 18 (difícil), 22 (muy difícil).

Además, clasifica cuánto tarda la acción DENTRO DE LA FICCIÓN (no el tiempo real que tardas en responder):
- "instantanea" (0 min): segundos — examinar, hablar, atacar, esquivar, reaccionar.
- "corta" (1-59 min): minutos — cortar leña un rato, buscar en una zona concreta, primeros auxilios.
- "extendida" (60-1439 min, es decir 1-24 horas): horas — descanso largo/prolongado (no un rato breve, eso es "corta"), un tramo de viaje, vigilar un campamento.
- "larga" (1440+ min, es decir 1 día o más): días o más — construir un campamento, viaje regional, curarse de una herida grave.

REGLA MÁS IMPORTANTE: si el texto del jugador menciona una duración explícita ("un rato", "toda la noche", "varios días", "una semana", "tres días"), esa duración manda SIEMPRE sobre tu estimación por tipo de actividad — no lo hagas al revés. Ejemplos de conversión: "un momento/un rato" ≈ 10-30 min (corta); "un par de horas" ≈ 120 min (extendida); "toda la noche" ≈ 480 min (extendida); "un día" ≈ 1440 min (larga); "varios días"/"unos días" ≈ 4320 min = 3 días (larga); "una semana" ≈ 10080 min (larga).

"duracionEstimadaMinutos" y "banda" TIENEN que ser coherentes entre sí según los rangos de arriba — nunca devuelvas "corta" con una duración de 4000 minutos, ni "larga" con 20 minutos.

Ejemplos completos (entrada → salida esperada) — el campo "razon" de cada uno es un ejemplo real
de justificación, no una plantilla que copiar: escribe la tuya propia, específica para la acción
que se te pida, nunca literalmente "...". El orden NO indica frecuencia: la mayoría de acciones
reales son instantáneas o cortas, no largas:
- Acción "Me quedo aquí varios días construyendo un campamento base permanente" → { "requiereTirada": true, "atributo": "fuerza", "dificultad": 15, "razon": "El jugador menciona explícitamente \\"varios días\\", una obra grande — la duración explícita manda.", "banda": "larga", "duracionEstimadaMinutos": 4320 }
- Acción "Examino mis alrededores con cuidado" → { "requiereTirada": true, "atributo": "destreza", "dificultad": 12, "razon": "Percepción rápida del entorno inmediato, sin desplazarse.", "banda": "instantanea", "duracionEstimadaMinutos": 0 }
- Acción "Descanso un rato antes de seguir" → { "requiereTirada": false, "atributo": "voluntad", "dificultad": 8, "razon": "Descanso breve sin duración explícita mayor.", "banda": "corta", "duracionEstimadaMinutos": 20 }
- Acción "Exploro la zona en busca de comida o rastros" → { "requiereTirada": true, "atributo": "destreza", "dificultad": 12, "razon": "Recorrido a pie de una zona cercana ya conocida, sin viaje largo ni obra de construcción — no hay duración explícita, así que se estima corta.", "banda": "corta", "duracionEstimadaMinutos": 30 }
- Acción "Soy Gorhorn Maktor, quien eres y que buscas?" (con un personaje en escena) → { "requiereTirada": false, "atributo": "carisma", "dificultad": 8, "razon": "Es solo hablar — una pregunta o presentación a alguien ya presente, sin ningún gesto físico ni forcejeo. Hablar es SIEMPRE instantáneo, nunca una confrontación de horas, aunque el otro personaje sea de nivel superior.", "banda": "instantanea", "duracionEstimadaMinutos": 0 }`;

  const prompt = `${fixedInstructions}
${ctx.npcCalibration ? `\n${ctx.npcCalibration}\n` : ''}
PERSONAJE:
${ctx.characterSummary}

ACCIÓN DEL JUGADOR:
"${ctx.action}"

Responde solo con el JSON pedido, nada más.`;

  const format = {
    type: 'object',
    properties: {
      requiereTirada: { type: 'boolean' },
      atributo: { type: 'string', enum: ATTRIBUTES },
      dificultad: { type: 'number', enum: [8, 12, 15, 18, 22] },
      razon: { type: 'string' },
      banda: { type: 'string', enum: ['instantanea', 'corta', 'extendida', 'larga'] },
      // Roadmap 2026-07-20 (Fable, control de acciones): enum cerrado en vez de number libre —
      // los enum sí los respeta bien la gramática de Ollama (a diferencia de minimum/maximum,
      // poco fiables para restricciones numéricas semánticas), y reduce justo donde más falla un
      // modelo pequeño: elegir un número de la nada. Cubre los valores de conversión que ya
      // describe la regla de arriba.
      duracionEstimadaMinutos: { type: 'number', enum: [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440, 2880, 4320, 10080] },
    },
    required: ['requiereTirada', 'atributo', 'dificultad', 'razon', 'banda', 'duracionEstimadaMinutos'],
  };

  // keepAlive '0': descarga el modelo pequeño en cuanto clasifica, antes de que narrateAction
  // cargue el modelo grande justo después — nunca los dos a la vez en memoria.
  // timeoutMs 90s: nunca ha tardado más de ~54s en pruebas reales, deja margen de sobra.
  // temperature 0 (roadmap 2026-07-20, Fable, segunda pasada): el `format` ya restringe la
  // gramática a los valores válidos del schema — el muestreo solo decide CUÁL de esos valores
  // gana cuando el modelo duda, y en una tarea de clasificación (nunca prosa creativa) esa duda
  // no aporta nada, solo varianza. Bajado de 0.15 (primera pasada) a 0 puro: sin downside
  // conocido, no se está narrando nada aquí.
  const callOllama = () =>
    ollamaGenerate({
      temperature: 0,
      model: env.ollamaModelCronista,
      system,
      prompt,
      format,
      keepAlive: '0',
      timeoutMs: 90_000,
    });

  // Resiliencia (auditoría 2026-07-22): a diferencia de narrateAction (cascada de 3 intentos),
  // esto no tenía NINGÚN reintento pese a correr en el camino caliente de casi cada turno — un
  // hipo puntual de Ollama (timeout, JSON cortado) tiraba el turno entero sin ninguna segunda
  // oportunidad. Un solo reintento con los mismos parámetros basta para el caso común (hipo
  // transitorio); no se replica la cascada completa de narrateAction porque aquí no hay un
  // modelo "grande" del que caer — clasificar siempre usa el mismo modelo pequeño.
  const { text } = await ollamaCallWithOneRetry('clasificar', callOllama);
  return JSON.parse(text) as ClassificationResult;
}

/// Sugerencias de próxima acción — llamada Ollama APARTE de `narrateAction` (petición explícita,
/// 2026-08-15: "quizás estoy valorando añadir un botón al lado de actuar... que al darle las
/// genere mirando los logs"). Antes vivían dentro de `narrateAction` (schema/prompt ya recortados
/// de ahí), compitiendo por atención con ~15 instrucciones más — y ni siquiera quedaban ancladas
/// al resultado mecánico real del turno (bug real jugando en vivo: tras narrar que el "Orco
/// Enfurecido" quedaba inmóvil de un golpe, una sugerencia fue "Ataco a Orco Enfurecido"). Mismo
/// patrón que `classifyAction` de arriba: prompt corto, sin `worldFacts`/RAG de lore (esta tarea
/// depende del historial inmediato, no del lore general del mundo), modelo pequeño, un solo
/// reintento — nunca un "agente" nuevo, es la misma familia de llamadas pequeñas ya establecida.
export interface SuggestionsContext {
  characterName: string;
  /// Últimos `LogEntry.text` de la partida, en orden CRONOLÓGICO (el más antiguo primero) — el
  /// caller (`routes/saves/suggestions.ts`) ya los trae en ese orden.
  recentLog: string[];
  /// NPCs realmente en escena ahora mismo con su condición física real — el caller ya los calcula
  /// con `detectNpcsInScene` (mismo mecanismo que recolectar.ts/cazar.ts), esta función no hace
  /// ninguna consulta a la BD por su cuenta (mismo criterio que `classifyAction`/`narrateAction`:
  /// reciben el contexto ya resuelto, no acceden a Prisma directamente).
  npcsEnEscena: { name: string; condicionFisica: CondicionFisica }[];
  /// Misiones ACTIVAS de la partida con su objetivo corto y accionable (petición explícita,
  /// 2026-08-15: "hay una misión y debería buscar hacer los pasos para que la misión se active")
  /// — para que una sugerencia pueda empujar hacia el siguiente paso real, no solo reaccionar al
  /// último turno.
  activeQuests: { title: string; objetivo: string | null }[];
  /// Banda de salud/energía del propio jugador (petición explícita: "descansar si tienes poca
  /// energía") — nunca el número exacto (mismo criterio que `saludBandFor`/ESTADO ACTUAL DEL
  /// PERSONAJE en `narrateAction`), solo una etiqueta cualitativa.
  saludJugador: string;
  energiaJugador: string;
  /// Últimos hechos de sesión (petición explícita: "interactuar con algo que se detectó en el
  /// ambiente") — el caller ya los carga con `loadSessionFacts` (misma llamada que ya necesita
  /// para `detectNpcsInScene`), aquí solo se reutiliza una porción reciente. Incluye cosas como
  /// "Gorhorn localiza Cardo Brújula en la zona" — recursos/fauna ya detectados pero sin usar
  /// todavía.
  ambiente: string[];
}

const SUGGESTIONS_EXAMPLE_1 = `EJEMPLO 1, combate ya resuelto (referencia de FORMATO, no de contenido — NUNCA copies estos fragmentos tal cual ni ningún nombre de aquí, esto no existe en tu partida real): historial reciente "Gorhorn derriba a su rival de un golpe certero, dejándolo tendido en el suelo, incapaz de seguir luchando." → sugerencias ["Remato al rival caído", "Registro su cuerpo", "Miro si hay alguien más"] — ninguna lo trata como si pudiera seguir defendiéndose (ya está convaleciente: rematarlo/registrarlo es coherente, "atacarlo" o "enfrentarlo" no). Nota cómo NINGUNA sugerencia inventa un nombre propio para el rival — usa solo lo que el historial de TU partida real te da. Aunque tu escena real se parezca a esta, tus 3 sugerencias tienen que ser fragmentos NUEVOS sobre TU historial, nunca estos mismos fragmentos copiados.`;

/// Solo se incluye en el prompt cuando `lastLogHasDirectSpeech` es true (ver `generateSuggestions`)
/// — bug real jugando en vivo (2026-08-18, "las sugerencias siguen pareciendo que adivinan el
/// futuro"): con un NPC simplemente ACERCÁNDOSE, sin aliento, mirando hacia atrás (ninguna réplica
/// entre comillas todavía), el modelo devolvió casi textualmente las 3 sugerencias de ESTE mismo
/// ejemplo — "voy a por quien la persigue" copiado casi literal de "quien me persigue" — como si
/// ya le hubiera pedido ayuda, adelantándose a un diálogo que el jugador ni siquiera ha
/// presenciado. Antes esta regla/ejemplo estaban SIEMPRE en el prompt, activos o no; ahora solo
/// entran cuando de verdad hay algo que responder (ver `SUGGESTIONS_NO_DIRECT_SPEECH_OVERRIDE`
/// para el caso contrario, y `dropSuggestionsCopyingExample` como red de seguridad determinista
/// por si el modelo pequeño lo ignora igual).
const SUGGESTIONS_EXAMPLE_2_AND_REGLA_1 = `EJEMPLO 2, un NPC te acaba de hablar/pedir algo (misma referencia de FORMATO, NUNCA copies estos fragmentos tal cual ni ningún nombre de aquí): historial reciente termina con alguien desconocido diciendo entre comillas "¿No quieres ayudarme? Empieza por quien me persigue — hazlo antes de que sea tarde." → sugerencias ["Acepto ayudarla", "Pregunto por el perseguidor", "Me niego, por ahora"] — LAS TRES responden de verdad a lo que acaba de pedir; ninguna lo ignora para hablar de otra cosa (nada de "registro la zona"/"busco huellas": eso ignoraría que alguien te está hablando ahora mismo). Fíjate que "Acepto ayudarla" se PARA ahí — no sigue con "y voy a por quien la persigue" ni con "y lo encuentro": ese siguiente paso es OTRO turno, con su propia decisión y su propia sugerencia, no algo que dar ya por hecho en este mismo fragmento (ver REGLA 4). Si tu escena real se parece a esta (alguien pidiéndote ayuda contra un perseguidor), NO copies estos 3 fragmentos — la petición real de tu historial puede ser sobre algo totalmente distinto, y aunque coincida, tienes que redactarla de nuevo con las palabras y el contexto de TU escena, nunca reusar esta literalmente.

REGLA MÁS IMPORTANTE 1, sin excepciones (ver EJEMPLO 2; reforzada 2026-08-20, bug real jugando en vivo: comprobado con logging directo contra la partida real que el modelo, 3 de 3 veces seguidas, sustituía el hueco de "pregunta" por una acción de puro entorno — "reviso mi entorno en busca de peligros", "inspecciono la zona" — dejando la decisión real sin cubrir; la usuaria lo notó de inmediato: "ninguna es una respuesta directa a la petición... la única la de negarse"): si el historial reciente TERMINA con un personaje pidiéndote algo en concreto (ayuda, una decisión, una respuesta a una petición directa) — de las 3 sugerencias, DOS tienen que cubrir las dos caras reales de esa decisión: una que ACEPTA (o se inclina a aceptar) y otra que RECHAZA (o pone condiciones antes de aceptar). La tercera es libre (una pregunta sobre ESTA MISMA situación, o una acción física relacionada), pero ninguna de las 3 puede ser una acción de entorno que ignore por completo que alguien te acaba de hablar y espera algo de ti ("reviso mi entorno", "busco peligros", "inspecciono la zona" NUNCA cuentan como respuesta, aunque mencionen a la persona que habla de pasada). Si el diálogo es solo una pregunta abierta sin una decisión clara que tomar (no un "¿me ayudas o no?"), aplica la versión simple: al menos UNA sugerencia responde de verdad, nunca las 3 la ignoran.`;

/// Inverso de la regla de arriba — se incluye SOLO cuando NO hay diálogo real en el historial
/// reciente, para que el modelo no tenga ningún ejemplo tentador de "responder a una petición" que
/// invitaría a inventar una que no existe.
const SUGGESTIONS_NO_DIRECT_SPEECH_OVERRIDE = `El historial reciente de abajo NO termina con nadie hablándote entre comillas — nadie te ha pedido nada en voz alta todavía, aunque algo se esté acercando o algo esté pasando. NO inventes una petición, una pregunta o un diálogo que no está ahí — eso sería adivinar lo que va a pasar, no reaccionar a lo que ya pasó. Las 3 sugerencias (fragmentos cortos) tienen que responder solo a lo que de verdad ya ocurrió (acercarte, observar, prepararte, hablar tú primero...), nunca a algo que alguien todavía no ha dicho.`;

/// Rediseño a fragmentos cortos (petición explícita, 2026-08-20 — la usuaria, tras una tarde entera
/// de bugs reales de gramática/coherencia en sugerencias de frase completa, preguntó por qué era
/// tan difícil si "cualquier IA ya hace esto"; la causa raíz no es el prompt ni RAG (`generateSuggestions`
/// no usa `retrieveLore` en absoluto) — es que sostener a la vez persona gramatical, número,
/// pronombre, no-compresión y cobertura aceptar/rechazar en UNA FRASE LARGA es mucho para un
/// modelo de 7B en un solo intento sin autocrítica, confirmado en vivo esa misma tarde con 6+
/// fallos reales distintos en la misma frase de Gistera Koh). Un fragmento de 3-6 palabras da mucho
/// menos superficie para que la persona/número/pronombre se tuerzan o para comprimir dos acciones —
/// no arregla el techo de capacidad del modelo, pero reduce drásticamente cuántas formas hay de
/// fallar en cada intento.
const SUGGESTIONS_BASE_RULES = `Reglas: exactamente 3 sugerencias. Cada una es un FRAGMENTO CORTO de 3 a 6 palabras — nunca una frase narrativa completa ni una oración con varias cláusulas. Piensa en cada una como una etiqueta de acción ("Acepto ayudarla", "Ataco al orco", "Pregunto por el perseguidor"), no un párrafo. Primera persona, presente — el verbo termina en "-o" ("Examino", "Reviso", "Busco", "Acepto" — NUNCA "Examina"/"Examinó"/"Examine", esas son otra persona gramatical, aunque parezcan sinónimos válidos; nunca "su"/"él"/"ella" refiriéndote al propio personaje del jugador). Distintas entre sí. Cada una tiene que apuntar a algo CONCRETO ya mencionado en el historial de abajo — nunca un genérico que serviría igual para cualquier turno del juego ("sigo explorando", "espero a ver qué pasa").

REGLA MÁS IMPORTANTE 2, sin excepciones (ver EJEMPLO 1): si en "PERSONAJES EN ESCENA" se lista a alguien como CONVALECIENTE o MUERTO, NUNCA sugieras atacarlo, enfrentarlo o combatir contra él.

REGLA MÁS IMPORTANTE 3, sin excepciones (bug real jugando en vivo, 2026-08-18): si el historial reciente deja algo A PROPÓSITO sin nombre ("uno de los suyos me pisa los talones", "alguien me persigue", "quien me busca"...), NUNCA rellenes ese hueco con el nombre de un NPC de "PERSONAJES EN ESCENA" a menos que el propio historial YA lo haya nombrado ahí mismo como esa persona en concreto. Que un NPC esté en PERSONAJES EN ESCENA solo significa que el jugador YA LO CONOCE de antes — no que sea la respuesta a cada pregunta sin resolver de la escena actual. Adivinar de quién se trata antes de que la ficción lo confirme es tan grave como inventar una petición que nadie ha hecho (regla 1).

REGLA MÁS IMPORTANTE 4, sin excepciones (bug real jugando en vivo, 2026-08-20: "Gorhorn no responde como tal, sino que ya adelanta hechos, haciendo la interacción mucho más corta" — ver EJEMPLO 2, "Acepto ayudarla" se para ahí): cada sugerencia es UN solo paso inmediato — la reacción de AHORA MISMO, no una cadena de pasos futuros comprimida en un fragmento. Nunca dés por hecho el resultado de una decisión que tu personaje ni siquiera ha tomado todavía: "Acepto ayudarla" sí, "Acepto ayudarla y encuentro a quien la persigue" no (eso son dos turnos, el segundo con un desenlace que el propio juego todavía no ha resuelto). Si dudas, pregúntate: ¿este fragmento describe SOLO lo que pasa a continuación, o también cómo acaba? Si acaba, es demasiado.

Si además hay MISIÓN ACTIVA con un objetivo concreto alcanzable desde aquí, SALUD/ENERGÍA baja del jugador, o algo en AMBIENTE sin usar todavía, puede que una tercera sugerencia apunte a eso — solo cuando de verdad encaje con la escena, nunca forzado.`;

/// Solo mira la ÚLTIMA entrada del historial reciente (no todas — una réplica de hace varios
/// turnos ya está resuelta, no es "ahora mismo") — mismo estilo de diálogo que usa el resto del
/// motor (`narrador.ts`, "Escribe SOLO tu réplica hablada... entre comillas"): comillas rectas.
export function lastLogHasDirectSpeech(recentLog: string[]): boolean {
  const last = recentLog[recentLog.length - 1] ?? '';
  return /"[^"]+"/.test(last);
}

export async function generateSuggestions(ctx: SuggestionsContext): Promise<string[]> {
  const system =
    'Eres un asistente que propone posibles próximas acciones para el jugador de un juego de rol de mesa, basándote en lo que acaba de pasar. No inventas hechos nuevos, solo sugieres reacciones coherentes a lo ya ocurrido.';

  // Evita spoilear el nombre real de un NPC que el propio personaje del jugador TODAVÍA no conoce
  // en la ficción (petición explícita, 2026-08-15: "menciona a Gistera antes de que nosotros la
  // descubramos") — ver `npcsKnownFromLog` más abajo.
  const knownNpcs = npcsKnownFromLog(ctx.npcsEnEscena, ctx.recentLog);
  const npcsBlock = knownNpcs.length > 0 ? `\nPERSONAJES EN ESCENA:\n${knownNpcs.map((n) => `- ${n.name}: ${n.condicionFisica}`).join('\n')}\n` : '';
  const questsBlock =
    ctx.activeQuests.length > 0
      ? `\nMISIÓN ACTIVA:\n${ctx.activeQuests.map((q) => `- ${q.title}${q.objetivo ? `: ${q.objetivo}` : ''}`).join('\n')}\n`
      : '';
  const ambienteBlock = ctx.ambiente.length > 0 ? `\nAMBIENTE:\n${ctx.ambiente.map((f) => `- ${f}`).join('\n')}\n` : '';

  // EJEMPLO 2/REGLA 1 solo entran cuando de verdad hay diálogo real que responder — ver doc
  // comment de `SUGGESTIONS_EXAMPLE_2_AND_REGLA_1`.
  const hasDirectSpeech = lastLogHasDirectSpeech(ctx.recentLog);
  const examplesAndRules = hasDirectSpeech
    ? `${SUGGESTIONS_EXAMPLE_1}\n\n${SUGGESTIONS_EXAMPLE_2_AND_REGLA_1}\n\n${SUGGESTIONS_BASE_RULES}`
    : `${SUGGESTIONS_EXAMPLE_1}\n\n${SUGGESTIONS_BASE_RULES}\n\n${SUGGESTIONS_NO_DIRECT_SPEECH_OVERRIDE}`;

  const prompt = `${examplesAndRules}

PERSONAJE DEL JUGADOR: ${ctx.characterName} — eres TÚ. El historial de abajo lo narra en tercera persona por su nombre (así se narra todo el juego), pero las sugerencias son SIEMPRE lo que ${ctx.characterName} hace o dice a continuación, en primera persona. Si "${ctx.characterName}" aparece en el historial, ESO ERES TÚ MISMO — nunca lo trates como si fuera otro personaje que te habla o te pide algo; solo un nombre DISTINTO al tuyo puede hacer eso (regla 1 de arriba).
ESTADO DEL PERSONAJE: salud ${ctx.saludJugador}; energía ${ctx.energiaJugador}.

HISTORIAL RECIENTE:
${ctx.recentLog.map((l) => `- ${l}`).join('\n')}
${npcsBlock}${questsBlock}${ambienteBlock}
Responde solo con el JSON pedido, nada más.`;

  const format = {
    type: 'object',
    properties: {
      suggestions: { type: 'array', items: { type: 'string' } },
    },
    required: ['suggestions'],
  };

  // Cambiado de `ollamaModelCronista` (1.5B) a `ollamaModelNarrador` (bug real jugando en vivo,
  // 2026-08-20: tres fallos de contenido seguidos en la misma escena real — copiar el ejemplo
  // literal, sugerir violencia contra quien pedía ayuda, y por último ninguna de las 3 respondía
  // de verdad a esa petición pese a REGLA MÁS IMPORTANTE 1 — el modelo pequeño no seguía la regla
  // de forma fiable por más que se afinara el prompt/los filtros). Y de ahí a `ollamaModelSugerencias`
  // propio (mismo día, "el 4b solo para sugerencias no puede ser una opción?"): separado de
  // `ollamaModelNarrador` a propósito — la narración real de cada turno sigue en el modelo grande
  // sin tocar; solo "Sugerir" (bajo demanda, no bloquea el resto del turno) usa el más pequeño,
  // verificado con calidad comparable en esta tarea concreta y bastante más rápido.
  const callOllama = (temperature: number) =>
    ollamaGenerate({
      temperature,
      model: env.ollamaModelSugerencias,
      system,
      prompt,
      format,
      keepAlive: '0',
      timeoutMs: 90_000,
    });

  const downedNpcNames = knownNpcs.filter((n) => n.condicionFisica === 'CONVALECIENTE' || n.condicionFisica === 'MUERTO').map((n) => n.name);

  // Un intento completo: llama al modelo (con su propio reintento de RED aparte, `attemptNumber`
  // solo decide la temperatura) y aplica toda la cadena de filtros deterministas.
  async function attempt(
    temperature: number,
  ): Promise<{ final: string[]; rawCount: number; copiedExampleVerbatim: boolean; droppedOnlyAcceptCandidate: boolean }> {
    const { text } = await ollamaCallWithOneRetry('sugerencias', () => callOllama(temperature));
    const parsed = JSON.parse(text) as { suggestions?: string[] };
    const afterSanitize = sanitizeSuggestions(parsed.suggestions);
    const afterCopyExample = dropSuggestionsCopyingExample(afterSanitize);
    const withoutDowned = dropSuggestionsTargetingDownedNpc(afterCopyExample, downedNpcNames);
    const withoutAttackingRequester = dropSuggestionsAttackingHelpRequester(withoutDowned, knownNpcs, ctx.recentLog);
    const withoutCompressedAccept = dropSuggestionsCompressingAcceptance(withoutAttackingRequester);
    const withoutStaleNpc = dropSuggestionsNamingStaleNpc(withoutCompressedAccept, ctx.npcsEnEscena, ctx.recentLog);
    const withoutWrongPerson = dropSuggestionsWrongGrammaticalPerson(withoutStaleNpc);
    const final = dropSuggestionsReferencingPlayerByName(withoutWrongPerson, ctx.characterName);
    return {
      final,
      rawCount: afterSanitize.length,
      copiedExampleVerbatim: afterSanitize.length > 0 && afterCopyExample.length === 0,
      // Bug real jugando en vivo (2026-08-20, mismo turno en que se confirmó el filtro de arriba):
      // `dropSuggestionsCompressingAcceptance` acertó descartando "Acepto ayudarla y..." — pero era
      // la ÚNICA sugerencia que aceptaba, así que el resultado final se quedó con solo pregunta +
      // "exploro el entorno", reproduciendo la queja original ("ninguna es una respuesta directa...
      // la única la de negarse") por un camino distinto: no porque el modelo no aceptara, sino
      // porque la única vez que lo hizo, lo hizo mal y se descartó. Señal para el reintento de abajo.
      droppedOnlyAcceptCandidate: withoutAttackingRequester.length > withoutCompressedAccept.length && !withoutCompressedAccept.some((s) => ACCEPT_PHRASE_REGEX.test(s)),
    };
  }

  const first = await attempt(0.4);
  const shouldRetry = (first.final.length === 0 && first.copiedExampleVerbatim) || (hasDirectSpeech && first.droppedOnlyAcceptCandidate);
  if (!shouldRetry) return first.final;

  // Reintento determinista (bug real jugando en vivo, 2026-08-20: "al darle a sugerir no me está
  // dando ninguna sugerencia" — encontrado con logging directo contra la partida real: el modelo
  // devolvía las 3 frases de EJEMPLO 2 CASI VERBATIM, {"suggestions":[]} tras el filtro de copia,
  // sin ningún error — el filtro hacía justo su trabajo, pero no quedaba nada que mostrar). Mismo
  // patrón ya establecido en este archivo (comprobación post-hoc + reintento, no solo confiar en
  // el prompt): si TODO lo generado se descartó por copiar el ejemplo literal, un segundo intento
  // con más temperatura (0.4→0.8) rompe la tendencia a repetir la continuación más "obvia" — igual
  // que `callOllama`'s propio reintento de red, nunca se reintenta más de una vez.
  //
  // Segunda causa de reintento añadida el mismo día (`droppedOnlyAcceptCandidate`): con diálogo
  // real pendiente, `dropSuggestionsCompressingAcceptance` acertó descartando la única sugerencia
  // que aceptaba (comprimía dos beats) — el resultado se quedó con solo pregunta + acción de
  // entorno, reproduciendo la queja original de REGLA 1 ("ninguna es una respuesta directa") por un
  // camino nuevo: el modelo SÍ intentó aceptar, solo que mal. Mismo remedio: más temperatura para
  // romper la tendencia a la misma redacción comprimida.
  console.warn(
    first.copiedExampleVerbatim
      ? '[sugerencias] el modelo copió el ejemplo casi literal, reintentando con más temperatura'
      : '[sugerencias] la única aceptación se descartó por comprimir dos beats, reintentando con más temperatura',
  );
  const retry = await attempt(0.8);
  return retry.final;
}

/// Red de seguridad determinista (no confiar solo en la instrucción del prompt, mismo criterio que
/// `hasFalseCombatMiss`) — bug real jugando en vivo (2026-08-15, reincidente pese a la instrucción
/// explícita ya añadida en el prompt: "Comienzo a caminar hacia Gorhorn, intentando descubrir..."
/// tratando al propio personaje del jugador como si fuera otra persona a la que acercarse). Un
/// modelo de 1.5B no sigue esa instrucción de forma fiable el 100% de las veces — mismo motivo por
/// el que el resto de reglas de esta familia (`hasFalseCombatHit`, `hasAnachronism`...) nunca
/// confían solo en el texto del prompt. Corte simple y sin matices: una sugerencia nunca necesita
/// nombrar al propio personaje del jugador (ya está implícito en la primera persona), así que
/// cualquiera que lo mencione se descarta entera, sin intentar salvar la frase.
export function dropSuggestionsReferencingPlayerByName(suggestions: string[], characterName: string): string[] {
  const escaped = characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(`\\b${escaped}\\b`, 'i');
  return suggestions.filter((s) => !nameRegex.test(s));
}

/// Filtro determinista contra spoilers de identidad (petición explícita, 2026-08-15: "menciona a
/// Gistera antes de que nosotros la descubramos... no ser tan específico hasta que ella se
/// presente") — `detectNpcsInScene` (el caller de esta función) ya resuelve el roster COMPLETO de
/// la escena con nombre real, incluidos encuentros guionizados que el motor conoce desde el primer
/// instante aunque el personaje del jugador todavía no se haya presentado con ellos en la ficción
/// (p. ej. Gistera Koh, descrita al principio solo como "una sombra"/"una orca con la marca del
/// Clan Serhu"). Un NPC solo cuenta como "conocido" para las sugerencias si su nombre aparece de
/// verdad en el propio historial reciente — un NPC activamente en escena (p. ej. en pleno combate)
/// va a tener su nombre por todo el log de sobra, así que esto no les afecta.
export function npcsKnownFromLog<T extends { name: string }>(npcs: T[], recentLog: string[]): T[] {
  const logText = recentLog.join(' ').toLowerCase();
  return npcs.filter((n) => logText.includes(n.name.toLowerCase()));
}

/// Red de seguridad determinista (no confiar solo en la instrucción del prompt, mismo criterio que
/// `hasFalseCombatMiss`) para el bug real de referencia: descarta cualquier sugerencia que combine
/// el nombre de un NPC YA convaleciente/muerto con un verbo de INICIO de combate — "remato a X"/
/// "registro a X"/"me alejo de X" siguen siendo coherentes con alguien ya caído y NO se tocan, solo
/// se filtra la variante que lo trata como si pudiera seguir defendiéndose.
const COMBAT_INITIATION_VERB_REGEX = /\b(atac[oa]|atacar|enfrent[oa]|enfrentar|pele[oa]|pelear|combat[oe]|combatir)\b/i;

export function dropSuggestionsTargetingDownedNpc(suggestions: string[], downedNpcNames: string[]): string[] {
  if (downedNpcNames.length === 0) return suggestions;
  return suggestions.filter((s) => {
    const mentionsDownedNpc = downedNpcNames.some((name) => s.toLowerCase().includes(name.toLowerCase()));
    return !(mentionsDownedNpc && COMBAT_INITIATION_VERB_REGEX.test(s));
  });
}

/// Complementario al de arriba (bug real jugando en vivo, 2026-08-20: "ahora funciona pero...muy
/// mal" — dos variantes seguidas del mismo fallo, "Remato a Gistera Koh para evitar su pérdida" y
/// después "Ataco a Gistera Koh para acabar con su presencia", justo cuando ella acababa de
/// presentarse ILESA pidiendo ayuda contra un tercero, sin combate de por medio). Un verbo de
/// violencia (incluido "rematar", golpe de gracia que solo tiene sentido contra alguien ya
/// convaleciente/muerto) NUNCA es coherente contra el NPC que ACABA de dirigirse al jugador con
/// una pregunta o petición real — eso es justo lo contrario de REGLA MÁS IMPORTANTE 1 (responder
/// de verdad a lo que pide, no atacarlo). Deliberadamente NO se aplica a cualquier NPC sano
/// (rompería la sugerencia normal de "Ataco a X" contra un enemigo sano en pleno combate) — solo a
/// quien es AMBAS cosas a la vez: sano Y quien habló en la última entrada del historial.
const VIOLENCE_VERB_REGEX = /\b(atac[oa]|atacar|enfrent[oa]|enfrentar|pele[oa]|pelear|combat[oe]|combatir|remat[oa]|rematar)\b/i;

export function dropSuggestionsAttackingHelpRequester<T extends { name: string; condicionFisica: string }>(
  suggestions: string[],
  knownNpcs: T[],
  recentLog: string[],
): string[] {
  if (!lastLogHasDirectSpeech(recentLog)) return suggestions;
  const lastEntry = (recentLog[recentLog.length - 1] ?? '').toLowerCase();
  const requesterNames = knownNpcs
    .filter((n) => n.condicionFisica !== 'CONVALECIENTE' && n.condicionFisica !== 'MUERTO')
    .map((n) => n.name)
    .filter((name) => lastEntry.includes(name.toLowerCase()));
  if (requesterNames.length === 0) return suggestions;
  return suggestions.filter((s) => {
    const mentionsRequester = requesterNames.some((name) => s.toLowerCase().includes(name.toLowerCase()));
    return !(mentionsRequester && VIOLENCE_VERB_REGEX.test(s));
  });
}

/// Red de seguridad determinista para REGLA MÁS IMPORTANTE 4 (bug real reincidente jugando en vivo,
/// 2026-08-20 — la propia REGLA 4 y EJEMPLO 2 del prompt YA prohíben esto explícitamente, "Acepto
/// ayudarla" tiene que pararse ahí, pero el modelo lo sigue comprimiendo con cierta frecuencia
/// real): "Acepto ayudarla y busco al que me persigue" — dos beats en una frase (aceptar + una
/// segunda acción ya decidida), y de paso arrastra un error de pronombre (copia "me persigue" de
/// la voz de Gistera en primera persona, cuando desde el punto de vista del jugador tendría que ser
/// "LA persigue" — a ella, no a él). En vez de intentar arreglar el pronombre (frágil, un solo caso
/// más de una familia potencialmente más amplia), se descarta la sugerencia entera: "Acepto
/// ayudarla"/"Decido ayudarla" sin nada más detrás es la forma correcta, cualquier " y " con más
/// contenido detrás de esas dos frases es la compresión que la regla ya prohíbe.
/// Acotado a "y" en el tramo INMEDIATO tras el verbo de aceptar (hasta 40 caracteres, ni una
/// palabra de condición de por medio) — no "cualquier 'y' en toda la frase", que daría falso
/// positivo con una aceptación CON CONDICIÓN legítima ("Acepto ayudarla, pero solo si me cuentas
/// todo lo que sabes sobre los Serhu y por qué están en guerra con nosotros" — buena, ver REGLA 1 —
/// tiene una "y" bien entrada en la frase, sin relación con esto). El lookahead negativo corta el
/// tramo en seco en cuanto aparece "pero"/"si"/"aunque"/"cuando"/"solo" — justo las palabras que
/// introducen una condición legítima, nunca una segunda acción ya decidida. Sin `\b` tras "ayudar"
/// a propósito: el pronombre enclítico se pega sin espacio ("ayudarla"/"ayudarle"/"ayudarte"), y
/// "ayudar a Gistera Koh" (objeto con nombre en vez de pronombre, variante real ya vista) también
/// tiene que matchear.
const COMPRESSED_ACCEPT_REGEX = /^(acepto|decido|accedo)\s+ayudar(?:(?!\b(?:pero|si|aunque|cuando|solo)\b)[^,.!?]){0,40}?,?\s+y\s+\S/i;
/// Reconoce CUALQUIER aceptación (comprimida o no) — usada en `generateSuggestions` para saber si
/// ya sobrevivió una aceptación de verdad tras el filtro de arriba, o si hace falta reintentar.
const ACCEPT_PHRASE_REGEX = /^(acepto|decido|accedo)\s+ayudar/i;
/// Segunda variante real (misma sesión, verificada con logging directo minutos después de la
/// primera): "Acepto ayudarte, Gistera Koh. Debo enfrentarme al que te persigue primero." — la
/// misma compresión de dos beats, pero con PUNTO en vez de "y" uniendo la segunda frase, así que
/// `COMPRESSED_ACCEPT_REGEX` (acotado a "y") no la cazaba. Heurística de contenido en vez de
/// estructura: si la sugerencia EMPIEZA aceptando ayudar Y en cualquier parte del resto del texto
/// menciona al perseguidor (`pers[ei]g\w*`, no `persegu\w*` — mismo cambio de raíz en presente que
/// `PURSUER_REFERENCE_REGEX`, turnResolution.ts: "persigue"/"persiguen" usan "persig-", no
/// "persegu-", y son justo las formas más usadas en esta escena), es casi con toda seguridad la misma compresión —
/// "Acepto ayudarla" sola, la forma correcta que pide REGLA 4, nunca necesita mencionar al
/// perseguidor en absoluto (ver EJEMPLO 2 del prompt). Riesgo aceptado, mismo criterio que el resto
/// de esta familia de filtros: alguna aceptación legítima que exprese incertidumbre sobre quién
/// persigue ("Acepto ayudarla, aunque no sé aún quién la persigue") también se descartaría — perder
/// una sugerencia de más pesa menos que dejar pasar la compresión ya confirmada dos veces.
const ACCEPT_THEN_PURSUER_MENTION_REGEX = /^(acepto|decido|accedo)\s+ayudar[\s\S]*\bpers[ei]g\w*/i;
export function dropSuggestionsCompressingAcceptance(suggestions: string[]): string[] {
  return suggestions.filter((s) => {
    const trimmed = s.trim();
    return !COMPRESSED_ACCEPT_REGEX.test(trimmed) && !ACCEPT_THEN_PURSUER_MENTION_REGEX.test(trimmed);
  });
}

/// Red de seguridad determinista para la instrucción de persona gramatical de SUGGESTIONS_BASE_RULES
/// ("en primera persona... nunca 'su'/'él'/'ella'") — bug real jugando en vivo, reproducido 2 de 2
/// veces seguidas en la misma sesión (2026-08-20, verificado con logging directo): la sugerencia de
/// "explorar el entorno" salía como "Examinó el terreno..."/"Examine el terreno..." — tercera
/// persona de pretérito o imperativo/subjuntivo, nunca "Examino" (primera persona presente, la
/// forma correcta). El prompt YA pide primera persona explícitamente; esto es la comprobación
/// post-hoc de siempre, acotada a un vocabulario cerrado de los verbos de "explorar/revisar" ya
/// vistos fallar (mismo criterio que `WEAPON_CATEGORY_NOUNS`: lista cerrada de un campo semántico
/// concreto, no un intento de conjugador genérico de español). Solo mira la PRIMERA palabra — el
/// resto de la frase puede usar cualquier persona en subordinadas sin que sea señal de nada.
/// `(?![\\p{L}\\p{N}])` en vez de `\b` (mismo gotcha ya documentado en enciclopediaIndex.ts,
/// frontend): `\b` de JS trata las vocales acentuadas como "no letra" — sin este cambio, "Buscó"/
/// "Exploró" (terminan en vocal acentuada) nunca llegaban a matchear, el límite de palabra se
/// rompía justo ahí.
const WRONG_PERSON_FIRST_WORD_REGEX =
  /^(examina|examinó|examine|revisa|revisó|revise|busca|buscó|inspecciona|inspeccionó|inspeccione|observa|observó|observe|explora|exploró|explore|registra|registró|registre)(?![\p{L}\p{N}])/iu;
export function dropSuggestionsWrongGrammaticalPerson(suggestions: string[]): string[] {
  return suggestions.filter((s) => !WRONG_PERSON_FIRST_WORD_REGEX.test(s.trim()));
}

/// Fragmentos EXACTOS de EJEMPLO 1/EJEMPLO 2 (referencia de forma en el prompt, NUNCA debería
/// aparecer en la partida real de nadie) — bug real jugando en vivo (2026-08-18, "las sugerencias
/// siguen pareciendo que adivinan el futuro"): con un NPC solo acercándose sin haber dicho nada
/// todavía, el modelo devolvió "Acepto ayudarla y voy a por quien la persigue" casi textual al
/// ejemplo, pese a la instrucción explícita "NUNCA copies ningún nombre de aquí". Red de seguridad
/// determinista (no confiar solo en esa instrucción, mismo criterio que el resto de esta familia)
/// — compara cada sugerencia generada contra estos fragmentos de ejemplo. Deliberadamente SIN
/// "Acepto ayudarla" (rediseño a fragmentos cortos, 2026-08-20): esa es justo la forma CORRECTA que
/// pide REGLA 4 cuando el jugador de verdad acepta — incluirla aquí penalizaría al modelo por
/// acertar, no por copiar. Tampoco "Pregunto por el perseguidor" (mismo motivo, encontrado minutos
/// después verificando en vivo): con solo 2 palabras de contenido ("pregunto"+"perseguidor"),
/// cualquier variante genuina y correcta ("Pregunto por su perseguidor", "Pregunto por su
/// persecutor"...) comparte el 100% y se descartaba igual — la pregunta sobre el perseguidor es la
/// respuesta obvia y correcta a esta escena concreta, no una señal de estar copiando el ejemplo.
///
/// `factSimilarity` (worldFacts.ts), NO `similarity()` plana (bug real, 2026-08-20: "al darle a
/// sugerir no me está dando ninguna sugerencia") — con fragmentos tan cortos como estos (3-6
/// palabras) y encima con el mismo verbo que el propio prompt pide usar ("Pregunto por...",
/// "Registro...", ver SUGGESTIONS_BASE_RULES), dos sugerencias sobre temas totalmente distintos ya
/// comparten suficientes palabras de función para cruzar el umbral con `similarity()` plana — las
/// 3 sugerencias generadas se descartaban enteras sin que ninguna copiara nada de verdad,
/// devolviendo `[]` sin ningún error visible en el front. `factSimilarity` filtra antes las
/// palabras de función y usa Jaccard real, exactamente calibrado para este mismo patrón (ver su
/// comentario en worldFacts.ts) — una copia con 1-2 palabras cambiadas sigue cazándose.
const EXAMPLE_SUGGESTION_TEXTS = ['Remato al rival caído', 'Registro su cuerpo', 'Miro si hay alguien más', 'Me niego, por ahora'];
const EXAMPLE_COPY_SIMILARITY_THRESHOLD = 0.5;

export function dropSuggestionsCopyingExample(suggestions: string[]): string[] {
  return suggestions.filter((s) => !EXAMPLE_SUGGESTION_TEXTS.some((ex) => factSimilarity(s, ex) >= EXAMPLE_COPY_SIMILARITY_THRESHOLD));
}

/// Red de seguridad determinista para REGLA MÁS IMPORTANTE 3 (bug real jugando en vivo,
/// 2026-08-18): Gistera Koh pidiendo ayuda contra "uno de los suyos" — sin nombrarlo — bastó para
/// que una sugerencia rellenara el hueco con "el Orco Enfurecido" (un NPC que el jugador SÍ conoce
/// de antes, de ahí que pasara `npcsKnownFromLog`, pero que la escena actual nunca conectó con
/// quien persigue a Gistera). Corte simple: un NPC "conocido" solo puede nombrarse en una
/// sugerencia si su nombre aparece en la ÚLTIMA entrada del historial — conocerlo de turnos
/// anteriores no basta para que sea la respuesta a una pregunta sin resolver de AHORA MISMO.
///
/// Recibe el roster COMPLETO de la escena (`ctx.npcsEnEscena`), no solo `knownNpcs` (bug
/// reincidente, 2026-08-20: la misma "Orco Enfurecido" volvió a colarse en una sugerencia real
/// aunque nunca se nombró en el historial ni en PERSONAJES EN ESCENA — la causa raíz de ESE caso
/// concreto era otra, ver turnResolution.ts fase 2 de Gistera Koh, pero este filtro tenía el mismo
/// hueco por diseño: como `npcsKnownFromLog` ya lo excluía de `knownNpcs` por no aparecer en el
/// log, tampoco entraba en `staleNames` — quedaba completamente fuera de esta red de seguridad,
/// justo el caso que más la necesita). Un NPC detectado en escena por el motor pero que el modelo
/// menciona por su cuenta sin que el propio historial lo respalde es siempre sospechoso, esté o no
/// en `knownNpcs`.
export function dropSuggestionsNamingStaleNpc<T extends { name: string }>(
  suggestions: string[],
  npcsEnEscena: T[],
  recentLog: string[],
): string[] {
  const lastEntry = (recentLog[recentLog.length - 1] ?? '').toLowerCase();
  const staleNames = npcsEnEscena.map((n) => n.name).filter((name) => !lastEntry.includes(name.toLowerCase()));
  if (staleNames.length === 0) return suggestions;
  return suggestions.filter((s) => !staleNames.some((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s)));
}

export interface NpcReplyContext {
  npc: { name: string; personality: string; bio: string; role: string };
  characterName: string;
  action: string;
  sessionFacts: string[];
}

/// Réplica de NPC en su propia llamada dedicada (sesión de diseño 2026-07-23, "revisar partida" —
/// tres intentos seguidos de arreglar esto vía instrucciones dentro de `narrateAction` fallaron
/// cada uno en un sitio distinto: lo ignoraba del todo, respondía el NPC equivocado, hacía hablar
/// a un ave sin habla). Misma filosofía que ya separa `classifyAction` de `narrateAction`: un
/// modelo de 7B en CPU rinde mucho mejor en una tarea única y estrecha ("sé este personaje,
/// responde a esto") que malabareando diálogo a la vez que tirada/objetos/misiones/hechos en la
/// misma llamada. `system` propio (sustituye al del Modelfile a propósito): aquí NO queremos que
/// el modelo narre la escena ni decida nada mecánico, solo que hable en personaje. El resultado se
/// añade tal cual a la narración final en turnResolution.ts — a la llamada principal ya NO se le
/// pide diálogo, para no arriesgar una segunda réplica por duplicado.
const NPC_REPLY_FORMAT = {
  type: 'object',
  properties: { reply: { type: 'string' } },
  required: ['reply'],
} as const;

export async function generateNpcReply(ctx: NpcReplyContext): Promise<string> {
  const system =
    'Interpretas a UN SOLO personaje dentro de una escena de rol de mesa. Tu única tarea es escribir su respuesta HABLADA, en primera persona, a lo que el jugador le acaba de decir o preguntar — nunca la narración de la escena, ni acotaciones de gesto, ni el nombre del personaje delante. Responde solo con su réplica entre comillas, 1-2 frases, nada más.';

  const prompt = `PERSONAJE QUE ERES: ${ctx.npc.name} — ${ctx.npc.role}.
Personalidad: ${ctx.npc.personality}
Trasfondo: ${ctx.npc.bio}

HECHOS YA ESTABLECIDOS (no los contradigas ni reveles nada que no sepas todavía según tu propio trasfondo):
${factsBlock(ctx.sessionFacts)}

${ctx.characterName} te acaba de decir: "${ctx.action}"

Escribe SOLO tu réplica hablada, en primera persona y entre comillas, coherente con tu personalidad y tu trasfondo. Una única réplica — nunca dos intentos ni dos turnos de diálogo seguidos.`;

  // `format` estructurado (bug real jugando en vivo, 2026-09-03: Gistera Koh autocontradiciéndose
  // dentro de la misma respuesta — ver hasDoubleReplyLeak) — antes esta llamada pedía texto libre
  // sin ningún schema, y el modelo podía concatenar dos "intentos" de réplica en la misma salida
  // (dos bloques de comillas independientes, cada uno sonando a una respuesta completa distinta).
  // Un único campo `reply: string` (mismo patrón que `dynamicModeNarracion.ts` § NARRATION_FORMAT)
  // no elimina el riesgo del todo (el modelo aún puede escribir dos frases dentro del mismo string),
  // pero sí quita la ambigüedad estructural de "generar más de una respuesta suelta" — combinado con
  // el guard de abajo, doble red de seguridad.
  const { text } = await ollamaGenerate({
    model: env.ollamaModelNarrador,
    system,
    prompt,
    format: NPC_REPLY_FORMAT,
    // 120s (subido de 60s tras un fallo real en partida, 2026-07-23): probado en aislado, la
    // misma llamada tardó ~33s — pero en un turno real esta llamada se encola DETRÁS de la
    // narración principal (30-220s) en el mismo Ollama de concurrencia 1, y cambiar de `system`
    // en la misma sesión de modelo puede añadir latencia de recarga de contexto. 60s se quedaba
    // corto en la práctica; el turno principal ya usa 180s de margen para su propio intento 1.
    timeoutMs: 120_000,
    keepAlive: '1h',
    temperature: 0.4,
  });
  let reply: string;
  try {
    const parsed = JSON.parse(text) as { reply?: unknown };
    reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  } catch {
    // Fallback si el `format` JSON falla en sí (Ollama no lo respeta, o el propio motor de
    // gramática entra en un caso raro) — mismo criterio de siempre: el texto crudo tal cual, en
    // vez de perder la réplica entera por un problema de parseo ajeno al contenido.
    reply = text.trim();
  }
  // Sin cascada de reintento en esta llamada (a diferencia de `narrateAction`) — si la réplica
  // se cuela en registro de asistente o se autocontradice, se descarta sin más (mismo criterio
  // que el `catch` de `turnResolution.ts` al llamar a esta función: perder la réplica es
  // preferible a mostrarla mal).
  if (hasMetaInstructionLeak(reply)) return '';
  if (hasDoubleReplyLeak(reply)) return '';
  return reply;
}

export interface QuestResponseContext {
  characterName: string;
  npcName: string | null;
  questTitle: string;
  accepted: boolean;
  sessionFacts: string[];
}

/// Narración de la respuesta del JUGADOR al pulsar Aceptar/Cancelar sobre una oferta de misión
/// (2026-08-30, petición explícita: "esto genera narración de respuesta... según el tono del pj
/// responde y acepta la misión") — antes `quests.ts` escribía un texto fijo
/// (`"${characterName} acepta la misión: ${title}."`) sin pasar por Ollama en absoluto; la mecánica
/// (crear la Quest, aplicar recompensa) sigue siendo 100% determinista, solo el TEXTO de reacción
/// pasa a narrarse — mismo principio que el resto de "mundo determinista": el motor ya decidió QUÉ
/// pasó, el LLM solo lo cuenta. Llamada aislada, mismo espíritu que `generateNpcReply` (una tarea
/// única y estrecha en vez de arriesgar el pipeline completo de un turno para una frase corta) pero
/// al revés: aquí narra al PERSONAJE DEL JUGADOR, no a un NPC.
export async function generateQuestResponseNarration(ctx: QuestResponseContext): Promise<string> {
  const system =
    'Narras UNA sola acción breve de un personaje de rol de mesa en tercera persona, tono acorde a la escena — nunca inventes hechos nuevos, nunca decidas el desenlace (ya está decidido), solo describe cómo lo hace/dice.';

  const decision = ctx.accepted ? 'ACABA DE ACEPTAR' : 'ACABA DE RECHAZAR';
  const npcLine = ctx.npcName ? ` a ${ctx.npcName}` : '';
  const prompt = `PERSONAJE: ${ctx.characterName}.

HECHOS YA ESTABLECIDOS (no los contradigas):
${factsBlock(ctx.sessionFacts)}

${ctx.characterName} ${decision} la misión "${ctx.questTitle}"${npcLine ? `, ofrecida por${npcLine}` : ''}.

Escribe 1-2 frases narrando en tercera persona cómo ${ctx.characterName} ${ctx.accepted ? 'acepta' : 'rechaza'} — su gesto, su tono, una frase corta si dice algo. No repitas literalmente el título de la misión como si fuera diálogo.
IMPORTANTE: el título de arriba es solo una etiqueta INTERNA para identificar la misión — ${ctx.characterName} NO conoce ningún nombre propio que no esté ya en los HECHOS YA ESTABLECIDOS. Si el título nombra a alguien y ese nombre no aparece en los hechos, ${ctx.characterName} debe referirse a esa persona de forma genérica (p.ej. "el que la persigue", "su perseguidor"), nunca por su nombre.
No inventes ningún hecho nuevo (ni objetos, ni lugares, ni personajes) que no esté ya aquí.`;

  const { text } = await ollamaGenerate({
    model: env.ollamaModelNarrador,
    system,
    prompt,
    timeoutMs: 120_000,
    keepAlive: '1h',
    temperature: 0.4,
  });
  const narration = text.trim();
  // Mismo hueco estructural que `generateNpcReply` (llamada aislada, sin la cascada de guards de
  // `narrateAction`) — mismo fix, aunque aquí el riesgo real es menor al narrar en 3ª persona
  // sobre el jugador, no diálogo en 1ª persona de un NPC.
  if (hasMetaInstructionLeak(narration)) return '';
  return narration;
}

/// Grados de éxito (docs/mecanicas/08-acciones-por-tiempo.md § 5, roadmap 2026-07-19) — binario desde el
/// 2026-09-07 (hallazgo 15/19b, revisar-partida-hallazgos.md): el tercer grado "con coste" se
/// retiró por ser puramente cosmético (nunca decidía nada mecánico real, solo sugería texto sin
/// garantía de aplicarse).
function rollBlockFor(roll: RollResult): string {
  const base = `RESULTADO YA RESUELTO — no lo cambies, narra en torno a él: tirada de ${roll.attribute} = ${roll.result} (dado ${roll.roll} + atributo) vs dificultad ${roll.difficulty} → `;
  if (roll.gradoExito === 'claro') {
    return `${base}ÉXITO CLARO. La narración TIENE que aportar algo concreto y útil que antes no sabíamos (una amenaza, un objeto, un rastro, una dirección, una pista) — nunca te quedes solo en ambientación sensorial sin ningún dato jugable.`;
  }
  return `${base}FALLO. Puedes no revelar nada de interés, o revelar algo a medias/engañoso.`;
}

/// Warm-up del narrador al arrancar el servidor (2026-09-14, server.ts) — necesita un prompt REAL,
/// no cualquier texto: Ollama/llama.cpp cachea el KV-cache por coincidencia exacta de PREFIJO de
/// tokens (ver comentario de `fixedInstructions` más abajo, "D1, caché de prefijo"), y el prefijo
/// real de un turno son ~900 tokens de instrucciones fijas (`GOOD_NARRATION_EXAMPLE` +
/// `fixedInstructions`) que van SIEMPRE primero, idénticos en cada turno de cualquier partida.
/// Medido en vivo (2026-09-14): un warm-up con un prompt corto cualquiera ("Hola") deja
/// `prompt_eval_duration` en ~6.7s para el primer turno real (907 tokens sin cachear); repetir el
/// MISMO prefijo real baja eso a ~0.5s — la diferencia que de verdad importa, no capturada por
/// mirar solo `ollama ps`/`load_duration` (esos confirman que los PESOS están en GPU, no que el
/// prompt esté cacheado). Construye un `TurnContext` mínimo (caso más común: fuera de combate,
/// banda normal, sin Reino) y reutiliza `buildNarrationPrompt` en vez de copiar el texto a mano,
/// mismo criterio que ya usa `generate-distillation-dataset.ts` (ver comentario de esa función,
/// justo abajo) — así nunca se desincroniza si `fixedInstructions` cambia.
///
/// 2026-09-14 (mismo día, hallazgo posterior): al principio este warm-up solo beneficiaba turnos
/// SIN NPC en escena — `combatBlock` (con el nombre real de cada NPC no-agresivo presente) vivía
/// dentro de `fixedInstructions`, así que el prefijo cacheable variaba según qué NPC hubiera. Se
/// movió `combatBlock` fuera de `fixedInstructions` (ver ese comentario más abajo) precisamente
/// para que este warm-up cubra también la mayoría de turnos reales, no solo el caso de exploración
/// en solitario.
export function narratorWarmupPrompt(): string {
  return buildNarrationPrompt({
    worldFacts: [],
    characterSummary: '',
    action: '',
  }).prompt;
}

/// Paso 2 del turno: narra con el resultado de la tirada ya fijado (o sin tirada si no hacía falta).
/// Extraído de narrateAction (2026-08-07, plan "IA local propia") como función pura sin efectos
/// secundarios ni llamadas a Ollama — el script de destilación (generate-distillation-dataset.ts)
/// necesita el MISMO prompt exacto que recibe producción para que el profesor cloud se evalúe
/// sobre condiciones idénticas, sin arriesgarse a que una copia a mano se desincronice la próxima
/// vez que se ajuste una instrucción aquí (ha pasado muchas veces en el historial de este fichero).
export function buildNarrationPrompt(ctx: TurnContext & { roll?: RollResult }): {
  prompt: string;
  format: Record<string, unknown>;
  backgroundLoreBlock: string;
} {
  const rollBlock = ctx.roll
    ? rollBlockFor(ctx.roll)
    : 'Esta acción no necesita tirada — narra el resultado directamente, pero sigue aportando algo concreto: qué cambia, qué consigue o qué nota el personaje, no solo atmósfera.';

  const npcSlugs = ctx.npcSlugsInScene ?? [];
  const reinoActive = reinoIntentDetected(ctx.action);
  // Emboscada determinista (bug real jugando, 2026-07-22): antes quién actúa primero era libre
  // albedrío total del modelo, incluso cuando ya existía una tirada resuelta para ESTA misma
  // acción de acercamiento/búsqueda hostil — se reutiliza su gradoExito en vez de inventar una
  // señal nueva o dejarlo a la prosa. Ver detectsHostileSearchIntent (npcScene.ts) para el hueco
  // real que esto tapa: "busco a X en busca de pelea" no lleva verbo de ataque literal.
  //
  // Contradicción real encontrada (bug jugando en vivo, 2026-08-22, "Salgo a cazar y ataco a
  // 'Zense Ceniza'." narró un golpe conectado y la reacción de dolor del ave, en el turno que
  // INICIA combate, sin ningún intercambio mecánico todavía): la rama `gradoExito === 'claro'`
  // decía literalmente "actúa/golpea primero" — la palabra "golpea" implica contacto ya resuelto,
  // justo lo que `combatNotYetResolved` (turnResolution.ts, mismo prompt, más abajo en
  // `combatBlock`) prohíbe explícitamente para este mismo turno ("NUNCA un golpe que conecta"). Y
  // no es un choque ocasional: `hostileEngagement` (arriba) exige `!ctx.enCombate`, y
  // mecánicamente `exchangeHappened` SIEMPRE es false mientras `enCombate` (el flag que manda el
  // frontend) siga en false — así que esta rama de `ambushHint` y `combatNotYetResolved` se
  // activan SIEMPRE juntas, nunca por separado, para cualquier primer ataque libre contra un NPC
  // virgen. El propio regex de seguridad (`PREMATURE_COMBAT_REGEX` más abajo) se amplió para
  // pillar esta narración concreta, pero la causa de raíz era esta instrucción contradictoria
  // dentro del mismo prompt — se reescribe para hablar de VENTAJA DE POSICIÓN/INICIATIVA, nunca
  // de un golpe ya conectado ni de la reacción física del objetivo a él.
  const hostileEngagement = !ctx.enCombate && npcSlugs.length > 0 && (detectsAttackIntent(ctx.action) || detectsHostileSearchIntent(ctx.action));
  // Ver `hasWrongAggressorName` más abajo y el comentario de `nonHostileNpcNamesInScene` en
  // TurnContext — instrucción explícita con nombres reales, no solo el guard post-hoc, para que el
  // modelo tenga la información desde el principio en vez de que la corrección llegue solo vía
  // reintento.
  const nonHostileNames = ctx.nonHostileNpcNamesInScene ?? [];
  const nonHostileHint =
    nonHostileNames.length > 0
      ? ` ${nonHostileNames.join(', ')} ${nonHostileNames.length === 1 ? 'no es' : 'no son'} agresivo${nonHostileNames.length === 1 ? '' : 's'} por naturaleza — nunca lo(s) narres iniciando un ataque, ni como el implicado en "combateIniciado" si la escena deriva en enfrentamiento.`
      : '';
  const ambushHint =
    hostileEngagement && ctx.roll
      ? ctx.roll.gradoExito === 'claro'
        ? ' Tu personaje SORPRENDE al NPC — se mueve/actúa primero, con clara ventaja de posición. Pero NO describas ningún golpe ya conectado, herida, ni ninguna reacción de dolor o huida del NPC a un golpe: si conecta o no, y qué le pasa al NPC, se decide en el combate que empieza ahora, no en esta narración.'
        : ctx.roll.gradoExito === 'fallo'
          ? ' El NPC te SORPRENDE A TI — nota tu presencia y reacciona primero, con ventaja sobre ti. Pero NO describas ningún golpe ya recibido por tu personaje: eso se decide en el combate que empieza ahora, no en esta narración.'
          : ' Ninguno sorprende al otro — ambos se preparan a la vez, en igualdad de condiciones, sin que el enfrentamiento en sí (quién golpea, quién sale herido) se resuelva todavía en esta narración.'
      : '';
  const combatBlock = ctx.enCombate
    ? `ESTÁS DENTRO DE UN COMBATE (docs/mecanicas/14-combate-y-muerte.md § 2.3): narra en 1-2 frases, corto y directo, el intercambio de ESTE turno — nada de ambientación de relleno, es el ritmo de un choque, no una escena. Puedes proponer "condicionFisica" si el personaje sale herido de este intercambio (nunca lo cures aquí salvo que la acción sea explícitamente curarse). No te contradigas dentro de la misma frase (checklist consolidado P1.6, 2026-08-27, bug real: "bloquea eficazmente... sin daño, dejando una mancha roja en su pecho" — el propio texto se desmiente a sí mismo) — si un golpe se bloquea o esquiva sin daño, no describas ninguna herida/mancha/marca en el mismo aliento; si SÍ hay herida, no digas antes que fue "sin daño".${
        ctx.npcFallsUnconsciousThisTurn
          ? ctx.npcFallsConvalecienteThisTurn
            ? // Grupo que continúa (auditoría 2026-08-22, "revisa la partida otra vez"): este mismo
              // individuo NO se queda tirado y rematable — la fila vuelve a ILESO para el siguiente
              // miembro en este mismo turno (ver `grupoContinuaEsteTurno` en turnResolution.ts), así
              // que no hay ocasión real de rematarlo después. `npcFallsConvalecienteThisTurn` ya
              // excluye ese caso, así que aquí SIEMPRE es un CONVALECIENTE "de verdad" (sigue vivo,
              // rematable, quizá se recupere solo con el tiempo) — la instrucción de abajo puede
              // seguir prometiendo eso sin mentir.
              ' Este golpe deja al rival CONVALECIENTE (no MUERTO) — tu narración de este turno tiene que describir explícitamente ese momento, no dejarlo implícito ni solo insinuado: sigue consciente, solo sin fuerzas para seguir luchando — cae de rodillas, se desploma malherido, tambalea sin poder levantarse... NUNCA lo narres inconsciente/desmayado/sin sentido (un rival inconsciente de verdad no podría seguir combatiendo si el jugador no lo remata ya mismo, y el juego permite que la pelea continúe).'
            : ' Este golpe acaba con este rival para siempre — tu narración de este turno tiene que describir explícitamente ese momento, no dejarlo implícito ni solo insinuado: es el final para él, no un simple tropiezo del que pueda recuperarse.'
          : ''
      }${
        ctx.jugadorRecibeGolpeEsteTurno
          ? ' ADEMÁS, en este MISMO intercambio tú también recibes un golpe de vuelta — tu narración tiene que reflejar los DOS lados del choque (lo que le pasa al rival Y lo que te pasa a ti), nunca solo uno de los dos como si el otro no hubiera ocurrido.'
          : ''
      }`
    : `Fuera de combate nunca empeores "condicionFisica" — solo puedes proponerla si el personaje se cura o descansa de verdad (mejora), o déjala en null. ${
        hostileEngagement
          ? `Esta escena ES un enfrentamiento real contra ${npcSlugs.length === 1 ? 'el NPC ya' : 'los NPCs ya'} en escena — rellena "combateIniciado" con los NPCs implicados (usa exactamente los slugs ya listados, nunca inventes uno), esto no es opcional aquí.${ambushHint}`
          : npcSlugs.length > 0
            ? // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"):
              // ante una pregunta directa del jugador a un NPC ya en escena, el modelo respondió con
              // el propio Gorhorn repitiendo sus mismas palabras entre comillas como si fuera la
              // respuesta de OTRO personaje, y encima renombró al NPC real (Gistera Koh) por un rol
              // genérico inventado ("el joven cazador Serhu") — perdiendo nombre, personalidad y
              // hasta el sexo del NPC en dos turnos. La instrucción anterior ("Modo diálogo: si hay
              // conversación...") no era lo bastante explícita para un modelo pequeño; esta nombra el
              // fallo exacto a evitar.
              `Si esta escena deriva en un enfrentamiento real (no solo tensión verbal), rellena "combateIniciado" con los NPCs implicados (usa exactamente los slugs ya listados, nunca inventes uno) — en caso contrario, null.${nonHostileHint} DIÁLOGO (obligatorio si el jugador pregunta, saluda o dirige la palabra a un NPC en escena): ese NPC EXACTO — usa su nombre y personalidad reales de "PERSONAJE EN ESCENA" más abajo, nunca lo sustituyas por un rol genérico ni le cambies el sexo — tiene que responderle de verdad dentro de esta misma narración, hablando en primera persona entre comillas. Dejar la pregunta sin respuesta, resumirla en tercera persona genérica, o hacer que el propio personaje del jugador repita sus mismas palabras como si fueran la respuesta de otro, es un fallo grave. Si hay diálogo real (no solo tensión), puedes extenderte algo más de lo habitual para darle espacio a esa voz — no lo comprimas a una sola frase.`
            : 'No hay ningún NPC con datos conocidos en esta escena, así que "combateIniciado" tiene que ser null.'
      }`;

  // Extensión de la narración según el peso real del turno (2026-07-22, petición explícita:
  // "narraciones cortas cuando son acciones y quizás largas cuando son de lore, conversaciones,
  // descripciones de resultados de una acción larga... no quiero limitar el número de caracteres
  // para todos los casos"). `banda` es la misma clasificación que ya decidió /turn/classify — no
  // se inventa una señal nueva, se reutiliza la que ya existe. Combate manda siempre que aplica
  // (más estricto que "instantanea" a secas, ver combatBlock más abajo, que ya impone su propio
  // ritmo); fuera de combate, una acción "extendida"/"larga" (viaje, descanso prolongado, obra)
  // representa de verdad más tiempo de ficción y puede ganarse más espacio para contarlo.
  const lengthGuidance = ctx.enCombate
    ? 'Narra en 1-2 frases muy breves lo que ocurre en este intercambio — directo, sin relleno, con al menos un dato o consecuencia concreta.'
    : ctx.banda === 'extendida' || ctx.banda === 'larga'
      ? 'Esta acción representa un tramo largo de tiempo (horas o más) — puedes extenderte algo más de lo habitual si hay algo real que contar sobre cómo transcurre (hasta 4-5 frases), pero sigue sin rellenar con paisaje o sensaciones vacías: cada frase de más tiene que aportar un dato o consecuencia concreta.'
      : 'Narra en 1-3 frases breves lo que ocurre — directo, sin relleno, y con al menos un dato o consecuencia concreta (no solo describir el paisaje o las sensaciones).';

  // Roadmap 2026-07-19 (D1, caché de prefijo): Ollama reutiliza el KV-cache cuando el PREFIJO de
  // tokens coincide con la petición anterior, y en CPU el prefill domina el coste — un turno de
  // 30-220s. Antes el prompt empezaba por HECHOS DEL MUNDO (lo más variable posible), invalidando
  // el caché en cada turno. Ahora el bloque fijo (idéntico letra a letra en todos los turnos, salvo
  // `lengthGuidance` arriba) va primero, y lo que cambia de verdad turno a turno (hechos, tirada,
  // acción) va al final. Nota 2026-07-22: medido en vivo que el prefill de un prompt típico
  // (~900 tokens) tarda ~0.3s en este hardware — perder algo de caché de prefijo por variar
  // `lengthGuidance` es coste real pero insignificante frente a los 60s+ que domina el decode.
  //
  // 2026-09-14 (investigación warm-up, decisión técnica 15): `combatBlock` (con `nonHostileHint`/
  // `ambushHint`, que incluyen el NOMBRE REAL de cada NPC en escena) se sacó de aquí a propósito —
  // vivía al final de `fixedInstructions` pese a NO ser fijo (varía según qué NPC esté presente),
  // lo que rompía el caché de prefijo del warm-up en cuanto había cualquier NPC en escena (la
  // mayoría de turnos reales). Ahora `fixedInstructions` es de verdad idéntico letra a letra en
  // todos los turnos de cualquier partida, y `combatBlock` se coloca más abajo, junto a `rollBlock`
  // y ACCIÓN DEL JUGADOR — la parte que ya variaba turno a turno de todos modos.
  const fixedInstructions = `${lengthGuidance}

PERSPECTIVA: NARRA SIEMPRE EN TERCERA PERSONA sobre el personaje del jugador, por su nombre (checklist consolidado P1.6/P1.7, 2026-08-27, bug real jugando en vivo: la narración saltaba a segunda persona a mitad de párrafo — "El orco... lanzándola hacia Gorhorn... Tu hacha... tu pecho" — mezclando registros dentro de la misma frase) — nunca "tú"/"tu"/"te" refiriéndote al personaje del jugador, aunque estas instrucciones a TI (el modelo) sí usen esa forma para hablarte. Solo el diálogo citado entre comillas de un NPC dirigiéndose al jugador puede usar la segunda persona dentro de esa cita — redacta SIEMPRE una frase nueva para esa cita, propia de TU escena real, nunca una frase genérica o previsible que pudiera repetirse turno tras turno o partida tras partida (bug real jugando en vivo, 2026-09-15: dos NPC sin relación entre sí dijeron literalmente la misma frase "¿Has visto algo?" — un NPC nuevo tiene que sonar distinto de cualquier otro, aunque comparta el mismo motivo o situación). NUNCA termines la narración con preguntas retóricas dirigidas al jugador (nada de "¿qué harás?", "¿te arriesgas?", "¿continúas?") ni le ofrezcas explícitamente una lista de opciones a elegir — eso lo decide el jugador con su siguiente acción libre, no el narrador proponiéndoselo.

TONO: el tono/actitud que el jugador describe explícitamente en su propia acción (calma, cortesía, agresividad...) define cómo actúa y se comporta SU personaje en esta narración — nunca lo sustituyas por uno contrario (auditoría 2026-08-12, "descolocación de tono" — bug real jugando en vivo: un acercamiento pacífico y explícito, manos vacías y en calma, se narró como si el personaje exigiera y desafiara). Esto no limita cómo reacciona el NPC: puede responder con su propia personalidad (hostil, huidizo, indiferente...) aunque el tono del jugador sea distinto — el tono ajeno del NPC no debe "contagiar" cómo se describe al personaje del jugador.

MUNDO: JAMÁS menciones pólvora, armas de fuego, metal industrial, plástico, electricidad ni ningún objeto o tecnología moderna/anacrónica — ni como ambientación ni como detalle suelto. Si necesitas un olor o peligro genérico, usa algo coherente con el lugar (sudor, sangre, humo de leña, arcilla, azufre volcánico), nunca un cliché de videojuego moderno. No contradigas los hechos ya establecidos sobre el propio personaje (por ejemplo, si va solo, no le des compañeros, seguidores o un grupo propio que no existían antes) ni repitas como si fuera nuevo un lugar o hecho que ya aparece en HECHOS DEL MUNDO. Si a cualquier NPC (con nombre o improvisado) le describes un arma, armadura o material, usa solo los ya establecidos en este mundo (hierro, hueso, cuero o piel curtida, madera, hielo sílice, arcilla): nunca inventes un material distinto (nada de bronce, acero, cobre, obsidiana ni ningún otro que no hayas visto ya en HECHOS DEL MUNDO). Igual con cualquier animal o criatura que aparezca (con nombre o improvisado): usa solo fauna ya establecida en este mundo (la que se te da como pista de posible encuentro, la ya vista en HECHOS DEL MUNDO, o el bestiario propio de este lugar) — nunca un animal mundano del mundo real que no exista aquí (zorro, ciervo, conejo, lobo, oso...). Sí puedes improvisar libremente NPCs sin nombre o sucesos menores que no tengan peso en la trama (un viajero anónimo, un ruido, el clima).

CAMPOS OPCIONALES (todos poco frecuentes, la mayoría de turnos van en null): si la narración revela algo que el personaje ahora sabe o que cambia la situación, añádelo también a "newFacts" como frase corta, para que se recuerde en turnos futuros. Solo si la acción resulta de verdad en que el personaje consigue o fabrica un objeto físico duradero (no algo que se consume o desaparece en la escena), rellena "newItem" con su nombre y descripción — en caso contrario déjalo en null. Igual para "newCompanion": solo si la acción resulta de verdad en ganar un aliado o compañero de verdad (nunca lo inventes de la nada ni contradigas que el personaje va solo), rellénalo con nombre/rol/notas; si no, déjalo en null.

Progresión: si este turno logra algo significativo que no sea solo superar la tirada (un descubrimiento importante, cerrar un objetivo menor, cerrar un objetivo mayor/misión larga), rellena "hito" con "descubrimiento", "objetivo_menor" u "objetivo_mayor" — en caso contrario, null. Esto es poco frecuente, no pasa en cada turno.

Misiones: solo si la escena establece de verdad un objetivo narrativo concreto con entidad propia (no cualquier intención pasajera del jugador), rellena "newQuest" con un título corto y su descripción — en caso contrario, null. Si esta acción resuelve (con éxito o fracaso definitivo) una misión que ya existía, rellena "questProgress" con el título EXACTO de esa misión y "COMPLETADA" o "FALLIDA" — en caso contrario, null. Ambos muy poco frecuentes, nunca en el mismo turno que se crea la misión.

${
    // Roadmap de velocidad (Fable, 2026-07-19): este párrafo (y los 3 campos del schema que
    // describe) solo se ofrece cuando la propia acción del jugador sugiere Reino/gobierno —
    // en el resto de turnos ni siquiera se menciona, ahorrando tokens de instrucción y de
    // schema sin quitarle la posibilidad al modelo cuando sí aplica.
    reinoActive
      ? '\nReino: solo si la acción resulta de verdad en que el personaje reclama un territorio, termina de construir un edificio, o gana un súbdito con nombre que sirve a su dominio (no un compañero de viaje personal, eso es "newCompanion"), rellena el campo correspondiente ("newTerritory", "newBuilding" o "newSubject") — el resto de turnos, todos en null. Muy poco frecuente.\n'
      : ''
  }`;

  const groundingBlock = ctx.weaklyGrounded
    ? 'No tenemos hechos específicos sobre esto — describe el entorno o el resultado de forma genérica y creíble (terreno, clima, sensaciones), sin inventar fauna, personajes con nombre, clanes ni objetos con historia propia.'
    : 'No inventes fauna, flora, personajes con nombre, clanes ni objetos con historia propia que no aparezcan en HECHOS DEL MUNDO o en CONOCIMIENTO DE FONDO. Pero ojo: CONOCIMIENTO DE FONDO es solo trasfondo/ambientación — NUNCA es licencia para hacer aparecer en persona, en esta escena, a un personaje que solo esté ahí. Un personaje de CONOCIMIENTO DE FONDO puede motivar un detalle, un rumor, un objeto o una referencia indirecta, pero solo puede aparecer físicamente si además está en HECHOS DEL MUNDO o en NPCs EN ESCENA.';

  // CONOCIMIENTO DE FONDO (roadmap 2026-07-24, ver comentario en TurnContext.backgroundLore):
  // bloque separado de HECHOS DEL MUNDO a propósito — el lore RAG se recupera por similitud
  // semántica con la acción, no por relevancia geográfica/narrativa a la escena actual, así que
  // puede traer personajes reales del canon que viven en otra región o en la trama de otro
  // personaje jugable. Iba fusionado en la misma lista que los hechos deterministas de la escena
  // hasta que un NPC de otra región (Hagar, Sella Marn) apareció en persona sin venir a cuento.
  const backgroundLoreBlock = `

CONOCIMIENTO DE FONDO DEL MUNDO (lore general del mundo relacionado con la acción — solo contexto/ambientación, NO implica presencia física en esta escena):
${factsBlock(ctx.backgroundLore ?? [])}`;

  const prompt = `${GOOD_NARRATION_EXAMPLE}

${fixedInstructions}

PERSONAJE:
${ctx.characterSummary}

HECHOS DEL MUNDO (lo que es real y está pasando en esta escena/partida ahora mismo):
${factsBlock(ctx.worldFacts)}${backgroundLoreBlock}
${groundingBlock}

${rollBlock}

${combatBlock}

ACCIÓN DEL JUGADOR:
"${ctx.action}"

Responde solo con el JSON pedido, nada más.`;

  const format = {
    type: 'object',
    properties: {
      narration: { type: 'string' },
      newFacts: { type: 'array', items: { type: 'string' } },
      newItem: {
        type: ['object', 'null'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      newCompanion: {
        type: ['object', 'null'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      hito: { type: ['string', 'null'], enum: ['descubrimiento', 'objetivo_menor', 'objetivo_mayor', null] },
      // Campos de Reino (roadmap de velocidad, 2026-07-19): solo entran en el schema cuando
      // reinoActive los sugiere — el resto de turnos ni siquiera se le ofrece la posibilidad de
      // rellenarlos, así que no puede gastar tokens devolviendo "newTerritory": null, etc.
      ...(reinoActive
        ? {
            newTerritory: {
              type: ['object', 'null'],
              properties: {
                name: { type: 'string' },
                region: { type: 'string' },
                description: { type: 'string' },
              },
            },
            newBuilding: {
              type: ['object', 'null'],
              properties: {
                name: { type: 'string' },
                kind: { type: 'string' },
                description: { type: 'string' },
                territoryName: { type: 'string' },
              },
            },
            newSubject: {
              type: ['object', 'null'],
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                notes: { type: 'string' },
                territoryName: { type: 'string' },
              },
            },
          }
        : {}),
      newQuest: {
        type: ['object', 'null'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
      },
      questProgress: {
        type: ['object', 'null'],
        properties: {
          title: { type: 'string' },
          status: { type: 'string', enum: ['COMPLETADA', 'FALLIDA'] },
        },
      },
      condicionFisica: {
        type: ['string', 'null'],
        enum: ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO', null],
      },
      combateIniciado: {
        type: ['object', 'null'],
        properties: {
          npcSlugs: {
            type: 'array',
            items: npcSlugs.length > 0 ? { type: 'string', enum: npcSlugs } : { type: 'string' },
          },
        },
      },
    },
    required: ['narration', 'newFacts'],
  };

  return { prompt, format, backgroundLoreBlock };
}

/// Red de seguridad del reintento en cascada (2026-08-31, causa raíz: "sessionFacts reintroduce
/// NPCs retirados/cruza rasgos entre NPCs") — true si CADA intento produjo JSON válido pero fue
/// rechazado por EXACTAMENTE el mismo guard las 3 veces (mismo `reason` de texto). Cuando el sesgo
/// vive en el propio prompt (mismo sessionFact/ficha de NPC visto en los 3 intentos), el reintento
/// no lo cura solo — devolver el último intento (como se hacía antes) narraba la contaminación al
/// jugador de todos modos. `reasons.length < totalAttempts` (algún intento falló por excepción, no
/// por rechazo de guard) nunca cuenta como "mismo motivo" — solo se activa si TODOS los intentos
/// llegaron a producir JSON y TODOS violaron el mismo guard.
export function allAttemptsRejectedForSameReason(reasons: string[], totalAttempts: number): boolean {
  return reasons.length === totalAttempts && new Set(reasons).size === 1;
}

export async function narrateAction(ctx: TurnContext & { roll?: RollResult }): Promise<NarrationResult> {
  const { prompt, format, backgroundLoreBlock } = buildNarrationPrompt(ctx);

  // Tres intentos en cascada. Visto en pruebas reales (2026-07-18): una acción concreta colgó
  // 4 de 4 veces con el modelo grande, incluso reduciendo hechos y relajando la regla de "no
  // inventes" — no es un problema de contexto, parece un cuelgue real del motor de gramática de
  // Ollama con ese texto en concreto. Sin forma de arreglar la causa desde aquí, así que la red
  // de seguridad es: intentarlo dos veces con el grande y, si ambas fallan, caer al modelo
  // pequeño — peor prosa, pero el turno no se pierde del todo.
  // keepAlive '1h' (roadmap de velocidad, 2026-07-19): antes el narrador usaba el default (5m) —
  // un tránsito extendida/larga comprimido en tiempo real podía tardar más que eso en resolverse,
  // así que el turno siguiente pagaba recarga completa del modelo (4,4GB) desde disco Y perdía el
  // caché de prefijo recién optimizado (D1). Dejarlo residente más tiempo cuesta RAM mientras el
  // jugador piensa, pero en este hardware el cuello de botella medido es precisamente recargar
  // desde disco bajo presión de memoria, no la RAM ociosa en sí.
  // temperature más baja en combate (roadmap 2026-07-20, mitigación de calidad narrativa,
  // propuesta de Fable): el combate necesita precisión ("¿a quién golpeo, con qué?"), no prosa
  // creativa — dejar la exploración en la temperatura normal del Modelfile (~0.9).
  const combatTemperature = ctx.enCombate ? 0.65 : undefined;

  const attempt1 = () => {
    const generateOptions = {
      model: env.ollamaModelNarrador,
      prompt,
      format,
      maxTokens: 220,
      // Bajado de 180s a 90s (2026-08-04, "ronda larga de pruebas" — logs reales de la Deck bajo
      // presión de memoria: el intento 1 se colgó del todo y agotó los 180s completos en CADA
      // turno narrado de la sesión, y el intento 2 (que sí funcionó) tardó solo ~60-105s más
      // encima de eso). 90s deja el triple de margen que el peor caso normal de la usuaria (~60s
      // en situaciones concretas) sin seguir regalando minutos enteros a un cuelgue real antes de
      // caer al intento 2, que es el que de verdad completa el turno.
      timeoutMs: 90_000,
      keepAlive: '1h',
      temperature: combatTemperature,
    };
    if (!ctx.onNarrationChunk) return ollamaGenerate(generateOptions);

    // Extrae "narration" en vivo del JSON a medio generar (narrationStream.ts) — re-deriva desde
    // el texto crudo acumulado en cada chunk (barato: son ~cientos de caracteres) en vez de llevar
    // estado de escape a medio resolver entre llamadas.
    let rawAccum = '';
    let emitted = '';
    const onNarrationChunk = ctx.onNarrationChunk;
    return ollamaGenerateStream(generateOptions, (delta) => {
      rawAccum += delta;
      const { value } = extractStreamingNarration(rawAccum);
      if (value.length > emitted.length) {
        onNarrationChunk(value.slice(emitted.length));
        emitted = value;
      }
    });
  };

  const attempt2 = () => {
    // Si fue timeout (no solo JSON cortado), reducir los hechos es la mitigación más razonable
    // sin saber la causa exacta — no ha demostrado arreglar el cuelgue visto, pero tampoco hace
    // daño. Nunca por debajo de `criticalFactsCount` (ver comentario en TurnContext) — el recorte
    // se come primero el lore RAG/sessionFacts del final, nunca los bloques deterministas.
    const retryFacts = ctx.worldFacts.slice(0, Math.max(2, ctx.criticalFactsCount ?? 0));
    // El lore de fondo (backgroundLoreBlock) es aún más prescindible que sessionFacts en un
    // reintento de emergencia — se omite entero, nunca se recorta a medias.
    const retryPrompt = prompt
      .replace(factsBlock(ctx.worldFacts), factsBlock(retryFacts))
      .replace(backgroundLoreBlock, '');
    // maxTokens 400 (roadmap de velocidad, 2026-07-19, hallazgo de Fable): antes este intento no
    // llevaba tope y podía irse a los 240s enteros de timeout en vez de cortar antes — 400 sigue
    // dando mucho más margen que los 220 del intento 1 (por si la causa real era truncar de más),
    // sin dejarlo sin límite del todo.
    return ollamaGenerate({
      model: env.ollamaModelNarrador,
      prompt: retryPrompt,
      format,
      maxTokens: 400,
      timeoutMs: 240_000,
      keepAlive: '1h',
      temperature: combatTemperature,
    });
  };

  const attempt3 = () =>
    ollamaGenerate({
      model: env.ollamaModelCronista,
      prompt,
      format,
      maxTokens: 220,
      timeoutMs: 90_000,
      keepAlive: '0',
      temperature: combatTemperature,
    });

  let lastResult: NarrationResult | null = null;
  // Red de seguridad (2026-08-31, causa raíz: "sessionFacts reintroduce NPCs retirados/cruza
  // rasgos entre NPCs") — si el sesgo que produce una violación vive en el PROPIO prompt (mismo
  // sessionFact/ficha de NPC visto en los 3 intentos), el reintento en cascada no lo cura solo:
  // los 3 intentos pueden violar el MISMO guard por igual, y antes de esto se devolvía el último
  // de todos modos (`lastResult`), narrando la contaminación al jugador. Se registra la `reason`
  // de cada rechazo para poder distinguir ese caso de "tuvo éxito en el intento 2/3 tras un fallo
  // distinto cada vez" — solo cuando las 3 razones coinciden EXACTAMENTE se trata como no resuelto.
  const rejectionReasons: string[] = [];
  const attempts = [attempt1, attempt2, attempt3];
  for (let idx = 0; idx < attempts.length; idx++) {
    try {
      const { text } = await attempts[idx]();
      const parsed = JSON.parse(text) as NarrationResult;
      parsed.narration = stripLeakedJson(stripNonLatinScript(parsed.narration));
      parsed.newFacts = parsed.newFacts.filter((f) => !NON_LATIN_SCRIPT_REGEX.test(f));
      // Roadmap 2026-07-19: filtro determinista de anacronismos — el Modelfile ya los prohíbe
      // explícitamente (visto en pruebas: "olor a pólvora" en un mundo medieval-fantástico sin
      // pólvora), pero un 7B en CPU a veces lo ignora. No hace falta gastar un intento nuevo:
      // si este ya se ha ganado igualmente el reintento del cascadeo (attempt2/3), simplemente
      // no se devuelve todavía — se guarda por si TODOS los intentos fallan igual.
      // Validadores en cascada (refactor de deuda técnica, sin cambio de comportamiento): antes era
      // un `if` casi idéntico por validador, copiado 11 veces. El ORDEN importa (es observable: el
      // primer validador que falla es el que se reporta y el que decide si hay reintento), así que
      // se recorre en el mismo orden que antes con un solo bucle interno.
      // Bug real jugando en vivo (auditoría 2026-08-22, "¿no queda nada más al revisar la
      // partida?"): un turno cuya PROSA era honesta ("se desploma hacia atrás, dejando una
      // mancha de sangre" — un golpe de verdad, pero ni de lejos una muerte) escribió de todos
      // modos "Zense Ceniza ha sido derrotado y muerto." en `newFacts` — un SessionFact falso
      // que ninguno de los guards de abajo pilló porque todos comprobaban solo `parsed.narration`,
      // nunca `newFacts`. Ese hecho falso queda persistido para siempre (`appendSessionFacts`) y
      // contamina la RAG de turnos futuros, mucho más grave que una frase suelta mal elegida —
      // mismo patrón que ya usan `hasFalseTravelClaim`/`hasFalsePhantomTravel` (comprueban prosa Y
      // `newFacts` juntos). Los 4 guards de honestidad narración-vs-mecánica de combate ahora
      // comprueban el mismo texto combinado.
      const narrationAndFacts = [parsed.narration, ...parsed.newFacts].join(' ');
      const rejection = [
        { check: () => hasAnachronism(parsed.narration), reason: 'anacronismo' },
        { check: () => isTooSimilarToLast(parsed.narration, ctx.lastNarrationText), reason: 'repetir casi verbatim el turno anterior' },
        { check: () => hasEnglishLeak(parsed.narration), reason: 'fuga de inglés' },
        { check: () => hasHumanRaceLeak(parsed.narration), reason: 'mención de "humano/humana" — Helek Sirik no tiene raza humana' },
        { check: () => hasSecondPersonLeak(parsed.narration), reason: 'salto a segunda persona fuera de diálogo citado' },
        { check: () => hasFalseCombatHit(narrationAndFacts, ctx.combatBothMissed), reason: 'narrar (en prosa o en newFacts) un golpe que no conectó (ataque_falla/parada_en_seco)' },
        {
          check: () => hasFalseCombatMiss(narrationAndFacts, ctx.combatRealHitLanded, ctx.nonExchangeAttackHitLanded),
          reason: 'narrar (en prosa o en newFacts) una esquiva/bloqueo limpio cuando el golpe sí conectó (golpe_normal/golpe_pleno/golpes_mutuos)',
        },
        {
          check: () => hasFalseCombatAttacker(narrationAndFacts, ctx.characterName, ctx.jugadorRecibeGolpeEsteTurno),
          reason: 'narrar (en prosa o en newFacts) al jugador acertando un golpe cuando el golpe real de este intercambio lo dio el NPC contra el jugador',
        },
        {
          check: () => hasFalseDefenseNarration(parsed.narration, ctx.playerActedAsDefenderThisExchange),
          reason: 'narrar una escena de búsqueda/reconocimiento del enemigo en vez de bloquear/esquivar el golpe recibido en la defensa a ciegas',
        },
        {
          check: () => hasInoffensiveNpcNarratedAttacking(parsed.narration, ctx.npcAttackerIsInoffensive),
          reason: 'narrar un ataque activo (embestir/golpear/morder) de un NPC marcado INOFENSIVO o cuyo ataqueNatural dice "No ataca" — el catálogo dice que esa criatura no ataca',
        },
        {
          check: () => hasGorhornPronouncingOrcoEnfurecidoName(parsed.narration, ctx.gisteraAcceptanceTurnRisksOrcoName),
          reason: 'Gorhorn pronunciando el nombre "Orco Enfurecido" al aceptar ayudar a Gistera Koh — ella nunca lo dice, es solo el nombre técnico de la misión, Gorhorn no lo conoce todavía',
        },
        {
          check: () => hasPrematureCombatResolution(narrationAndFacts, ctx.combatNotYetResolved),
          reason: 'narrar (en prosa o en newFacts) un combate ya resuelto sin ningún intercambio mecánico este turno',
        },
        {
          check: () => hasFalseUnconsciousNarration(narrationAndFacts, ctx.npcFallsConvalecienteThisTurn),
          reason: 'narrar (en prosa o en newFacts) al rival inconsciente/desmayado/inerte cuando queda CONVALECIENTE (sigue consciente, solo sin fuerzas)',
        },
        {
          check: () => hasFalseDeathClaim(narrationAndFacts, ctx.combatNoRealDeathThisTurn),
          reason: 'reclamar (en prosa o en newFacts) la muerte del rival cuando el golpe de este turno no lo deja MUERTO de verdad',
        },
        { check: () => hasFalseItemUse(parsed.narration, ctx.possiblyFalseItemUseNames), reason: 'narrar el uso de un objeto que no se consumió de verdad' },
        {
          check: () => hasResurrectedDeadNpc(parsed.narration, ctx.possiblyResurrectedNpcNames),
          reason: 'narrar a un NPC convaleciente/muerto como si siguiera activo',
        },
        {
          check: () => hasFalseNpcAppearance(narrationAndFacts, ctx.possiblyUnauthorizedNpcNames),
          reason: 'hacer aparecer (en prosa o en newFacts) a un NPC que ningún mecanismo determinista puso en escena este turno',
        },
        {
          check: () => hasGisteraReencuentroSinNombrar(parsed.narration, ctx.gisteraSeHaMarchado),
          reason: 'reintroducir a Gistera Koh sin nombrarla pese a haberse marchado para siempre',
        },
        {
          check: () => hasFalseGisteraNamedReturn(parsed.narration, ctx.gisteraSeHaMarchado),
          reason: 'nombrar a Gistera Koh directamente pese a haberse marchado para siempre',
        },
        {
          check: () => hasFalseKarotVekuAsRiver(narrationAndFacts),
          reason: 'describir Karot Veku como un río — es el nombre nativo del campamento del Clan Serhu, no un accidente geográfico',
        },
        {
          check: () => hasWrongCelestialReference(parsed.narration, ctx.momentoDelDia),
          reason: 'mencionar estrellas en pleno día, o sol/amanecer/atardecer de noche — el momento del día ya lo decide el motor determinista',
        },
        {
          check: () => hasFalseMoonReference(parsed.narration),
          reason: 'mencionar la luna — Helek Sirik no tiene luna convencional, en ningún momento del día (el cinturón de micro-cristales se llama "brillo de aurora")',
        },
        {
          check: () => hasMortalSpeakingNohade(parsed.narration),
          reason: 'un mortal hablando, leyendo o escribiendo nohade — es la lengua exclusivamente divina de las Semillas, ningún mortal la ha hablado jamás',
        },
        {
          check: () => hasOrcWorshippingTarkor(parsed.narration),
          reason: 'un orco rezando, jurando o invocando a Tarkor — los orcos no adoran a Tarkor ni conocen su existencia, la Magia es para ellos poder salvaje del Estallido sin nombre ni figura divina',
        },
        {
          check: () => hasUnpunishedOrcTabooBreak(parsed.narration),
          reason: 'interrumpir un duelo de honor o tocar el tótem de un clan ajeno sin ninguna consecuencia narrada — son los dos tabúes prácticos reales de la cultura orca',
        },
        {
          check: () => hasNonSerhuDenyingFuneralRite(parsed.narration),
          reason: 'negar el cuerpo de un caído (hacerlo desaparecer sin velarlo) en un clan que no es Serhu — ese castigo es exclusivo de la casta de Ketg, ningún otro clan orco lo practica',
        },
        {
          check: () => hasRawOrcMagicWithoutFocus(parsed.narration),
          reason: 'un orco lanzando magia en crudo con las manos, sin ningún tótem o runa — Tarkor selló ese canalizador de serie, la única vía real es a través de un foco trabajado',
        },
        {
          check: () => hasMercifulSigneran(parsed.narration),
          reason: 'un Signeran (duelo de honor orco) resuelto con clemencia — es siempre a muerte, dejar con vida al perdedor es una deshonra y una debilidad para ambos',
        },
        {
          check: () => hasUnpunishedIlvenarFalsify(parsed.narration),
          reason: 'un Ilvenar falseando un registro sin la consecuencia de dejar de ser considerado Ilvenar por los suyos — es su tabú absoluto, el que define a toda la raza',
        },
        {
          check: () => hasUnpunishedFaerusAbandon(parsed.narration),
          reason: 'un Faerus abandonando a un herido de la manada sin ninguna consecuencia narrada — es el único tabú que no se perdona en su cultura',
        },
        {
          check: () => hasNieblaCrossingWithoutTech(parsed.narration),
          reason: 'cruzar la Niebla del Estrecho sin mencionar cristal Kelife o brújula de vacío Nabieus — ningún barco convencional puede cruzarla sin perder el rumbo',
        },
        {
          check: () => hasFalseMaktorThreatClaim(narrationAndFacts),
          reason: 'sugerir que quedan otros orcos del Clan Maktor con vida — el clan fue aniquilado, Gorhorn es el único superviviente conocido',
        },
        {
          check: () => hasFalseTravelClaim(parsed, ctx.possiblyFalseTravelDestinationNames),
          reason: 'narrar una llegada a un destino sin resolver mecánicamente (2+ salidas posibles)',
        },
        {
          check: () => hasFalsePhantomTravel(parsed, ctx.phantomTravelLocationNames),
          reason: 'narrar que abandona la ubicación actual sin ningún viaje resuelto mecánicamente (destino inventado/sin alias real)',
        },
        {
          check: () => hasFalseInventoryReview(parsed.narration, ctx.possiblyFalseInventoryReviewNames),
          reason: 'narrar una revisión de inventario incompleta como si fuera exhaustiva',
        },
        {
          check: () => hasFalseWeaponThrowClaim(parsed.narration, ctx.equippedWeaponNamesInCombat),
          reason: 'narrar el arma equipada como lanzada/fuera de la mano, sin mecánica real de lanzar armas',
        },
        {
          check: () => hasFalseEquipmentChangeClaim(parsed.narration, ctx.equippableItemNames),
          reason: 'narrar un cambio de equipo (ponerse/quitarse/atarse algo) no pedido y sin reflejo real en InventoryItem.slot',
        },
        {
          check: () => hasFalseItemGivenAway(parsed.narration, ctx.equippableItemNames),
          reason: 'narrar la entrega de un objeto real a un NPC — no existe mecánica de "dar objeto", el InventoryItem nunca se retira',
        },
        {
          check: () => hasFalseHealingClaim(parsed.narration, ctx.restHealCeilingBelowIleso),
          reason: 'prometer una recuperación completa al descansar cuando el techo mecánico real queda por debajo de ILESO',
        },
        {
          check: () => hasFalseNewItemClaim(parsed.narration, parsed.newItem?.name, ctx.worldItemCatalogNames),
          reason: 'narrar que el personaje se queda con/guarda un objeto cuyo nombre no coincide con ningún ItemCatalog real (no se materializará)',
        },
        {
          check: () => hasFalsePassiveHarvestClaim(parsed.narration, parsed.newItem?.name, ctx.harvestOrLootActiveThisTurn),
          reason: 'narrar la obtención de un objeto sin ningún camino mecánico activo este turno ni newItem propuesto',
        },
        {
          check: () => hasFalseCombatTargetName(parsed.narration, ctx.combatRealTargetName, ctx.otherNpcNamesInScene),
          reason: 'narrar el intercambio de combate resuelto sin nombrar al objetivo real, nombrando en su lugar a otro NPC presente en la escena',
        },
        {
          check: () => hasWrongNpcName(parsed.narration, ctx.combatRealTargetName, ctx.possiblyStaleNpcNames),
          reason: 'narrar el combate mencionando a un NPC de un combate anterior de la sesión en vez del NPC real de este combate',
        },
        {
          check: () => hasWrongAggressorName(parsed.combateIniciado?.npcSlugs, ctx.nonHostileNpcSlugsInScene),
          reason: 'proponer "combateIniciado" contra un NPC que no puede ser agresor por catálogo (temperamento no AGRESIVO/ENEMIGO)',
        },
        {
          check: () => hasIllegitimateMagicVocabulary(parsed.narration, ctx.characterClase),
          reason: 'usar vocabulario mágico (arcano/hechizo/conjuro/encantamiento/mágico) narrando a un personaje sin clase con vertiente mágica real (solo MAGO/CHAMAN)',
        },
      ].find((validator) => validator.check());

      if (rejection) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por ${rejection.reason}, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        rejectionReasons.push(rejection.reason);
        continue;
      }
      return parsed;
    } catch (err) {
      // Roadmap de velocidad, 2026-07-20 (streaming): antes este catch tragaba el error en
      // silencio — sin esto, un fallo del intento 1 (el único que transmite en vivo) era
      // indistinguible desde fuera de "narró bien pero sin streaming", justo el tipo de fallo
      // silencioso que este proyecto ya se ha propuesto cazar (ver P0.2/P0.4 del roadmap).
      console.warn(`[narrador] intento ${idx + 1}/3 falló: ${err instanceof Error ? err.message : err}`);
      if (idx === 0) ctx.onNarrationReset?.();
      continue;
    }
  }

  // Las 3 razones de rechazo coinciden EXACTAMENTE (mismo guard, las 3 veces) — el sesgo vive en
  // el propio prompt, no es aleatorio, así que un 4º reintento no arreglaría nada. Se trata igual
  // que un fallo técnico: fallback determinista en vez de la última prosa contaminada.
  if (lastResult && allAttemptsRejectedForSameReason(rejectionReasons, attempts.length)) {
    console.warn(`[narrador] los 3 intentos violaron el mismo guard ("${rejectionReasons[0]}") — usando fallback determinista sin IA para: "${ctx.action}"`);
    return deterministicFallbackNarration(ctx);
  }
  if (lastResult) return lastResult;
  // Fallback determinista (auditoría 2026-07-24, "revisa todo bien bien"): antes, si los 3
  // intentos fallaban de verdad (nunca produjeron ni un JSON parseable — timeout/cuelgue real),
  // esto lanzaba y `narrateAndPersistTurn` abortaba ANTES de su `$transaction` — la tirada ya
  // resuelta, la condición física, el XP, todo se perdía, y el jugador solo veía un error muerto
  // ("no se pudo resolver este turno"). Con los hechos mecánicos ya fijados (`roll`), se puede
  // construir una frase mínima sin IA para que el turno SIEMPRE se resuelva de verdad — sin
  // inventar nada (nunca decide `condicionFisica`/`combateIniciado`: esos ya tienen sus propias
  // redes de seguridad deterministas en turnResolution.ts, independientes de lo que devuelva esto).
  console.warn(`[narrador] los 3 intentos fallaron sin ninguna respuesta parseable — usando fallback determinista sin IA para: "${ctx.action}"`);
  return deterministicFallbackNarration(ctx);
}

export function deterministicFallbackNarration(ctx: {
  action: string;
  roll?: RollResult;
  combatBothMissed?: boolean;
  combatRealHitLanded?: boolean;
}): NarrationResult {
  const { action, roll } = ctx;
  // En un intercambio de combate manda el intercambio, no `roll` (Fase G del 0.1, hallazgo G7):
  // «Gana Gorhorn · el golpe conecta» salía junto a «La acción no sale como se esperaba». Sin saber
  // aquí qué lado conectó, se dice solo lo que es seguro y la tarjeta de la tirada cuenta el resto.
  const resultado = ctx.combatBothMissed
    ? 'Ningún golpe llega a conectar.'
    : ctx.combatRealHitLanded
      ? 'El intercambio se salda con un golpe que conecta.'
      : !roll
        ? 'La acción transcurre sin incidentes.'
        : roll.gradoExito === 'claro'
          ? 'La acción sale exactamente como se esperaba.'
          : 'La acción no sale como se esperaba.';
  return {
    narration: `${action} ${resultado}`,
    newFacts: [],
    newItem: null,
    newCompanion: null,
    hito: null,
    newQuest: null,
    questProgress: null,
    condicionFisica: null,
    combateIniciado: null,
  };
}

// Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"): el modelo
// a veces "pierde el hilo" dentro del propio valor de "narration" y sigue escribiendo como si
// continuara rellenando el resto del JSON — el texto mostrado acababa con un trozo crudo tipo
// `newItem": "Maza orca astillada", "condicionFisica": null, "combateIniciado": [...` pegado al
// final de la prosa. `JSON.parse` sigue siendo válido (es solo texto dentro de la cadena), así
// que no lo detecta ningún error de parseo — se corta aquí, buscando el patrón de una clave JSON
// real de este mismo schema apareciendo tras una coma, y quedándose con el texto de antes.
// Bug real encontrado auditando la partida de Gorhorn (2026-07-24, "revisa todo bien bien"): el
// modelo (qwen2.5, base china) a veces "cambia de idioma" a mitad de la narración sin que ninguna
// instrucción se lo pida — un turno real narró en chino durante media frase, describiendo además
// un NPC que no venía a cuento. Mismo criterio que `stripLeakedJson` justo abajo: cortar en el
// primer carácter de un alfabeto que el español nunca usa es mucho más barato que gastar un
// reintento entero (30-220s) por esto. Cubre CJK (chino/japonés), hangul (coreano), cirílico y
// árabe — los alfabetos no latinos con más probabilidad real de "fuga" en un modelo entrenado
// mayoritariamente en chino/inglés.
export const NON_LATIN_SCRIPT_REGEX =
  /[　-〿぀-ヿ一-鿿가-힣Ѐ-ӿ؀-ۿ]/;

export function stripNonLatinScript(narration: string): string {
  const match = narration.match(NON_LATIN_SCRIPT_REGEX);
  if (!match || match.index === undefined) return narration;
  return narration.slice(0, match.index).trimEnd();
}

const JSON_LEAK_REGEX =
  /(?:newItem|newCompanion|condicionFisica|combateIniciado|hito|questProgress|newFacts|newQuest|newTerritory|newBuilding|newSubject)"\s*:/;

export function stripLeakedJson(narration: string): string {
  const match = narration.match(JSON_LEAK_REGEX);
  if (!match || match.index === undefined) return narration;
  // Corta desde el nombre de la clave — no se puede saber de antemano si el modelo dejó una
  // comilla/coma suelta justo antes (el formato exacto de la fuga varía), así que se limpia
  // cualquier resto de puntuación de cierre de JSON que quede pegado al final tras el corte.
  return narration
    .slice(0, match.index)
    .replace(/["',]+\s*$/, '')
    .trimEnd();
}

/// Contrato de mundo (docs/rpgtarkor/lore-mundo/07-mundo-helek-sirik.md § 9): medieval-fantástico, sin pólvora ni
/// tecnología industrial en ningún continente. Ya reforzado en el Modelfile — esto es la red de
/// seguridad determinista para cuando el modelo lo ignora de todos modos (visto en pruebas reales).
/// "nave espacial"/coche/avión/robot añadidos (2026-08-13, validador de grounding del jugador,
/// docs/mecanicas/18-validacion-accion-jugador.md — ejemplo real de la sesión de diseño: "me monto en mi
/// nave espacial y me voy volando") — mismo regex reutilizado por `detectsPlayerAnachronism`
/// (playerActionValidation.ts), así que ampliarlo aquí también refuerza la salida del Narrador.
export const ANACHRONISM_REGEX =
  /p[óo]lvora|pistola|rifle|escopeta|pl[áa]stico|electricidad|el[ée]ctric[oa]|motor(?:\s+de)?\s+(?:combusti[óo]n|explosi[óo]n)|hormig[óo]n|acero industrial|tel[ée]fono|internet|nave espacial|robot|autom[óo]vil|\bcoche\b|\bavi[óo]n\b/i;

export function hasAnachronism(narration: string): boolean {
  return ANACHRONISM_REGEX.test(narration);
}

/// Amenaza inventada de "otros orcos del Clan Maktor" (ronda de correcciones 2026-08-28, P5.3 —
/// bug real jugando en vivo: *"antes de que lleguen más goirsentres o orcos del Clan Maktor"*).
/// `protectedFactsFor` YA instruye explícitamente que el Clan Maktor fue aniquilado y Gorhorn es
/// el único superviviente conocido — el modelo lo ignoró de todos modos, mismo patrón que el resto
/// de esta familia de guards (`hasFalseGisteraNamedReturn`, `hasFalseKarotVekuAsRiver`...): no
/// basta con la instrucción, hace falta comprobar el texto generado. Detecta "Clan Maktor" en la
/// misma frase que vocabulario de amenaza/pluralidad real (más orcos del clan, no solo Gorhorn) —
/// deliberadamente NO dispara con menciones neutras del clan (origen, honor, historia), solo con
/// la contradicción concreta de "quedan más".
const MAKTOR_THREAT_REGEX = /\bclan\s+maktor\b/i;
const MAKTOR_THREAT_CONTEXT_REGEX =
  /\b(m[áa]s|otros?|dem[áa]s|resto|superviviente|quedan?|llegan?|amenaza|ataque|ej[ée]rcito|guerreros?)\b/i;

export function hasFalseMaktorThreatClaim(narration: string): boolean {
  return narration
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => MAKTOR_THREAT_REGEX.test(sentence) && MAKTOR_THREAT_CONTEXT_REGEX.test(sentence));
}

/// Fuga de inglés, red de seguridad determinista (2026-07-31, bug real probando en vivo: "el eco
/// de su own pisadas" — una palabra en inglés suelta en medio de una frase en español). Mismo
/// criterio que `hasAnachronism`/`stripNonLatinScript`: el Modelfile ya pide español, esto es la
/// red de seguridad para cuando el modelo lo ignora de todos modos. Lista deliberadamente corta y
/// conservadora — solo palabras función inglesas sin NINGÚN homónimo español real, para no
/// disparar con nombres propios o préstamos legítimos.
///
/// Ampliada (ronda de correcciones 2026-08-28, P5.1) — recurrencia confirmada 3 veces jugando en
/// vivo con la lista original SIN cubrir ninguno de los casos reales: "small clearing" (2026-08-13),
/// "several pasos" (2026-08-23), "lullaby" (2026-08-28). Añadidas esas palabras concretas más otras
/// del mismo campo semántico (tamaño/cantidad/sustantivos comunes en descripciones de escena) que
/// comparten el mismo riesgo de colarse sueltas en medio de una frase en español.
///
/// "accompanies" añadido (sesión de pruebas 2026-08-28, partida nueva de Novato): "El viento
/// siseante lo accompanies en su búsqueda" — variante nueva del mismo hueco, pero con un VERBO
/// conjugado en inglés sustituyendo al verbo español ("acompaña") en mitad de la frase, no un
/// sustantivo/adjetivo suelto como los casos anteriores.
///
/// "who" añadido (ronda de pruebas de verificación en vivo, 2026-09-05): "el Orco Enfurecido, who
/// gruñe furiosamente" — pronombre relativo inglés sustituyendo a "que" en mitad de una frase por
/// lo demás en español, mismo patrón exacto que el resto de la lista.
const ENGLISH_LEAK_REGEX =
  /\b(own|the|and|was|with|from|small|clearing|several|lullaby|nearby|forest|shadow|whisper|silence|darkness|distant|accompanies|who)\b/i;

/// Reaparecido más grave (checklist 2026-09-01, sesión de combate en vivo tras varios reinicios de
/// Ollama/backend): no palabras sueltas, sino CLÁUSULAS ENTERAS en inglés dentro de una frase por
/// lo demás en español — "Canizor's blade slices through the air with a resonant crack, catching
/// Gorhorn off balance and leaving a fresh gash across his shoulder." La lista de arriba (una
/// palabra por bug real encontrado) no escala a este caso: cada cláusula nueva trae vocabulario
/// distinto ("blade"/"slices"/"crack"/"catching"/"gash"...), imposible de enumerar a mano de
/// antemano. En vez de listar sustantivos/verbos (riesgo real de falsos positivos con préstamos o
/// nombres), se detecta la DENSIDAD de palabras función inglesas inequívocas (sin ningún homónimo
/// ni preposición española real — a diferencia de la lista de arriba, aquí se excluyen a propósito
/// "a"/"en"/"on" por chocar con "a"/preposición española) dentro de una ventana corta de texto: 3+
/// aparecen juntas en 12 palabras seguidas prácticamente nunca ocurre por azar en una frase en
/// español, pero sí es la firma de una cláusula inglesa completa colada en medio.
const ENGLISH_FUNCTION_WORDS = ['the', 'with', 'and', 'his', 'her', 'of', 'to', 'off', 'across', 'through', 'into', 'onto', 'catching', 'leaving'];
const ENGLISH_FUNCTION_WORD_REGEX = new RegExp(`\\b(${ENGLISH_FUNCTION_WORDS.join('|')})\\b`, 'gi');
const ENGLISH_CLAUSE_WINDOW = 12;
const ENGLISH_CLAUSE_THRESHOLD = 3;

function hasEnglishClauseDensity(narration: string): boolean {
  const words = narration.split(/\s+/);
  const hitIndices: number[] = [];
  words.forEach((word, i) => {
    ENGLISH_FUNCTION_WORD_REGEX.lastIndex = 0;
    if (ENGLISH_FUNCTION_WORD_REGEX.test(word)) hitIndices.push(i);
  });
  for (let i = 0; i + ENGLISH_CLAUSE_THRESHOLD - 1 < hitIndices.length; i++) {
    if (hitIndices[i + ENGLISH_CLAUSE_THRESHOLD - 1] - hitIndices[i] < ENGLISH_CLAUSE_WINDOW) return true;
  }
  return false;
}

/// Genitivo sajón inglés (bug real, sesión autónoma de pruebas con Playwright, 2026-09-04):
/// "dejando una mancha roja en Gorhorn's pecho" — un solo apóstrofe+s pegado a un nombre no dispara
/// ni la lista de palabras sueltas ni la densidad de cláusula (`hasEnglishClauseDensity` exige 3+
/// palabras función en una ventana de 12; aquí es una fuga puntual, no una cláusula completa). El
/// posesivo con apóstrofe no existe en español — cualquier `\w+'s` seguido de espacio es, en la
/// práctica, siempre una fuga real, nunca un uso legítimo.
const ENGLISH_POSSESSIVE_REGEX = /\w+'s\b/;

export function hasEnglishLeak(narration: string): boolean {
  return ENGLISH_LEAK_REGEX.test(narration) || hasEnglishClauseDensity(narration) || ENGLISH_POSSESSIVE_REGEX.test(narration);
}

/// Red de seguridad determinista para la instrucción de persona gramatical fija de
/// `fixedInstructions` ("NARRA SIEMPRE EN TERCERA PERSONA... nunca 'tú'/'tu'/'te'... Solo el
/// diálogo citado entre comillas... puede usar la segunda persona") — mismo criterio que
/// `hasEnglishLeak`/`hasAnachronism`: la instrucción de prompt ya existe desde 2026-08-27 (mismo
/// caso real citado ahí como ejemplo), pero nada comprobaba el texto YA generado. Bug real
/// documentado 2 veces jugando en vivo (2026-08-27, "revisar partida" — el susurro de la Entidad
/// SÍ narra en 2ª persona legítimamente, dentro de sus propias comillas; el fallo real era la
/// PROSA de fuera saltando a 2ª persona a mitad de párrafo sin ninguna comilla que lo justifique:
/// "El orco... lanzándola hacia Gorhorn... Tu hacha... tu pecho").
///
/// Comillas dobles rectas (mismo patrón que `lastLogHasDirectSpeech`, único formato real que usa
/// el diálogo citado en este motor) — se retira TODO lo que caiga entre un par de comillas antes
/// de buscar la 2ª persona, así que un NPC diciéndole "tu momento" al jugador nunca dispara esto.
const QUOTED_SPEECH_REGEX = /"[^"]*"/g;
const SECOND_PERSON_REGEX = /\b(tú|tu|tus|te|contigo)\b/i;

export function hasSecondPersonLeak(narration: string): boolean {
  const withoutQuotedSpeech = narration.replace(QUOTED_SPEECH_REGEX, ' ');
  return SECOND_PERSON_REGEX.test(withoutQuotedSpeech);
}

/// Red de seguridad para `generateNpcReply` (bug real jugando en vivo, 2026-09-03: preguntarle a
/// Gistera Koh cómo estaba devolvió como su réplica "¿Qué quieres saber sobre Gistera Koh? Ella es
/// quien me pidió ayuda." — un registro de asistente/chatbot genérico, no la voz en primera persona
/// del personaje que pide el `system` de esa llamada). Mismo criterio que `hasEnglishLeak`/
/// `hasSecondPersonLeak`: `generateNpcReply` es una llamada Ollama SEPARADA de `narrateAction`
/// (comentario de cabecera de `generateNpcReply`), así que no hereda ninguno de los guards del
/// bucle de reintento principal — necesita los suyos propios. Lista curada de patrones de registro
/// de asistente/meta-pregunta (no un regex genérico sin acotar — un NPC real puede legítimamente
/// hacer una pregunta retórica, solo se descarta el patrón concreto ya visto de "pregunta qué
/// quiere saber el jugador sobre sí mismo/otro NPC", que ningún personaje diría de verdad).
const META_INSTRUCTION_LEAK_REGEX = /¿(qué|en qué) (quieres?|puedo|te gustaría) (saber|ayudar|hacer)/i;

export function hasMetaInstructionLeak(reply: string): boolean {
  return META_INSTRUCTION_LEAK_REGEX.test(reply);
}

/// Segunda red de seguridad para `generateNpcReply` (bug real jugando en vivo, 2026-09-03: Gistera
/// Koh, tras dar una pista real sobre el Clan Serhu con naturalidad en la misma réplica, terminaba
/// negando conocerlo — "'...sabes dónde están escondidos los restos de Maktor.' '¿Clan Serhu? No lo
/// sé, no he oído hablar de ellos.'" — autocontradicción dentro de la misma respuesta). Distinto de
/// `hasMetaInstructionLeak` (patrón de contenido concreto): aquí el problema es de FORMA — el
/// prompt pide UNA réplica de 1-2 frases entre comillas, y el modelo a veces concatena dos
/// "intentos" de respuesta como si fueran turnos de diálogo separados, cada uno en su propio bloque
/// de comillas. 2+ bloques de comillas (simples O dobles, el modelo no es consistente en cuál usa)
/// que arrancan con mayúscula cada uno es la señal — una réplica real de 1-2 frases nunca necesita
/// abrir y cerrar comillas más de una vez seguida (una cita DENTRO de la réplica sería un caso
/// legítimo, pero no se ha visto ninguno real hasta ahora — más seguro descartar de más que dejar
/// pasar la autocontradicción).
const DOUBLE_QUOTE_BLOCK_REGEX = /['"“][A-ZÁÉÍÓÚÑ][^'"”]*['"”]/g;

export function hasDoubleReplyLeak(reply: string): boolean {
  const blocks = reply.match(DOUBLE_QUOTE_BLOCK_REGEX);
  return !!blocks && blocks.length >= 2;
}

/// Anti-repetición, red de seguridad determinista (2026-07-31, bug real probando en vivo: dos
/// turnos de combate seguidos narraron "Gorhorn descarga una poderosa hachata hacia atrás contra
/// el orco" casi palabra por palabra, pese a que `worldFacts` ya lleva la instrucción explícita de
/// no repetir — ver `lastNarrationText`/`TurnContext`). En combate, con muchas instrucciones a la
/// vez compitiendo por un hueco de 1-2 frases, "no repitas" es la primera que se cae. Mismo
/// criterio que `hasAnachronism`: no confiar en que la instrucción baste, comprobar el texto YA
/// generado y reintentar si hace falta, en vez de sumar todavía más prosa de reglas. Umbral sin
/// calibrar con datos (mismo criterio que `RELEVANCE_THRESHOLD` en retrieval.ts) — ajustar si dado
/// caso deja pasar repeticiones reales o dispara con turnos que solo comparten vocabulario normal
/// de combate (los nombres de personaje/NPC, "ataca", "golpea"...).
const REPEAT_SIMILARITY_THRESHOLD = 0.7;

export function isTooSimilarToLast(narration: string, lastNarrationText?: string): boolean {
  if (!lastNarrationText) return false;
  return similarity(narration, lastNarrationText) >= REPEAT_SIMILARITY_THRESHOLD;
}

/// `factSimilarity` (worldFacts.ts), NO `similarity()` plana (bug real, 2026-08-20: "al darle a
/// sugerir no me está dando ninguna sugerencia" — mismo motivo exacto que el cambio en
/// `dropSuggestionsCopyingExample`, ver su comentario: frases tan cortas como una sugerencia
/// comparten palabras de función de sobra para cruzar cualquier umbral con `similarity()` plana
/// sin ser la misma idea de verdad). Petición explícita previa, 2026-08-15: "las sugerencias no
/// están siendo muy buenas" — ya se había bajado el umbral una vez para paliar el mismo síntoma
/// sin cambiar de métrica; con Jaccard+stopwords el umbral vuelve a 0.5 (el propio caso de
/// ejemplo de abajo, "Sigo explorando la zona"/"Continúo explorando la zona", da exactamente 0.5
/// con la nueva métrica — verificado en el test).
const SUGGESTION_SIMILARITY_THRESHOLD = 0.5;

/// Sanea "suggestions" tras el parseo (mismo criterio que `isTooSimilarToLast`: no confiar solo en
/// la instrucción del prompt, comprobar el texto ya generado) — quita vacíos/espacios de sobra y
/// descarta cualquier sugerencia demasiado parecida a otra ya aceptada, quedándose con la primera
/// de cada grupo de duplicados. Nunca rellena de vuelta hasta 3: mejor devolver 1-2 sugerencias
/// buenas y distintas que 3 con dos casi idénticas.
export function sanitizeSuggestions(suggestions: string[] | undefined): string[] {
  const kept: string[] = [];
  for (const raw of suggestions ?? []) {
    const s = raw.trim();
    if (!s) continue;
    if (kept.some((k) => factSimilarity(s, k) >= SUGGESTION_SIMILARITY_THRESHOLD)) continue;
    kept.push(s);
  }
  return kept;
}

/// Narración-vs-mecánica, red de seguridad determinista (2026-07-31, bug real jugando en vivo:
/// "la maza pesada golpea el cuello del orco, dejando un rastro de sangre" narrado en un turno
/// donde `resolveExchange` (combatExchange.ts) resolvió 'ataque_falla' — la condición del NPC no
/// cambió, confirmado por DB, pero el jugador leyó un golpe limpio). `exchangeContextBlock` ya le
/// dice al modelo "YA RESUELTO, no lo cambies: narra cómo falla o es esquivado" para
/// 'ataque_falla'/'parada_en_seco' (los dos únicos resultados donde NADIE conecta un golpe), pero
/// un modelo pequeño bajo presión de combate a veces la ignora igual que ignoraba "no repitas"
/// (ver `isTooSimilarToLast`) — mismo criterio: no confiar en la instrucción sola, comprobar el
/// texto ya generado. Lista de palabras deliberadamente centrada en CONTACTO+DAÑO inequívoco
/// (nunca solo "ataca"/"golpea con" de intención, que también aparecen narrando un fallo: "golpea
/// el aire", "intenta golpear") — el riesgo real es solo un reintento de más, no un falso negativo
/// que deje pasar la alucinación. "clava en" se probó y se quitó a propósito: un fallo real
/// también puede describir el arma clavándose en la roca/el suelo tras errar, no solo en carne.
// "línea de sangre" añadido (auditoría 2026-08-02, "revisar partida" — bug real jugando en vivo):
// "pero este esquiva fácilmente, dejando una línea de sangre fría donde la hoja rozó su
// armadura" — dice fallo (esquiva) e impacto (sangre) en la MISMA frase; el hueco era de
// vocabulario (la lista no cubría esta variante concreta de "hay sangre"), no de lógica.
// Gerundios añadidos (bug real jugando en vivo, revisión de partida 2026-08-08): "atravesando el
// cuello del ave" en un turno de "Salgo a cazar y ataco a 'Zense Ceniza'" (combate recién abierto,
// sin ningún intercambio mecánico todavía) se coló porque la lista solo cubría las formas en
// pasado/presente de cada verbo (`atraves[oó]`/`atraviesa`), nunca el gerundio — el mismo hueco
// existe en potencia para cualquier otro verbo de la lista ("golpeando", "hiriendo", "rebanando").
// "golpea" (presente) añadido (dos bugs reales seguidos jugando en vivo, 2026-08-15): "la maza
// golpea fuertemente el costado del Zense Ceniza, dejando una herida visible" en un turno resuelto
// 'ataque_falla' — el comentario original excluía "golpea" a propósito por "golpea el aire"/
// "intenta golpear" (fallo genuino), pero eso dejaba pasar TAMBIÉN "golpea [al objetivo real]"
// (acierto falso) — se reintroduce con una excepción explícita solo para "golpea el aire", el caso
// concreto que motivó la exclusión, en vez de excluir la palabra entera.
// "herida"/"se desploma" añadidos (mismos dos bugs, 2026-08-15): "dejando una herida visible" y,
// en un segundo turno idéntico en su fondo, "el ave grita y se desploma al suelo" tras "clava su
// maza en el cuello" — ninguno de los dos disparaba nada, mismo hueco de vocabulario que las rondas
// anteriores (rastro de sangre, atravesando...), no de lógica.
// "muerte instantánea"/"corta la garganta"/"corta el cuello"/"derramando sangre" añadidos (bug real
// jugando en vivo, auditoría 2026-08-22 "revisa la partida otra vez"): un "Remato a 'Buitre
// Cenizo'..." resolvió 'parada_en_seco' (el buitre atacó y falló, Gorhorn lo bloqueó — nadie
// conectó ningún golpe, mucho menos uno mortal), pero el modelo narró "Gorhorn propina un potente
// zarpazo que corta la garganta del Zense Ceniza, derramando una gran cantidad de sangre y
// causándole la muerte instantánea" — un golpe de muerte completo, inventado de la nada. Mismo
// hueco de vocabulario que las rondas anteriores: la lista no cubría ninguna de estas frases de
// remate/muerte, aunque la lógica (combatBothMissed) ya era correcta.
// Vocabulario ampliado (auditoría de código 2026-08-25, sin reproducir en vivo todavía): el patrón
// `\bgolpe[oó]\b` solo cazaba el VERBO "golpeo"/"golpeó", nunca el sustantivo suelto "golpe" — el
// uso más común en español para narrar un impacto ya resuelto es "asesta/propina un golpe [certero/
// limpio]", no el verbo. Se añade en forma de frase (verbo+golpe o golpe+adjetivo), nunca "golpe" a
// secas, porque "esquiva/bloquea/detiene el golpe" (un golpe INTENTADO, no aterrizado) es fraseo de
// FALLO legítimo y disparar ahí sería un falso positivo nuevo. Mismo criterio para
// zarpazo/tajo/estocada/mandoble: solo cuentan con verbo de impacto o adjetivo de acierto delante/
// detrás, nunca sueltos (un "mandoble que falla" sigue siendo un fallo real). "clava"/"ensarta"/
// "empala" sí se añaden sueltos — a diferencia de "golpe", esos verbos ya implican contacto por
// definición en español (no existe un "empala" fallido).
// "línea roja" añadido (bug real jugando en vivo, prueba con Playwright, 2026-08-27, ver
// `hasFalseCombatAttacker`): "una línea roja que corre desde el omóplato hasta el costado" no
// disparaba nada — "línea de sangre" ya cubría la variante explícita, pero "roja" a secas (sin la
// palabra "sangre") es igual de común en la prosa real y describe el mismo corte. Solo "línea roja"
// como frase fija (no "línea"/"roja" sueltos, que tendrían demasiados falsos positivos legítimos
// fuera de combate).
// "clava" ampliado (bug real jugando en vivo, ronda de pruebas 2026-08-28): "la clava con fuerza
// en el cuello del Kirelon Arenoso, haciendo que éste retroceda" con la tirada real en Fallo para
// Gorhorn (combatBothMissed) — "clava con fuerza en" no matchea `clava\s+(su|el|un|la)` porque
// "con" se cuela entre el verbo y el artículo del complemento de lugar. Añadido `con\s+\w+\s+en`
// como alternativa que cubre ese fraseo sin perder la ya existente.
//
// "derriba" añadido (mismo día, mismo combate, segundo turno): "apunto a Kirelon Arenoso y derriba
// su brazo de cuchillo" con `resultado: 'parada_en_seco'` (fallo total del jugador) — "derriba" sin
// más describe un golpe conectado, vocabulario nuevo sin cubrir hasta ahora.
const COMBAT_HIT_LEAK_REGEX =
  /\b(golpe[oó]|golpea(?!\s+el\s+aire)|golpeando|impact[oó]|impactando|hiri[oó]|hiere|hiriendo|herida|atraves[oó]|atraviesa|atravesando|reban[oó]|rebanando|degüell[oa]|hace sangrar|rastro de sangre|l[ií]nea de sangre|l[ií]nea roja|sangrando|sangra por|se desploma|desplom[oó]|desplomándose|muerte instantánea|corta la garganta|corta el cuello|derram\w* (una gran cantidad de )?sangre|derrib[oa]|derribando|asesta\s+\w*\s*(golpe|zarpazo|tajo|estocada|mandoble)|propina\s+\w*\s*(golpe|zarpazo|tajo|estocada|mandoble)|golpe\s+(certero|limpio|directo|contundente|mortal)|zarpazo\s+(certero|limpio|directo)|tajo\s+(certero|limpio|profundo)|estocada\s+(certera|limpia|directa)|ensarta|empala|clava\s+(su|el|un|la)|clava\s+con\s+\w+\s+en)\b/i;

export function hasFalseCombatHit(narration: string, combatBothMissed?: boolean): boolean {
  if (!combatBothMissed) return false;
  return COMBAT_HIT_LEAK_REGEX.test(narration);
}

/// Mismo vocabulario que `COMBAT_HIT_LEAK_REGEX`, sin condicionar a ningún contexto de combate ya
/// resuelto — para contextos donde combate ni siquiera debería estar abierto todavía (modo
/// dinámico, `dynamicModeNarracion.ts`: "nunca sustituye un combate" es solo una instrucción de
/// prompt, sin guard determinista — candidato real de bug anotado en checklist-pruebas-juego.md,
/// mismo patrón frágil ya visto varias veces en este proyecto con un modelo pequeño que ignora
/// instrucciones de "no hagas X"). Usarlo para forzar el cierre determinista de la interacción en
/// vez de fiarse de que el LLM ponga `cierra: true` por sí solo.
export function hasCombatVocabulary(narration: string): boolean {
  return COMBAT_HIT_LEAK_REGEX.test(narration);
}

/// Inverso de `COMBAT_HIT_LEAK_REGEX`/`hasFalseCombatHit` (ver `combatRealHitLanded` en
/// `TurnContext`) — vocabulario de esquiva/bloqueo LIMPIO, sin contacto alguno. Deliberadamente
/// más corto y específico que una lista de "cualquier palabra de fallo" a propósito: en
/// `golpes_mutuos`/`defensor_contragolpea` la narración legítimamente describe que UN lado falla
/// su golpe mientras el otro sí conecta ("el orco falla su zarpazo, pero el hacha de Gorhorn sí
/// encuentra su hombro") — un detector centrado en "falla"/"no consigue" a secas dispararía ahí
/// sin necesidad. Esto solo caza esquiva/bloqueo CLARO y sin matices ("por un pelo", "en seco",
/// "por completo"), la misma clase de frase que el bug real de referencia usó.
// "por poco" a secas se probó y se quitó a propósito: "falla su zarpazo por poco margen" (un
// fallo genuino de UN lado en golpes_mutuos/defensor_contragolpea, mientras el otro sí conecta)
// también lo contiene — "por un pelo" es igual de idiomático para una esquiva limpia y no choca.
// "bloquea el/su/un/tu ataque|golpe|zarpazo|tajo|estocada|mandoble" añadido (bug real jugando en
// vivo, prueba con Playwright, 2026-08-27): "Tu Hacha de guerra rota bloquea el ataque, pero una
// mancha roja se abre en su pecho" con la tirada real en 'Éxito con éxito' para el atacante (el
// golpe SÍ conectó) — "bloquea por completo" no cubría "bloquea el ataque" a secas, el fraseo más
// común para un bloqueo narrado. Con objeto explícito (ataque/golpe/zarpazo/tajo/estocada/mandoble)
// a propósito, igual que el criterio ya usado para "asesta/propina" en COMBAT_HIT_LEAK_REGEX — deja
// pasar "intenta bloquear" (fallo genuino de defensa) sin disparar.
// "se desvía"/"se aparta" (sin "a tiempo") añadidos (2º bug real jugando en vivo el mismo día,
// prueba con Playwright, 2026-08-27, tras aplicar el fix de arriba): "Gorhorn se desvía con
// agilidad, notando una mancha roja en su pecho. El golpe falla al último momento" — con la tirada
// real en Éxito para Gorhorn (esquiva de verdad) y Fallo para el orco (no conecta). Mismo hueco de
// vocabulario, verbo distinto — "se aparta a tiempo" ya existía pero exigía "a tiempo" detrás,
// dejando pasar "se aparta"/"se desvía" sueltos, que son igual de comunes en la prosa real.
//
// "no logra conectar (con)" (bug real, sesión autónoma de pruebas con Playwright, 2026-09-04):
// turno de remate real contra un Orco CONVALECIENTE, roll de Éxito con coste (19 vs 11, el golpe SÍ
// conecta según el resumen mecánico), pero la narración dijo "Gorhorn lanza la Hacha de guerra rota
// con todas sus fuerzas, pero NO LOGRA CONECTAR con su objetivo" — negación directa de impacto que
// ninguna de las frases de arriba cubría (no es "esquiva"/"se aparta", es la negación explícita del
// verbo "conectar" que el propio resumen mecánico usa para narrar el ÉXITO — "el golpe conecta").
const COMBAT_MISS_LEAK_REGEX =
  /\b(esquiv[oa]|esquivando|esquiv[aá]ndol[oa]|elude|eludiendo|evade|evita el golpe|sortea|sorteando|por un pelo|ni siquiera (roza|toca)|sin (rozarlo|rozarla|tocarlo|tocarla)|detiene el golpe en seco|para en seco|se aparta|se desv[ií]a|bloquea por completo|bloquea\s+(el|su|un|tu)\s+(ataque|golpe|zarpazo|tajo|estocada|mandoble)|no logra conectar|no consigue conectar|no llega a conectar)\b/i;

export function hasFalseCombatMiss(narration: string, combatRealHitLanded?: boolean, nonExchangeAttackHitLanded?: boolean): boolean {
  if (!combatRealHitLanded && !nonExchangeAttackHitLanded) return false;
  return COMBAT_MISS_LEAK_REGEX.test(narration);
}

/// Narración-vs-mecánica, caso NUEVO (bug real jugando en vivo, prueba con Playwright, 2026-08-27,
/// reproducido 2 de 4 turnos de la misma partida real): `jugadorRecibeGolpeEsteTurno` ya existe
/// (true cuando el NPC fue quien acertó el golpe de ESTE intercambio, jugador incluido contragolpe
/// recibido) pero ningún guard comprobaba a quién le atribuye la prosa el golpe GANADOR. Captura
/// real: mecánica "Gana Orco enfurecido... el golpe conecta" (Gorhorn cae a Convaleciente), pero la
/// narración dijo "Gorhorn ataca de lleno al Orco enfurecido con su Hacha de guerra rota" — sujeto y
/// objeto invertidos del todo, no solo vocabulario de contacto suelto (`hasFalseCombatHit`/
/// `hasFalseCombatMiss` no lo cazan: SÍ hubo un golpe real este turno, así que `combatBothMissed`/
/// `combatRealHitLanded` no disparan nada, el hueco es de A QUIÉN). Mismo vocabulario ya validado de
/// `COMBAT_HIT_LEAK_REGEX` (golpe/hiere/atraviesa/asesta un golpe...), pero a diferencia del resto
/// de la familia `sentenceMatchesRegexAndName` ("misma frase"), aquí la ventana es de 2 frases
/// SEGUIDAS: el texto real capturado del bug partía sujeto y consecuencia así — "Gorhorn lanza su
/// Cuchillo... [frase 1, sin verbo de impacto confirmado, solo intención]. El cuchillo atrapa la
/// piel..., dejando una línea roja [frase 2, el impacto de verdad, sin nombrar a Gorhorn]" — con
/// solo "misma frase" ninguna de las dos frases dispara. Riesgo aceptado: si la frase 2 describe a
/// otro sujeto distinto de Gorhorn (p. ej. un tercer NPC entrando en la escena), podría disparar de
/// más — no observado en la práctica todavía, mismo criterio que otros guards de esta familia
/// (mejor un reintento de más que dejar pasar la inversión de roles real).
export function hasFalseCombatAttacker(narration: string, characterName?: string, jugadorRecibeGolpeEsteTurno?: boolean): boolean {
  if (!characterName || !jugadorRecibeGolpeEsteTurno) return false;
  const normalizedName = normalizeText(characterName);
  const sentences = narration.split(SENTENCE_SPLIT_REGEX).map(normalizeText);
  return sentences.some((sentence, i) => {
    if (!sentence.includes(normalizedName)) return false;
    const window = [sentence, sentences[i + 1] ?? ''].join(' ');
    return COMBAT_HIT_LEAK_REGEX.test(window);
  });
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseCombatHit` (2026-08-02, bug real jugando en
/// vivo, confirmado en DOS partidas seguidas — 2026-07-31 y 2026-08-01): el turno de aceptar ayudar
/// a Gistera Koh ("Yo me ocupo de tu perseguidor") no resuelve ningún intercambio de combate de
/// verdad (aceptar ayudar nunca fuerza combate mecánico solo, decisión explícita de la usuaria), pero
/// la narración describía un choque ya ganado ("lanza el cuchillo, acierta, el orco huye cojeando")
/// — el NPC seguía ILESO de verdad en la base de datos, y dos turnos después el jugador volvía a
/// atacar al mismo enemigo como si nunca hubiera huido. El contextBlock "Ningún intercambio de
/// combate mecánico..." (turnResolution.ts) ya avisa de esto, pero un modelo pequeño lo ignora igual
/// que el resto de instrucciones "no hagas X" de esta sesión — mismo criterio: comprobar el texto ya
/// generado, no confiar solo en la instrucción. Vocabulario centrado en contacto/daño YA RESUELTO
/// (mismos verbos que `COMBAT_HIT_LEAK_REGEX`) más las variantes propias de este caso concreto
/// ("acierta", "huye cojeando/malherido") — el riesgo real es un reintento de más, no dejar pasar la
/// alucinación.
// Ampliado (bug real jugando en vivo, 2026-08-08, habilidad "Cazar" nueva ese mismo día): "Salgo a
// cazar y ataco a 'Corretolvas'" abrió combate real (Corretolvas ILESO en la base de datos, el
// jugador todavía sin dar un solo golpe), pero la narración describió una caza ya cerrada —
// "lanzando una astuta trampa que atrapa al Corretolva... con el Corretolva ya inmovilizado,
// decide registrar su cuerpo". El vocabulario de captura/inmovilización es una variante nueva del
// mismo hueco (narrar un desenlace que el propio turno todavía no ha decidido): ni golpe ni huida,
// pero igual de "ya resuelto sin intercambio mecánico" — mismo criterio que el resto de esta lista.
// Mismo hueco de gerundios que COMBAT_HIT_LEAK_REGEX (bug real jugando en vivo, revisión de
// partida 2026-08-08) — "atravesando" en un turno de caza sin combate mecánico todavía.
// Variante nueva (bug real jugando en vivo, 2026-08-22, "Salgo a cazar y ataco a 'Buitre
// Cenizo'." — primer turno, sin intercambio mecánico todavía): la narración evitó todo el
// vocabulario de arriba (nunca dice "golpea"/"hiere"/"acierta") pero describió el mismo desenlace
// ya decidido de otra forma — "...ataca la pierna del Zense Ceniza, haciendo que el carroñero
// chillé gigantesco y se lance hacia atrás en un intento de escapar": un ataque dirigido a una
// parte del cuerpo concreta ("ataca la/el/los/las X", a diferencia de "ataca A [NPC]", que solo
// declara intención de enfrentarse) seguido de la REACCIÓN de dolor/susto del objetivo (chillido,
// retroceso, intento de huida) es la misma alucinación con palabras distintas — el objetivo no
// puede "reaccionar" a un golpe que el sistema todavía no ha decidido si conecta.
const PREMATURE_COMBAT_REGEX =
  /\b(golpe[oó]|golpeando|impact[oó]|impactando|hiri[oó]|hiere|hiriendo|atraves[oó]|atraviesa|atravesando|reban[oó]|rebanando|degüell[oa]|acierta|huye (cojeando|malherid[oa]|herid[oa])|cojeando|atrap[oa]|atrapad[oa]|inmoviliz[oa]|inmovilizad[oa]|captur[oa]|capturad[oa]|ataca (la|el|los|las) \w+|chill\w*|intent[ao] de escapar|se (lanz|abalanz|retroced|retir|salt|tambale)\w*( \w+)? hacia atrás)\b/i;

export function hasPrematureCombatResolution(narration: string, combatNotYetResolved?: boolean): boolean {
  if (!combatNotYetResolved) return false;
  return PREMATURE_COMBAT_REGEX.test(narration);
}

/// Narración-vs-mecánica (bug real jugando en vivo, 2026-08-22, "he matado a un buitre pero
/// desollar no detecta el cadáver" — revisando el log completo de la partida se encontró OTRO
/// problema aparte: el turno justo antes del remate real, con el Zense Ceniza todavía
/// CONVALECIENTE de verdad, la narración dijo "cae hacia atrás, cayendo inerte sobre el polvo" —
/// el propio `combatBlock` (más arriba, `npcFallsUnconsciousThisTurn`) ya prohíbe explícitamente
/// "inconsciente/desmayado/sin sentido" para CONVALECIENTE ("un rival inconsciente de verdad no
/// podría seguir combatiendo si el jugador no lo remata ya mismo"), pero no tenía ningún guard
/// post-generación que lo pillara si un modelo pequeño la ignoraba bajo presión narrativa — mismo
/// hueco que ya se cerró para `hasFalseCombatHit`/`hasPrematureCombatResolution`. Deliberadamente
/// SOLO se dispara para CONVALECIENTE (`npcFallsConvalecienteThisTurn`), nunca para MUERTO — ahí
/// "inerte"/"sin vida" es la descripción correcta.
// Vocabulario ampliado (auditoría de código 2026-08-25, sin reproducir en vivo todavía): frases
// equivalentes sin ninguna de las palabras clave originales — "no se mueve"/"no reacciona"/
// "inmóvil"/"no vuelve a moverse" describen la misma inconsciencia falsa con otras palabras.
const UNCONSCIOUS_LEAK_REGEX =
  /inconsciente|desmayad[oa]|sin sentido|inerte|se desvanece|desvanecid[oa]|pierde el conocimiento|no se mueve|no reacciona|inm[oó]vil|no vuelve a moverse/i;

export function hasFalseUnconsciousNarration(narration: string, npcFallsConvalecienteThisTurn?: boolean): boolean {
  if (!npcFallsConvalecienteThisTurn) return false;
  return UNCONSCIOUS_LEAK_REGEX.test(narration);
}

/// Narración-vs-mecánica, el caso INVERSO de `hasFalseUnconsciousNarration`/`hasFalseCombatHit`
/// (bug real jugando en vivo, auditoría 2026-08-22, "¿no queda nada más al revisar la partida?"):
/// un golpe real que solo dejó al rival GRAVE (no CONVALECIENTE/MUERTO, así que ningún guard
/// gateado por `npcFallsUnconsciousThisTurn` protegía nada aquí) tuvo una PROSA honesta ("se
/// desploma hacia atrás, dejando una mancha de sangre en el suelo" — un golpe real, ni de lejos
/// una muerte) pero escribió en `newFacts` "Zense Ceniza ha sido derrotado y muerto." — un
/// SessionFact falso que queda persistido para siempre (`appendSessionFacts`) y contamina la RAG
/// de turnos futuros. Se llama con `parsed.narration` + `parsed.newFacts` combinados (ver el
/// call site en `narrateTurn`), no solo la prosa — este es justo el guard que necesitaba mirar
/// ambos. Vocabulario deliberadamente centrado en finalidad INEQUÍVOCA de muerte (nunca "cae"/
/// "se desploma" a secas, que también describen un golpe fuerte no mortal): el riesgo real es un
/// reintento de más, no dejar pasar la alucinación.
// Vocabulario ampliado (auditoría de código 2026-08-25, sin reproducir en vivo todavía): "fallece"/
// "expira"/"deja de respirar"/"exhala su último aliento" son sinónimos igual de comunes de "muere"
// que la lista original no cazaba, más los sustantivos "cadáver"/"despojos" (una narración que ya
// llama "cadáver" a alguien está afirmando su muerte tan claramente como el verbo).
// Hueco de vocabulario nuevo (bug real jugando en vivo, 2026-09-03, "narración de muerte falsa
// tras un Fallo"): "emite un ruido lastimero antes de quedarse inmóvil" describe una muerte con
// pleno detalle sin usar ninguna palabra de la lista original — "queda(rse)/permanece inmóvil"
// exige el verbo completo (no "inmóvil" suelto, que también describe una pausa momentánea real,
// ver caso negativo ya cubierto "se desploma... dejando una mancha de sangre").
const DEATH_CLAIM_LEAK_REGEX =
  /muri[oó]|muere\b|ha muerto|cae muert[oa]|sin vida|derrotad[oa] y muert[oa]|muerte (instantánea|definitiva)|fallece|expira\b|deja de respirar|exhala su último aliento|cadáver|despojos|qued(a|arse|ando)\s+inm[oó]vil|permanece\s+inm[oó]vil|no vuelve a (moverse|levantarse|respirar)/i;

export function hasFalseDeathClaim(narration: string, combatNoRealDeathThisTurn?: boolean): boolean {
  if (!combatNoRealDeathThisTurn) return false;
  return DEATH_CLAIM_LEAK_REGEX.test(narration);
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseItemUse` pero de EXCLUSIVIDAD, no de uso
/// (auditoría 2026-08-11, "pruebas por API": "Reviso mi equipo y observo con calma el terreno..."
/// narró "notando que el cuchillo de hielo sílice y el tótem Maktor son los únicos objetos que
/// lleva consigo en este viaje" — el inventario real tenía 8 objetos, no 2). Solo dispara si la
/// narración usa una frase de exclusividad EXPLÍCITA ("los únicos objetos", "solo lleva"...): una
/// revisión vaga sin enumerar nada ("revisa su equipo, todo en orden") no es una mentira, es solo
/// poco específica, y no debe gastar un reintento por eso — mismo criterio de "el riesgo real es
/// un reintento de más, no dejar pasar la alucinación" que el resto de esta familia de detectores.
const INVENTORY_EXCLUSIVITY_REGEX =
  /\b(los?|las?) unic[oa]s? (objetos?|cosas?|pertenencias?|items?) que (lleva|porta|tiene)|\bsolo (lleva|porta|tiene|carga)\b|\bunicamente (lleva|porta|tiene|carga)\b|\bnada mas que (lleva|porta|tiene)\b|\beso es todo lo que lleva\b|\bno lleva nada mas\b/i;

export function hasFalseInventoryReview(narration: string, possiblyFalseInventoryReviewNames?: string[]): boolean {
  if (!possiblyFalseInventoryReviewNames || possiblyFalseInventoryReviewNames.length === 0) return false;
  const normalizedNarration = normalizeText(narration);
  if (!INVENTORY_EXCLUSIVITY_REGEX.test(normalizedNarration)) return false;
  const normalizedNames = possiblyFalseInventoryReviewNames.map(normalizeText);
  return normalizedNames.some((name) => !normalizedNarration.includes(name));
}

/// Narración-vs-mecánica (auditoría "revisar partida", 2026-08-13, bug real jugando en vivo: un
/// turno de "Ataco con un golpe directo, con el arma que llevo en la mano principal" narró
/// "Gorhorn lanza su hacha de guerra rota con fuerza hacia el orco... rebotando lejos en la pared
/// de arcilla" — el juego no tiene mecánica de lanzar armas (sin habilidad que lo modele, sin
/// forma de recuperarla), y el turno siguiente Gorhorn seguía atacando con la misma hacha sin
/// ninguna acción de recogerla — la narración prometió un cambio de estado del arma que la
/// mecánica nunca produjo.
///
/// El nombre del arma tiene que ser el OBJETO DIRECTO de "lanza" (adyacente, con como mucho un
/// artículo/posesivo de por medio) — a propósito para no disparar con "lanza un golpe/una
/// estocada... con su hacha", donde "hacha" no es lo que se lanza, es la herramienta del golpe.
function weaponThrowRegexFor(weaponNameNormalized: string): RegExp {
  return new RegExp(`\\blanz\\w*\\s+(su|el|la|tu|una?)?\\s*${weaponNameNormalized}`, 'i');
}

export function hasFalseWeaponThrowClaim(narration: string, equippedWeaponNamesInCombat?: string[]): boolean {
  if (!equippedWeaponNamesInCombat || equippedWeaponNamesInCombat.length === 0) return false;
  const normalizedNarration = normalizeText(narration);
  return equippedWeaponNamesInCombat.some((name) => weaponThrowRegexFor(normalizeText(name)).test(normalizedNarration));
}

/// Narración-vs-mecánica (auditoría "revisar partida", 2026-08-13, bug real jugando en vivo: en un
/// simple turno de viaje, "Gorhorn arranca la capa de piel de gargantúa y la atóona a su cintura
/// como una falda, revelando su pecho descubierto" — un cambio de equipo completo, no pedido por
/// la jugadora, sin ningún reflejo real en `InventoryItem.slot` (sigue en ACCESORIO toda la
/// partida). Equipar/desequipar es SIEMPRE una decisión manual vía `PATCH
/// /saves/:id/inventario/:itemId` (ver inventario.ts: "decisión manual de la jugadora, el modelo
/// nunca la toma") — nunca pasa por aquí, así que no hace falta comprobar la intención de este
/// turno como en `hasFalseItemUse`: CUALQUIER cambio de vestimenta narrado es alucinación, siempre.
///
/// Verbos curados a propósito (nunca "se pone"/"se quita": demasiado genéricos, "se pone en pie"/
/// "se pone furioso"/"se quita de en medio" no tienen nada que ver con equipo) — mismo criterio de
/// mismo-sentencia-que-el-nombre-real que `hasFalseItemUse`/`hasFalseInventoryReview`.
const EQUIP_CHANGE_VERB_REGEX = /\b(arranc\w*|ata\w*|desata\w*|ci[ñn]\w*|revist\w*|desvist\w*)\b/i;

export function hasFalseEquipmentChangeClaim(narration: string, equippableItemNames?: string[]): boolean {
  if (!equippableItemNames || equippableItemNames.length === 0) return false;
  const normalizedNames = equippableItemNames.map(normalizeText);
  return sentenceMatchesRegexAndName(narration, EQUIP_CHANGE_VERB_REGEX, normalizedNames);
}

/// Narración-vs-mecánica (bug real jugando en vivo, análisis de cierre de partida 2026-08-28,
/// FASE 1: "dar un objeto a un NPC no lo retira del inventario del jugador") — la ÚNICA forma real
/// de entregar un objeto a un NPC es el modal dedicado "Entregar" (EntregaModal.tsx,
/// POST /saves/:id/entregar/:npcSlug, 2026-08-31), determinista, sin narración de por medio. La
/// narración LIBRE nunca decide una entrega por su cuenta — si describe al personaje entregando/
/// dando/pasando un objeto real de su inventario a alguien, es una alucinación de licencia
/// narrativa, nunca algo que esa vía pueda cumplir: el objeto reaparecería en manos del jugador en
/// cualquier turno posterior (exactamente el bug real encontrado antes de que existiera el modal —
/// el cuchillo de hielo sílice "entregado" a Gistera Koh seguía en el inventario y reapareció en 4
/// turnos posteriores). Mismo criterio que `hasFalseEquipmentChangeClaim`:
/// mismo-sentencia-que-el-nombre-real, para no disparar con "entrega su vida a la causa" o frases
/// sin relación con un objeto real concreto.
const ITEM_GIVEN_AWAY_VERB_REGEX = /\b(entreg\w*|le d[ae]s?|le pas\w*|le ofrec\w*|le tiend\w*)\b/i;

export function hasFalseItemGivenAway(narration: string, equippableItemNames?: string[]): boolean {
  if (!equippableItemNames || equippableItemNames.length === 0) return false;
  const normalizedNames = equippableItemNames.map(normalizeText);
  return sentenceMatchesRegexAndName(narration, ITEM_GIVEN_AWAY_VERB_REGEX, normalizedNames);
}

/// Narración-vs-mecánica, categoría sin ningún guard hasta ahora (auditoría de código 2026-08-25):
/// "descansar" libre (sin panel "Curar" explícito, `usingExplicitHealList` false) pasa por el LLM,
/// pero el techo real de curación lo calcula `healCeilingFor` (death.ts) de forma determinista —
/// tope GRAVE en terreno salvaje, HERIDO solo en refugio/asentamiento real, nunca ILESO sin un
/// objeto médico real. Nada comprobaba que la prosa no prometiera más salud de la que ese techo
/// permite ("queda completamente sano, como nuevo" cuando el resultado mecánico real es peor).
const FULL_HEAL_CLAIM_REGEX =
  /completamente san[oa]|como nuev[oa]|se recupera (del todo|por completo)|totalmente recuperad[oa]|sana del todo|sin ninguna herida|como si nada hubiera pasado/i;

export function hasFalseHealingClaim(narration: string, restHealCeilingBelowIleso?: boolean): boolean {
  if (!restHealCeilingBelowIleso) return false;
  return FULL_HEAL_CLAIM_REGEX.test(narration);
}

/// Narración-vs-mecánica, categoría sin ningún guard hasta ahora (auditoría de código 2026-08-25):
/// caso INVERSO de `hasFalseItemUse` (protege el CONSUMO falso) — aquí protege la OBTENCIÓN falsa.
/// `turnResolution.ts` solo materializa un `newItem` propuesto si su nombre coincide con un
/// `ItemCatalog` real del mundo (`catalogMatch`); si no coincide, no se crea nada, pero la prosa
/// puede seguir afirmando que el personaje se queda con el objeto. Vocabulario de posesión
/// EXPLÍCITA (guardar/quedarse con/añadir al inventario) — una mención de pasada sin verbo de
/// posesión no es una mentira, mismo criterio que el resto de esta familia de detectores.
const ITEM_POSSESSION_CLAIM_REGEX =
  /\bguarda\b|\bse queda con\b|añade a su inventario|mete en su (mochila|bolsa|zurr[oó]n)|guarda en su (cinto|bolsa|zurr[oó]n)/i;

export function hasFalseNewItemClaim(narration: string, newItemName: string | null | undefined, worldItemCatalogNames?: string[]): boolean {
  if (!newItemName || !worldItemCatalogNames) return false;
  const normalizedNames = worldItemCatalogNames.map(normalizeText);
  if (normalizedNames.includes(normalizeText(newItemName))) return false; // sí existe, se materializará de verdad
  return ITEM_POSSESSION_CLAIM_REGEX.test(narration);
}

/// Narración-vs-mecánica, hueco distinto de `hasFalseNewItemClaim` (hallazgo real jugando en vivo,
/// 2026-08-28: "Recolecto más materiales de la zona antes de descansar." narrado como "recoge...
/// Encontrado un par de hojas duraderas, las añade a sus raciones" — pero el turno no tenía
/// `harvestMatch`/`lootMode` activos NI el modelo rellenó `newItem`, así que ningún camino
/// mecánico ni `hasFalseNewItemClaim` (que solo mira `newItem`) podía cazarlo). `detectHarvest`
/// exige nombrar la fuente real del catálogo a propósito (decisión de diseño 2026-07-29, evita
/// "picar" madera o "talar" piedra) — no se amplía su vocabulario aquí; en vez de eso, se veta
/// cualquier prosa que prometa una obtención SIN ningún camino mecánico activo este turno, sin
/// importar qué palabras use para prometerlo. Vocabulario de obtención (encontrar/recoger/
/// conseguir/añadir a la mochila) — mismo criterio conservador que el resto de la familia: si
/// ya hay un camino mecánico real este turno (recolección/saqueo/construcción/crafteo), la
/// obtención es legítima y el guard no se evalúa.
const ITEM_OBTAINED_CLAIM_REGEX =
  /\b(encuentr\w*|recog\w*|recolect\w*|consigu\w*|obtien\w*|hall[ao]\w*)\b|añade a (su|sus) (inventario|raciones|mochila|bolsa|zurr[oó]n)/i;

export function hasFalsePassiveHarvestClaim(narration: string, newItemName: string | null | undefined, harvestOrLootActiveThisTurn?: boolean): boolean {
  if (harvestOrLootActiveThisTurn || newItemName) return false;
  return ITEM_OBTAINED_CLAIM_REGEX.test(narration);
}

/// Ámbito por FRASE, no por texto completo (fix 2026-09-08, ver comentario de `hasFalseCombatTargetName`
/// y `hasWrongNpcName` más abajo) — bug real reconfirmado jugando en vivo: el criterio original
/// ("el guard no dispara si el nombre real aparece EN ALGUNA PARTE del texto") cortocircuitaba a
/// `false` incluso cuando la MISMA frase le daba protagonismo de combate a un NPC incorrecto, con
/// tal de que el nombre real apareciera en OTRA frase de la misma narración. Ejemplo real: "El
/// Kirelon Arenoso aparece ante la punta de las patas del Orco Enfurecido... el depredador nocturno
/// se prepara para atacar al nuevo enemigo" — "Kirelon Arenoso" (nombre real) sí aparecía en el
/// texto, así que el guard nunca llegaba a notar que "Orco Enfurecido" (NPC MUERTO de un combate
/// anterior) estaba recibiendo un rol de combatiente activo en esa misma frase. Reutiliza el mismo
/// splitter que `sentenceMatchesRegexAndName` (frases separadas por punto/exclamación/interrogación).
/// Sigue siendo conservador: una frase que mencione AMBOS nombres a la vez ("X se acerca junto a Y")
/// no dispara — solo una frase que mencione al NPC incorrecto SIN el real junto a él.
function sentenceHasWrongNameWithoutRealName(narration: string, realName: string, wrongNames: string[]): boolean {
  const normalizedReal = normalizeText(realName);
  const normalizedWrong = wrongNames.map(normalizeText);
  return narration
    .split(SENTENCE_SPLIT_REGEX)
    .some((sentence) => {
      const normalizedSentence = normalizeText(sentence);
      if (normalizedSentence.includes(normalizedReal)) return false;
      return normalizedWrong.some((name) => normalizedSentence.includes(name));
    });
}

/// Narración-vs-mecánica (revisión de partida real, 2026-08-14, "ataque a Múrgol narrado como si
/// fuera contra Cruzavientos"): un intercambio de combate resuelto contra un objetivo concreto
/// (`npcAttackTarget`) puede narrarse sin nombrarlo en absoluto, mencionando en su lugar a OTRO
/// NPC/fauna real presente en la misma escena — el modelo "se distrae" con el elemento mencionado
/// más recientemente en vez del objetivo real de la acción de este turno; la capa determinista
/// (XP, `NpcState`) resuelve bien, solo la prosa nombra mal a quién. Dispara por FRASE (ver
/// `sentenceHasWrongNameWithoutRealName`): una frase que menciona a otro NPC presente SIN el nombre
/// real junto a él es la alucinación real; una frase que menciona a ambos a la vez sigue siendo
/// ambientación inocua.
export function hasFalseCombatTargetName(narration: string, realTargetName?: string, otherNpcNamesInScene?: string[]): boolean {
  if (!realTargetName || !otherNpcNamesInScene || otherNpcNamesInScene.length === 0) return false;
  return sentenceHasWrongNameWithoutRealName(narration, realTargetName, otherNpcNamesInScene);
}

/// Narración-vs-mecánica, categoría de vocabulario ilegítimo (bug real jugando en vivo, 2026-09-01):
/// Gorhorn (Cazador, orco, sin ninguna clase/habilidad mágica) tuvo la curación por descanso normal
/// narrada DOS turnos seguidos con imaginería mágica — "las heridas... comienzan a sellarse con un
/// fino escudo de energía arcana" y luego "notando que el escudo arcáneo se ha fortalecido alrededor
/// de las heridas más profundas" — pese a que ninguna mecánica de este personaje involucra magia.
/// Solo 2 de las 9 clases (docs/rpgtarkor/sistemas-combate/clases.md) tienen vertiente mágica legítima: MAGO (la
/// clase mágica por diseño, aunque su tabla de habilidades siga siendo solo identidad hoy) y CHAMAN
/// (varias habilidades reales usan `preferredAttribute: 'magia'`, ver classAbilities.ts). El resto
/// (Guerrero/Cazador/Arquero/Caballero/Segador/Asesino/Druida) y una partida sin clase asignada
/// (`characterClase` null) no tienen ningún camino mecánico a vocabulario mágico — si aparece de
/// todos modos, es una alucinación de sabor, no una licencia narrativa.
/// Vocabulario acotado al campo semántico real que usa el proyecto (clases.md § Mago: "arcano" como
/// nombre de escuela, "hechizo"/"conjuro"/"encantamiento" como sinónimos de acto mágico, "mágic-" en
/// cualquier flexión) — no se inventan términos que el juego no usa. "Arcano" es ambiguo a propósito
/// (es tanto vocabulario mágico general como el nombre de una escuela de Mago) pero eso es correcto:
/// para un personaje SIN vertiente mágica no hay lectura legítima de la palabra en absoluto.
const MAGIC_VOCABULARY_REGEX = /\barcan[oa]s?\b|\barcáne[oa]s?\b|\bhechiz\w*|\bconjur\w*|\bencantamient\w*|\bmágic[oa]s?\b/i;
const MAGIC_CLASSES: ReadonlySet<Clase> = new Set(['MAGO', 'CHAMAN']);

export function hasIllegitimateMagicVocabulary(narration: string, characterClase?: Clase | null): boolean {
  if (characterClase && MAGIC_CLASSES.has(characterClase)) return false;
  return MAGIC_VOCABULARY_REGEX.test(narration);
}

/// Narración-vs-mecánica, hermano de `hasFalseCombatTargetName` con alcance distinto (hallazgo
/// real jugando en vivo, 2026-08-28/29: encabezado mecánico "KIRELON ARENOSO ATACA CON 'CAZA POR
/// VIBRACIÓN'" pero la prosa narró "El Quio retrocede gruñendo ante el ataque de Gorhorn" — Quio
/// era el rival de un combate ANTERIOR de la misma sesión, ya AUSENTE de la escena actual, así que
/// `otherNpcNamesInScene` — que solo cubre confusión entre NPCs presentes a la vez — no lo cazaba).
/// El modelo "arrastra" un nombre que sigue apareciendo en `sessionFacts` (contexto reciente ya
/// mandado al prompt) en vez del rival real de este intercambio. Dispara por FRASE (fix 2026-09-08,
/// reconfirmado jugando en vivo con "Orco Enfurecido" MUERTO recibiendo rol de combatiente activo
/// mezclado en la misma narración que sí nombraba al rival real — ver comentario de
/// `sentenceHasWrongNameWithoutRealName`): una frase que menciona al NPC obsoleto SIN el real junto
/// a él es la alucinación; una frase que menciona a ambos sigue siendo ambientación inocua.
export function hasWrongNpcName(narration: string, realTargetName?: string, possiblyStaleNpcNames?: string[]): boolean {
  if (!realTargetName || !possiblyStaleNpcNames || possiblyStaleNpcNames.length === 0) return false;
  return sentenceHasWrongNameWithoutRealName(narration, realTargetName, possiblyStaleNpcNames);
}

/// Auditoría "narrador vs. motor determinista" (2026-08-30, bug real jugando: "Exploro la zona"
/// narró a un NPC INOFENSIVO comportándose como agresor, mientras el combate real que el motor
/// abrió fue contra otro NPC completamente distinto, el único de verdad AGRESIVO en la escena) —
/// a diferencia del resto de la familia `hasFalse*`/`hasWrong*` (que comparan PROSA libre contra
/// un nombre esperado), este guard compara el campo ESTRUCTURADO "combateIniciado.npcSlugs" que el
/// propio modelo devuelve — más preciso que parsear texto, sin depender de vocabulario/regex: si el
/// modelo propone como implicado en el combate a cualquier slug que el motor ya sabe que NO puede
/// ser agresor (`nonHostileNpcSlugsInScene`), es una alucinación de "quién" inicia el
/// enfrentamiento, no una licencia narrativa.
export function hasWrongAggressorName(combateIniciadoSlugs?: string[] | null, nonHostileNpcSlugsInScene?: string[]): boolean {
  if (!combateIniciadoSlugs || combateIniciadoSlugs.length === 0 || !nonHostileNpcSlugsInScene || nonHostileNpcSlugsInScene.length === 0) return false;
  return combateIniciadoSlugs.some((slug) => nonHostileNpcSlugsInScene.includes(slug));
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseCombatHit` (2026-08-01, bug real jugando en
/// vivo: descansar tras quedar CONVALECIENTE no cura solo por descansar — hace falta un objeto
/// médico real, ver healCeilingFor/death.ts — pero la narración dijo "agarra la cataplasma de
/// salvia del polvo y aplica una fina capa en una herida abierta", aunque el jugador nunca la
/// nombró en su acción y el objeto seguía intacto en el inventario después). El prompt YA deja
/// claro que el backend gestiona objetos/botín de forma determinista (ver el aviso de "no rellenes
/// newItem"), pero eso no impide que la PROSA libre narre un uso que nunca ocurrió mecánicamente —
/// mismo hueco que el golpe fantasma de combate. Verbo de consumo + nombre real del objeto EN LA
/// MISMA FRASE (no en toda la narración, para no disparar con una mención de pasada tipo "su
/// cataplasma sigue en la mochila" — riesgo bajo pero real, mismo motivo que "maza" se descartó en
/// combate).
const ITEM_CONSUMPTION_VERB_REGEX = /\b(aplic\w*|us[oó]|usa\w*|consum\w*|beb\w*|com[eoí]\w*|unt\w*|vend\w*|ingier\w*|traga\w*)\b/i;

/// Deduplicación (refactor de deuda técnica, sin cambio de comportamiento): `hasFalseItemUse`,
/// `hasResurrectedDeadNpc`, `hasFalseTravelClaim` y `hasFalsePhantomTravel` repetían el mismo
/// algoritmo — partir en frases, normalizar cada una, y comprobar si matchea a la vez una regex de
/// acción sospechosa y alguno de los nombres normalizados dados. Acepta uno o varios textos (los
/// dos detectores de viaje comprueban tanto la prosa como `newFacts`) para no forzar a los
/// callers de un solo texto a envolverlo en un array.
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

function sentenceMatchesRegexAndName(text: string | string[], actionRegex: RegExp, normalizedNames: string[]): boolean {
  const texts = Array.isArray(text) ? text : [text];
  return texts
    .flatMap((t) => t.split(SENTENCE_SPLIT_REGEX))
    .some((sentence) => {
      const normalizedSentence = normalizeText(sentence);
      // Tolerancia a plural simple (bug real jugando en vivo, 2026-09-01: "cataplasmas de salvia
      // del polvo" no matcheaba contra "Cataplasma de salvia del polvo" del catálogo) — ver
      // `includesNameOrPlural` (itemReference.ts) para el criterio exacto.
      return actionRegex.test(normalizedSentence) && normalizedNames.some((name) => includesNameOrPlural(normalizedSentence, name));
    });
}

export function hasFalseItemUse(narration: string, possiblyFalseItemUseNames?: string[]): boolean {
  if (!possiblyFalseItemUseNames || possiblyFalseItemUseNames.length === 0) return false;
  const normalizedNames = possiblyFalseItemUseNames.map(normalizeText);
  return sentenceMatchesRegexAndName(narration, ITEM_CONSUMPTION_VERB_REGEX, normalizedNames);
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseCombatHit`/`hasFalseItemUse` (2026-08-01,
/// bug real jugando en vivo — clase de fallo ya documentada en docs/runbooks/revisar-partida.md § "NPCs que
/// resucitan"): con el Orco Enfurecido MUERTO y saqueado desde hacía varios turnos, un simple
/// "Exploro la zona" narró "una mirada al oeste revela un conjunto de huellas recientes... Gorhorn
/// reconoce el paso de un orco — probablemente el Orco Enfurecido" — implicando que sigue vivo y
/// merodeando. `npcSceneBlockFor` (npcScene.ts) YA le da al modelo la instrucción explícita de
/// tratarlo solo como "un cadáver ya visto, un recuerdo... nunca un encuentro nuevo" cuando está
/// CONVALECIENTE/MUERTO, pero un modelo pequeño la ignora bajo la misma presión creativa que el
/// resto de esta lista. Vocabulario centrado en SEÑALES DE PRESENCIA RECIENTE/ACTIVA (huellas
/// frescas, "sigue vivo", reaparece...) — deliberadamente no cualquier mención del nombre, para no
/// disparar con un recuerdo legítimo en pasado ("recordó cuando luchó contra el Orco Enfurecido").
// Vocabulario de "ataca de nuevo" ampliado (auditoría "revisar partida", 2026-08-12 — bug real
// jugando en vivo: con el Orco Enfurecido MUERTO/saqueado desde hacía varios turnos, un "Salgo a
// cazar y ataco a 'Múrgol'" (sin mencionar al orco) narró "El orco enfurecido se da la vuelta
// bruscamente... el orco se lanza hacia él con un rugido atronador" — el vocabulario de arriba
// (huellas, "sigue vivo", "reaparece"...) no cubría una iniciativa de ataque directa como esta.
// Verificado contra el texto real capturado en el log: la versión anterior de este regex devolvía
// `false` para esta frase exacta, dejando pasar la resurrección sin reintento.
// Vocabulario ampliado (auditoría de código 2026-08-25, sin reproducir en vivo todavía): (1) verbos
// de "levantarse" tras quedar CONVALECIENTE/MUERTO ("se incorpora"/"se levanta"/"se pone en pie") —
// un rival abatido de verdad no se pone en pie solo; (2) "lanza/abalanza/arroja" solo cazaba el
// verbo pegado DIRECTAMENTE a hacia/sobre/contra ("se lanza hacia") — "lanza un hachazo brutal
// contra Gorhorn" (verbo + objeto + preposición) se colaba entero.
const RESURRECTION_LEAK_REGEX =
  /\b(huellas?\s+(recien\w*|frescas?)|rastro\s+reciente|reconoce el paso de|acaba de pasar|sigue\s+(con vida|vivo)|todav[ií]a\s+(con vida|vivo)|reaparece|vuelve a (atacar|aparecer|acercarse)|se acerca (de nuevo|otra vez)|se (lanza|abalanza|arroja)\s+(\w+\s+){0,3}(hacia|sobre|contra)|se (da la vuelta|gira|vuelve)\s+bruscamente|se (incorpora|levanta|pone en pie)|embiste|carga contra|arremete\s+(hacia|contra))\b/i;

export function hasResurrectedDeadNpc(narration: string, possiblyResurrectedNpcNames?: string[]): boolean {
  if (!possiblyResurrectedNpcNames || possiblyResurrectedNpcNames.length === 0) return false;
  const normalizedNames = possiblyResurrectedNpcNames.map(normalizeText);
  return sentenceMatchesRegexAndName(narration, RESURRECTION_LEAK_REGEX, normalizedNames);
}

/// Grupo 3 § Mundo determinista, Capa 3, pieza B (docs/rpgtarkor/lore-mundo/mundo-determinista.md, 2026-08-25)
/// — mismo problema de fondo que `hasResurrectedDeadNpc`, pero para una aparición NUEVA en vez de
/// una resurrección: el modelo puede mencionar a un NPC real del catálogo, plausible geográficamente
/// (`candidateNpcNamesNotInScene`, npcScene.ts) pero que ningún mecanismo determinista puso en
/// escena este turno, y "hacerlo aparecer" con vocabulario de presencia activa — el hueco real que
/// investigó esta sesión (`sessionFacts` sin control de población/terreno). Mismo vocabulario base
/// que `RESURRECTION_LEAK_REGEX` (comparte varias frases — "se lanza hacia", "embiste"...) más
/// verbos propios de una PRIMERA aparición (aparece, surge, emerge, sale al paso...), deliberadamente
/// NO cualquier mención del nombre — "recordó cuando luchó contra X" no debe disparar, mismo criterio
/// de frase-a-frase que el resto de esta familia de guards.
const NPC_APPEARANCE_LEAK_REGEX =
  /\b(aparece|reaparece|surge|emerge|irrumpe|asoma|se materializa|sale\s+(a tu paso|al paso|de entre|de repente)|llega\s+(de repente|corriendo|hasta [a-záéíóúñ]+)|te (encuentras|topas) con|cruza (tu|su) camino|se acerca (de nuevo|otra vez|sigiloso)|se (lanza|abalanza|arroja)\s+(hacia|sobre|contra)|se (da la vuelta|gira|vuelve)\s+bruscamente|embiste|carga contra|arremete\s+(hacia|contra))\b/i;

export function hasFalseNpcAppearance(narration: string, possiblyUnauthorizedNpcNames?: string[]): boolean {
  if (!possiblyUnauthorizedNpcNames || possiblyUnauthorizedNpcNames.length === 0) return false;
  const normalizedNames = possiblyUnauthorizedNpcNames.map(normalizeText);
  return sentenceMatchesRegexAndName(narration, NPC_APPEARANCE_LEAK_REGEX, normalizedNames);
}

/// Narración-vs-mecánica, variante de `hasResurrectedDeadNpc` (bug real jugando en vivo, visto ya
/// tres veces en tres partidas/sesiones distintas): Gistera Koh se marcha para siempre nada más
/// aceptar su misión ("ya no está en escena, no volverá a aparecer", ver `gisteraSeHaMarchado`
/// en turnResolution.ts, que ya la excluye de `npcsInScene` por slug) — pero el modelo la
/// reintroduce sin nombrarla NUNCA, reciclando su propia intro casi textual ("una orca marcada del
/// Clan Serhu, sin nombre revelado... algo la persigue", "jadeante"/"persigue su silueta"...). La
/// exclusión por slug no puede cazar esto porque el texto nunca dice "Gistera Koh".
///
/// Se exige la mención del clan Y vocabulario de persecución/huida A LA VEZ (no cada uno por
/// separado) — Torgash/Ulkha (también "del Clan Serhu", pero SIEMPRE nombrados) podrían aparecer
/// legítimamente en escena más adelante sin estar huyendo de nada; exigir las dos señales juntas
/// evita ese falso positivo mientras sigue cazando el patrón real (confirmado en las 3 apariciones
/// reales: siempre persecución/huida, nunca una mención neutra del clan).
const GISTERA_CLAN_MENTION_REGEX = /orca\s+(?:marcada\s+)?(?:del\s+clan\s+)?serhu/i;
// Ampliado (bug real jugando en vivo, 2026-08-27, checklist consolidado P0.1): tras un respawn, la
// reaparición se narró como amenaza estática/acechante ("sin nombre revelado todavía... sus ojos
// fieros fijos en Gorhorn"), sin ninguna de las palabras de persecución/huida ya cubiertas — el
// vocabulario original asumía siempre el mismo patrón de "ella huye, él la persigue", pero esta
// reaparición invierte el marco. "sin nombre revelado" es la frase más específica del patrón real
// (recicla casi textualmente la intro original) — deliberadamente NO se añaden verbos genéricos
// como "aparece"/"se acerca" para no disparar con una mención legítima futura de otra orca real del
// Clan Serhu (Torgash/Ulkha) que no tenga nada que ver con Gistera.
const GISTERA_PERSECUCION_REGEX =
  /persigu\w*|persecucion\w*|jadea\w*|sin aliento|huy[eo]|huyendo|acecha\w*|sin nombre revelado/i;

export function hasGisteraReencuentroSinNombrar(narration: string, gisteraSeHaMarchado?: boolean): boolean {
  if (!gisteraSeHaMarchado) return false;
  const normalized = normalizeText(narration);
  return GISTERA_CLAN_MENTION_REGEX.test(normalized) && GISTERA_PERSECUCION_REGEX.test(normalized);
}

/// Complementario a `hasGisteraReencuentroSinNombrar` (auditoría "revisar partida", 2026-08-13,
/// bug real jugando en vivo: en pleno combate contra el Orco Enfurecido, defendiéndose de SU
/// golpe, la narración dijo "Gistera Koh se aproxima a Gorhorn con una expresión de furia" — el
/// caso de arriba solo caza la reintroducción SIN nombrarla; este cubre el caso contrario, donde
/// el modelo sí la nombra literalmente pese a que el hecho protegido diga que se marchó para
/// siempre. Nombre/alias exacto con límite de palabra (no basta con que "gistera" aparezca dentro
/// de otra palabra) — a diferencia del caso sin nombrar, aquí no hace falta exigir vocabulario de
/// persecución además: el propio nombre ya es la señal inequívoca.
const GISTERA_NAME_REGEX = /\bgistera(\s+koh)?\b/i;

export function hasFalseGisteraNamedReturn(narration: string, gisteraSeHaMarchado?: boolean): boolean {
  if (!gisteraSeHaMarchado) return false;
  return GISTERA_NAME_REGEX.test(normalizeText(narration));
}

/// Narración-vs-catálogo (bug real jugando en vivo, 2026-08-27, checklist consolidado P0.2, mismo
/// turno contaminado que `hasGisteraReencuentroSinNombrar`): "Karot Veku" es el nombre NATIVO en
/// lengua orca del campamento del Clan Serhu (worldCatalog.ts, alias "karot veku" de
/// "Karot Veku - Campamento del Clan Serhu" — mismo sitio que "Colmillo Ceniza"), nunca un río. La
/// narración de esa partida inventó "el río Karot Veku" — mezcló un topónimo real del catálogo con
/// una naturaleza geográfica que no le corresponde. Guard acotado a este caso concreto (decisión
/// explícita: un guard genérico de topónimos contra TODAS las Location del mundo, mapeando
/// vocabulario natural a `kind`, es diseño nuevo con más riesgo de falso positivo — se deja para
/// si el patrón se repite con otro lugar).
const KAROT_VEKU_AS_WATER_REGEX = /\b(r[ií]o|lago|laguna|afluente|arroyo|cauce)\s+(de\s+)?karot\s+veku\b/i;

export function hasFalseKarotVekuAsRiver(narration: string): boolean {
  return KAROT_VEKU_AS_WATER_REGEX.test(normalizeText(narration));
}

/// Fuga de vocabulario de fantasía genérica (bug real, ronda 2 de pruebas autónomas 2026-09-05): un
/// gesgurio en modo dinámico narró "como si pudieran ver lo que los humanos ocultan tras sus almas"
/// — Helek Sirik no tiene ninguna raza humana, jugable ni narrativa (orcos/goirntes/nabieus/faerus,
/// ver worldCatalog.ts, donde "humano/humanoide" solo aparece como adjetivo genérico de forma
/// corporal, nunca como nombre de raza). El modelo arrastró vocabulario por defecto de fantasía
/// típica sin adaptarlo al lore real de este mundo. Sin contexto adicional — "humano" nunca es
/// correcto en ningún turno de esta partida, así que no hace falta condicionarlo a nada.
const HUMAN_RACE_LEAK_REGEX = /\bhumanos?\b|\bhumanas?\b/i;

export function hasHumanRaceLeak(narration: string): boolean {
  return HUMAN_RACE_LEAK_REGEX.test(normalizeText(narration));
}

/// Narración-vs-mecánica (bug real jugando en vivo, hallazgo 1 de la sesión autónoma de pruebas
/// 2026-09-04): el jugador respondía a ciegas a un ataque del NPC ya decidido ("CASO DEFENSA",
/// `turnResolution.ts`), pero la narración describió a Gorhorn "mirando atentamente... intentando
/// localizar al Orco enfurecido" — una escena de búsqueda/reconocimiento, como si el enemigo
/// todavía no estuviera identificado ni atacando, en vez de bloquear/esquivar el golpe ya en
/// marcha. Vocabulario de "buscar/localizar al enemigo" no tiene sentido cuando el NPC ya está en
/// escena y ya lanzó su ataque este mismo intercambio — es una alucinación de tipo de acción, no
/// una licencia narrativa (el personaje podría estar atento/alerta DURANTE la defensa, pero no
/// "buscando" a quien ya tiene delante y ya le está atacando).
const SEARCHING_ENEMY_LEAK_REGEX =
  /\b(buscando|intenta(ndo)?\s+localizar|trata(ndo)?\s+de\s+localizar|intenta(ndo)?\s+encontrar|trata(ndo)?\s+de\s+encontrar|escudri[ñn]a(ndo)?|otea(ndo)?|rastrea(ndo)?)\b/i;

export function hasFalseDefenseNarration(narration: string, playerActedAsDefenderThisExchange?: boolean): boolean {
  if (!playerActedAsDefenderThisExchange) return false;
  return SEARCHING_ENEMY_LEAK_REGEX.test(narration);
}

/// Narración-vs-mecánica (bug real jugando en vivo, 2026-09-06: "el Bulco de Arena lanza un rugido
/// agudo y su caracola rugosa golpea con fuerza" — un ítem de recolección/marisco de
/// `HarvestYield`, `temperamento: INOFENSIVO` y `ataqueNatural: 'No ataca.'` en el catálogo,
/// narrado ejecutando un ataque activo). `turnResolution.ts` ya usa este mismo dato de catálogo
/// para bloquear el DAÑO mecánico (`jugadorRecibeGolpe = false` cuando `ataqueNatural` empieza por
/// "No ataca"), pero nada impedía que la PROSA describiera el ataque igualmente — el LLM recibe al
/// NPC como `npcParaIntercambio` en su contexto sin ninguna restricción de comportamiento. Vocabulario
/// deliberadamente de agresión ACTIVA contra el jugador (embestir/golpear/atacar/morder/arañar/
/// clavar), no de mera presencia o huida — un Quio o un Bulco de Arena puede aparecer, acercarse o
/// alejarse en prosa sin violar su ficha, solo no puede atacar.
const INOFFENSIVE_NPC_ACTIVE_ATTACK_REGEX =
  /\b(embiste|embistio|embisti[oó]|golpea|golpeo|golpe[oó]|ataca|ataco|atac[oó]|arremete|arremetio|arremeti[oó]|carga contra|se abalanza|muerde|mordio|mordi[oó]|ara[ñn]a|ara[ñn]o|ara[ñn][oó]|lanza un mordisco|clava)\w*/i;

export function hasInoffensiveNpcNarratedAttacking(narration: string, npcAttackerIsInoffensive?: boolean): boolean {
  if (!npcAttackerIsInoffensive) return false;
  return INOFFENSIVE_NPC_ACTIVE_ATTACK_REGEX.test(normalizeText(narration));
}

/// Escena de Gistera Koh, turno de aceptación (bug real jugando en vivo, 2026-09-06): Gistera nunca
/// pronuncia el nombre "Orco Enfurecido" en la conversación (dice "el que me persigue"), es solo el
/// nombre técnico del catálogo/misión — Gorhorn no lo ha oído y no debe usarlo en su propia réplica.
/// La instrucción de prompt reforzada no bastó por sí sola, de ahí este guard con reintento real.
const ORCO_ENFURECIDO_NAME_REGEX = /orco\s+enfurecido/i;

export function hasGorhornPronouncingOrcoEnfurecidoName(narration: string, gisteraAcceptanceTurnRisksOrcoName?: boolean): boolean {
  if (!gisteraAcceptanceTurnRisksOrcoName) return false;
  return ORCO_ENFURECIDO_NAME_REGEX.test(normalizeText(narration));
}

/// Narración-vs-mundo determinista (bug real, sesión autónoma de pruebas con Playwright, 2026-09-04):
/// "sus ojos centelleando bajo el resplandor de la luna" narrado en un turno a las 08:16 de la
/// mañana, con "Amanece sobre Helek Sirik..." como primera línea de la propia partida — el sistema
/// SÍ calcula correctamente el momento del día (`momentoDelDiaFor`, worldClock.ts — usado para
/// imágenes de escena y fauna diurna/nocturna), pero ese dato nunca se pasaba al narrador como
/// restricción de coherencia. Solo dispara con referencias INEQUÍVOCAS al astro contrario (luna/
/// estrellas de noche estrellada en pleno día; sol/amanecer/atardecer de noche) — deliberadamente
/// sin incluir "oscuridad"/"sombra"/"claridad" (pueden describir un interior, una cueva, un eclipse
/// narrativo legítimo) para no disparar en falso con ambientación de escena normal.
///
/// "luna"/"lunar" se sacaron de aquí (auditoría de coherencia código↔lore, 2026-09-05) — el guard
/// original solo los rechazaba DE DÍA, pero Helek Sirik NUNCA tiene luna convencional
/// (`genesis.md` § "El cielo sin luna"), de día o de noche: el bug real que motivó este guard
/// ("resplandor de la luna" a las 08:16 de la mañana) se arregló solo para el caso diurno, dejando
/// pasar el caso de noche, que es justo el más frecuente. Ver `hasFalseMoonReference` más abajo,
/// que cubre ambos momentos del día a la vez.
const NIGHT_REF_IN_DAY_REGEX = /\b(estrellas?|noche\s+estrellada|constelaci[oó]n(es)?)\b/i;
const DAY_REF_IN_NIGHT_REGEX = /\b(sol|solar|amanecer|atardecer|luz\s+del\s+d[ií]a)\b/i;

export function hasWrongCelestialReference(narration: string, momentoDelDia?: 'dia' | 'noche'): boolean {
  if (!momentoDelDia) return false;
  const normalized = normalizeText(narration);
  if (momentoDelDia === 'dia') return NIGHT_REF_IN_DAY_REGEX.test(normalized);
  return DAY_REF_IN_NIGHT_REGEX.test(normalized);
}

/// Narración-vs-lore (auditoría de coherencia código↔lore, 2026-09-05): Helek Sirik nunca tuvo una
/// luna convencional (`genesis.md` § "El cielo sin luna") — lo que hay de noche es un cinturón
/// difuso de micro-cristales que refleja un brillo perlado, nunca un disco de luna. A diferencia de
/// `hasWrongCelestialReference` (que compara contra el momento del día), esta regla es absoluta:
/// "luna"/"lunar" nunca son correctos, en ningún turno, de día o de noche. Sin excepciones desde el
/// 2026-09-29: el nombre popular del cinturón (y origen del nombre Kelife) pasó de "brillo de luna"
/// a "brillo de aurora" por decisión de Álvaro, así que ya no hace falta dejar pasar esa expresión.
const MOON_REFERENCE_REGEX = /\b(luna|lunar)\b/i;

export function hasFalseMoonReference(narration: string): boolean {
  return MOON_REFERENCE_REGEX.test(normalizeText(narration));
}

/// Narración-vs-lore, familia nueva "vs. lore del corpus" (auditoría de coherencia código↔lore,
/// hallazgo B5, cerrada 2026-09-06): hasta ahora ningún guard verificaba reglas de lore fuera de
/// mecánica de combate/viaje. `genesis.md` § Nohade: "lengua creada por Berd para que las Semillas
/// pudieran comunicarse entre sí y con Madre. Es exclusivamente divina: ningún mortal la ha hablado
/// jamás." Ningún personaje jugable, NPC ni fauna de Helek Sirik puede hablar, escribir o entender
/// nohade — solo puede mencionarse como concepto ajeno ("grabado en nohade", "nadie puede leerlo").
// Verbo + hasta ~25 caracteres de por medio ("el pergamino escrito en", "perfectamente, para
// sorpresa de todos" antes del siguiente "nohade") + "(en) nohade" — no exige que estén pegados.
const NOHADE_SPOKEN_BY_MORTAL_REGEX =
  /\b(habla|hablando|hablo|habl[oó]|dice|dijo|pronuncia|pronunci[oó]|escribe|escribi[oó]|lee|ley[oó]|entiende|entendi[oó]|traduce|tradujo)\w*[^.!?]{0,25}?\b(en\s+)?nohade\b/i;
// Excepción: negar la posibilidad ("nadie/ningún mortal ha hablado nohade jamás") es la frase
// CORRECTA según el lore, no una violación — sin esto, la propia negación dispararía el guard.
const NOHADE_NEGATION_NEARBY_REGEX = /\b(nadie|ning[uú]n\w*|ni\s+siquiera|jam[aá]s)\b/i;

export function hasMortalSpeakingNohade(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!NOHADE_SPOKEN_BY_MORTAL_REGEX.test(normalized)) return false;
  return !NOHADE_NEGATION_NEARBY_REGEX.test(normalized);
}

/// `razas.md` § Orcos: los orcos no adoran a Tarkor ni conocen su existencia — la Magia es "poder
/// salvaje del Estallido" para ellos, sin ningún nombre ni figura divina detrás; el arco de Tarkor
/// es mito reservado a Semillas/eruditos nohade, jamás llegó a la tradición oral orca. Cualquier
/// personaje (casi siempre un orco por nombre propio — Gorhorn, un NPC orco — nunca "orco" a secas
/// en prosa real) rezando, jurando o invocando a Tarkor rompe esto — no se exige la palabra "orco"
/// literal en la frase, el elenco jugable actual es orco casi sin excepción.
const ORC_WORSHIPPING_TARKOR_REGEX =
  /\btarkor\b[^.!?]{0,60}\b(reza|invoca|jura|venera|adora)\w*|\b(reza|invoca|jura|venera|adora)\w*[^.!?]{0,60}\btarkor\b|\ben el nombre de\s+tarkor\b/i;

export function hasOrcWorshippingTarkor(narration: string): boolean {
  return ORC_WORSHIPPING_TARKOR_REGEX.test(normalizeText(narration));
}

/// `razas.md` § Orcos: dos tabúes prácticos de duelo/tótem — "interrumpir un duelo de honor ya
/// aceptado" y "tocar el tótem de un clan ajeno sin permiso de su Terk'ikar" — ambos definidos como
/// transgresiones reales, nunca gestos sin consecuencia. Dispara si la narración describe el propio
/// acto (interrumpir el duelo / tocar el tótem ajeno) sin ninguna palabra de consecuencia o tensión
/// cerca — evita falsos positivos cuando el personaje SABE que es tabú y decide no hacerlo, o cuando
/// ya se narra la reacción/castigo correspondiente en la misma frase.
const TABOO_ACT_REGEX =
  /\b(interrumpe|interrumpio|interrumpió|detiene el duelo|para el duelo)\w*\s+el\s+duelo\b|\b(toca|tocando|toco|tocó|agarra|coge)\w*\s+el\s+t[oó]tem\s+(del?\s+)?(otro\s+)?clan\b/i;
const TABOO_CONSEQUENCE_NEARBY_REGEX =
  /\b(deshonra|deshonor|tab[uú]|prohibido|castigo|castiga|verg[uü]enza|ofende|ofensa|se enfurece|indignaci[oó]n)\w*/i;

export function hasUnpunishedOrcTabooBreak(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!TABOO_ACT_REGEX.test(normalized)) return false;
  return !TABOO_CONSEQUENCE_NEARBY_REGEX.test(normalized);
}

/// `areas.md` § "La casta de Ketg": negar el cuerpo de un caído (hacerlo desaparecer sin velarlo ni
/// recordarlo, en vez de quemarlo y marcar el lugar con su tótem) es "una práctica que no se ve en
/// ningún otro clan orco" — castigo exclusivo de la casta de Ketg (Clan Serhu) contra quien la
/// desafía. Cualquier otro clan (Maktor, Goshg, Helsig) narrando este mismo rito viola la regla.
const DENIED_BODY_RITE_REGEX =
  /\bcuerpo\b[^.!?]{0,60}\b(desaparece|hacen desaparecer|niegan|niega|no se vela|sin velar|sin quemar)\w*|\b(niegan|niega)\w*\s+el\s+cuerpo\b/i;
const NON_SERHU_ORC_CLAN_REGEX = /\b(maktor|goshg|helsig)\b/i;

export function hasNonSerhuDenyingFuneralRite(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!DENIED_BODY_RITE_REGEX.test(normalized)) return false;
  return NON_SERHU_ORC_CLAN_REGEX.test(normalized);
}

/// Familia "vs. lore", segunda tanda (auditoría de `loreChunks.ts`/guards, 2026-09-06). `razas.md`
/// § "Los orcos y la Magia": Tarkor selló el canalizador de serie de los orcos — ningún orco lanza
/// magia en crudo con las manos, siempre a través de tótem o runa. Dispara si un verbo de lanzar
/// magia aparece junto a "con las manos"/"desde las palmas"/"a mano" sin ningún tótem/runa cerca.
const RAW_ORC_MAGIC_REGEX =
  /\b(lanza|conjura|invoca|libera)\w*[^.!?]{0,40}\b(con las manos|desde las palmas|de sus manos|de las manos|a mano)\b/i;
const MAGIC_FOCUS_NEARBY_REGEX = /\b(t[oó]tem|runa)\w*/i;

export function hasRawOrcMagicWithoutFocus(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!RAW_ORC_MAGIC_REGEX.test(normalized)) return false;
  return !MAGIC_FOCUS_NEARBY_REGEX.test(normalized);
}

/// `razas.md` § "El Signeran": el duelo de honor orco es siempre a muerte — "dejar con vida al
/// perdedor se considera una deshonra y una debilidad... en la práctica casi ningún Signeran
/// termina de otra forma". Dispara si la narración menciona un Signeran junto a un desenlace de
/// clemencia (perdonar, dejar con vida, no matar).
const SIGNERAN_MENTION_REGEX = /\bsignera\w*\b/i;
const MERCIFUL_OUTCOME_REGEX =
  /\b(perdona|perdono|perdon[oó])\w*|\bdeja con vida\b|\ble perdona la vida\b|\brespeta su vida\b|\bno lo mata\b|\bdecide no matarlo\b/i;

export function hasMercifulSigneran(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!SIGNERAN_MENTION_REGEX.test(normalized)) return false;
  return MERCIFUL_OUTCOME_REGEX.test(normalized);
}

/// `razas.md` § Ilvenar: "su tabú es absoluto y define a la raza entera: falsear un registro. Un
/// Ilvenar que miente por escrito deja de ser considerado Ilvenar por los suyos". Dispara si un
/// Ilvenar falsea/altera un registro sin que la narración incluya esa consecuencia de expulsión.
const ILVENAR_MENTION_REGEX = /\bilvenar\w*\b/i;
const ILVENAR_FALSIFY_ACT_REGEX =
  /\b(falsea|falsifica|miente en|altera|manipula)\w*[^.!?]{0,30}\b(registro|archivo|cr[oó]nica)\w*/i;
const ILVENAR_CONSEQUENCE_NEARBY_REGEX =
  /\b(deja de ser|expulsa|ya no es considerad\w*|pierde su identidad|castigo)\w*/i;

export function hasUnpunishedIlvenarFalsify(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!ILVENAR_MENTION_REGEX.test(normalized)) return false;
  if (!ILVENAR_FALSIFY_ACT_REGEX.test(normalized)) return false;
  return !ILVENAR_CONSEQUENCE_NEARBY_REGEX.test(normalized);
}

/// `razas.md` § Faerus: "la manada es la única institución Faerus... abandonar a un herido de la
/// manada es el tabú que no se perdona". Dispara si un Faerus abandona a un herido sin ninguna
/// palabra de consecuencia/tensión cerca.
const FAERUS_MENTION_REGEX = /\bfaerus\b/i;
const FAERUS_ABANDON_ACT_REGEX =
  /\b(abandona|abandono|deja atras|dejo atras|dej[oó] atr[aá]s)\w*[^.!?]{0,30}\b(herido|herida|malherido|malherida)\w*/i;
const FAERUS_CONSEQUENCE_NEARBY_REGEX =
  /\b(tab[uú]|verg[uü]enza|no se perdona|castigo|expulsa|deshonra)\w*/i;

export function hasUnpunishedFaerusAbandon(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!FAERUS_MENTION_REGEX.test(normalized)) return false;
  if (!FAERUS_ABANDON_ACT_REGEX.test(normalized)) return false;
  return !FAERUS_CONSEQUENCE_NEARBY_REGEX.test(normalized);
}

/// `areas.md` § "La Niebla del Estrecho": "ningún barco convencional puede cruzarlo sin perder el
/// rumbo, salvo que use tecnología de cristal Kelife o brújulas de vacío Nabieus". Dispara si se
/// narra cruzar la Niebla sin mencionar ninguna de las dos tecnologías cerca. Bajo impacto mientras
/// la partida transcurra en Berig/Llanuras, lejos del estrecho — guard barato de mantener por si la
/// trama se traslada a Vaelira.
const NIEBLA_CROSSING_REGEX =
  /\bcruza\w*[^.!?]{0,40}\bniebla del estrecho\b|\bniebla del estrecho\w*[^.!?]{0,40}\bcruza\w*/i;
const NIEBLA_TECH_NEARBY_REGEX = /\b(cristal kelife|br[uú]jula|vac[ií]o)\w*/i;

export function hasNieblaCrossingWithoutTech(narration: string): boolean {
  const normalized = normalizeText(narration);
  if (!NIEBLA_CROSSING_REGEX.test(normalized)) return false;
  return !NIEBLA_TECH_NEARBY_REGEX.test(normalized);
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseItemUse`/`hasResurrectedDeadNpc` (bug real
/// jugando en vivo, 2026-08-06 — auditoría "revisa la partida" en directo: "Avanzo, dejando atrás
/// la Hondonada" desde un nodo con 2 salidas reales no puede auto-resolverse solo — el aviso
/// explícito de turnResolution.ts le pide al modelo preguntar cuál de los caminos elige, en vez de
/// narrar una llegada — pero narró "Gorhorn se arrastra... hacia los Pilares Rotos" y persistió el
/// hecho "Gorhorn ha dejado la Hondonada del Eco y avanza hacia los Pilares Rotos" en `newFacts`,
/// aunque `Save.currentLocationId` nunca cambió: la ubicación real y el hecho recordado para
/// siempre quedaron desincronizados. Se comprueba tanto la prosa como `newFacts` (a diferencia del
/// resto de comprobaciones de esta lista, que solo miran la prosa) porque aquí el hueco más
/// peligroso es justo el hecho persistido, no el texto de pantalla. Verbo de movimiento YA
/// COMPLETADO/comprometido a una dirección + nombre real de uno de los destinos ambiguos, en la
/// misma frase — una pregunta bien hecha ("¿hacia el Pozo o hacia los Pilares?") nombra los
/// destinos sin usar ninguno de estos verbos, así que no dispara en falso.
// "sale de"/"salio de"/"escapa de"/"huye de" añadidos (auditoría 2026-08-11, "pruebas por API",
// ver hasFalsePhantomTravel más abajo): el caso real que los echaba en falta era "Gorhorn sale de
// la hondonada, caminando firme hacia el norte..." — "sale de" no estaba en la lista, así que ni
// siquiera hasFalseTravelClaim (más abajo) lo habría cazado si el destino inventado hubiera
// coincidido por casualidad con un nombre real.
const FALSE_TRAVEL_VERB_REGEX =
  /\b(ha dejado|deja atras|dejo atras|abandona\w*|abandono|ha llegado|llega\w*|llego|alcanza\w*|alcanzo|entra\w* en|entro en|arriba\w* a|arribo a|avanza\w* hacia|camina\w* hacia|se dirige\w* hacia|dirigio\w* hacia|parte\w* hacia|prosigue\w* hacia|se encuentra ya en|esta ya en|sale\w* de|salio de|escapa\w* de|escapo de|huye\w* de|huyo de)\b/i;

export function hasFalseTravelClaim(narration: NarrationResult, possiblyFalseTravelDestinationNames?: string[]): boolean {
  if (!possiblyFalseTravelDestinationNames || possiblyFalseTravelDestinationNames.length === 0) return false;
  const normalizedNames = possiblyFalseTravelDestinationNames.map(normalizeText);
  return sentenceMatchesRegexAndName([narration.narration, ...narration.newFacts], FALSE_TRAVEL_VERB_REGEX, normalizedNames);
}

/// Complementario a `hasFalseTravelClaim` (auditoría 2026-08-11, "pruebas por API"): aquel cubre
/// "2+ destinos reales ambiguos, el modelo narra la llegada a uno sin preguntar" — este cubre el
/// caso contrario, un destino/dirección que NO matchea ningún alias real (p. ej. "Salgo de la
/// hondonada y camino hacia el norte, alejándome del orco" — "el norte" no es ningún alias de
/// ninguna Location). `travel` sale `null` (correcto: no hay nada que resolver), pero la narración
/// describió de todos modos "Gorhorn sale de la hondonada, caminando firme hacia el norte..." —
/// `Save.currentLocationId` nunca cambió, así que el jugador cree que se movió y no es verdad.
/// Mismo verbo compartido que `hasFalseTravelClaim`, pero comprobado contra el nombre de la
/// ubicación ACTUAL (no de un destino) — narrar que la abandona/deja atrás es la mentira aquí.
export function hasFalsePhantomTravel(narration: NarrationResult, phantomTravelLocationNames?: string[]): boolean {
  if (!phantomTravelLocationNames || phantomTravelLocationNames.length === 0) return false;
  const normalizedNames = phantomTravelLocationNames.map(normalizeText);
  return sentenceMatchesRegexAndName([narration.narration, ...narration.newFacts], FALSE_TRAVEL_VERB_REGEX, normalizedNames);
}
