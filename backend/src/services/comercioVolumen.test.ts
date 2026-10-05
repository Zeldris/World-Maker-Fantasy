import { describe, it, expect } from 'vitest';
import { cotizarCompra, cotizarVenta, diasDeCamino, unidadesDeOrden } from './comercioVolumen.js';
import { precioDinamico } from './economia.js';

/// CR-47: comercio de volumen (órdenes permanentes y precio unidad a unidad, como en X4).
describe('comercio de volumen (CR-47)', () => {
  it('la orden solo mueve lo que falta o sobra, como mucho un lote', () => {
    expect(unidadesDeOrden({ tipo: 'COMPRA', umbral: 20, lote: 5 }, 12)).toBe(5);
    expect(unidadesDeOrden({ tipo: 'COMPRA', umbral: 20, lote: 10 }, 17)).toBe(3);
    expect(unidadesDeOrden({ tipo: 'COMPRA', umbral: 20, lote: 10 }, 25)).toBe(0);
    expect(unidadesDeOrden({ tipo: 'VENTA', umbral: 80, lote: 10 }, 84)).toBe(4);
    expect(unidadesDeOrden({ tipo: 'VENTA', umbral: 80, lote: 10 }, 60)).toBe(0);
  });

  it('comprar mucho sale más caro por unidad: cada una vacía el almacén del que vende', () => {
    const una = cotizarCompra(10, 10, 1).coste;
    const diez = cotizarCompra(10, 10, 10).coste;
    expect(una).toBe(precioDinamico(10, 10));
    expect(diez).toBeGreaterThan(10 * una);
    // No hay más de lo que tiene.
    expect(cotizarCompra(10, 3, 10).unidades).toBe(3);
  });

  it('el presupuesto corta la compra', () => {
    const r = cotizarCompra(10, 20, 10, 25);
    expect(r.coste).toBeLessThanOrEqual(25);
    expect(r.unidades).toBeLessThan(10);
  });

  it('vender mucho sale más barato por unidad: cada una llena el almacén del que compra', () => {
    expect(cotizarVenta(10, 0, 10)).toBeLessThan(10 * precioDinamico(10, 0));
  });

  it('días de camino por los minutos del trayecto', () => {
    expect(diasDeCamino(0)).toBe(1);
    expect(diasDeCamino(480)).toBe(1);
    expect(diasDeCamino(900)).toBe(2);
  });
});
