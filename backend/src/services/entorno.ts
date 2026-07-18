import { ollamaGenerate } from '../lib/ollama.js';
import { env } from '../config/env.js';

export interface SurroundingsContext {
  worldFacts: string[];
  characterSummary: string;
  timeLabel: string;
}

export interface SurroundingsResult {
  description: string;
  event: string;
}

function factsBlock(facts: string[]): string {
  return facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(sin hechos previos registrados todavía)';
}

/// Panel "El mundo" (v1, ver conversación de producto): en vez de simular sucesos lejanos,
/// describe el entorno inmediato del personaje (clima, luz, posición del sol, sonidos) a
/// intervalos regulares. El backend decide con su propia probabilidad si además hay un
/// encuentro — el modelo solo redacta, nunca decide si "de vez en cuando" toca o no.
/// Usa el modelo pequeño (Cronista): es ambientación breve, no narración de un turno jugado.
export async function generateSurroundings(ctx: SurroundingsContext): Promise<SurroundingsResult> {
  const rollEvent = Math.random() < 0.25;

  const system =
    'Eres el narrador de ambientación de un juego de rol. Describes el entorno inmediato del personaje: clima, luz, posición del sol o de los astros, sonidos, terreno. Eres breve y evocador, nunca decides tú si pasa algo salvo que se te pida explícitamente.';

  const prompt = `HECHOS DEL MUNDO:
${factsBlock(ctx.worldFacts)}

PERSONAJE Y SITUACIÓN:
${ctx.characterSummary}

MOMENTO: ${ctx.timeLabel}

Describe en 1-2 frases el entorno inmediato del personaje ahora mismo: clima, luz/posición del sol o los astros, sonidos, terreno. Sin acción, solo ambientación.
${
  rollEvent
    ? 'Además, incluye un evento o encuentro breve e inesperado apropiado al tono del mundo (una amenaza, un hallazgo, una presencia) que interrumpa la calma — en 1 frase, terminando de forma que invite a reaccionar.'
    : 'No incluyas ningún evento ni encuentro — solo ambientación tranquila.'
}
Responde solo con el JSON pedido, nada más.`;

  const format = {
    type: 'object',
    properties: {
      description: { type: 'string' },
      event: { type: 'string' },
    },
    required: ['description', 'event'],
  };

  const { text } = await ollamaGenerate({ model: env.ollamaModelCronista, system, prompt, format, timeoutMs: 90_000 });
  const parsed = JSON.parse(text) as SurroundingsResult;
  return { description: parsed.description, event: rollEvent ? parsed.event : '' };
}
