// Tope de `darObjetos.ts` (puro, para probarlo sin base). P367 (2026-11-03): el script ya no mete objetos por encima de la
// capacidad del inventario (`inventoryCapacityFor`): da lo que cabe, por orden, y avisa de lo que se queda fuera. Antes
// los metía igual (a propósito, para preparar escenarios) y la partida quedaba «llena» sin que el escenario lo dijera: el
// juego luego rechaza recoger, recolectar y comprar, y un escenario con 170/37 parecía roto sin motivo.
export interface PorDar { slug: string; nombre: string; cantidad: number }
export interface Repartido { dar: PorDar[]; fuera: PorDar[]; avisos: string[] }

/// Da lo que cabe en `capacidad - carga` unidades (cada unidad dada ocupa 1, una fila por unidad), por orden de los pares.
/// Lo que no cabe se devuelve en `fuera` y cada recorte se explica en `avisos`.
export function repartirPorCapacidad(lote: PorDar[], carga: number, capacidad: number): Repartido {
  let hueco = Math.max(0, capacidad - carga);
  const dar: PorDar[] = [];
  const fuera: PorDar[] = [];
  const avisos: string[] = [];
  for (const p of lote) {
    const caben = Math.min(p.cantidad, hueco);
    hueco -= caben;
    if (caben > 0) dar.push({ ...p, cantidad: caben });
    if (caben < p.cantidad) {
      fuera.push({ ...p, cantidad: p.cantidad - caben });
      avisos.push(`AVISO: ${p.nombre}: ${caben === 0 ? 'no se da ninguno' : `se dan ${caben} de ${p.cantidad}`} (inventario ${carga}/${capacidad}: el tope no se pasa). Para dar más, deja hueco o usa mochila-libre.`);
    }
  }
  return { dar, fuera, avisos };
}

/// El inventario ya estaba por encima del tope antes de dar nada (p. ej. un escenario viejo hecho cuando `dar` no lo respetaba).
export function avisoDeCarga(carga: number, capacidad: number): string | null {
  if (carga <= capacidad) return null;
  return `AVISO: el inventario está con ${carga} unidades y la capacidad es ${capacidad} (${carga - capacidad} de más). El juego no dejará recoger ni recolectar hasta que baje la carga (preparar <partida> mochila-libre).`;
}
