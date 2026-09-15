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

/// El DEBILIDAD (`magnitude < 0`) de mayor magnitud negativa de la lista, sin tocarla — extraída de
/// `removeWorstDebilidad` (2026-09-15, REFLEJAR real, Segador Transmutador) para que el caller
/// pueda leer el efecto ANTES de quitarlo (REFLEJAR lo reconstruye sobre el rival, no solo lo
/// borra). Empate: se queda el primero encontrado (ninguna ficha real aclara el criterio). `null`
/// sin ningún DEBILIDAD activo.
export function worstDebilidadOf(activeEffects: ActiveEffect[]): ActiveEffect | null {
  return activeEffects.reduce<ActiveEffect | null>((worst, e) => {
    if (e.magnitude >= 0) return worst;
    if (!worst || e.magnitude < worst.magnitude) return e;
    return worst;
  }, null);
}

/// El AUMENTO (`magnitude > 0`) de mayor magnitud POSITIVA de la lista, sin tocarla — simétrico a
/// `worstDebilidadOf` (2026-09-15, CONVERSION real — Transmutación Mayor/Equilibrio Roto, Segador
/// Transmutador): "convierte un buff del rival en debilidad" necesita el mejor AUMENTO del rival,
/// igual que REFLEJAR necesita su peor DEBILIDAD. Empate: se queda el primero encontrado. `null`
/// sin ningún AUMENTO activo.
export function bestAumentoOf(activeEffects: ActiveEffect[]): ActiveEffect | null {
  return activeEffects.reduce<ActiveEffect | null>((best, e) => {
    if (e.magnitude <= 0) return best;
    if (!best || e.magnitude > best.magnitude) return e;
    return best;
  }, null);
}

/// `LIMPIAR` (2026-09-15, docs/rpgtarkor/clases.md — Caballero del Valor 16/32, Manto de
/// Purificación/Purga de Honor) — quita de la lista el DEBILIDAD (magnitude < 0) de mayor
/// magnitud negativa, a diferencia de `decrementActiveEffects` (que toca TODOS a la vez por turno)
/// esta es la única función del motor que elimina un `ActiveEffect` concreto. Empate: se queda el
/// primero encontrado (ninguna ficha real aclara el criterio de desempate). Sin ningún DEBILIDAD
/// activo, devuelve la lista sin cambios — el efecto se pierde en silencio, mismo criterio de "sin
/// candidato válido" que usa el resto del motor.
export function removeWorstDebilidad(activeEffects: ActiveEffect[]): ActiveEffect[] {
  return removeActiveEffect(activeEffects, worstDebilidadOf(activeEffects));
}

/// Quita UN `ActiveEffect` concreto de la lista por referencia (2026-09-15, extraída para
/// compartirla entre `removeWorstDebilidad` y la transmutación de AUMENTO — Transmutación Mayor/
/// Equilibrio Roto, Segador Transmutador, necesita quitar el `bestAumentoOf` del rival del mismo
/// modo). `null`/efecto no encontrado en la lista devuelve la lista sin cambios.
export function removeActiveEffect(activeEffects: ActiveEffect[], effect: ActiveEffect | null): ActiveEffect[] {
  if (!effect) return activeEffects;
  const idx = activeEffects.indexOf(effect);
  if (idx === -1) return activeEffects;
  return [...activeEffects.slice(0, idx), ...activeEffects.slice(idx + 1)];
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
