import { env } from '../config/env.js';
import { ollamaGenerate } from '../lib/ollama.js';
import { hasFalseCombatHit, hasFalseCombatMiss, hasFalseUnconsciousNarration, hasFalseDeathClaim } from './narrador.js';

/// Grupo 3 § Combate múltiple (2026-08-25) — narración por LLM de UN turno individual dentro de
/// una ronda con varios combatientes (decisión explícita de la usuaria, con el dato real de
/// latencia sobre la mesa: "cada turno por el LLM por ahora, lo valoro jugando y si no en el
/// futuro lo pasamos a determinista"). Deliberadamente MÁS SIMPLE que `narrador.ts` §
/// `narrateAction`/`buildNarrationPrompt`: no hay texto libre del jugador que clasificar, el
/// desenlace mecánico (quién golpea a quién, con qué habilidad, qué pasa) ya está completamente
/// decidido — esto solo lo describe en un par de frases.
///
/// Reutiliza los 4 guards narración-vs-mecánica que ya existen en narrador.ts (hasFalseCombatHit/
/// hasFalseCombatMiss/hasFalseUnconsciousNarration/hasFalseDeathClaim) en vez de inventar unos
/// nuevos — son genéricos (texto + booleano), no dependen de que la narración venga del pipeline
/// principal. **Primer corte, no tan endurecido como narrateAction todavía**: ese pipeline llegó a
/// su forma actual tras un mes real de bugs encontrados jugando (2026-07-22 → 2026-08-22) — esta
/// pieza es nueva, espera el mismo tipo de ajuste con partidas reales, no un cierre definitivo.
export interface TurnoNarracionInput {
  atacanteNombre: string;
  defensorNombre: string;
  habilidadNombre: string;
  /// Ya construido por `exchangeContextBlock`/`independentExchangeContextBlock`
  /// (combatExchange.ts) — mismo texto "YA RESUELTO, no lo cambies" que usa el pipeline principal,
  /// reutilizado tal cual en vez de reconstruir la lógica de desenlace aquí.
  exchangeBlock: string;
  /// Los 4 flags que ya consumen los guards reutilizados — el caller (el orquestador de ronda,
  /// todavía sin construir) es quien sabe el desenlace real y se los pasa ya calculados.
  combatBothMissed: boolean;
  combatRealHitLanded: boolean;
  defensorQuedaConvalecienteEsteTurno: boolean;
  defensorMuereEsteTurno: boolean;
}

const NARRATION_FORMAT = {
  type: 'object',
  properties: { narration: { type: 'string' } },
  required: ['narration'],
} as const;

export function buildExchangeNarrationPrompt(input: TurnoNarracionInput): { prompt: string; format: object } {
  const prompt = `${input.exchangeBlock}

Habilidad usada: "${input.habilidadNombre}".

Narra en UNA sola frase corta y directa qué pasa en este intercambio entre ${input.atacanteNombre} y ${input.defensorNombre} — nada de ambientación, solo la acción concreta ya resuelta arriba. No inventes ningún dato nuevo (objetos, aliados, lugares) — esto es un turno de combate, nada más.`;
  return { prompt, format: NARRATION_FORMAT };
}

/// Frase de color sin LLM (mismo criterio que el "adorno de ramas deterministas" ya usado en otro
/// sistema de este proyecto) — se usa solo si las 2 llamadas reales fallan o violan un guard,
/// nunca como primera opción: sigue siendo mejor un texto genérico honesto que una alucinación.
export function deterministicExchangeNarration(input: TurnoNarracionInput): string {
  if (input.defensorMuereEsteTurno) return `${input.atacanteNombre} acaba con ${input.defensorNombre} de un golpe definitivo.`;
  if (input.defensorQuedaConvalecienteEsteTurno) return `${input.atacanteNombre} deja a ${input.defensorNombre} sin fuerzas para seguir luchando.`;
  if (input.combatBothMissed) return `${input.atacanteNombre} y ${input.defensorNombre} intercambian golpes, ninguno conecta de verdad.`;
  if (input.combatRealHitLanded) return `${input.atacanteNombre} golpea a ${input.defensorNombre}, que acusa el impacto.`;
  return `${input.atacanteNombre} se enfrenta a ${input.defensorNombre} en un nuevo choque.`;
}

function violaAlgunGuard(narration: string, input: TurnoNarracionInput): boolean {
  return (
    hasFalseCombatHit(narration, input.combatBothMissed) ||
    hasFalseCombatMiss(narration, input.combatRealHitLanded) ||
    hasFalseUnconsciousNarration(narration, input.defensorQuedaConvalecienteEsteTurno) ||
    hasFalseDeathClaim(narration, !input.defensorMuereEsteTurno)
  );
}

/// 2 intentos reales contra Ollama (mismo criterio de "comprobación post-hoc + reintento" ya
/// establecido en este proyecto, ver memoria `tarkor_antirepeticion_reintento`) antes de caer al
/// texto determinista — nunca más de 2, cada intento ya cuesta 30-220s reales (narrador.ts),
/// encadenar más alargaría una ronda con varios combatientes todavía más de lo que ya alarga.
export async function narrarTurnoCombateMultiple(input: TurnoNarracionInput): Promise<string> {
  const { prompt, format } = buildExchangeNarrationPrompt(input);
  for (let intento = 0; intento < 2; intento++) {
    try {
      const { text } = await ollamaGenerate({
        model: env.ollamaModelNarrador,
        prompt,
        format,
        maxTokens: 120,
        timeoutMs: 90_000,
        keepAlive: '1h',
        temperature: 0.65,
      });
      const parsed = JSON.parse(text) as { narration?: string };
      const narration = (parsed.narration ?? '').trim();
      if (narration && !violaAlgunGuard(narration, input)) return narration;
    } catch {
      // Reintenta en la siguiente vuelta del bucle; tras la última, cae al determinista de abajo.
    }
  }
  return deterministicExchangeNarration(input);
}
