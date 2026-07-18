import { ollamaGenerate } from '../lib/ollama.js';
import { env } from '../config/env.js';
import type { Attribute, RollResult } from './dice.js';

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
}

interface ClassifyContext {
  characterSummary: string;
  action: string;
}

function factsBlock(facts: string[]): string {
  return facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(sin hechos previos registrados todavía)';
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

  const prompt = `PERSONAJE:
${ctx.characterSummary}

ACCIÓN DEL JUGADOR:
"${ctx.action}"

Clasifica esta acción para resolverla con una tirada de d20 + atributo/2 vs dificultad.
Dificultades posibles: 8 (trivial), 12 (fácil), 15 (media), 18 (difícil), 22 (muy difícil).

Además, clasifica cuánto tarda la acción DENTRO DE LA FICCIÓN (no el tiempo real que tardas en responder):
- "instantanea": segundos — examinar, hablar, atacar, esquivar, reaccionar.
- "corta": minutos — cortar leña un rato, buscar en una zona concreta, primeros auxilios.
- "extendida": horas — descanso corto, un tramo de viaje, vigilar un campamento.
- "larga": días o más — construir un campamento, viaje regional, curarse de una herida grave.
Da también "duracionEstimadaMinutos": 0 si es instantánea, si no tu mejor estimación en minutos (p. ej. 15 para cortar leña un rato, 240 para un descanso corto, 4320 para 3 días de viaje).

Responde solo con el JSON pedido, nada más.`;

  const format = {
    type: 'object',
    properties: {
      requiereTirada: { type: 'boolean' },
      atributo: { type: 'string', enum: ATTRIBUTES },
      dificultad: { type: 'number', enum: [8, 12, 15, 18, 22] },
      razon: { type: 'string' },
      banda: { type: 'string', enum: ['instantanea', 'corta', 'extendida', 'larga'] },
      duracionEstimadaMinutos: { type: 'number' },
    },
    required: ['requiereTirada', 'atributo', 'dificultad', 'razon', 'banda', 'duracionEstimadaMinutos'],
  };

  // keepAlive '0': descarga el modelo pequeño en cuanto clasifica, antes de que narrateAction
  // cargue el modelo grande justo después — nunca los dos a la vez en memoria.
  // timeoutMs 90s: nunca ha tardado más de ~54s en pruebas reales, deja margen de sobra.
  const { text } = await ollamaGenerate({
    model: env.ollamaModelCronista,
    system,
    prompt,
    format,
    keepAlive: '0',
    timeoutMs: 90_000,
  });
  return JSON.parse(text) as ClassificationResult;
}

/// Paso 2 del turno: narra con el resultado de la tirada ya fijado (o sin tirada si no hacía falta).
export async function narrateAction(ctx: TurnContext & { roll?: RollResult }): Promise<NarrationResult> {
  const rollBlock = ctx.roll
    ? `RESULTADO YA RESUELTO — no lo cambies, narra en torno a él: tirada de ${ctx.roll.attribute} = ${ctx.roll.result} (dado ${ctx.roll.roll} + atributo) vs dificultad ${ctx.roll.difficulty} → ${ctx.roll.success ? 'ÉXITO' : 'FALLO'}. En ÉXITO, la narración TIENE que aportar algo concreto y útil que antes no sabíamos (una amenaza, un objeto, un rastro, una dirección, una pista) — nunca te quedes solo en ambientación sensorial sin ningún dato jugable. En FALLO, puedes no revelar nada de interés, o revelar algo a medias/engañoso.`
    : 'Esta acción no necesita tirada — narra el resultado directamente, pero sigue aportando algo concreto: qué cambia, qué consigue o qué nota el personaje, no solo atmósfera.';

  const prompt = `HECHOS DEL MUNDO:
${factsBlock(ctx.worldFacts)}

PERSONAJE:
${ctx.characterSummary}

ACCIÓN DEL JUGADOR:
"${ctx.action}"

${rollBlock}

Narra en 1-3 frases breves lo que ocurre — directo, sin relleno, y con al menos un dato o consecuencia concreta (no solo describir el paisaje o las sensaciones). No contradigas los hechos ya establecidos sobre el propio personaje (por ejemplo, si va solo, no le des compañeros, seguidores o un grupo propio que no existían antes) ni repitas como si fuera nuevo un lugar o hecho que ya aparece en HECHOS DEL MUNDO. Si la narración revela algo que el personaje ahora sabe o que cambia la situación, añádelo también a "newFacts" como frase corta, para que se recuerde en turnos futuros. ${
    ctx.weaklyGrounded
      ? 'No tenemos hechos específicos sobre esto — describe el entorno o el resultado de forma genérica y creíble (terreno, clima, sensaciones), sin inventar fauna, personajes con nombre, clanes ni objetos con historia propia.'
      : 'No inventes fauna, flora, personajes con nombre, clanes ni objetos con historia propia que no aparezcan en HECHOS DEL MUNDO — usa solo lo que ahí se te da.'
  } Sí puedes improvisar libremente NPCs sin nombre o sucesos menores que no tengan peso en la trama (un viajero anónimo, un ruido, el clima). Solo si la acción resulta de verdad en que el personaje consigue o fabrica un objeto físico duradero (no algo que se consume o desaparece en la escena), rellena "newItem" con su nombre y descripción — en caso contrario déjalo en null; esto pasará en la minoría de turnos, no en cada uno. Igual para "newCompanion": solo si la acción resulta de verdad en ganar un aliado o compañero de verdad (nunca lo inventes de la nada ni contradigas que el personaje va solo), rellénalo con nombre/rol/notas; si no, déjalo en null.

Progresión: si este turno logra algo significativo que no sea solo superar la tirada (un descubrimiento importante, cerrar un objetivo menor, cerrar un objetivo mayor/misión larga), rellena "hito" con "descubrimiento", "objetivo_menor" u "objetivo_mayor" — en caso contrario, null. Esto es poco frecuente, no pasa en cada turno.

Reino: solo si la acción resulta de verdad en que el personaje reclama un territorio, termina de construir un edificio, o gana un súbdito con nombre que sirve a su dominio (no un compañero de viaje personal, eso es "newCompanion"), rellena el campo correspondiente ("newTerritory", "newBuilding" o "newSubject") — el resto de turnos, todos en null. Muy poco frecuente.

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
    },
    required: ['narration', 'newFacts'],
  };

  // Tres intentos en cascada. Visto en pruebas reales (2026-07-18): una acción concreta colgó
  // 4 de 4 veces con el modelo grande, incluso reduciendo hechos y relajando la regla de "no
  // inventes" — no es un problema de contexto, parece un cuelgue real del motor de gramática de
  // Ollama con ese texto en concreto. Sin forma de arreglar la causa desde aquí, así que la red
  // de seguridad es: intentarlo dos veces con el grande y, si ambas fallan, caer al modelo
  // pequeño — peor prosa, pero el turno no se pierde del todo.
  const attempt1 = () =>
    ollamaGenerate({ model: env.ollamaModelNarrador, prompt, format, maxTokens: 220, timeoutMs: 180_000 });

  const attempt2 = () => {
    // Si fue timeout (no solo JSON cortado), reducir los hechos es la mitigación más razonable
    // sin saber la causa exacta — no ha demostrado arreglar el cuelgue visto, pero tampoco hace daño.
    const retryFacts = ctx.worldFacts.slice(0, 2);
    const retryPrompt = prompt.replace(factsBlock(ctx.worldFacts), factsBlock(retryFacts));
    return ollamaGenerate({ model: env.ollamaModelNarrador, prompt: retryPrompt, format, timeoutMs: 240_000 });
  };

  const attempt3 = () =>
    ollamaGenerate({
      model: env.ollamaModelCronista,
      prompt,
      format,
      maxTokens: 220,
      timeoutMs: 90_000,
      keepAlive: '0',
    });

  for (const attempt of [attempt1, attempt2, attempt3]) {
    try {
      const { text } = await attempt();
      return JSON.parse(text) as NarrationResult;
    } catch {
      continue;
    }
  }

  throw new Error('El Narrador no pudo resolver este turno tras tres intentos (modelo grande x2 + modelo pequeño).');
}
