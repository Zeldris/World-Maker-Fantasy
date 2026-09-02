import { env } from '../config/env.js';
import { ollamaGenerate } from '../lib/ollama.js';
import type { DynamicModeTipo } from './dynamicMode.js';
import { hasCombatVocabulary, hasSecondPersonLeak } from './narrador.js';

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

export function buildDynamicModeTurnoPrompt(input: DynamicModeTurnoInput): { prompt: string; format: object } {
  const quien = input.tipo === 'NPC' ? `el NPC ${input.targetName}` : `${input.targetName} (fauna presente en la zona)`;
  const apertura = input.respuestaJugador
    ? `El jugador ya respondió: "${input.respuestaJugador}".`
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
export function deterministicDynamicModeTurno(input: DynamicModeTurnoInput): DynamicModeTurnoOutput {
  const quien = input.targetName;
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
