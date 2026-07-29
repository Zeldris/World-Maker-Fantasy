/// Sistema de fatiga/energía (2026-07-29, petición explícita: "que no sean de uso ilimitado" las
/// habilidades) — determinista, mismo criterio que condicionFisica (death.ts): el modelo nunca
/// decide el número, solo lo narra ya resuelto. Alcance de esta primera pasada: solo el JUGADOR
/// (los NPC siguen eligiendo habilidad sin restricción de energía, ver npcCombatAbilities.ts —
/// darles el mismo sistema es una ampliación futura, no parte de esta).

/// Tope de energía (2026-07-29) — escala con Constitución, mismo espíritu que `effectiveDefense`
/// escalando con equipo: un personaje más aguantador tiene más fondo de reserva.
export function energiaMaxFor(constitucion: number): number {
  return 50 + constitucion * 3;
}

/// Coste fijo por tramo (petición explícita: "fijo por tramo", no variable por habilidad ni por
/// efecto) — el mismo para cualquier habilidad básica (racial, arma nivel 1, de clase) o avanzada
/// (arma nivel máximo). Las genéricas (Ataque a mano, Defenderse, Esquivar) cuestan 0.
export const ENERGY_COST_BASICA = 15;
export const ENERGY_COST_AVANZADA = 25;

/// Ritmo de regeneración EN COMBATE (petición explícita, 2026-07-29: "si usas una habilidad ese
/// turno no recuperas nada, si haces un ataque normal recuperas un poco y si te defiendes un poco
/// más") — depende del ROL que tuvo el jugador en el intercambio de este turno, no de cuál
/// habilidad concreta usó, siempre que su coste haya sido 0.
const ENERGY_REGEN_ATAQUE = 10;
const ENERGY_REGEN_DEFENSA = 15;

export interface EnergyTurnInput {
  current: number;
  max: number;
  /// Coste de la habilidad usada este turno (0 si fue ataque a mano o una genérica gratuita).
  abilityEnergyCost: number;
  /// true si este turno resolvió un intercambio de combate real (resolveExchange) — sin esto, no
  /// hay regen de combate que aplicar (un turno fuera de combate no gasta ni regenera por esta vía).
  exchangeHappened: boolean;
  /// Rol que tuvo el jugador en ese intercambio — decide el ritmo de regen cuando el coste fue 0.
  wasDefending: boolean;
  /// Descanso válido este turno (mismo detectsRestIntent que ya usa healCeilingFor) — restaura al
  /// tope entero, igual que un descanso válido cura hasta HERIDO en condicionFisica.
  restSucceeds: boolean;
  /// Objeto consumido este turno que restaura energía (ItemCatalog.curaEnergia, detectado por
  /// detectEnergyItemUse en itemReference.ts) — null si no se usó ninguno.
  itemRestoreAmount: number | null;
}

/// Resuelve la energía del jugador tras este turno — puro, sin IA, mismo patrón que
/// nextCondicionFisica (death.ts): gasto primero, luego regen/restauración, siempre topado a
/// [0, max].
export function nextEnergia(input: EnergyTurnInput): number {
  let energia = Math.max(0, input.current - input.abilityEnergyCost);
  if (input.exchangeHappened && input.abilityEnergyCost === 0) {
    energia += input.wasDefending ? ENERGY_REGEN_DEFENSA : ENERGY_REGEN_ATAQUE;
  }
  if (input.restSucceeds) {
    energia = input.max;
  }
  if (input.itemRestoreAmount) {
    energia += input.itemRestoreAmount;
  }
  return Math.max(0, Math.min(input.max, energia));
}
