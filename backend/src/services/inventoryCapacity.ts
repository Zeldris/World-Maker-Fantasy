import { quantityOf } from './ingredients.js';

/// Capacidad de inventario (rediseño de profesiones, 2026-08-07, decisión explícita de la
/// usuaria: "el inventario va a ser por slots y dependerá en parte de los stats de fuerza y
/// constitución y por otro por los cosméticos que podrán tener bonus del tipo +5 slots") — hasta
/// ahora el inventario no tenía ningún tope en todo el juego. Un slot = una fila de InventoryItem
/// (mismo criterio simple que ya usa el resto del inventario, no peso). Mismo espíritu que
/// `energiaMaxFor` (energy.ts): fórmula base + bonus, ajustable si hace falta tras probarla.
export function inventoryCapacityFor(fuerza: number, constitucion: number, cosmeticBonus: number): number {
  return 20 + fuerza + constitucion + cosmeticBonus;
}

/// Bug real jugando en vivo (2026-08-08, "a ver si un slot pero lo que se acumule en el cuenta
/// como slot... sino es que podemos tener inventario infinito"): la propia usuaria pidió "un slot
/// = una fila" el 2026-08-07, pero `recolectar.ts` comprobaba la capacidad contando FILAS
/// (`InventoryItem.count()`) contra el número de SELECCIONES de la petición — ninguno de los dos
/// mira la CANTIDAD acumulada. Una vez existe una fila ("Piedra (1)"), cada recolección siguiente
/// solo incrementa su cantidad (mismo patrón de `TouchedStack`, recolectar.ts) sin crear una fila
/// nueva, así que `count()` nunca sube — inventario realmente ilimitado para cualquier recurso ya
/// poseído, aunque solo ocupe "1 slot" en la UI. Corregido: la capacidad ahora se mide en UNIDADES
/// totales (`quantityOf` de cada fila, ingredients.ts) — una fila sigue siendo un solo renglón
/// visual, pero cada unidad que acumula cuenta contra el tope igual que si fuera su propia fila.
export function totalInventoryUnits(items: { name: string }[]): number {
  return items.reduce((sum, item) => sum + quantityOf(item.name), 0);
}
