import type { AbilityEffect } from '@prisma/client';
import type { Attribute } from './dice.js';

export interface StartingAbility {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  /// 'profesion' (2026-08-07) — habilidades de oficio desbloqueadas por nivel (ver
  /// professionAbilities.ts): igual que 'general' en todo lo mecánico (nunca de combate, siempre
  /// clicable/atacable a la acción), pero en su propia pestaña del panel de Habilidades.
  category: 'combate' | 'general' | 'profesion';
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2) — solo relevante
  /// para category:'combate'. Gana sobre la heurística de palabra clave de npcScene.ts
  /// (tabulatedAttackAttribute) cuando el turno manda el savedActionId de esta habilidad.
  effect?: AbilityEffect;
  preferredAttribute?: Attribute;
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
const GORHORN_STARTING_ABILITIES: StartingAbility[] = [
  {
    name: 'Buscar provisiones',
    icon: '🌿',
    description: 'Busca comida, agua o cualquier recurso útil en los alrededores — el resultado puede ser cualquier cosa aprovechable de la zona.',
    promptText: 'Recorro la zona con atención, buscando comida, agua o cualquier recurso que me pueda servir.',
    category: 'general',
  },
  {
    name: 'Volver al campamento',
    icon: '🏕️',
    description: 'Deja lo que está haciendo y regresa a un lugar seguro que ya conoce para descansar.',
    promptText: 'Dejo lo que estoy haciendo y vuelvo a un lugar seguro que ya conozco para descansar.',
    category: 'general',
  },
  {
    name: 'Viajar',
    icon: '🧭',
    description: 'Emprende camino hacia un destino conocido — completa el nombre del lugar justo después de insertarla en el mensaje.',
    promptText: 'Me pongo en marcha hacia ',
    category: 'general',
  },
  {
    name: 'Descansar',
    icon: '🔥',
    description: 'Se detiene donde esté, monta un vivac breve y descansa para recuperar fuerzas — sin necesitar volver a un lugar conocido.',
    promptText: 'Me detengo aquí mismo, monto un vivac breve y descanso para recuperar fuerzas antes de seguir.',
    category: 'general',
  },
  {
    name: 'Saquear',
    icon: '🏺',
    description: 'Registra el cuerpo que tenga delante en busca de todo lo aprovechable — un enemigo derrotado o una presa cazada.',
    promptText: 'Registro y saqueo el cuerpo que tengo delante, sea un enemigo derrotado o una presa cazada, en busca de todo lo que pueda aprovechar.',
    category: 'general',
  },
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
];

export function startingAbilitiesFor(characterName: string): StartingAbility[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_ABILITIES;
  return [];
}
