import type { ClassificationResult } from '../services/narrador.js';
import type { RollResult } from '../services/dice.js';
import type { TravelResolution } from '../services/travel.js';
import type { NpcInScene } from '../services/npcScene.js';

interface CachedClassify {
  classification: ClassificationResult;
  roll?: RollResult;
  travel?: TravelResolution | null;
  /// Auditoría de rendimiento 2026-07-28 ("rascar segundos"): se cachea junto al resto para que
  /// un preview reutilizado en un envío real no obligue a recalcularlo — ver mismo comentario en
  /// turn.ts sobre por qué /turn/narrate ya no necesita su propio detectNpcsInScene.
  npcsInScene?: NpcInScene[];
  expiresAt: number;
}

/// Solapar `/turn/classify` con el tecleo del jugador (roadmap de velocidad, 2026-07-19): el
/// frontend lanza un `preview:true` en segundo plano tras ~1,5s sin teclear, que hace TODO el
/// trabajo caro (Ollama/tabla) pero no persiste nada — si el envío real llega con el MISMO texto
/// exacto, se salta esa parte y va directo a persistir. TTL corto (single-use además, ver
/// consumeCachedClassify) porque esto es puramente para esconder la latencia de un envío
/// concreto, nunca un caché de propósito general.
const TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, CachedClassify>();

function keyFor(saveId: string, enCombate: boolean | undefined, action: string): string {
  return `${saveId}:${enCombate ? 1 : 0}:${action}`;
}

export function peekCachedClassify(saveId: string, enCombate: boolean | undefined, action: string): CachedClassify | undefined {
  const key = keyFor(saveId, enCombate, action);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

export function setCachedClassify(
  saveId: string,
  enCombate: boolean | undefined,
  action: string,
  value: Omit<CachedClassify, 'expiresAt'>,
): void {
  // Barrido perezoso al escribir — evita crecer sin límite en una sesión larga sin un timer aparte.
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
  cache.set(keyFor(saveId, enCombate, action), { ...value, expiresAt: now + TTL_MS });
}

/// Se llama SOLO desde un envío real (nunca desde un preview) para que una entrada cacheada no
/// pueda reutilizarse una segunda vez — si el jugador repitiera el mismo texto como una acción
/// nueva de verdad más tarde, necesita su propia tirada, no la de la vez anterior.
export function consumeCachedClassify(saveId: string, enCombate: boolean | undefined, action: string): void {
  cache.delete(keyFor(saveId, enCombate, action));
}
