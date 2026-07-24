import type { EquipSlot } from '@prisma/client';
import type { Attribute } from './dice.js';

export interface StartingInventoryItem {
  name: string;
  description: string;
  origin: string;
  slot?: EquipSlot;
  statBonusAttribute?: Attribute | 'defensa';
  statBonusAmount?: number;
  /// Slug de ItemCatalog (petición explícita de la usuaria, 2026-07-24: "el hacha de guerra y el
  /// tótem que llevo equipado no están en la enciclopedia") — sin esto, el equipo inicial nunca
  /// tenía fila de catálogo que enlazar, así que era invisible tanto en la Enciclopedia (su lista
  /// de objetos sale de ItemCatalog) como para `entityDiscovery.ts` (solo reconoce nombres de
  /// ItemCatalog). Opcional: no todo objeto narrativo suelto necesita una fila de catálogo.
  catalogSlug?: string;
}

/// Equipo inicial "de serie" de Gorhorn (2026-07-19) — hasta ahora el inventario inicial solo
/// vivía como texto en docs/rpgtarkor/personajes.md § 5 ("Inventario inicial"), nunca como filas
/// reales (mismo hallazgo del roadmap de Fable). Se siembra al crear partida y al reiniciarla,
/// mismo patrón que startingAbilitiesFor. Bonificadores en armas/tótem (atributo) y armadura
/// (slot de defensa, 2026-07-19) — Gorhorn es guerrero, nada mágico todavía (instrucción
/// explícita de la usuaria).
const GORHORN_STARTING_INVENTORY: StartingInventoryItem[] = [
  {
    name: 'Hacha de guerra rota',
    description: 'El hacha de guerra de su clan, partida por la mitad — la usa como una maza pesada.',
    origin: 'inicial',
    slot: 'ARMA_PRINCIPAL',
    statBonusAttribute: 'fuerza',
    statBonusAmount: 2,
    catalogSlug: 'hacha-guerra-maktor-rota',
  },
  {
    name: 'Cuchillo de hielo sílice',
    description: 'Filo mineral tallado, no forjado — comercio con el Clan Helsig, regalo de Hagar.',
    origin: 'inicial',
    slot: 'ARMA_SECUNDARIA',
    statBonusAttribute: 'sigilo',
    statBonusAmount: 1,
    catalogSlug: 'cuchillo-hielo-silice',
  },
  {
    name: 'Tótem Maktor',
    description: 'El tótem del Clan Maktor, atado con cuerdas a la espalda — el objeto más importante de Gorhorn, lo único que le queda de sus ancestros.',
    origin: 'inicial',
    slot: 'ABALORIO',
    statBonusAttribute: 'voluntad',
    statBonusAmount: 1,
    catalogSlug: 'totem-maktor',
  },
  {
    name: 'Arnés de cuero',
    description: 'Cuero curtido sobre el pecho descubierto, sin nada más.',
    origin: 'inicial',
    slot: 'CAMISA',
    statBonusAttribute: 'defensa',
    statBonusAmount: 1,
    catalogSlug: 'arnes-cuero',
  },
  {
    name: 'Pantalones de piel',
    description: 'Piel con pequeños detalles de pelo de cornamenta.',
    origin: 'inicial',
    slot: 'ARMADURA_INFERIOR',
    catalogSlug: 'pantalones-piel',
  },
  {
    name: 'Capa de piel de gargantúa',
    description: 'Con plumas de Sombras de Kroj, decorativas — atada a modo de falda, se usa en zonas frías durante los viajes largos.',
    origin: 'inicial',
    slot: 'ACCESORIO',
    catalogSlug: 'capa-piel-gargantua',
  },
  {
    name: 'Raciones de viaje (5 días)',
    description: 'Comida seca para cinco días de viaje.',
    origin: 'inicial',
    // Nombre distinto al del catálogo a propósito ("Ración de viaje", singular) — la cantidad
    // (5 días) es propia de esta partida, no del catálogo genérico; se enlaza por catalogSlug en
    // vez de depender de que el nombre coincida letra a letra (por eso `entityDiscovery.ts` nunca
    // lo había reconocido).
    catalogSlug: 'racion-viaje',
  },
];

export function startingInventoryFor(characterName: string): StartingInventoryItem[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_INVENTORY;
  return [];
}
