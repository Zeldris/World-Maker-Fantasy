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

/// Descansar — reposo fijo (2026-09-06, hallazgo 11 de la sesión de pruebas) — antes reponía al
/// tope entero (refugio) o a la mitad del tope (cualquier sitio), desproporcionado con
/// Constitución alta; ahora un tramo fijo de +30, igual en cualquier sitio válido, sin distinguir
/// refugio de vivac (la petición no distingue). Curación de condicionFisica al descansar
/// ELIMINADA por completo (decisión explícita de la usuaria) — ver death.ts § healCeilingFor, la
/// única vía de curar condición fuera de combate pasa a ser "Curar" con objetos médicos.
export const ENERGY_REST_RESTORE = 30;
/// B11 (pruebas 2026-09-28): tras un combate la energía se quedaba en 1/77 y no se recuperaba ni
/// viajando (solo Descansar, +30 cada 3h). Regeneración pasiva fuera de combate: 1 punto por cada
/// `MINUTOS_POR_PUNTO_ENERGIA_PASIVA` minutos de ficción transcurridos (decisión por defecto,
/// revisable por Álvaro).
export const MINUTOS_POR_PUNTO_ENERGIA_PASIVA = 10;
/// Puro: puntos de energía pasiva ganados al pasar de `antes` a `despues` minutos de ficción — cuenta
/// los múltiplos de `MINUTOS_POR_PUNTO_ENERGIA_PASIVA` cruzados, así no hace falta guardar restos
/// entre turnos (dos pasos de 5 minutos dan lo mismo que uno de 10).
export function energiaPasivaEntre(antes: number, despues: number): number {
  if (despues <= antes) return 0;
  return Math.floor(despues / MINUTOS_POR_PUNTO_ENERGIA_PASIVA) - Math.floor(antes / MINUTOS_POR_PUNTO_ENERGIA_PASIVA);
}

/// Cooldown de Descansar (2026-09-06, hallazgo 11) — 3h de tiempo de FICCIÓN, mismo patrón exacto
/// que `dispersionCooldownActivo` (cazar.ts): `null` = nunca descansó, sin cooldown que aplicar.
export const REST_COOLDOWN_MINUTES = 3 * 60;

export function restCooldownActivo(lastRestAtMinutes: number | null, nowMinutes: number): boolean {
  if (lastRestAtMinutes === null) return false;
  return nowMinutes - lastRestAtMinutes < REST_COOLDOWN_MINUTES;
}

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
  /// Descanso en refugio/asentamiento real este turno, con el cooldown de `REST_COOLDOWN_MINUTES`
  /// YA comprobado por el caller (turnResolution.ts) — si el cooldown está activo, el caller debe
  /// mandar `false` aquí, no dejar que esta función lo sepa. Repone `ENERGY_REST_RESTORE` fijo,
  /// igual que `restAttempted` (2026-09-06: ya no distingue refugio de vivac para la energía —
  /// solo seguía distinguiendo para curar condicionFisica, curación eliminada, ver death.ts).
  restSucceeds: boolean;
  /// Descanso intentado EN CUALQUIER SITIO, con éxito mecánico y cooldown YA comprobado por el
  /// caller (mismo criterio que `restSucceeds` arriba) — mismo `detectsRestIntent` que
  /// `healCeilingFor` usaba antes (death.ts, curación ya eliminada). Repone
  /// `ENERGY_REST_RESTORE` fijo sobre `current`, topado a `max` (nunca reduce si ya estaba por
  /// encima, mismo criterio de siempre).
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
  if (input.restSucceeds || input.restAttempted) {
    energia += ENERGY_REST_RESTORE;
  }
  if (input.itemRestoreAmount) {
    energia += input.itemRestoreAmount;
  }
  return Math.max(0, Math.min(input.max, energia));
}
