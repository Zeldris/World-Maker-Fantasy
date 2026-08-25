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
/// efecto) — el mismo para cualquier habilidad básica (racial, de clase) o avanzada (arma nivel
/// máximo). 'general' se queda en 0.
///
/// (Deuda técnica, auditoría 2026-08-25: existían `ENERGY_RECOVER_BASICA/MEDIA/AVANZADA/EXPERTA`
/// — 10/20/40/70 — pensadas como el equivalente de regeneración por tramo, pero sin ningún caller
/// real; el sistema de clases (`classAbilities.ts`, posterior a esto) acabó fijando
/// `energyRegen` a mano por habilidad, no por tramo, y esas constantes nunca llegaron a
/// conectarse. Retiradas en vez de conectadas: los valores reales de `classAbilities.ts` no siguen
/// esa escala, así que reconectarlas habría exigido cambiar el balance de ~15 habilidades sin que
/// nadie lo pidiera.)
export const ENERGY_COST_BASICA = 10;
export const ENERGY_COST_MEDIA = 15;
export const ENERGY_COST_AVANZADA = 30;
export const ENERGY_COST_EXPERTA = 50;
/// Rediseño 2026-07-31 ("ataque básico... son acciones que tienen todos los personajes... si usa
/// ataque básico cuesta solo 5 de energía") — Ataque Básico deja de costar lo mismo que una
/// habilidad real (antes caía en ENERGY_COST_BASICA=15 al ser tier 'basica' de arma) y pasa a un
/// tramo propio, mucho más barato, acorde a ser la acción base que tiene cualquier personaje.
export const ENERGY_COST_ATAQUE_BASICO = 5;

export interface EnergyTurnInput {
  current: number;
  max: number;
  /// Coste de la habilidad usada este turno (0 en las que solo regeneran — Defenderse/Esquivar).
  abilityEnergyCost: number;
  /// true si este turno resolvió un intercambio de combate real (resolveExchange) — sin esto, no
  /// hay regen de combate que aplicar (un turno fuera de combate no gasta ni regenera por esta vía).
  exchangeHappened: boolean;
  /// Rediseño 2026-07-31 — reemplaza al viejo `wasDefending` (regen fijo por ROL: "si atacas
  /// recuperas un poco, si te defiendes un poco más", sin mirar qué habilidad se usó de verdad).
  /// Ahora el regen es una propiedad de LA HABILIDAD usada este turno (Defenderse=10/Esquivar=5,
  /// 0 en cualquier otra, incluido Ataque Básico) — se lee de `SavedAction.energyRegen` (jugador)
  /// o `NpcCombatAbility.energyRegen`/`PendingNpcAttack.energyRegen` (NPC), nunca inferido del rol.
  abilityEnergyRegen: number;
  /// Descanso en refugio/asentamiento real este turno — restaura al tope entero, igual que un
  /// descanso válido cura hasta HERIDO en condicionFisica.
  restSucceeds: boolean;
  /// Descanso intentado EN CUALQUIER SITIO, con éxito mecánico (mismo `detectsRestIntent` que
  /// `restAttempted` de `healCeilingFor`, death.ts) — bug real jugando en vivo, 2026-08-13: "he
  /// descansado [en un vivac fuera de refugio/asentamiento] y la energía no se recuperó", mismo
  /// síntoma ya arreglado para condicionFisica el 2026-08-11 ("cura en cualquier sitio, pero
  /// menos"). Un vivac improvisado restaura HASTA la mitad del tope — nunca reduce energía ya por
  /// encima de eso. `restSucceeds` (arriba) manda si además el sitio es válido.
  restAttempted: boolean;
  /// Objeto consumido este turno que restaura energía (ItemCatalog.curaEnergia, detectado por
  /// detectEnergyItemUse en itemReference.ts) — null si no se usó ninguno.
  itemRestoreAmount: number | null;
}

/// Resuelve la energía del jugador tras este turno — puro, sin IA, mismo patrón que
/// nextCondicionFisica (death.ts): gasto primero, luego regen/restauración, siempre topado a
/// [0, max].
export function nextEnergia(input: EnergyTurnInput): number {
  let energia = Math.max(0, input.current - input.abilityEnergyCost);
  if (input.exchangeHappened) {
    energia += input.abilityEnergyRegen;
  }
  if (input.restSucceeds) {
    energia = input.max;
  } else if (input.restAttempted) {
    energia = Math.max(energia, Math.floor(input.max / 2));
  }
  if (input.itemRestoreAmount) {
    energia += input.itemRestoreAmount;
  }
  return Math.max(0, Math.min(input.max, energia));
}
