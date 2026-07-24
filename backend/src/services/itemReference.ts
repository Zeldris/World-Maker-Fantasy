import { normalizeText, levenshtein } from './travel.js';

/// Palabras de objeto genéricas que un jugador puede pedir mirar/usar/revisar sin nombrarlo
/// exactamente como en su inventario (roadmap 2026-07-19: "mirar el mapa" sin tener uno debía
/// narrar que no lo tiene, no inventarlo ni ignorar el hecho en silencio). Lista CURADA a
/// propósito, no un regex genérico de "mi X" — así no dispara en falso con "mi pasado", "mi
/// familia", "mi objetivo" ni nada que no sea un objeto físico real.
const COMMON_ITEM_NOUNS = [
  'mapa', 'antorcha', 'brujula', 'cuerda', 'pocion', 'llave', 'vendaje', 'manta',
  'cantimplora', 'provisiones', 'racion', 'raciones', 'moneda', 'monedas', 'oro',
  'herramienta', 'cuchillo', 'espada', 'hacha', 'arco', 'flecha', 'flechas', 'escudo',
  'armadura', 'casco', 'anillo', 'amuleto', 'pergamino', 'libro', 'carta', 'pico',
  'odre', 'yesca', 'pedernal', 'saco', 'mochila',
];

/// Raíces de verbo que implican comprobar algo que ya se llevaría encima (mirar/revisar/
/// consultar/sacar/usar/coger/tener) — deliberadamente sin "busco/buscar" (demasiado genérico,
/// ya usado por harvest.ts/npcScene.ts para fauna/NPCs/lugares, se solaparía en falso).
const CHECK_VERB_REGEX = /\b(mir|revis|consult|sac|us|coj|tien)/;

export interface ItemReferenceCheck {
  noun: string;
  posee: boolean;
}

/// Detecta si la acción menciona posiblemente un objeto concreto de la lista curada y, si es
/// así, si el personaje lo tiene de verdad en su inventario actual — puro, sin IA, mismo patrón
/// determinista que el resto de detectores (harvest.ts, npcScene.ts).
export function detectItemReference(action: string, inventoryNames: string[]): ItemReferenceCheck | null {
  const normalized = normalizeText(action);
  if (!CHECK_VERB_REGEX.test(normalized)) return null;

  const words = normalized.split(/[^a-zñáéíóúü]+/);
  // Tolerancia a erratas (roadmap 2026-07-20, P0 de Fable — auditoría de detectores tras el bug
  // real de matchNpcAliases): solo para sustantivos de 5+ letras, mismo umbral que el resto de
  // detectores — evita falsos positivos en sustantivos cortos como "oro" o "arco".
  const noun =
    COMMON_ITEM_NOUNS.find((n) => words.includes(n)) ??
    COMMON_ITEM_NOUNS.find((n) => n.length >= 5 && words.some((w) => w.length >= 5 && levenshtein(w, n) <= 2));
  if (!noun) return null;

  const normalizedInventory = inventoryNames.map(normalizeText);
  const posee = normalizedInventory.some((name) => name.includes(noun));
  return { noun, posee };
}

/// Bloque de prompt para cuando NO lo tiene — cierra la puerta a que el modelo invente que sí lo
/// lleva encima o que lo encuentra de repente.
export function missingItemBlockFor(check: ItemReferenceCheck): string {
  return `EL PERSONAJE NO TIENE "${check.noun}" ENTRE SUS PERTENENCIAS ahora mismo: narra que lo busca, lo considera o palpa su equipo y se da cuenta de que no lo tiene — nunca que sí lo tiene, ni que lo encuentra de repente, ni que aparece uno nuevo.`;
}
