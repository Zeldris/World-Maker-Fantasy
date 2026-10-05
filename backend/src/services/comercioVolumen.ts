// Comercio de volumen Reino↔facción (CR-47, hito 0.2 — fórmula decidida por la usuaria el
// 2026-10-05, contrastada con X4 y Bellwright; la revisa Álvaro). Reglas puras.
//
// - El Reino deja órdenes permanentes en su Mercado: «compra X si baja de N», «vende X si pasa de N»
//   (como el Mercado de Bellwright). Sus caravanas las cumplen con las facciones con tratado o alianza.
// - Precio unidad a unidad con `precioDinamico` (X4): cada unidad comprada vacía el almacén de quien
//   vende y encarece la siguiente; cada unidad vendida llena el de quien compra y abarata la siguiente.
//   Sin descuento por volumen: comprar mucho de golpe sale caro, como debe.
import { precioDinamico } from './economia.js';

export type TipoOrden = 'COMPRA' | 'VENTA';

export interface OrdenPermanente {
  tipo: TipoOrden;
  /// Compra si el stock del Reino baja de aquí; vende si lo supera.
  umbral: number;
  /// Como mucho tantas unidades por viaje.
  lote: number;
}

/// Puro: cuántas unidades mueve la orden ahora (0 si no toca).
export function unidadesDeOrden(orden: OrdenPermanente, stockReino: number): number {
  const falta = orden.tipo === 'COMPRA' ? orden.umbral - stockReino : stockReino - orden.umbral;
  return Math.max(0, Math.min(orden.lote, falta));
}

/// Puro: precio de comprar `unidades` a quien tiene `stockVendedor` (cada una encarece la siguiente).
/// Devuelve cuántas se pueden pagar con `presupuesto` y lo que cuestan.
export function cotizarCompra(valorBase: number, stockVendedor: number, unidades: number, presupuesto = Infinity): { unidades: number; coste: number } {
  let coste = 0;
  let compradas = 0;
  for (let i = 0; i < Math.min(unidades, stockVendedor); i++) {
    const precio = precioDinamico(valorBase, stockVendedor - i);
    if (coste + precio > presupuesto) break;
    coste += precio;
    compradas++;
  }
  return { unidades: compradas, coste };
}

/// Puro: lo que paga quien tiene `stockComprador` por `unidades` (cada una abarata la siguiente).
export function cotizarVenta(valorBase: number, stockComprador: number, unidades: number): number {
  let ingreso = 0;
  for (let i = 0; i < unidades; i++) ingreso += precioDinamico(valorBase, stockComprador + i);
  return ingreso;
}

/// Días de camino de una caravana por número de tramos del grafo (ida); como mínimo 1.
export function diasDeCamino(tramos: number): number {
  return Math.max(1, Math.ceil(tramos / 2));
}
