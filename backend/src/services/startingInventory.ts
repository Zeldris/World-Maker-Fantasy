import type { EquipSlot } from '@prisma/client';
import type { Attribute } from './dice.js';

export interface StartingInventoryItem {
  name: string;
  description: string;
  origin: string;
  slot?: EquipSlot;
  /// Bonificadores múltiples por objeto (2026-08-03, sustituye a statBonusAttribute/statBonusAmount
  /// — un solo par no dejaba, p.ej., una armadura buena sumar fuerza Y defensa a la vez). Mismo
  /// patrón que `Requisitos` (requisitos.ts): mapa parcial, tantas claves como haga falta.
  statBonuses?: Partial<Record<Attribute | 'defensa', number>>;
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
    catalogSlug: 'hacha-guerra-maktor-rota',
  },
  //este item debe ser arma y herramientas. Esto viene a que cada profesion dependera de tener la herramienta para poder usar esa profesion. Asi que este cuchillo vale como arma y tambien para poder hacer crafteos con peleteria o usar la recoleccion de desuello.
  {
    name: 'Cuchillo de hielo sílice',
    description: 'Filo mineral tallado, no forjado — comercio con el Clan Helsig, regalo de Hagar.',
    origin: 'inicial',
    slot: 'ARMA_SECUNDARIA',
    catalogSlug: 'cuchillo-hielo-silice',
  },
  // Herramienta de minero real (2026-08-23, Grupo 3 § HarvestYield.condicion: "requiere pico de
  // minero" en mena de Yerreo/veta de hierro de Los Pilares Rotos, ambas del núcleo jugable) —
  // el objeto de catálogo (`pico-minero`) solo aparecía en el loadout de Hagar Kiugh, fuera del
  // grafo v1 (Cristal Helado), así que sin esto minero quedaba con gate real de herramienta
  // (OFICIOS_CON_HERRAMIENTA_REQUERIDA) pero sin ninguna vía real de conseguirla. Mismo criterio
  // que Hagar aprendió minería junto a Gorhorn en esas mismas minas de Cristal Helado — se lo
  // trajo consigo. Sin `slot`: no ocupa ARMA_SECUNDARIA (ya la lleva el cuchillo de hielo
  // sílice) — `hasToolForOficio` no exige que la herramienta esté equipada, solo en inventario.
  {
    name: 'Pico de minero',
    description: 'Pico de cabeza de hierro pesado y mango largo de madera, punta desgastada de golpear roca y hielo — se lo trajo de las minas de Cristal Helado.',
    origin: 'inicial',
    catalogSlug: 'pico-minero',
  },
  {
    name: 'Tótem Maktor',
    description: 'El tótem del Clan Maktor, atado con cuerdas a la espalda — el objeto más importante de Gorhorn, lo único que le queda de sus ancestros.',
    origin: 'inicial',
    slot: 'COSMETICO_ESPALDA',
    // Sin statBonus* (2026-08-03, corregido — este archivo tenía +1 voluntad puesto a mano, algo
    // que la usuaria nunca pidió y que contradecía directamente su propia decisión de diseño: "es
    // cosmético, no un objeto equipable" con efecto real.
    // Corrección 2026-08-23: la nota de aquí decía "el objeto de ItemCatalog ya estaba bien" —
    // era falso, `totem-maktor` no existía en absoluto en `worldCatalog.ts` (detectado en
    // auditoría lore↔código). Ya tiene fila real, sin bonus, coherente con esta decisión.
    catalogSlug: 'totem-maktor',
  },
  {
    name: 'Arnés de cuero',
    description: 'Cuero curtido sobre el pecho descubierto, sin nada más.',
    origin: 'inicial',
    slot: 'CAMISA',
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
    name: 'Raciones de viaje',
    description: 'Comida seca para varios días de viaje.',
    origin: 'inicial',
    // Nombre distinto al del catálogo a propósito ("Ración de viaje", singular) — se enlaza por
    // catalogSlug en vez de depender de que el nombre coincida letra a letra (por eso
    // `entityDiscovery.ts` nunca lo había reconocido).
    //
    // Bug real (auditoría 2026-07-30, "revisar partida"): el nombre incluía "(5 días)" — sin
    // ninguna mecánica real detrás que contara esos días (el objeto se consume entero de una vez,
    // no día a día), el clasificador de turnos (turn.ts) lo leía como si "(5 días)" fuera la
    // DURACIÓN de la propia acción de "consumir la ración", clasificándola como banda "larga" y
    // dejando al jugador en un `CharacterTransit` real de casi una hora por comer. Quitado el
    // número: ya no tiene sentido de todos modos (nunca se contaron los días).
    catalogSlug: 'racion-viaje',
  },
  {
    name: 'Cataplasma de salvia del polvo',
    description: 'Pasta verde grisácea de hojas machacadas de Salvia del Polvo — corta hemorragias y limpia heridas.',
    origin: 'inicial',
    // Petición explícita (2026-07-29, "para las pruebas") — objeto médico real (curaHasta: HERIDO
    // en ItemCatalog), para poder probar las reglas de curación sin tener que craftearlo primero.
    catalogSlug: 'cataplasma-salvia-polvo',
  },
];

export function startingInventoryFor(characterName: string): StartingInventoryItem[] {
  if (characterName === 'Gorhorn') return GORHORN_STARTING_INVENTORY;
  return [];
}
