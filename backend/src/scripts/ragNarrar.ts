import { buildNarrationPrompt } from '../services/narrador.js';
import { formatLoreForPrompt, isWeaklyGrounded, loreQueEntra, MAX_LORE_CHARS, type RetrievedLore } from '../services/retrieval.js';

export { MAX_LORE_CHARS };

/// Banco de narración de `rag-eval --narrar` (`QA-359`, T10 del GVE): el prompt del narrador que arma el juego con el
/// lore recuperado de un caso. Sin la parte de red (la generación está en `rag-eval.ts`), para poder probarlo.
///
/// El contexto es el mínimo, sin hechos de escena ni resumen del personaje, como `narratorWarmupPrompt`: lo que se
/// mide es qué hace el modelo con el lore, no con el resto del turno. En el juego (turnResolution.ts),
/// `backgroundLore` es `formatLoreForPrompt(retrieved)` y `weaklyGrounded` es `isWeaklyGrounded(retrieved)` y que no
/// haya hechos de escena: aquí nunca los hay.

export interface PromptNarrador {
  prompt: string;
  format: Record<string, unknown>;
  /// Los fragmentos que entraron en el prompt, en su orden, ya recortados por `MAX_LORE_CHARS`; `texto` es el del
  /// fragmento, sin el «título: » de delante.
  lore: { titulo: string; texto: string }[];
  pocoAnclado: boolean;
}

export function armarPromptNarrador(trozos: RetrievedLore[], accion: string): PromptNarrador {
  const pocoAnclado = isWeaklyGrounded(trozos);
  const { prompt, format } = buildNarrationPrompt({
    worldFacts: [],
    characterSummary: '',
    action: accion,
    backgroundLore: formatLoreForPrompt(trozos),
    weaklyGrounded: pocoAnclado,
  });
  return { prompt, format, lore: loreQueEntra(trozos).map((t) => ({ titulo: t.title, texto: t.text })), pocoAnclado };
}

/// Lo que dijo el modelo: el campo `narration` del JSON que devuelve; si no parsea (o no lo trae), el texto crudo.
export function leerNarracion(crudo: string): { texto: string; json_valido: boolean } {
  try {
    const narration = (JSON.parse(crudo) as { narration?: unknown })?.narration;
    if (typeof narration === 'string') return { texto: narration, json_valido: true };
  } catch {
    // texto crudo, abajo
  }
  return { texto: crudo, json_valido: false };
}
