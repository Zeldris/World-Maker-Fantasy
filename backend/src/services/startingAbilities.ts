import type { AbilityEffect, AbilityRol } from '@prisma/client';
import type { Attribute } from './dice.js';

export interface StartingAbility {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  /// 'profesion' (2026-08-07) — habilidades de oficio desbloqueadas por nivel (ver
  /// professionAbilities.ts): igual que 'general' en todo lo mecánico (nunca de combate, siempre
  /// clicable/atacable a la acción), pero en su propia pestaña del panel de Habilidades.
  /// 'reino' (2026-08-13) — recetas de construction.ts (Campamento, Ayuntamiento x3 aquí; la
  /// Choza, con oficio propio, en professionAbilities.ts) — su propia pestaña "Reino", separada de
  /// "Profesiones" aunque alguna tenga oficio, porque conceptualmente son "levantar algo del mundo
  /// persistente", no "craftear un objeto propio".
  category: 'combate' | 'general' | 'profesion' | 'reino';
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2) — solo relevante
  /// para category:'combate'. Gana sobre la heurística de palabra clave de npcScene.ts
  /// (tabulatedAttackAttribute) cuando el turno manda el savedActionId de esta habilidad. Lista,
  /// no valor único (2026-08-15, petición explícita: "que una habilidad pueda tener múltiples
  /// AbilityEffects") — undefined/[] = sin efecto mecánico (general/profesión/reino).
  effects?: AbilityEffect[];
  /// Rediseño de combate (2026-08-09) — ver `enum AbilityRol` (schema.prisma). Solo relevante
  /// para category:'combate', igual que `effects`/`preferredAttribute`.
  rol?: AbilityRol;
  preferredAttribute?: Attribute;
  /// Bonus de atributo fijo (2026-08-24, Grupo 3 § Sistema de clases, clases.md § "Habilidad de
  /// daño vs ataque básico") — se suma al valor CRUDO del atributo antes del multiplicador de tipo
  /// al usar esta habilidad (`ExchangeParticipant.attributeBonus`, combatExchange.ts), no un bono
  /// plano a la tirada. undefined = sin bonus (Ataque Básico y el resto de habilidades genéricas).
  attributeBonus?: number;
  /// Tope de usos por combate (2026-08-15, junto a AbilityEffect.LIMITADA) — independiente de qué
  /// efectos lleve la habilidad: undefined = sin tope.
  maxUsesPerCombat?: number;
  /// Sistema de fatiga (2026-07-29) — coste de energía fijo por tramo (energy.ts). Solo relevante
  /// para category:'combate'; las generales se quedan en 0/undefined (siempre gratis).
  energyCost?: number;
  /// Rediseño 2026-07-31 (energy.ts § nextEnergia) — energía que RECUPERA usar esta habilidad en
  /// un intercambio real (Defenderse/Esquivar, ver genericCombatAbilities.ts). 0/undefined en el
  /// resto.
  energyRegen?: number;
}

/// Kit de habilidades "de serie" de Gorhorn — no cuentan contra el cupo por nivel
/// (docs/10-niveles-xp-reino.md § 4.3), son lo que el personaje ya sabía hacer antes de
/// empezar la partida.
///
/// Rediseño de atributos/armas (2026-07-29, "vamos a quitar entonces las habilidades fijas
/// porque no aportan gran cosa"): las 2 de combate que había aquí (Furia de Maktor/Piel de
/// Guerra) se eliminan — su papel lo cubren ahora las habilidades raciales (berigLore.ts) y las
/// de arma equipada (weaponAbilities.ts), calculadas dinámicamente en vez de fijas de por vida.
///
/// Las generales (2026-07-21, segunda revisión a petición explícita de la usuaria): la primera
/// versión mezclaba utilidades genéricas ("Buscar provisiones") con acciones puntuales de un solo
/// resultado y sabor muy específico (domar una bestia, romper una roca, discurso con el tótem) —
/// la usuaria señaló que esas últimas "no siguen el concepto de general" (una de ellas, domar
/// bestias, ni siquiera es utilidad: es una acción de combate/captura disfrazada). Sustituidas por
/// utilidades de verdad genéricas, usables en cualquier situación: viajar, descansar donde sea
/// (sin necesitar volver a un sitio conocido) y saquear/despiezar lo que tengas delante.
const GORHORN_GENERAL_ABILITIES: StartingAbility[] = [
  // Panel de selección (2026-08-17, mismo patrón que Cazar/HuntSelectionModal) — lista los
  // campamentos ya construidos, agrupados por región, para volver a uno sin tener que escribirlo
  // de memoria (CampSelectionModal.tsx).
  {
    name: 'Volver al campamento',
    icon: '🏕️',
    description: 'Te permite elegir entre tus campamentos construidos para volver a uno de ellos.',
    promptText: 'Me pongo en camino al campamento en la region de ',
    category: 'general',
  },
  // Panel de selección (2026-08-17) — regiones descubiertas si no llevas mapa; todas las que
  // muestra el mapa poseído si sí lo llevas (TravelDestinationModal.tsx).
  {
    name: 'Viajar',
    icon: '🧭',
    description: 'Siempre que lleves un mapa en tu inventario, te listará las zonas disponibles para viajar y podras seleccionar una para iniciar tu viaje.',
    promptText: 'Me pongo en marcha hacia ',
    category: 'general',
  },
  {
    name: 'Descansar',
    icon: '🔥',
    // Auditoría 2026-08-11 ("la ficha promete curar en cualquier sitio, pero la mecánica solo
    // curaba en refugio/asentamiento"): aclarado con la usuaria — sí cura en cualquier sitio, pero
    // un vivac improvisado solo llega hasta Grave; hace falta un refugio o asentamiento real para
    // llegar a Herido (ver healCeilingFor, death.ts).
    description: 'Se detiene donde esté, monta un vivac breve y descansa para recuperar fuerzas — un alivio real incluso a la intemperie, aunque solo un refugio o asentamiento de verdad permite recuperarse del todo.',
    promptText: 'Me detengo aquí mismo, monto un vivac breve y descanso para recuperar fuerzas antes de seguir.',
    category: 'general',
  },
  // Fuera de combate (2026-08-17): detecta NPCs muertos/convalecientes sin saquear en la zona
  // actual y reutiliza el mismo flujo de saqueo que ya existe al final de un combate
  // (postCombatInteraction.ts) — mismo comportamiento en los dos sitios, sin duplicar lógica.
  {
    name: 'Saquear',
    icon: '🏺',
    description: 'Registra el cuerpo que tenga delante en busca de todo lo aprovechable — un enemigo derrotado o una presa cazada.',
    promptText: 'Registro y saqueo el cuerpo que tengo delante, sea un enemigo derrotado o una presa cazada, en busca de todo lo que pueda aprovechar.',
    category: 'general',
  },
  // Decisión (2026-08-17): se queda como habilidad general, no se convierte en profesión —
  // cerrar el acceso a cazar tras un oficio es un cambio de balance/economía mayor que lo que
  // pide resolver este comentario. Si en el futuro se quiere diferenciar cazadores buenos de
  // malos, mejor un bonus de oficio sobre la tirada (mismo criterio que el resto de oficios) que
  // restringir quién puede cazar en absoluto.
  {
    name: 'Cazar',
    icon: '🏹',
    // Bug real jugando en vivo (revisión de partida 2026-08-08: "buscar presas... eso no va, sale
    // un pequeño raposa que desaparece sin más"): el texto libre nunca conectaba de forma fiable
    // con la fauna real del catálogo (dependía de una sugerencia ambiental opcional al 25%, ajena
    // a que el jugador estuviera cazando de verdad). Mismo criterio que Minar/Talar
    // (harvestAbilities.ts): en vez de reforzar la detección de texto libre, abre un pop-up
    // (HuntSelectionModal) con la fauna real y con población activa en la zona ahora mismo —
    // `promptText` no se usa nunca (GameView.tsx intercepta por nombre antes de llegar al
    // composer), se deja por consistencia con el resto de `StartingAbility`.
    description: 'Busca fauna real de la zona para cazarla — una presa débil puede caer sin pelear, varias a la vez siempre exigen combate.',
    promptText: 'Salgo a cazar por la zona.',
    category: 'general',
  },
  // Panel de selección (2026-08-17, mismo patrón que Cazar) — lista los curativos del inventario
  // con vista previa acumulada del resultado final antes de confirmar (HealSelectionModal.tsx);
  // bloqueado si ya estás ILESO — no deja seguir gastando objetos sin necesidad.
  {
    name: 'Curar',
    icon: '🌿',
    description: 'Registra el inventario y te permite seleccionar uno o varios items curativos, viendo el resultado final antes de confirmar, para sanarte.',
    promptText: 'Reviso el inventario y me curo con ',
    category: 'general',
  },
];

// Edificios sin oficio (2026-08-13, petición explícita: "hay que añadir también los edificios
// como habilidades de construcción, al igual que el resto de elementos de profesiones") —
// Campamento y los 3 niveles de Ayuntamiento no llevan `oficio` en construction.ts a propósito
// ("cualquiera puede intentarlo, no hace falta un gremio"), así que van aquí en vez de en
// professionAbilities.ts (que exige oficio+tier). Categoría 'reino' (pestaña propia, 2026-08-13,
// petición explícita: "hay que añadir un tab en habilidades para las habilidades de reino"), no
// 'general' — misma pestaña que la Choza, que sí tiene oficio y vive en professionAbilities.ts.
// Separado en su propia const (2026-08-17, "revisar si separar este bloque en otra var para no
// liarnos con las generales") — mismo array final vía startingAbilitiesFor, solo separado en el
// código fuente.
const GORHORN_REINO_ABILITIES: StartingAbility[] = [
  {
    name: 'Construir campamento',
    icon: '🏕️',
    description: 'Levanta un campamento base con leña, piedra y piel — un refugio rápido para pasar la noche y guardar partida.',
    promptText: 'Construyo un campamento base con lo que llevo encima.',
    category: 'reino',
  },
  {
    name: 'Fundar ayuntamiento',
    icon: '🏛️',
    description: 'Levanta el primer ayuntamiento de un reino en esta región — el asiento de mando que desbloquea construir infraestructura de reino a su alrededor.',
    promptText: 'Construyo un ayuntamiento en este territorio.',
    category: 'reino',
  },
  {
    name: 'Ampliar ayuntamiento a mediano',
    icon: '🏛️',
    description: 'Mejora tu ayuntamiento ya construido a tamaño mediano, ampliando cuánta infraestructura de reino puedes sostener.',
    promptText: 'Mejoro mi ayuntamiento a uno mediano.',
    category: 'reino',
  },
  {
    name: 'Ampliar ayuntamiento a grande',
    icon: '🏛️',
    description: 'Mejora tu ayuntamiento ya construido a un gran ayuntamiento, la capital de un reino asentado.',
    promptText: 'Amplío mi ayuntamiento hasta convertirlo en uno grande.',
    category: 'reino',
  },
];

export function startingAbilitiesFor(characterName: string): StartingAbility[] {
  if (characterName === 'Gorhorn') return [...GORHORN_GENERAL_ABILITIES, ...GORHORN_REINO_ABILITIES];
  return [];
}
