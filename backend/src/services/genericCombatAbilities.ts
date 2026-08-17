import type { StartingAbility } from './startingAbilities.js';

/// Sistema de fatiga (2026-07-29, petición explícita): "además del ataque normal... un
/// 'Defenderse' también como habilidad genérica que depende del Aguante y 'Esquivar' que
/// dependerá de la destreza" — el fallback SIEMPRE disponible cuando la energía no alcanza para
/// una habilidad racial/de arma/de clase. Universales (no dependen de raza/clase, a diferencia de
/// las demás habilidades de combate) — se conceden a CUALQUIER personaje jugable, no solo a
/// Gorhorn (ver dónde se usan en POST /saves).
///
/// Rediseño 2026-07-31 (petición explícita: "son acciones que tienen todos los personajes... si
/// usar defenderse recupera 10 y si usa esquivar recupera 5"): dejan de ser solo "gratis" y pasan
/// a RECUPERAR energía de verdad al usarlas en un intercambio real — `energyRegen`, no
/// `energyCost` (que se queda en 0, nunca cuestan nada). El tercer genérico, "Ataque Básico", NO
/// vive aquí — depende del arma equipada, se calcula en weaponAbilities.ts/dynamicAbilities.ts,
/// pero comparte el mismo flag `isGeneric` para agruparse junto a estos dos en la UI.
export const GENERIC_COMBAT_ABILITIES: StartingAbility[] = [
  {
    name: 'Defenderse',
    icon: '🪨',
    description: 'Se planta y aguanta el golpe con pura resistencia física — siempre disponible, y recupera algo de energía.',
    promptText: 'Me planto y aguanto el golpe que venga con pura resistencia física.',
    category: 'combate',
    effects: ['AGUANTE'],
    rol: 'defensa',
    preferredAttribute: 'constitucion',
    energyCost: 0,
    energyRegen: 10,
  },
  {
    name: 'Esquivar',
    icon: '💨',
    description: 'Se aparta del golpe confiando solo en sus reflejos — siempre disponible, y recupera algo de energía.',
    promptText: 'Me aparto del golpe confiando solo en mis reflejos.',
    category: 'combate',
    effects: ['AGUANTE'],
    rol: 'defensa',
    preferredAttribute: 'destreza',
    energyCost: 0,
    energyRegen: 5,
  },
];
