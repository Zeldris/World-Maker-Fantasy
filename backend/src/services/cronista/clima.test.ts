import { describe, it, expect } from 'vitest';
import { sucesosDeClima } from './clima.js';
import { climaFor } from '../worldClock.js';
import { textoDeSuceso, type DatosSuceso, type TipoSuceso } from './catalogoSucesos.js';

// CR-3 (hito 0.2): sucesos de clima al cruzar días.
describe('sucesosDeClima', () => {
  const REGION = 'Las Llanuras del Viento Rojo';
  const texto = (s: ReturnType<typeof sucesosDeClima>[number]) => textoDeSuceso(s.tipo as TipoSuceso, s.datos as DatosSuceso[TipoSuceso]);

  it('un día de tormenta en la región del personaje deja su suceso, con la región en la frase', () => {
    // Busca el primer día con tormenta en las Llanuras según el propio reloj.
    let dia = 1;
    while (!['TORMENTA_GRANDE', 'TORMENTA_EXTREMA'].includes(climaFor(dia * 1440, REGION) ?? '')) dia++;
    const sucesos = sucesosDeClima(dia * 1440 - 1, dia * 1440, REGION, null);
    const tormenta = sucesos.find((s) => s.tipo === 'TORMENTA' || s.tipo === 'TORMENTA_EXTREMA')!;
    expect(tormenta.regionSlug).toBe('las-llanuras-del-viento-rojo');
    expect(texto(tormenta)).toMatch(/azota las Llanuras del Viento Rojo|arrasa las Llanuras del Viento Rojo/);
  });

  it('cruzar el día 30 → 31 cambia de estación', () => {
    const sucesos = sucesosDeClima(30 * 1440 - 1, 30 * 1440, null, null);
    expect(sucesos.map((s) => s.tipo)).toContain('CAMBIO_ESTACION');
  });

  it('sin cruzar de día no hay nada, y sin región no hay tormentas', () => {
    expect(sucesosDeClima(100, 200, REGION, null)).toEqual([]);
    expect(sucesosDeClima(0, 10 * 1440, null, null).filter((s) => s.tipo !== 'CAMBIO_ESTACION')).toEqual([]);
  });
});
