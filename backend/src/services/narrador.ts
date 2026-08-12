import { ollamaGenerate, ollamaGenerateStream } from '../lib/ollama.js';
import { extractStreamingNarration } from './narrationStream.js';
import { env } from '../config/env.js';
import { normalizeText, fuzzyMatchCandidates, findFuzzyStemMatch } from './travel.js';
import { detectsAttackIntent, detectsHostileSearchIntent } from './npcScene.js';
import { similarity } from './worldFacts.js';
import type { Attribute, RollResult } from './dice.js';
import type { CondicionFisica } from '@prisma/client';

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'arcano'];

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
  /// Bandas de tiempo (docs/08-acciones-por-tiempo.md § 2) — cuánto tarda la acción EN LA
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
  /// docs/10-niveles-xp-reino.md § 3.2: el modelo solo propone el TIPO de hito narrativo, el
  /// backend traduce a XP. "capitulo" no está aquí porque ese lo emite el backend, no el modelo.
  hito?: HitoTipo | null;
  /// docs/10-niveles-xp-reino.md § 5: eventos de Reino, uno por turno como mucho, poco frecuentes
  /// a propósito — el backend valida y materializa (mismo patrón que newItem/newCompanion).
  newTerritory?: { name: string; region?: string; description: string } | null;
  newBuilding?: { name: string; kind: string; description: string; territoryName?: string } | null;
  newSubject?: { name: string; role: string; notes: string; territoryName?: string } | null;
  /// docs/09-panel-personaje.md (pestaña Misiones): solo cuando la escena establece de verdad un
  /// objetivo narrativo con entidad propia (no cualquier intención pasajera) — mismo patrón que
  /// newTerritory/newBuilding/newSubject, el backend valida y materializa.
  newQuest?: { title: string; description: string } | null;
  /// Cierra una misión ACTIVA ya existente (matchea por título, backend valida que exista) —
  /// "completada" o "fallida" según cómo se resuelva en la narración.
  questProgress?: { title: string; status: 'COMPLETADA' | 'FALLIDA' } | null;
  /// docs/14-combate-y-muerte.md § 2.1: el Narrador marca esto cuando la escena deriva en un
  /// enfrentamiento real (no lo infiere el backend por regex, a diferencia de viajar/recolectar
  /// — un inicio de combate depende demasiado de contexto narrativo). `npcSlugs` viene acotado
  /// por enum a los NPCs ya detectados en escena (§ 2.5 de docs/12): el modelo nunca inventa uno.
  combateIniciado?: { npcSlugs: string[] } | null;
  /// docs/14-combate-y-muerte.md § 1: opcional, el backend valida con nextCondicionFisica()
  /// antes de aplicarla — nunca confía en este valor a ciegas.
  condicionFisica?: CondicionFisica | null;
}

interface TurnContext {
  worldFacts: string[];
  characterSummary: string;
  action: string;
  /// true si la recuperación de lore (RAG) no encontró nada realmente relevante para esta
  /// acción — en ese caso, exigir "no inventes nada" sin darle material real puede dejar al
  /// modelo sin forma de responder (hipótesis de la usuaria, 2026-07-18, tras un cuelgue
  /// reproducible en una acción de este tipo: "busca un lugar seguro para acampar", donde no
  /// tenemos ningún hecho sobre qué hace seguro un sitio concreto).
  weaklyGrounded?: boolean;
  /// docs/14-combate-y-muerte.md § 2.3: true dentro del popup de combate — cambia el tono a
  /// intercambios cortos y directos, y habilita que el Narrador proponga condicionFisica/
  /// combateIniciado con más margen (ver nextCondicionFisica en services/death.ts).
  enCombate?: boolean;
  /// Slugs de los NPCs ya detectados en escena (docs/12 § 2.5) — lista cerrada para el campo
  /// "combateIniciado.npcSlugs"; vacío = no hay NPC conocido, así que no puede haber combate.
  npcSlugsInScene?: string[];
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
  /// Ver `hasPrematureCombatResolution` más abajo — true cuando hay un NPC real en escena pero
  /// NINGÚN intercambio de combate se ha resuelto todavía este turno (ni ataque ni "Decapitar"),
  /// típicamente un turno de aceptación/promesa verbal ("Yo me ocupo de tu perseguidor"). Si la
  /// narración describe de todos modos un golpe ya conectado/un enemigo ya herido huyendo, es una
  /// alucinación adelantada del combate, no una licencia narrativa — se reintenta.
  combatNotYetResolved?: boolean;
  /// Ver `hasFalseItemUse` más abajo — nombres reales de objetos médicos/de energía que el
  /// personaje lleva encima PERO que este turno no se detectó que usara de verdad (ni
  /// `detectMedicalItemUse` ni `detectEnergyItemUse` los reconocieron en la acción del jugador).
  /// Si la narración de todos modos describe aplicárselos/consumirlos, es una alucinación — el
  /// objeto sigue intacto en el inventario y el jugador se lleva la falsa impresión de haberlo
  /// gastado (y de haberse curado) sin que ninguno de los dos pase de verdad. Vacío = no hace
  /// falta comprobar nada este turno (algún objeto SÍ se usó de verdad, o no hay ninguno médico/
  /// de energía en el inventario).
  possiblyFalseItemUseNames?: string[];
  /// Ver `hasResurrectedDeadNpc` más abajo — nombres reales de NPCs INCAPACITADO/MUERTO presentes
  /// este turno (ver `npcSceneBlockFor`, npcScene.ts: ya reciben la instrucción explícita "no lo
  /// narres como una amenaza activa... nunca un encuentro nuevo"). Bug documentado en el propio
  /// runbook del proyecto (docs/revisar-partida.md § "NPCs que resucitan") — un modelo pequeño a
  /// veces la ignora igual que ignoraba el resto de instrucciones "no hagas X" de esta lista.
  possiblyResurrectedNpcNames?: string[];
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
  /// es una revisión de inventario/equipo (`detectsInventoryReviewIntent`, turnResolution.ts).
  /// Vacío = no aplica este turno (no es una acción de revisar equipo, o el inventario tiene 0-1
  /// objetos y no hay nada real que omitir).
  possiblyFalseInventoryReviewNames?: string[];
}

interface ClassifyContext {
  characterSummary: string;
  action: string;
  /// Línea de calibración de dificultad cuando hay un NPC con nivel conocido en escena
  /// (docs/12-mundo-estructurado.md § 2.2) — el backend calcula la diferencia de nivel y le
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

/// Paso 1 del turno (decisión de mecánicas 2, docs/06-decisiones-mecanicas.md): decide si la
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
- Acción "Examino mis alrededores con cuidado" → { "requiereTirada": true, "atributo": "sigilo", "dificultad": 12, "razon": "Percepción rápida del entorno inmediato, sin desplazarse.", "banda": "instantanea", "duracionEstimadaMinutos": 0 }
- Acción "Descanso un rato antes de seguir" → { "requiereTirada": false, "atributo": "voluntad", "dificultad": 8, "razon": "Descanso breve sin duración explícita mayor.", "banda": "corta", "duracionEstimadaMinutos": 20 }
- Acción "Exploro la zona en busca de comida o rastros" → { "requiereTirada": true, "atributo": "sigilo", "dificultad": 12, "razon": "Recorrido a pie de una zona cercana ya conocida, sin viaje largo ni obra de construcción — no hay duración explícita, así que se estima corta.", "banda": "corta", "duracionEstimadaMinutos": 30 }
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
  try {
    const { text } = await callOllama();
    return JSON.parse(text) as ClassificationResult;
  } catch (err) {
    console.warn(`[clasificar] intento 1/2 falló, reintentando: ${err instanceof Error ? err.message : err}`);
    const { text } = await callOllama();
    return JSON.parse(text) as ClassificationResult;
  }
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
export async function generateNpcReply(ctx: NpcReplyContext): Promise<string> {
  const system =
    'Interpretas a UN SOLO personaje dentro de una escena de rol de mesa. Tu única tarea es escribir su respuesta HABLADA, en primera persona, a lo que el jugador le acaba de decir o preguntar — nunca la narración de la escena, ni acotaciones de gesto, ni el nombre del personaje delante. Responde solo con su réplica entre comillas, 1-2 frases, nada más.';

  const prompt = `PERSONAJE QUE ERES: ${ctx.npc.name} — ${ctx.npc.role}.
Personalidad: ${ctx.npc.personality}
Trasfondo: ${ctx.npc.bio}

HECHOS YA ESTABLECIDOS (no los contradigas ni reveles nada que no sepas todavía según tu propio trasfondo):
${factsBlock(ctx.sessionFacts)}

${ctx.characterName} te acaba de decir: "${ctx.action}"

Escribe SOLO tu réplica hablada, en primera persona y entre comillas, coherente con tu personalidad y tu trasfondo.`;

  const { text } = await ollamaGenerate({
    model: env.ollamaModelNarrador,
    system,
    prompt,
    // 120s (subido de 60s tras un fallo real en partida, 2026-07-23): probado en aislado, la
    // misma llamada tardó ~33s — pero en un turno real esta llamada se encola DETRÁS de la
    // narración principal (30-220s) en el mismo Ollama de concurrencia 1, y cambiar de `system`
    // en la misma sesión de modelo puede añadir latencia de recarga de contexto. 60s se quedaba
    // corto en la práctica; el turno principal ya usa 180s de margen para su propio intento 1.
    timeoutMs: 120_000,
    keepAlive: '1h',
    temperature: 0.4,
  });
  return text.trim();
}

/// Grados de éxito (docs/08-acciones-por-tiempo.md § 5, roadmap 2026-07-19): misma tirada de
/// siempre, tres lecturas narrativas en vez de éxito/fallo binario — "con coste" completa la
/// acción pero con un precio (tarda más, gasta un recurso, deja peor postura), distinto tanto de
/// un éxito limpio como de un fallo.
function rollBlockFor(roll: RollResult): string {
  const base = `RESULTADO YA RESUELTO — no lo cambies, narra en torno a él: tirada de ${roll.attribute} = ${roll.result} (dado ${roll.roll} + atributo) vs dificultad ${roll.difficulty} → `;
  if (roll.gradoExito === 'claro') {
    return `${base}ÉXITO CLARO. La narración TIENE que aportar algo concreto y útil que antes no sabíamos (una amenaza, un objeto, un rastro, una dirección, una pista) — nunca te quedes solo en ambientación sensorial sin ningún dato jugable.`;
  }
  if (roll.gradoExito === 'con_coste') {
    return `${base}ÉXITO CON COSTE. La acción SÍ se completa de verdad, pero con un precio narrativo — tarda más de lo esperado, gasta algo, deja al personaje en peor postura, o revela menos de lo que un éxito limpio habría dado. Nunca lo narres como un fallo ni como un éxito perfecto sin matices.`;
  }
  return `${base}FALLO. Puedes no revelar nada de interés, o revelar algo a medias/engañoso.`;
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
  // Emboscada determinista (bug real jugando, 2026-07-22): antes quién golpea primero era libre
  // albedrío total del modelo, incluso cuando ya existía una tirada resuelta para ESTA misma
  // acción de acercamiento/búsqueda hostil — se reutiliza su gradoExito en vez de inventar una
  // señal nueva o dejarlo a la prosa. Ver detectsHostileSearchIntent (npcScene.ts) para el hueco
  // real que esto tapa: "busco a X en busca de pelea" no lleva verbo de ataque literal.
  const hostileEngagement = !ctx.enCombate && npcSlugs.length > 0 && (detectsAttackIntent(ctx.action) || detectsHostileSearchIntent(ctx.action));
  const ambushHint =
    hostileEngagement && ctx.roll
      ? ctx.roll.gradoExito === 'claro'
        ? ' Tu personaje SORPRENDE al NPC — actúa/golpea primero, el NPC no llega a reaccionar en este turno.'
        : ctx.roll.gradoExito === 'fallo'
          ? ' El NPC te SORPRENDE A TI — actúa primero, tu personaje reacciona tarde.'
          : ' Ninguno sorprende al otro — ambos se preparan a la vez, en igualdad de condiciones.'
      : '';
  const combatBlock = ctx.enCombate
    ? 'ESTÁS DENTRO DE UN COMBATE (docs/14-combate-y-muerte.md § 2.3): narra en 1-2 frases, corto y directo, el intercambio de ESTE turno — nada de ambientación de relleno, es el ritmo de un choque, no una escena. Puedes proponer "condicionFisica" si el personaje sale herido de este intercambio (nunca lo cures aquí salvo que la acción sea explícitamente curarse).'
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
              `Si esta escena deriva en un enfrentamiento real (no solo tensión verbal), rellena "combateIniciado" con los NPCs implicados (usa exactamente los slugs ya listados, nunca inventes uno) — en caso contrario, null. DIÁLOGO (obligatorio si el jugador pregunta, saluda o dirige la palabra a un NPC en escena): ese NPC EXACTO — usa su nombre y personalidad reales de "PERSONAJE EN ESCENA" más abajo, nunca lo sustituyas por un rol genérico ni le cambies el sexo — tiene que responderle de verdad dentro de esta misma narración, hablando en primera persona entre comillas. Dejar la pregunta sin respuesta, resumirla en tercera persona genérica, o hacer que el propio personaje del jugador repita sus mismas palabras como si fueran la respuesta de otro, es un fallo grave. Si hay diálogo real (no solo tensión), puedes extenderte algo más de lo habitual para darle espacio a esa voz — no lo comprimas a una sola frase.`
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
  const fixedInstructions = `${lengthGuidance} NUNCA termines la narración con preguntas retóricas dirigidas al jugador (nada de "¿qué harás?", "¿te arriesgas?", "¿continúas?") ni le ofrezcas explícitamente una lista de opciones a elegir — eso lo decide el jugador con su siguiente acción libre, no el narrador proponiéndoselo. TONO DEL PERSONAJE DEL JUGADOR (auditoría 2026-08-12, "descolocación de tono" — bug real jugando en vivo: un acercamiento pacífico y explícito, manos vacías y en calma, se narró como si el personaje exigiera y desafiara): el tono/actitud que el jugador describe explícitamente en su propia acción (calma, cortesía, agresividad...) define cómo actúa y se comporta SU personaje en esta narración — nunca lo sustituyas por uno contrario. Esto no limita cómo reacciona el NPC: puede responder con su propia personalidad (hostil, huidizo, indiferente...) aunque el tono del jugador sea distinto — el tono ajeno del NPC no debe "contagiar" cómo se describe al personaje del jugador. RECORDATORIO DE MUNDO (mundo medieval-fantástico): JAMÁS menciones pólvora, armas de fuego, metal industrial, plástico, electricidad ni ningún objeto o tecnología moderna/anacrónica — ni como ambientación ni como detalle suelto. Si necesitas un olor o peligro genérico, usa algo coherente con el lugar (sudor, sangre, humo de leña, arcilla, azufre volcánico), nunca un cliché de videojuego moderno. No contradigas los hechos ya establecidos sobre el propio personaje (por ejemplo, si va solo, no le des compañeros, seguidores o un grupo propio que no existían antes) ni repitas como si fuera nuevo un lugar o hecho que ya aparece en HECHOS DEL MUNDO. Si la narración revela algo que el personaje ahora sabe o que cambia la situación, añádelo también a "newFacts" como frase corta, para que se recuerde en turnos futuros. Sí puedes improvisar libremente NPCs sin nombre o sucesos menores que no tengan peso en la trama (un viajero anónimo, un ruido, el clima) — pero si a cualquier NPC (con nombre o improvisado) le describes un arma, armadura o material, usa solo los ya establecidos en este mundo (hierro, hueso, cuero o piel curtida, madera, hielo sílice, arcilla): nunca inventes un material distinto (nada de bronce, acero, cobre, obsidiana ni ningún otro que no hayas visto ya en HECHOS DEL MUNDO). Igual con cualquier animal o criatura que aparezca (con nombre o improvisado): usa solo fauna ya establecida en este mundo (la que se te da como pista de posible encuentro, la ya vista en HECHOS DEL MUNDO, o el bestiario propio de este lugar) — nunca un animal mundano del mundo real que no exista aquí (zorro, ciervo, conejo, lobo, oso...). Solo si la acción resulta de verdad en que el personaje consigue o fabrica un objeto físico duradero (no algo que se consume o desaparece en la escena), rellena "newItem" con su nombre y descripción — en caso contrario déjalo en null; esto pasará en la minoría de turnos, no en cada uno. Igual para "newCompanion": solo si la acción resulta de verdad en ganar un aliado o compañero de verdad (nunca lo inventes de la nada ni contradigas que el personaje va solo), rellénalo con nombre/rol/notas; si no, déjalo en null.

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
  }
${combatBlock}`;

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
        enum: ['ILESO', 'HERIDO', 'GRAVE', 'INCAPACITADO', 'MUERTO', null],
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
      if (hasAnachronism(parsed.narration)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por anacronismo, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (isTooSimilarToLast(parsed.narration, ctx.lastNarrationText)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por repetir casi verbatim el turno anterior, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasEnglishLeak(parsed.narration)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por fuga de inglés, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasFalseCombatHit(parsed.narration, ctx.combatBothMissed)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar un golpe que no conectó (ataque_falla/parada_en_seco), reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasPrematureCombatResolution(parsed.narration, ctx.combatNotYetResolved)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar un combate ya resuelto sin ningún intercambio mecánico este turno, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasFalseItemUse(parsed.narration, ctx.possiblyFalseItemUseNames)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar el uso de un objeto que no se consumió de verdad, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasResurrectedDeadNpc(parsed.narration, ctx.possiblyResurrectedNpcNames)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar a un NPC incapacitado/muerto como si siguiera activo, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasGisteraReencuentroSinNombrar(parsed.narration, ctx.gisteraSeHaMarchado)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por reintroducir a Gistera Koh sin nombrarla pese a haberse marchado para siempre, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasFalseTravelClaim(parsed, ctx.possiblyFalseTravelDestinationNames)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar una llegada a un destino sin resolver mecánicamente (2+ salidas posibles), reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasFalsePhantomTravel(parsed, ctx.phantomTravelLocationNames)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar que abandona la ubicación actual sin ningún viaje resuelto mecánicamente (destino inventado/sin alias real), reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
        continue;
      }
      if (hasFalseInventoryReview(parsed.narration, ctx.possiblyFalseInventoryReviewNames)) {
        console.warn(`[narrador] intento ${idx + 1}/3 descartado por narrar una revisión de inventario incompleta como si fuera exhaustiva, reintentando`);
        if (idx === 0) ctx.onNarrationReset?.();
        lastResult = parsed;
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

export function deterministicFallbackNarration(ctx: { action: string; roll?: RollResult }): NarrationResult {
  const { action, roll } = ctx;
  const resultado = !roll
    ? 'La acción transcurre sin incidentes.'
    : roll.gradoExito === 'claro'
      ? 'La acción sale exactamente como se esperaba.'
      : roll.gradoExito === 'con_coste'
        ? 'La acción se completa, aunque no sale del todo limpia.'
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

/// Contrato de mundo (docs/07-mundo-helek-sirik.md § 9): medieval-fantástico, sin pólvora ni
/// tecnología industrial en ningún continente. Ya reforzado en el Modelfile — esto es la red de
/// seguridad determinista para cuando el modelo lo ignora de todos modos (visto en pruebas reales).
export const ANACHRONISM_REGEX =
  /p[óo]lvora|pistola|rifle|escopeta|pl[áa]stico|electricidad|el[ée]ctric[oa]|motor(?:\s+de)?\s+(?:combusti[óo]n|explosi[óo]n)|hormig[óo]n|acero industrial|tel[ée]fono|internet/i;

export function hasAnachronism(narration: string): boolean {
  return ANACHRONISM_REGEX.test(narration);
}

/// Fuga de inglés, red de seguridad determinista (2026-07-31, bug real probando en vivo: "el eco
/// de su own pisadas" — una palabra en inglés suelta en medio de una frase en español). Mismo
/// criterio que `hasAnachronism`/`stripNonLatinScript`: el Modelfile ya pide español, esto es la
/// red de seguridad para cuando el modelo lo ignora de todos modos. Lista deliberadamente corta y
/// conservadora — solo palabras función inglesas sin NINGÚN homónimo español real, para no
/// disparar con nombres propios o préstamos legítimos.
const ENGLISH_LEAK_REGEX = /\b(own|the|and|was|with|from)\b/i;

export function hasEnglishLeak(narration: string): boolean {
  return ENGLISH_LEAK_REGEX.test(narration);
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
// cuello del ave" en un turno de "Salgo a cazar y ataco a 'Buitre Cenizo'" (combate recién abierto,
// sin ningún intercambio mecánico todavía) se coló porque la lista solo cubría las formas en
// pasado/presente de cada verbo (`atraves[oó]`/`atraviesa`), nunca el gerundio — el mismo hueco
// existe en potencia para cualquier otro verbo de la lista ("golpeando", "hiriendo", "rebanando").
const COMBAT_HIT_LEAK_REGEX =
  /\b(golpe[oó]|golpeando|impact[oó]|impactando|hiri[oó]|hiere|hiriendo|atraves[oó]|atraviesa|atravesando|reban[oó]|rebanando|degüell[oa]|hace sangrar|rastro de sangre|l[ií]nea de sangre|sangrando|sangra por)\b/i;

export function hasFalseCombatHit(narration: string, combatBothMissed?: boolean): boolean {
  if (!combatBothMissed) return false;
  return COMBAT_HIT_LEAK_REGEX.test(narration);
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
const PREMATURE_COMBAT_REGEX =
  /\b(golpe[oó]|golpeando|impact[oó]|impactando|hiri[oó]|hiere|hiriendo|atraves[oó]|atraviesa|atravesando|reban[oó]|rebanando|degüell[oa]|acierta|huye (cojeando|malherid[oa]|herid[oa])|cojeando|atrap[oa]|atrapad[oa]|inmoviliz[oa]|inmovilizad[oa]|captur[oa]|capturad[oa])\b/i;

export function hasPrematureCombatResolution(narration: string, combatNotYetResolved?: boolean): boolean {
  if (!combatNotYetResolved) return false;
  return PREMATURE_COMBAT_REGEX.test(narration);
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

/// Narración-vs-mecánica, mismo patrón que `hasFalseCombatHit` (2026-08-01, bug real jugando en
/// vivo: descansar tras quedar INCAPACITADO no cura solo por descansar — hace falta un objeto
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

export function hasFalseItemUse(narration: string, possiblyFalseItemUseNames?: string[]): boolean {
  if (!possiblyFalseItemUseNames || possiblyFalseItemUseNames.length === 0) return false;
  const normalizedNames = possiblyFalseItemUseNames.map(normalizeText);
  return narration
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => {
      const normalizedSentence = normalizeText(sentence);
      return ITEM_CONSUMPTION_VERB_REGEX.test(normalizedSentence) && normalizedNames.some((name) => normalizedSentence.includes(name));
    });
}

/// Narración-vs-mecánica, mismo patrón que `hasFalseCombatHit`/`hasFalseItemUse` (2026-08-01,
/// bug real jugando en vivo — clase de fallo ya documentada en docs/revisar-partida.md § "NPCs que
/// resucitan"): con el Orco Enfurecido MUERTO y saqueado desde hacía varios turnos, un simple
/// "Exploro la zona" narró "una mirada al oeste revela un conjunto de huellas recientes... Gorhorn
/// reconoce el paso de un orco — probablemente el Orco Enfurecido" — implicando que sigue vivo y
/// merodeando. `npcSceneBlockFor` (npcScene.ts) YA le da al modelo la instrucción explícita de
/// tratarlo solo como "un cadáver ya visto, un recuerdo... nunca un encuentro nuevo" cuando está
/// INCAPACITADO/MUERTO, pero un modelo pequeño la ignora bajo la misma presión creativa que el
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
const RESURRECTION_LEAK_REGEX =
  /\b(huellas?\s+(recien\w*|frescas?)|rastro\s+reciente|reconoce el paso de|acaba de pasar|sigue\s+(con vida|vivo)|todav[ií]a\s+(con vida|vivo)|reaparece|vuelve a (atacar|aparecer|acercarse)|se acerca (de nuevo|otra vez)|se (lanza|abalanza|arroja)\s+(hacia|sobre|contra)|se (da la vuelta|gira|vuelve)\s+bruscamente|embiste|carga contra|arremete\s+(hacia|contra))\b/i;

export function hasResurrectedDeadNpc(narration: string, possiblyResurrectedNpcNames?: string[]): boolean {
  if (!possiblyResurrectedNpcNames || possiblyResurrectedNpcNames.length === 0) return false;
  const normalizedNames = possiblyResurrectedNpcNames.map(normalizeText);
  return narration
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => {
      const normalizedSentence = normalizeText(sentence);
      return RESURRECTION_LEAK_REGEX.test(normalizedSentence) && normalizedNames.some((name) => normalizedSentence.includes(name));
    });
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
const GISTERA_PERSECUCION_REGEX = /persigu\w*|persecucion\w*|jadea\w*|sin aliento|huy[eo]|huyendo|acecha\w*/i;

export function hasGisteraReencuentroSinNombrar(narration: string, gisteraSeHaMarchado?: boolean): boolean {
  if (!gisteraSeHaMarchado) return false;
  const normalized = normalizeText(narration);
  return GISTERA_CLAN_MENTION_REGEX.test(normalized) && GISTERA_PERSECUCION_REGEX.test(normalized);
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
  const sentences = [narration.narration, ...narration.newFacts].flatMap((text) => text.split(/(?<=[.!?])\s+/));
  return sentences.some((sentence) => {
    const normalizedSentence = normalizeText(sentence);
    return FALSE_TRAVEL_VERB_REGEX.test(normalizedSentence) && normalizedNames.some((name) => normalizedSentence.includes(name));
  });
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
  const sentences = [narration.narration, ...narration.newFacts].flatMap((text) => text.split(/(?<=[.!?])\s+/));
  return sentences.some((sentence) => {
    const normalizedSentence = normalizeText(sentence);
    return FALSE_TRAVEL_VERB_REGEX.test(normalizedSentence) && normalizedNames.some((name) => normalizedSentence.includes(name));
  });
}
