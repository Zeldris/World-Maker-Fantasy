import { loreChunks } from './loreChunks.js';
import { distanciaCoseno } from './ragCache.js';
import { trozosParaIndexar } from './loreTrozos.js';
import { textoDocumento, type ConfigRag } from '../lib/ragConfig.js';
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

/// Mandos del narrador (`QA-360`, T11 del GVE), todos opcionales: sin ellos el prompt es el de `QA-359`, byte a byte.
export interface MandosNarrador {
  /// N2: otro tope de caracteres del lore (por defecto `MAX_LORE_CHARS`).
  maxLoreChars?: number;
  /// N3: el bloque de lore va justo antes de «ACCIÓN DEL JUGADOR:», seguido de «Usa este lore si es pertinente.».
  loreAlFinal?: boolean;
  /// N4: otro umbral de distancia para `weaklyGrounded` (por defecto 0,75).
  umbralAnclado?: number;
}

/// Frase que cierra el bloque de lore cuando va al final (N3).
export const FRASE_LORE_AL_FINAL = 'Usa este lore si es pertinente.';

export function armarPromptNarrador(trozos: RetrievedLore[], accion: string, mandos: MandosNarrador = {}): PromptNarrador {
  const pocoAnclado = isWeaklyGrounded(trozos, mandos.umbralAnclado);
  const { prompt: base, format, backgroundLoreBlock } = buildNarrationPrompt({
    worldFacts: [],
    characterSummary: '',
    action: accion,
    backgroundLore: formatLoreForPrompt(trozos, mandos.maxLoreChars),
    weaklyGrounded: pocoAnclado,
  });
  let prompt = base;
  if (mandos.loreAlFinal) {
    const sinLore = base.replace(backgroundLoreBlock, '');
    const accionAt = sinLore.lastIndexOf('ACCIÓN DEL JUGADOR:');
    prompt = `${sinLore.slice(0, accionAt)}${backgroundLoreBlock.trim()}\n${FRASE_LORE_AL_FINAL}\n\n${sinLore.slice(accionAt)}`;
  }
  return { prompt, format, lore: loreQueEntra(trozos, mandos.maxLoreChars).map((t) => ({ titulo: t.title, texto: t.text })), pocoAnclado };
}

/// Los trozos en que se indexó un fragmento (`reindex-lore`): el crudo y el texto que se embebió. Vacío si el título no
/// está en `loreChunks.ts`.
export function trozosDelFragmento(cfg: ConfigRag, titulo: string): { trozo: string; embebido: string }[] {
  const chunk = loreChunks.find((c) => c.title === titulo);
  if (!chunk) return [];
  return trozosParaIndexar(chunk.text, cfg.tamTrozo, cfg.solape).map((trozo) => ({ trozo, embebido: textoDocumento(cfg, titulo, trozo) }));
}

/// N1 (`--lore-trozo`): el trozo de menor distancia coseno a la consulta (el primero si empatan); null si no hay.
export function trozoMasCercano(candidatos: { trozo: string; vector: number[] }[], vectorConsulta: number[]): string | null {
  let mejor: { trozo: string; distancia: number } | null = null;
  for (const c of candidatos) {
    const distancia = distanciaCoseno(c.vector, vectorConsulta);
    if (!mejor || distancia < mejor.distancia) mejor = { trozo: c.trozo, distancia };
  }
  return mejor?.trozo ?? null;
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
