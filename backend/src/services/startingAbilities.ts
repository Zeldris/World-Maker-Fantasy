import type { AbilityEffect } from '@prisma/client';
import type { Attribute } from './dice.js';

export interface StartingAbility {
  name: string;
  icon: string;
  description: string;
  promptText: string;
  category: 'combate' | 'general';
  /// Mecánica real de habilidades de clase (checklist 2026-07-21/22, puntos 1-2) — solo relevante
  /// para category:'combate'. Gana sobre la heurística de palabra clave de npcScene.ts
  /// (tabulatedAttackAttribute) cuando el turno manda el savedActionId de esta habilidad.
  effect?: AbilityEffect;
  preferredAttribute?: Attribute;
}

/// Kit de habilidades "de serie" de Gorhorn — no cuentan contra el cupo por nivel
/// (docs/10-niveles-xp-reino.md § 4.3), son lo que el personaje ya sabía hacer antes de
/// empezar la partida. Las 2 de combate las diseñó un pase de Fable calibrado para el
/// clasificador (evitan nombrar atributo/dificultad, pero cargan léxico que empuja hacia el
/// atributo correcto).
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
    name: 'Furia de Maktor',
    icon: '🪓',
    description: 'Descarga toda la potencia de su hacha rota sobre un enemigo a corta distancia, como el último martillo de su clan.',
    promptText:
      'Suelto un rugido de guerra y cargo contra mi enemigo, descargando mi hacha rota como una maza con toda la potencia de mis músculos.',
    category: 'combate',
    effect: 'ATAQUE',
    preferredAttribute: 'fuerza',
  },
  {
    name: 'Piel de Guerra',
    icon: '🩸',
    description: 'El dolor no manda sobre un Maktor: Gorhorn aguanta heridas, frío y agotamiento sin ceder terreno.',
    promptText: 'Aprieto los dientes y aguanto el dolor y el cansancio sin retroceder ni un paso, negándome a caer.',
    category: 'combate',
    effect: 'AGUANTE',
    preferredAttribute: 'voluntad',
  },
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
];

export function startingAbilitiesFor(characterName: string): StartingAbility[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_ABILITIES;
  return [];
}
