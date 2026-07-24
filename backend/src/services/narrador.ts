import { ollamaGenerate, ollamaGenerateStream } from '../lib/ollama.js';
import { extractStreamingNarration } from './narrationStream.js';
import { env } from '../config/env.js';
import { normalizeText, levenshtein } from './travel.js';
import { detectsAttackIntent, detectsHostileSearchIntent } from './npcScene.js';
import type { Attribute, RollResult } from './dice.js';
import type { CondicionFisica } from '@prisma/client';

const ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'sigilo', 'voluntad', 'carisma', 'arcano'];

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
  const words = normalized.split(/\s+/).filter((w) => w.length >= 5);
  return REINO_INTENT_STEMS.some((stem) => words.some((w) => levenshtein(w, stem) <= 2));
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
export async function narrateAction(ctx: TurnContext & { roll?: RollResult }): Promise<NarrationResult> {
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
  const fixedInstructions = `${lengthGuidance} NUNCA termines la narración con preguntas retóricas dirigidas al jugador (nada de "¿qué harás?", "¿te arriesgas?", "¿continúas?") ni le ofrezcas explícitamente una lista de opciones a elegir — eso lo decide el jugador con su siguiente acción libre, no el narrador proponiéndoselo. RECORDATORIO DE MUNDO (mundo medieval-fantástico): JAMÁS menciones pólvora, armas de fuego, metal industrial, plástico, electricidad ni ningún objeto o tecnología moderna/anacrónica — ni como ambientación ni como detalle suelto. Si necesitas un olor o peligro genérico, usa algo coherente con el lugar (sudor, sangre, humo de leña, arcilla, azufre volcánico), nunca un cliché de videojuego moderno. No contradigas los hechos ya establecidos sobre el propio personaje (por ejemplo, si va solo, no le des compañeros, seguidores o un grupo propio que no existían antes) ni repitas como si fuera nuevo un lugar o hecho que ya aparece en HECHOS DEL MUNDO. Si la narración revela algo que el personaje ahora sabe o que cambia la situación, añádelo también a "newFacts" como frase corta, para que se recuerde en turnos futuros. Sí puedes improvisar libremente NPCs sin nombre o sucesos menores que no tengan peso en la trama (un viajero anónimo, un ruido, el clima) — pero si a cualquier NPC (con nombre o improvisado) le describes un arma, armadura o material, usa solo los ya establecidos en este mundo (hierro, hueso, cuero o piel curtida, madera, hielo sílice, arcilla): nunca inventes un material distinto (nada de bronce, acero, cobre, obsidiana ni ningún otro que no hayas visto ya en HECHOS DEL MUNDO). Solo si la acción resulta de verdad en que el personaje consigue o fabrica un objeto físico duradero (no algo que se consume o desaparece en la escena), rellena "newItem" con su nombre y descripción — en caso contrario déjalo en null; esto pasará en la minoría de turnos, no en cada uno. Igual para "newCompanion": solo si la acción resulta de verdad en ganar un aliado o compañero de verdad (nunca lo inventes de la nada ni contradigas que el personaje va solo), rellénalo con nombre/rol/notas; si no, déjalo en null.

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
    : 'No inventes fauna, flora, personajes con nombre, clanes ni objetos con historia propia que no aparezcan en HECHOS DEL MUNDO — usa solo lo que ahí se te da.';

  const prompt = `${fixedInstructions}

PERSONAJE:
${ctx.characterSummary}

HECHOS DEL MUNDO:
${factsBlock(ctx.worldFacts)}
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
      timeoutMs: 180_000,
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
    const retryPrompt = prompt.replace(factsBlock(ctx.worldFacts), factsBlock(retryFacts));
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
      if (!hasAnachronism(parsed.narration)) return parsed;
      console.warn(`[narrador] intento ${idx + 1}/3 descartado por anacronismo, reintentando`);
      if (idx === 0) ctx.onNarrationReset?.();
      lastResult = parsed;
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
const ANACHRONISM_REGEX =
  /p[óo]lvora|pistola|rifle|escopeta|pl[áa]stico|electricidad|el[ée]ctric[oa]|motor(?:\s+de)?\s+(?:combusti[óo]n|explosi[óo]n)|hormig[óo]n|acero industrial|tel[ée]fono|internet/i;

function hasAnachronism(narration: string): boolean {
  return ANACHRONISM_REGEX.test(narration);
}
