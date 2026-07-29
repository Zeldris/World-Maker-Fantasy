import type { StartingAbility } from './startingAbilities.js';

/// Sistema de fatiga (2026-07-29, petición explícita): "además del ataque normal... un
/// 'Defenderse' también como habilidad genérica que depende del Aguante y 'Esquivar' que
/// dependerá de la destreza" — el fallback SIEMPRE disponible cuando la energía no alcanza para
/// una habilidad racial/de arma/de clase. Gratis (energyCost 0, ver StartingAbility), universales
/// (no dependen de raza/clase, a diferencia de las demás habilidades de combate) — se conceden a
/// CUALQUIER personaje jugable, no solo a Gorhorn (ver dónde se usan en POST /saves).
export const GENERIC_COMBAT_ABILITIES: StartingAbility[] = [
  {
    name: 'Defenderse',
    icon: '🪨',
    description: 'Se planta y aguanta el golpe con pura resistencia física — siempre disponible, sin gastar energía.',
    promptText: 'Me planto y aguanto el golpe que venga con pura resistencia física.',
    category: 'combate',
    effect: 'AGUANTE',
    preferredAttribute: 'constitucion',
    energyCost: 0,
  },
  {
    name: 'Esquivar',
    icon: '💨',
    description: 'Se aparta del golpe confiando solo en sus reflejos — siempre disponible, sin gastar energía.',
    promptText: 'Me aparto del golpe confiando solo en mis reflejos.',
    category: 'combate',
    effect: 'AGUANTE',
    preferredAttribute: 'destreza',
    energyCost: 0,
  },
];
