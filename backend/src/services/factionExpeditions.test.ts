import { describe, it, expect } from 'vitest';
import {
  DURACION_EXPEDICION_DIAS, MAX_GUARDIAS, MAX_RECOLECTORES, MAX_UNIDADES_POR_RECOLECTOR,
  elegirBotinDeRecolector, elegirGuardias, elegirRecolectores, esRolGuardia, metodoExpedicionFor,
  oficioRutaFor, oficiosDeRecoleccionOrdenados, ordenarDestinos, regionesElegibles, resolverInterceptacion,
  riesgoIntercepcion, riesgoPorRelacion, seIntercepta, xpRecolector,
} from './factionExpeditions.js';
import type { SourceCandidate } from '../routes/saves/recolectar.js';

describe('metodoExpedicionFor / oficioRutaFor', () => {
  it('acepta pescador, minero, herborista; excluye desollador y oficios de crafteo', () => {
    expect(metodoExpedicionFor('pescador')).toBe('PESCA');
    expect(metodoExpedicionFor('minero-cristal')).toBe('MINERIA');
    expect(metodoExpedicionFor('herborista-orcos-llanuras')).toBe('EXTRACCION');
    expect(metodoExpedicionFor('desollador-orcos-llanuras')).toBeNull();
    expect(metodoExpedicionFor('herrero-orcos-llanuras')).toBeNull();
  });
  it('pescador va por la ruta Pescar', () => {
    expect(oficioRutaFor('pescador')).toBe('pescador-pescar');
    expect(oficioRutaFor('minero-cristal')).toBe('minero-cristal');
  });
});

describe('elección de miembros y destino', () => {
  const cands = [
    { npcId: 'c', professionId: 'pescador', nivel: 3 },
    { npcId: 'a', professionId: 'pescador', nivel: 7 },
    { npcId: 'b', professionId: 'pescador', nivel: 3 },
    { npcId: 'd', professionId: 'herrero-orcos-llanuras', nivel: 9 },
    { npcId: 'e', professionId: 'desollador-orcos-llanuras', nivel: 6 },
  ];
  it('recolectores: máximo 2, mayor nivel primero, desempate por id', () => {
    const r = elegirRecolectores(cands, 'pescador');
    expect(r.map((x) => x.npcId)).toEqual(['a', 'b']);
    expect(r.length).toBeLessThanOrEqual(MAX_RECOLECTORES);
  });
  it('oficios: solo los recolectores viables, determinista por día y rotando', () => {
    const c2 = [...cands, { npcId: 'f', professionId: 'minero-cristal', nivel: 3 }];
    const d0 = oficiosDeRecoleccionOrdenados(c2, 0, 'fac');
    expect(d0.sort()).toEqual(['minero-cristal', 'pescador']);
    expect(oficiosDeRecoleccionOrdenados(c2, 5, 'fac')).toEqual(oficiosDeRecoleccionOrdenados(c2, 5, 'fac'));
    expect(oficiosDeRecoleccionOrdenados(c2, 0, 'fac')[0]).not.toBe(oficiosDeRecoleccionOrdenados(c2, 1, 'fac')[0]);
    expect(oficiosDeRecoleccionOrdenados([cands[3]!, cands[4]!], 0, 'fac')).toEqual([]);
  });
  it('guardias: role guerrero/guardia/patrulla, máximo 2, sin repetir recolectores', () => {
    const npcs = [
      { id: '1', role: 'Guerrero del Clan Serhu' }, { id: '2', role: 'Guardia de la puerta' },
      { id: '3', role: 'Patrullero' }, { id: '4', role: 'Pescador' }, { id: '5', role: 'Guerrera' },
    ];
    const g = elegirGuardias(npcs, ['1']);
    expect(g).toEqual(['2', '3']);
    expect(g.length).toBeLessThanOrEqual(MAX_GUARDIAS);
    expect(esRolGuardia('Pescador')).toBe(false);
    expect(esRolGuardia('Guerrera veterana')).toBe(true);
  });
  it('destinos: orden determinista por slug rotado por día', () => {
    const ds = [{ slug: 'b' }, { slug: 'a' }, { slug: 'c' }];
    expect(ordenarDestinos(ds, 0, 'x').map((d) => d.slug).sort()).toEqual(['a', 'b', 'c']);
    expect(ordenarDestinos(ds, 3, 'x')).toEqual(ordenarDestinos(ds, 3, 'x'));
    expect(ordenarDestinos([], 3, 'x')).toEqual([]);
  });
  it('regiones elegibles: propias o sin dueño', () => {
    const r = regionesElegibles('Clan Serhu', ['Las Llanuras del Viento Rojo', 'Cristal Helado', 'Tierra de Nadie']);
    expect(r).toEqual(['Las Llanuras del Viento Rojo', 'Tierra de Nadie']);
  });
});

describe('riesgo de intercepción', () => {
  it('GUERRA 50, TENSION 20, resto 0', () => {
    expect(riesgoPorRelacion('GUERRA')).toBe(50);
    expect(riesgoPorRelacion('TENSION')).toBe(20);
    for (const t of ['NEUTRAL', 'ALIANZA', 'TRATADO_COMERCIAL'] as const) expect(riesgoPorRelacion(t)).toBe(0);
    expect(riesgoPorRelacion(null)).toBe(0);
  });
  it('región compartida: manda la peor relación con los OTROS dueños; región propia en solitario = 0', () => {
    const rel = new Map<string, 'GUERRA' | 'TENSION' | 'NEUTRAL'>([['Keseg Prisilke', 'TENSION']]);
    expect(riesgoIntercepcion('Ciénaga Troncal', 'Clan Goshg', rel)).toBe(20);
    expect(riesgoIntercepcion('Ciénaga Troncal', 'Keseg Prisilke', rel)).toBe(0);
    expect(riesgoIntercepcion('Las Llanuras del Viento Rojo', 'Clan Serhu', rel)).toBe(0);
    expect(riesgoIntercepcion('Región inventada', 'Clan Serhu', rel)).toBe(0);
  });
  it('la tirada dispara por debajo del riesgo; riesgo 0 nunca', () => {
    expect(seIntercepta(50, 0.49)).toBe(true);
    expect(seIntercepta(50, 0.5)).toBe(false);
    expect(seIntercepta(0, 0)).toBe(false);
  });
  it('gancho 13-C: hoy la carga se pierde', async () => {
    expect((await resolverInterceptacion({ expedicionId: 'x', factionId: 'f', destinoRegion: 'r', guardiaNpcIds: ['g'], recolectorNpcIds: [] })).carga).toBe('perdida');
  });
});

describe('botín y XP', () => {
  const cand: SourceCandidate[] = [
    { sourceSlug: 's1', sourceCategory: 'c', disponible: 5, yields: [{ itemSlug: 'i1', itemName: 'Uno', cantidadMaxima: 10, tier: 2, sinTirada: false }] },
    { sourceSlug: 's2', sourceCategory: 'c', disponible: 5, yields: [{ itemSlug: 'i2', itemName: 'Dos', cantidadMaxima: 1, tier: null, sinTirada: false }] },
  ];
  it('elige un yield con cantidad acotada', () => {
    const a = elegirBotinDeRecolector(cand, 'n', 'pescador', () => 0)!;
    expect(a).toMatchObject({ catalogSlug: 'i1', cantidad: MAX_UNIDADES_POR_RECOLECTOR, tier: 2 });
    const b = elegirBotinDeRecolector(cand, 'n', 'pescador', () => 0.99)!;
    expect(b).toMatchObject({ catalogSlug: 'i2', cantidad: 1, tier: 1 });
    expect(elegirBotinDeRecolector([], 'n', 'p', () => 0)).toBeNull();
  });
  it('XP: la del tier más alto recogido; sin nada, 0', () => {
    expect(xpRecolector([])).toBe(0);
    expect(xpRecolector([{ tier: 1 }, { tier: 3 }])).toBe(50);
  });
  it('duración por defecto 2 días', () => {
    expect(DURACION_EXPEDICION_DIAS).toBe(2);
  });
});
