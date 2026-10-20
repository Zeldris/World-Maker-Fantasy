import { env } from '../config/env.js';
import { ollamaGenerate } from '../lib/ollama.js';
import type { DynamicModeTipo } from './dynamicMode.js';
import { hasCombatVocabulary, hasSecondPersonLeak, hasHumanRaceLeak } from './narrador.js';

/// Narración por LLM de UNA vuelta del "modo dinámico" (2026-08-27, Pieza 4 de "Dinamismo del
/// mundo") — deliberadamente MÁS SIMPLE que `narrador.ts` § `narrateAction`/`buildNarrationPrompt`
/// (mismo criterio que `combateMultipleNarracion.ts`): el motor YA decidió quién es el candidato y
/// en qué vuelta va, el LLM solo redacta la escena y propone 2-3 opciones concretas para que el
/// jugador elija (nunca texto libre dentro del modo dinámico — mismo espíritu que el resto de
/// "mundo determinista": la narración describe, no decide). `respuestaJugador` viene vacío en la
/// primera vuelta (el juego abre la interacción); en vueltas siguientes es la opción que el
/// jugador ya eligió.
export interface DynamicModeTurnoInput {
  tipo: DynamicModeTipo;
  targetName: string;
  vuelta: number;
  maxVueltas: number;
  characterSummary: string;
  respuestaJugador: string | null;
  /// Bio real de catálogo del NPC/fauna, si existe (2026-08-27, bug real jugando en vivo: sin
  /// esto el LLM inventaba lugares/eventos de la nada, ej. una "Isla Cambiante" que no existe en
  /// ningún dato real — `characterSummary` solo describe al PERSONAJE del jugador, nunca a con
  /// quién está interactuando). Solo se pasa en la primera vuelta (`interactuar` la consulta una
  /// vez y la persiste dentro de `PendingDynamicMode` para vueltas siguientes, ver dynamicMode.ts).
  targetBio?: string | null;
  /// Nombre + descripción de la Location actual del jugador, mismo motivo que `targetBio` — sin
  /// esto tampoco hay ningún anclaje real de DÓNDE ocurre la interacción.
  locationContext?: { name: string; description: string } | null;
  /// "¿Quién ve a quién primero?" (2026-09-17, petición explícita de Álvaro: "si lo encuentro me
  /// describe lo que se ve... si me ve él a mí, él decide cómo interactuar conmigo") — tirada
  /// Destreza vs Destreza (`quienIniciaEncuentro`, zonaPosicion.ts) resuelta en `detectarEncuentroEnCelda`
  /// (zona.ts) al disparar `dynamicModeOffer`. Solo cambia el FRAMING de `apertura` en la primera
  /// vuelta, nunca el resultado mecánico (agresivo/enemigo sigue forzando combate igual). `undefined`
  /// en vueltas siguientes (no aplica, ya se decidió en la primera) y en el guion 100% determinista
  /// de Gistera (`narrarVueltaGistera`, sin LLM, no pasa por este prompt).
  quienInicia?: 'jugador' | 'npc';
}

const NARRATION_FORMAT = {
  type: 'object',
  properties: {
    narration: { type: 'string' },
    opciones: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    cierra: { type: 'boolean' },
  },
  required: ['narration', 'opciones', 'cierra'],
} as const;

export interface DynamicModeTurnoOutput {
  narration: string;
  opciones: string[];
  cierra: boolean;
}

/// Tiempo verbal (bug real, ronda 2 de pruebas autónomas 2026-09-05): una vuelta de modo dinámico
/// narró en FUTURO ("un kirelon-arenoso emergerá... se asomarán... se tambalearán") en vez del
/// presente narrativo que usan siempre las demás vueltas de la misma interacción — la escena ya
/// está ocurriendo, nunca es una promesa a futuro. Acotado a este archivo (no a narrador.ts
/// general): el modo dinámico nunca incluye diálogo citado con promesas futuras ("iré mañana"),
/// así que aquí el futuro simple nunca es legítimo — un guard tan amplio sí arriesgaría falsos
/// positivos en el resto del juego (diálogo de NPC, planes del personaje), por eso queda local.
/// Cubre las terminaciones inequívocas del futuro simple regular (3ª persona singular/plural, las
/// únicas que puede usar una narración en 3ª persona): -ará/-erá/-irá, -arán/-erán/-irán. La tilde
/// en la á NUNCA es opcional — un primer intento con `[aá]` (acento opcional) disparaba en falso
/// contra "Gist**era** Koh" (sustantivo, sin relación con el futuro) porque "era" sin tilde matchea
/// igual que "erá"; el futuro simple español siempre lleva tilde en esta sílaba, así que exigirla
/// elimina el falso positivo sin perder ningún caso real. `\b` tampoco sirve de límite derecho aquí
/// — en JS, sin soporte nativo de `\w` unicode-aware, no reconoce "á" como carácter de palabra y
/// falla justo tras la vocal acentuada — de ahí `(?!\p{L})` en su lugar.
const FUTURE_TENSE_REGEX = /\p{L}+(?:ar|er|ir)á(?:n)?(?!\p{L})/iu;

export function hasFutureTenseLeak(narration: string): boolean {
  return FUTURE_TENSE_REGEX.test(narration);
}

/// Capacidad de comunicación (bug real reincidente — visto primero 2026-08-27 con un
/// kirelon-arenoso "respondiendo" a "Preguntarle...", y de nuevo en la ronda de pruebas de
/// verificación en vivo 2026-09-05 con un gesgurio ofreciendo "Intentar comunicarte con gesgurio").
/// El prompt ya le pide explícitamente al modelo que FAUNA nunca hable (`capacidadHint` más abajo),
/// pero un modelo pequeño la ignora bajo presión narrativa — mismo patrón exacto que ya obligó a
/// guards deterministas para persona gramatical/fuga de "humanos"/tiempo verbal en este mismo
/// archivo. `input.tipo` ('NPC' | 'FAUNA') YA es la señal de catálogo que distingue quién puede
/// comunicarse hablando — este guard solo verifica que el OUTPUT del modelo la respeta de verdad,
/// tanto en las opciones ofrecidas al jugador como en la propia narración (por si describe a la
/// fauna "respondiendo" o "diciendo" algo). Acotado a FAUNA — un NPC con nombre propio sí puede
/// hablar, ese camino nunca dispara este guard.
const COMMUNICATION_VERBS_REGEX =
  /\b(habla(r|ndo)?|hablas|dice(ndo)?|dijo|responde(r|ndo)?|contesta(r|ndo)?|pregunta(r(le|se)?|ndo)?|comunica(r(te|le)?|ndo)?|conversa(r|ndo)?|charla(r|ndo)?|dialoga(r|ndo)?)\b/i;

export function hasFalseFaunaCommunication(tipo: DynamicModeTipo, narration: string, opciones: string[]): boolean {
  if (tipo !== 'FAUNA') return false;
  if (COMMUNICATION_VERBS_REGEX.test(narration)) return true;
  return opciones.some((o) => COMMUNICATION_VERBS_REGEX.test(o));
}

export function buildDynamicModeTurnoPrompt(input: DynamicModeTurnoInput): { prompt: string; format: object } {
  const quien = input.tipo === 'NPC' ? `el NPC ${input.targetName}` : `${input.targetName} (fauna presente en la zona)`;
  // "¿Quién ve a quién primero?" (2026-09-17) — sin dato (`undefined`, vueltas siguientes o guion
  // determinista) se mantiene el criterio de siempre: el NPC/fauna busca la interacción. Con dato,
  // el framing se invierte cuando gana el jugador — es él quien encuentra/observa primero.
  const apertura = input.respuestaJugador
    ? `El jugador ya respondió: "${input.respuestaJugador}".`
    : input.quienInicia === 'jugador'
      ? `Esta es la primera vuelta — el jugador es quien encuentra/observa primero a ${quien}, todavía sin haber sido visto ni haber dicho o hecho nada — describe lo que el jugador percibe al toparse con la escena, no una reacción de ${quien} hacia él.`
      : `Esta es la primera vuelta — el juego toma la iniciativa, ${quien} es quien busca la interacción, el jugador no ha dicho nada todavía.`;
  const cierreHint =
    input.vuelta >= input.maxVueltas
      ? 'Esta es la ÚLTIMA vuelta posible — "cierra" debe ser true, resuelve la interacción de forma natural aunque el jugador no haya zanjado nada.'
      : 'Si la interacción ya llega a una resolución natural (el jugador decide algo concreto: aceptar, rechazar, atacar, alejarse...), pon "cierra": true. Si conviene una vuelta más, "cierra": false.';
  // Bug real jugando en vivo (2026-08-27): sin esta instrucción explícita, el LLM generaba
  // opciones de diálogo ("Preguntarle...") para fauna sin capacidad de hablar (un kirelon-arenoso
  // "respondía" preguntas como si fuera un NPC) — el único lugar que distinguía el tipo era el
  // sustantivo de `quien`, insuficiente para restringir el comportamiento esperado.
  const capacidadHint =
    input.tipo === 'FAUNA'
      ? `${input.targetName} es un animal — NUNCA habla ni entiende lenguaje humano. Sus opciones deben ser sobre comportamiento animal observable (acercarse con cautela, ofrecerle comida, ahuyentarlo, ignorarlo, observarlo de lejos...), nunca sobre preguntarle o hablar con él.`
      : `${input.targetName} es una persona — puede hablar, responder preguntas y tener intenciones propias.`;
  // Bug real jugando en vivo (2026-08-27, "habla de una isla y más cosas... hay que darle mucho
  // más contenido determinista para que no invente"): sin datos reales de quién es el
  // NPC/fauna ni dónde está el jugador, el LLM rellenaba el hueco inventando lugares/hechos que no
  // existen en ningún dato real del mundo. Ambos bloques son opcionales (no siempre hay bio de
  // catálogo o Location resuelta) — cuando faltan, se cae al comportamiento anterior sin bloque.
  const contextoReal = [
    input.targetBio ? `Sobre ${input.targetName}: ${input.targetBio}` : null,
    input.locationContext ? `Lugar actual — ${input.locationContext.name}: ${input.locationContext.description}` : null,
  ]
    .filter((line): line is string => !!line)
    .join('\n')
  const contextoBloque = contextoReal ? `\n${contextoReal}\n` : ''

  const prompt = `${input.characterSummary}

MODO DINÁMICO — mini-interacción puntual con ${quien}, vuelta ${input.vuelta} de ${input.maxVueltas} como máximo. Nunca sustituye un combate: si la escena deriva en pelea real, descríbelo y pon "cierra": true (el turno normal se encargará del combate después).

${capacidadHint}
${contextoBloque}
${apertura}

Narra en 1-2 frases cortas qué pasa en esta vuelta, ANCLADA en los datos reales de arriba (quién es ${input.targetName} y dónde está el jugador) — nunca inventes lugares, objetos, sucesos o motivos que no vengan ya de ese contexto o del resumen del personaje. Después, propón entre 2 y 3 opciones concretas y breves (verbos de acción, ej. "Aceptar la oferta", "Preguntar por el camino", "Rechazar y seguir tu camino") que el jugador pueda elegir para responder. ${cierreHint}`;

  return { prompt, format: NARRATION_FORMAT };
}

/// Frase de color sin LLM (mismo criterio que `deterministicExchangeNarration`,
/// combateMultipleNarracion.ts) — solo si las 2 llamadas reales fallan, nunca como primera opción.
///
/// Bug real jugando en vivo (2026-09-08, encuentro con Gistera Koh — ver memoria
/// tarkor_hallazgo_dialogo_gistera_sin_persistir): este texto es FIJO, idéntico sin importar la
/// vuelta — cuando Ollama fallaba 2 veces seguidas en una vuelta AVANZADA (p.ej. justo tras el
/// jugador elegir "Aceptar la oferta"), el fallback devolvía el mismo "se acerca, con intención de
/// hablar" que ya se había narrado en la vuelta 2, sin reconocer en absoluto que el jugador acababa
/// de responder algo — parecía que el juego "olvidaba" la aceptación. Ahora el fallback SÍ
/// distingue: sin respuesta previa (vuelta 1, la apertura de siempre) usa el texto genérico de
/// apertura; con `respuestaJugador` ya presente, cierra la interacción reconociendo la elección en
/// vez de repetir la apertura — evita el "estancamiento" visible y, al forzar `cierra: true`, deja
/// que el turno normal retome la iniciativa en vez de arrastrar una conversación que Ollama no
/// pudo narrar dos veces seguidas.
export function deterministicDynamicModeTurno(input: DynamicModeTurnoInput): DynamicModeTurnoOutput {
  const quien = input.targetName;
  if (input.respuestaJugador) {
    return {
      narration:
        input.tipo === 'NPC'
          ? `${quien} asiente ante la respuesta y la conversación llega a su fin por ahora.`
          : `${quien} reacciona a la presencia y se aleja, dando por terminado el encuentro.`,
      opciones: [],
      cierra: true,
    };
  }
  return {
    // 3ª persona real (bug propio encontrado 2026-09-03 al escribir el test del guard nuevo de
    // persona gramatical): "hablar contigo"/"lo que hagas" son fugas a 2ª persona en el propio
    // texto de fallback determinista — invisibles hasta ahora porque nunca se ejercitaba con
    // hasSecondPersonLeak, y en la práctica el LLM casi siempre acierta antes de agotar los 2
    // intentos (este texto solo se ve si Ollama falla dos veces seguidas).
    narration: input.tipo === 'NPC' ? `${quien} se acerca, con intención de hablar.` : `${quien} anda cerca, atento a la escena.`,
    opciones: ['Acercarte', 'Ignorarlo y seguir tu camino'],
    cierra: input.vuelta >= input.maxVueltas,
  };
}

/// 2 intentos reales contra Ollama antes de caer al texto determinista — mismo criterio que
/// `narrarTurnoCombateMultiple`.
export async function narrarVueltaModoDinamico(input: DynamicModeTurnoInput): Promise<DynamicModeTurnoOutput> {
  const { prompt, format } = buildDynamicModeTurnoPrompt(input);
  for (let intento = 0; intento < 2; intento++) {
    try {
      const { text } = await ollamaGenerate({
        model: env.ollamaModelNarrador,
        prompt,
        format,
        maxTokens: 220,
        timeoutMs: 90_000,
        keepAlive: '1h',
        temperature: 0.7,
        tarea: 'modo_dinamico',
      });
      const parsed = JSON.parse(text) as Partial<DynamicModeTurnoOutput>;
      const narration = (parsed.narration ?? '').trim();
      const opciones = Array.isArray(parsed.opciones) ? parsed.opciones.map((o) => String(o).trim()).filter(Boolean) : [];
      // Persona gramatical (checklist-pruebas-juego.md: "confirmado en vivo que el modelo pequeño
      // la ignora", mismo hueco ya cerrado en narrateAction con hasSecondPersonLeak) — este flujo
      // tiene su propio narrador separado (nunca pasa por narrador.ts § narrateAction), así que
      // necesita su propio guard. Descarta el intento entero (no solo lo marca) y deja que el
      // bucle de reintento pruebe otra vez, mismo criterio que el resto de validadores en cascada.
      if (narration && hasSecondPersonLeak(narration)) continue;
      if (narration && hasHumanRaceLeak(narration)) continue;
      if (narration && hasFutureTenseLeak(narration)) continue;
      if (narration && hasFalseFaunaCommunication(input.tipo, narration, opciones)) continue;
      if (narration && opciones.length >= 2) {
        // "Nunca sustituye un combate" (prompt, arriba) es solo una instrucción — un modelo pequeño
        // puede narrar un golpe real conectando sin marcar "cierra": true por su cuenta (mismo
        // patrón frágil ya visto en otras instrucciones de "no hagas X" de este proyecto). Guard
        // determinista: vocabulario de golpe real fuerza el cierre igual, sin depender del LLM.
        const cierra = Boolean(parsed.cierra) || input.vuelta >= input.maxVueltas || hasCombatVocabulary(narration);
        return { narration, opciones: opciones.slice(0, 3), cierra };
      }
    } catch {
      // Reintenta en la siguiente vuelta del bucle; tras la última, cae al determinista de abajo.
    }
  }
  return deterministicDynamicModeTurno(input);
}
