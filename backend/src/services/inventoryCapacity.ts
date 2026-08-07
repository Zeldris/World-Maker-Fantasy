/// Capacidad de inventario (rediseño de profesiones, 2026-08-07, decisión explícita de la
/// usuaria: "el inventario va a ser por slots y dependerá en parte de los stats de fuerza y
/// constitución y por otro por los cosméticos que podrán tener bonus del tipo +5 slots") — hasta
/// ahora el inventario no tenía ningún tope en todo el juego. Un slot = una fila de InventoryItem
/// (mismo criterio simple que ya usa el resto del inventario, no peso). Mismo espíritu que
/// `energiaMaxFor` (energy.ts): fórmula base + bonus, ajustable si hace falta tras probarla.
export function inventoryCapacityFor(fuerza: number, constitucion: number, cosmeticBonus: number): number {
  return 20 + fuerza + constitucion + cosmeticBonus;
}
