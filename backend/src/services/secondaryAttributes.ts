/// Atributos secundarios de PJ (sesión de diseño 2026-07-23, remodelados 2026-08-22) — rasgos
/// narrativos que NUNCA alimentan una tirada (dice.ts): solo comprobaciones de UMBRAL (requisitos
/// de objetos/construcciones/oficios). Deliberadamente en un archivo aparte de dice.ts por eso
/// mismo — mezclarlos rompería el clasificador, que ya tiene que acertar cuál de los 7 atributos
/// "jugables" usar para una tirada real.
///
/// Remodelado 2026-08-22 (petición explícita: "los habíamos dejado como efectos secundarios para
/// el combate pero lo vamos a descartar, así separamos estos attr del combate") — de las 9 claves
/// originales:
/// - `sigilo` sale de aquí del todo: en D&D es una HABILIDAD atada a Destreza, no un rasgo
///   aparte — pasa a ser una tirada real de Destreza (ver `npcScene.ts`, ya trataba acciones
///   sigilosas como Destreza) en vez de un umbral narrativo. Ver también el diseño pendiente de
///   tirada de recolección/caza (memoria `tarkor_tirada_recoleccion_pendiente_2026-08-22`).
/// - `resistenciaFisica`/`resistenciaMagica`/`resistenciaSemilla` se ELIMINAN: nacieron pensadas
///   como resistencia a tipos de daño de COMBATE, marco que se descarta explícitamente aquí —
///   Constitución ya cubre ese papel entre los 7 primarios, mantenerlas habría duplicado sin
///   necesidad (decisión explícita de la usuaria).
/// - `resistenciaFrio`/`resistenciaCalor`/`moral` se quedan tal cual: narrativas puras, sin
///   equivalente mecánico real (entorno — Cristal Helado/Llanuras — y entereza pasiva ante el
///   horror/pérdida, D&D no tiene un stat aparte para ninguna de las dos).
/// - `magia`/`poderSemilla` se RETIRARON de aquí el 2026-09-01: pasaron a vivir en el atributo
///   primario `magia` (antes `arcano`, ver dice.ts y docs/rpgtarkor/clases.md § Atributo Magia),
///   con tirada real propia — dejan de ser color narrativo puro para ser un atributo jugable como
///   los otros 6. `poderSemilla` sigue sin ramificarse por Semilla creadora (Kelife/Liania,
///   Kalisar/Sezix, Jusaly, Ilvenar/Berd, Nabieus/Kroj...); ese diseño queda pendiente, pero ya no
///   vive aquí como secundario.
/// - `suerte`/`honor` son nuevos: color narrativo puro (una coincidencia, un hallazgo fortuito;
///   la cultura orca de honor/deuda ya escrita en el lore — Signeran, casta de Ketg), inspirados
///   en rasgos de D&D sin stat mecánico propio (el rasgo "Lucky", el peso narrativo del honor).
///
/// **Percepción pasiva** (D&D: 10 + modificador de Sabiduría, sin tirada) se decidió NO guardarla
/// aquí como campo propio — con Voluntad ya siendo el equivalente de Sabiduría del proyecto
/// (ver dice.ts), se calcula al vuelo cuando haga falta en vez de duplicar el dato.
export type SecondaryAttribute = 'moral' | 'resistenciaFrio' | 'resistenciaCalor' | 'suerte' | 'honor';

export type SecondaryAttributeBlock = Record<SecondaryAttribute, number>;

export const SECONDARY_ATTRIBUTES: SecondaryAttribute[] = ['moral', 'resistenciaFrio', 'resistenciaCalor', 'suerte', 'honor'];

const EMPTY_SECONDARY_ATTRIBUTES: SecondaryAttributeBlock = {
  moral: 0,
  resistenciaFrio: 0,
  resistenciaCalor: 0,
  suerte: 0,
  honor: 0,
};

/// Partidas anteriores a esta migración tienen `secondaryAttributes: {}` (default de columna) —
/// se leen como todo-cero en vez de reventar con `undefined` en cualquier comprobación de umbral.
/// Partidas creadas ANTES del remodelado 2026-08-22 pueden tener `sigilo`/`resistenciaFisica`/
/// `resistenciaMagica`/`resistenciaSemilla` residuales en su JSON guardado — `raw` se tipa contra
/// el `SecondaryAttributeBlock` correcto, así que esas claves viejas simplemente se ignoran (nunca
/// se leen), y `suerte`/`honor` caen a 0 hasta que se resiembre la partida.
export function normalizeSecondaryAttributes(value: unknown): SecondaryAttributeBlock {
  const raw = (value ?? {}) as Partial<SecondaryAttributeBlock>;
  return {
    moral: raw.moral ?? 0,
    resistenciaFrio: raw.resistenciaFrio ?? 0,
    resistenciaCalor: raw.resistenciaCalor ?? 0,
    suerte: raw.suerte ?? 0,
    honor: raw.honor ?? 0,
  };
}

export { EMPTY_SECONDARY_ATTRIBUTES };
