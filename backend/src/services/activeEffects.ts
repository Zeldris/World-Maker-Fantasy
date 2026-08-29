import type { Attribute, AttributeBlock } from './dice.js';

/// Fase 2 de efectos de clase (2026-08-26, docs/21-roadmap.md § Fase 2) — infraestructura de
/// duración por turnos para `AUMENTO`/`DEBILIDAD`. Deliberadamente ACOTADO a estos dos efectos:
/// `CANALIZAR` (se cancela si te golpean antes de completarse), `REFLEJAR` (captura y devuelve un
/// efecto negativo) y `PURIFICAR` (limpia efectos negativos) son cada uno su propia mecánica
/// encima de esta base, sin construir todavía.
///
/// `magnitude` viaja CON SIGNO (positivo para AUMENTO, negativo para DEBILIDAD) — sumar
/// directamente sobre el atributo base es toda la lógica de "aplicar" que hace falta, sin tener
/// que distinguir AUMENTO de DEBILIDAD en el punto de lectura.
export interface ActiveEffect {
  attribute: Attribute;
  magnitude: number;
  turnsRemaining: number;
  /// Nombre de la habilidad que lo generó — para narración/depuración, nunca para deduplicar (dos
  /// usos de la misma habilidad SÍ pueden apilarse, ver comentario de `pushActiveEffect`).
  sourceAbility: string;
}

/// Suma con signo de todos los `ActiveEffect` que afectan a un atributo dado, sobre el bloque base
/// — el resultado es lo que de verdad debe entrar en `ExchangeParticipant.attributes` al construir
/// un intercambio (ver turnResolution.ts § resolveCombatExchangePhase). Varios efectos activos
/// sobre el MISMO atributo se apilan (nunca se sustituyen ni se limita a "el más reciente gana") —
/// simplificación consciente: ningún efecto real de `clases.md` combina varios AUMENTO/DEBILIDAD
/// sobre el mismo atributo a la vez hoy, así que no hace falta un tope.
export function effectiveAttributesConDuracion(base: AttributeBlock, activeEffects: ActiveEffect[]): AttributeBlock {
  if (activeEffects.length === 0) return base;
  const result = { ...base };
  for (const effect of activeEffects) {
    result[effect.attribute] = result[effect.attribute] + effect.magnitude;
  }
  return result;
}

/// Añade un efecto nuevo a la lista — apila en vez de sustituir (ver comentario de
/// `effectiveAttributesConDuracion`). `magnitude`/`turnsRemaining` ya vienen decididos por el
/// caller (de `SavedAction.durationEffectMagnitude`/`durationEffectTurns` de la habilidad usada).
export function pushActiveEffect(activeEffects: ActiveEffect[], newEffect: ActiveEffect): ActiveEffect[] {
  return [...activeEffects, newEffect];
}

/// Avanza un turno: resta 1 a `turnsRemaining` de todos los efectos y descarta los que llegan a 0
/// — se llama UNA vez por cada lado (jugador/NPC) al final de cada intercambio resuelto, mismo
/// punto donde ya se escribe `condicionFisica`/`energia` tras el golpe.
export function decrementActiveEffects(activeEffects: ActiveEffect[]): ActiveEffect[] {
  return activeEffects.map((e) => ({ ...e, turnsRemaining: e.turnsRemaining - 1 })).filter((e) => e.turnsRemaining > 0);
}

/// Lee `Save.activeEffects`/`NpcState.activeEffects` (columna `Json`, `[]` por defecto) con un
/// parseo defensivo — mismo criterio que el resto del proyecto con campos `Json` que pueden venir
/// de una fila creada antes de que este campo existiera (nunca debería pasar aquí, la migración ya
/// puso `[]` por defecto en todas las filas existentes, pero un `unknown`/`null` inesperado no
/// debe reventar el turno).
export function parseActiveEffects(raw: unknown): ActiveEffect[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ActiveEffect =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as ActiveEffect).attribute === 'string' &&
      typeof (e as ActiveEffect).magnitude === 'number' &&
      typeof (e as ActiveEffect).turnsRemaining === 'number',
  );
}
