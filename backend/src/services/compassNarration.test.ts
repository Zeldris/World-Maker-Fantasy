import { describe, it, expect } from 'vitest';
import { compassNarrationText, type CompassLinkInfo } from './compassNarration.js';

describe('compassNarrationText', () => {
  it('sin ningún camino con dirección conocida, devuelve la frase de reserva', () => {
    expect(compassNarrationText([], true)).toBe('Sostienes la Aguja de Cardo Brújula en alto, pero gira sin encontrar ningún camino conocido cerca.');
    expect(compassNarrationText([], false)).toBe('Sostienes la Aguja de Cardo Brújula en alto, pero gira sin encontrar ningún camino conocido cerca.');
  });

  it('con mapa, nombra el destino real y los minutos', () => {
    const links: CompassLinkInfo[] = [{ direction: 'sur', toName: 'Los Pilares Rotos', terreno: 'llanura abierta', minutosBase: 30 }];
    const text = compassNarrationText(links, true);
    expect(text).toBe('Consultas el mapa y, guiándote por el imán, ves que al sur hay camino a Los Pilares Rotos (30 min).');
  });

  it('sin mapa, describe el terreno de la ruta sin nombrar el destino', () => {
    const links: CompassLinkInfo[] = [{ direction: 'sur', toName: 'Los Pilares Rotos', terreno: 'llanura abierta', minutosBase: 30 }];
    const text = compassNarrationText(links, false);
    expect(text).toBe('Sin mapa a mano, giras la aguja y describes lo que percibes alrededor: al sur: llanura abierta.');
    expect(text).not.toContain('Pilares Rotos');
  });

  it('agrupa varios caminos en la misma dirección en una sola cláusula', () => {
    const links: CompassLinkInfo[] = [
      { direction: 'sur', toName: 'Los Pilares Rotos', terreno: 'llanura abierta', minutosBase: 30 },
      { direction: 'sur', toName: 'El Pozo de Cauce Viejo', terreno: 'senda de pastoreo', minutosBase: 12 },
    ];
    const text = compassNarrationText(links, true);
    expect(text).toBe('Consultas el mapa y, guiándote por el imán, ves que al sur hay caminos a Los Pilares Rotos (30 min) y El Pozo de Cauce Viejo (12 min).');
  });

  it('ordena varias direcciones distintas siempre en el mismo orden de sectores', () => {
    const links: CompassLinkInfo[] = [
      { direction: 'oeste', toName: 'X', terreno: 't1', minutosBase: 10 },
      { direction: 'norte', toName: 'Y', terreno: 't2', minutosBase: 20 },
    ];
    const text = compassNarrationText(links, true);
    expect(text.indexOf('al norte')).toBeLessThan(text.indexOf('al oeste'));
  });
});
