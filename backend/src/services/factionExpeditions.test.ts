import { MAX_RONDAS_SUBCOMBATE } from './combateDeFondo.js';
import { describe, it, expect } from 'vitest';
import {
  DURACION_EXPEDICION_DIAS, MAX_GUARDIAS, MAX_RECOLECTORES, MAX_UNIDADES_POR_RECOLECTOR,
  elegirBotinDeRecolector, elegirGuardias, elegirRecolectores, esRolGuardia, metodoExpedicionFor,
  oficioRutaFor, oficiosDeRecoleccionOrdenados, ordenarDestinos, regionesElegibles, resolverInterceptacion,
  elegirAtacante, faccionHostilDeRegion, simularCombateInterceptacion, type CombatienteInterceptacion,
  riesgoIntercepcion, riesgoPorRelacion, seIntercepta, xpRecolector,
  priorizarOficios, priorizarDestinos, motivoDeExpedicion, esComestible,
  PROBABILIDAD_MUERTE_EN_INTERCEPCION, muereTrasCaer, tirarMuertes, npcElegibleParaExpedicion, SLUGS_NPC_DE_TRAMA, type NpcParaElegibilidad, type NpcsProtegidos,
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
});

describe('intercepción con combate (Fase 13-C)', () => {
  const bloque = (v: number) => ({ fuerza: v, destreza: v, constitucion: v, inteligencia: v, voluntad: v, carisma: v, magia: v });
  const comb = (id: string, v: number): CombatienteInterceptacion => ({ id, slug: id, nombre: id, attributes: bloque(v), attribute: 'fuerza', attributeBonus: 0 });
  /// Todos los d20 dan 11: el desenlace solo depende de los atributos.
  const fijo = () => 0.5;

  it('sin guardias la carga se pierde (sin tocar la BD)', async () => {
    const r = await resolverInterceptacion({} as never, { expedicionId: 'x', worldId: 'w', factionId: 'f', factionName: 'A', faccionHostilNombre: 'B', guardiaNpcIds: [], recolectorNpcIds: [] }, fijo);
    expect(r.carga).toBe('perdida');
    expect(r.resumen).toMatchObject({ ganador: 'sin-combate', motivo: 'sin-guardias', presionAplicada: false });
  });
  it('sin facción hostil identificable la carga se pierde', async () => {
    const r = await resolverInterceptacion({} as never, { expedicionId: 'x', worldId: 'w', factionId: 'f', factionName: 'A', faccionHostilNombre: null, guardiaNpcIds: ['g'], recolectorNpcIds: [] }, fijo);
    expect(r).toMatchObject({ carga: 'perdida', resumen: { motivo: 'sin-atacante' } });
  });
  it('guardias fuertes contra un atacante débil resisten', () => {
    const r = simularCombateInterceptacion(comb('atacante', 4), [comb('g1', 18), comb('g2', 18)], fijo);
    expect(r).toMatchObject({ ganador: 'defensores', tope: false });
    expect(r.rondas).toBeLessThanOrEqual(MAX_RONDAS_SUBCOMBATE);
  });
  it('un guardia débil contra un atacante fuerte pierde', () => {
    const r = simularCombateInterceptacion(comb('atacante', 18), [comb('g1', 4)], fijo);
    expect(r).toMatchObject({ ganador: 'atacante', tope: false });
    expect(r.rondas).toBe(3); // tres escalones de condición: HERIDO, GRAVE, CONVALECIENTE
  });
  it('tope de rondas: si nadie cae los defensores resisten', () => {
    // Atributos iguales y d20 iguales: empate exacto = el golpe no conecta, para los dos lados.
    // CR-62: con el motor de fondo común el tope es el de sus sub-combates.
    const r = simularCombateInterceptacion(comb('atacante', 10), [comb('g1', 10)], fijo);
    expect(r).toMatchObject({ ganador: 'defensores', tope: true, condicionAtacante: 'ILESO', condicionGuardias: ['ILESO'] });
    expect(r.rondas).toBeGreaterThanOrEqual(MAX_RONDAS_SUBCOMBATE);
  });
  it('el combate expone la condición final de cada bando', () => {
    const r = simularCombateInterceptacion(comb('atacante', 18), [comb('g1', 4)], fijo);
    expect(r.condicionGuardias).toEqual(['CONVALECIENTE']);
    expect(r.condicionAtacante).toBe('ILESO');
  });
  it('sin guardias en el simulador gana el atacante sin rondas', () => {
    expect(simularCombateInterceptacion(comb('a', 10), [], fijo)).toEqual({ ganador: 'atacante', rondas: 0, tope: false, condicionAtacante: 'ILESO', condicionGuardias: [] });
  });
  it('determinista con el mismo random', () => {
    const secuencia = () => { let i = 0; const v = [0.13, 0.77, 0.42, 0.91, 0.05, 0.63, 0.28, 0.5]; return () => v[i++ % v.length]!; };
    const a = simularCombateInterceptacion(comb('a', 12), [comb('g1', 11), comb('g2', 9)], secuencia());
    const b = simularCombateInterceptacion(comb('a', 12), [comb('g1', 11), comb('g2', 9)], secuencia());
    expect(a).toEqual(b);
  });
  it('faccionHostilDeRegion: la de mayor riesgo entre los otros dueños; null si todas neutrales', () => {
    const rel = new Map<string, 'GUERRA' | 'TENSION' | 'NEUTRAL'>([['Los del Obelisco', 'GUERRA']]);
    expect(faccionHostilDeRegion('La Meseta del Orden', 'Concordia de Hierro', rel)).toBe('Los del Obelisco');
    expect(faccionHostilDeRegion('La Meseta del Orden', 'Concordia de Hierro', new Map([['Los del Obelisco', 'NEUTRAL' as const]]))).toBeNull();
    expect(faccionHostilDeRegion('Las Llanuras del Viento Rojo', 'Clan Serhu', rel)).toBeNull();
  });
  it('elegirAtacante: prefiere rol guardia y mayor nivel, luego slug; cae a cualquier humanoide; ignora fauna', () => {
    const n = (slug: string, role: string, level: number, faunaCategoria: string | null = null) => ({ slug, role, level, faunaCategoria });
    expect(elegirAtacante([n('b-cocinero', 'cocinero', 9), n('z-guardia', 'Guardia del clan', 2), n('a-guerrero', 'Guerrero', 2), n('lobo', 'guardia lobo', 9, 'depredador')])?.slug).toBe('a-guerrero');
    expect(elegirAtacante([n('b', 'cocinero', 1), n('a', 'herrero', 3)])?.slug).toBe('a');
    expect(elegirAtacante([n('lobo', 'bestia', 3, 'depredador')])).toBeNull();
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

describe('muerte en la intercepción', () => {
  it('probabilidad por defecto muy baja (3 %)', () => {
    expect(PROBABILIDAD_MUERTE_EN_INTERCEPCION).toBe(0.03);
  });
  it('muereTrasCaer: solo si la tirada cae por debajo de la probabilidad', () => {
    expect(muereTrasCaer(0.03, 0.02)).toBe(true);
    expect(muereTrasCaer(0.03, 0.03)).toBe(false);
    expect(muereTrasCaer(0.03, 0.99)).toBe(false);
    expect(muereTrasCaer(0, 0)).toBe(false);
    expect(muereTrasCaer(1, 0.999)).toBe(true);
  });
  const at = (condicion: 'ILESO' | 'HERIDO' | 'GRAVE' | 'CONVALECIENTE' | 'MUERTO') => ({ id: 'a', slug: 'atacante', condicion });
  const gu = (id: string, condicion: 'ILESO' | 'HERIDO' | 'GRAVE' | 'CONVALECIENTE' | 'MUERTO') => ({ id, slug: `slug-${id}`, condicion });
  it('solo tiran los que caen (CONVALECIENTE o peor); con probabilidad 1 mueren todos ellos', () => {
    const muertes = tirarMuertes(at('GRAVE'), [gu('g1', 'CONVALECIENTE'), gu('g2', 'HERIDO')], 1, () => 0.5);
    expect(muertes).toEqual([{ npcId: 'g1', slug: 'slug-g1', rol: 'guardia' }]);
    expect(tirarMuertes(at('CONVALECIENTE'), [gu('g1', 'CONVALECIENTE')], 1, () => 0.5).map((m) => m.rol)).toEqual(['atacante', 'guardia']);
  });
  it('con probabilidad 0 nadie muere y quien sigue en pie no consume random', () => {
    let llamadas = 0;
    const random = () => { llamadas++; return 0; };
    expect(tirarMuertes(at('CONVALECIENTE'), [gu('g1', 'CONVALECIENTE')], 0, random)).toEqual([]);
    expect(llamadas).toBe(2);
    llamadas = 0;
    tirarMuertes(at('ILESO'), [gu('g1', 'HERIDO')], 1, random);
    expect(llamadas).toBe(0);
  });
  it('determinista: mismo random, mismas muertes, en orden atacante y guardias', () => {
    const secuencia = () => { let i = 0; const v = [0.01, 0.9, 0.02]; return () => v[i++ % v.length]!; };
    const caidos = () => tirarMuertes(at('CONVALECIENTE'), [gu('g1', 'CONVALECIENTE'), gu('g2', 'CONVALECIENTE')], 0.03, secuencia());
    expect(caidos()).toEqual(caidos());
    expect(caidos().map((m) => m.npcId)).toEqual(['a', 'g2']);
  });
});

describe('npcElegibleParaExpedicion', () => {
  const npc = (o: Partial<NpcParaElegibilidad> = {}): NpcParaElegibilidad => ({ id: 'n1', slug: 'n-uno', interactionTypes: [], teachesProfession: null, muertoEnMundo: false, ...o });
  const ninguno: NpcsProtegidos = { ids: new Set(), slugs: new Set() };
  const roles = ['recolector', 'guardia', 'atacante'] as const;
  it('un NPC corriente vale para cualquier rol', () => {
    for (const rol of roles) expect(npcElegibleParaExpedicion(npc(), rol, ninguno)).toBe(true);
  });
  it('nunca un muerto de mundo', () => {
    for (const rol of roles) expect(npcElegibleParaExpedicion(npc({ muertoEnMundo: true }), rol, ninguno)).toBe(false);
  });
  it('nunca un líder de facción ni un objetivo de misión (por id)', () => {
    for (const rol of roles) expect(npcElegibleParaExpedicion(npc(), rol, { ids: new Set(['n1']), slugs: new Set() })).toBe(false);
  });
  it('nunca NPC de trama fija ni compañeros (por slug); Gistera Koh está en la lista', () => {
    expect(SLUGS_NPC_DE_TRAMA).toContain('gistera-koh');
    for (const rol of roles) {
      expect(npcElegibleParaExpedicion(npc({ slug: 'gistera-koh' }), rol, { ids: new Set(), slugs: new Set(SLUGS_NPC_DE_TRAMA) })).toBe(false);
      expect(npcElegibleParaExpedicion(npc(), rol, { ids: new Set(), slugs: new Set(['n-uno']) })).toBe(false);
    }
  });
  it('nunca un NPC con NPC_MISION; NPC_LORE y MAESTRO_OFICIO solos no bloquean', () => {
    for (const rol of roles) expect(npcElegibleParaExpedicion(npc({ interactionTypes: ['NPC_LORE', 'NPC_MISION'] }), rol, ninguno)).toBe(false);
    expect(npcElegibleParaExpedicion(npc({ interactionTypes: ['NPC_LORE'] }), 'guardia', ninguno)).toBe(true);
  });
  it('un Maestro puede recolectar pero no ser guardia ni atacante', () => {
    const maestro = npc({ teachesProfession: 'pescador', interactionTypes: ['MAESTRO_OFICIO'] });
    expect(npcElegibleParaExpedicion(maestro, 'recolector', ninguno)).toBe(true);
    expect(npcElegibleParaExpedicion(maestro, 'guardia', ninguno)).toBe(false);
    expect(npcElegibleParaExpedicion(maestro, 'atacante', ninguno)).toBe(false);
  });
  it('es determinista (pura): mismas entradas, mismo resultado', () => {
    expect(npcElegibleParaExpedicion(npc(), 'guardia', ninguno)).toBe(npcElegibleParaExpedicion(npc(), 'guardia', ninguno));
  });
});

describe('expediciones dirigidas (CR-34 34b)', () => {
  const comida = [{ tipo: 'COMIDA' as const, gravedad: 'GRAVE' as const }];

  it('con hambre, la pesca y después la extracción van primero; sin hambre, la rotación del día', () => {
    expect(metodoExpedicionFor('herborista-orcos-llanuras')).toBe('EXTRACCION');
    expect(metodoExpedicionFor('minero-cristal')).toBe('MINERIA');
    const rotacion = ['minero-cristal', 'herborista-orcos-llanuras', 'pescador'];
    expect(priorizarOficios(rotacion, [])).toEqual(rotacion);
    expect(priorizarOficios(rotacion, comida)).toEqual(['pescador', 'herborista-orcos-llanuras', 'minero-cristal']);
    expect(priorizarOficios(rotacion, [{ tipo: 'GOIRNOS', gravedad: 'GRAVE' }])).toEqual(rotacion);
  });

  it('el estratega prueba antes los destinos con menos riesgo; los demás siguen la rotación', () => {
    const destinos = [{ slug: 'a', r: 50 }, { slug: 'b', r: 0 }, { slug: 'c', r: 20 }, { slug: 'd', r: 0 }];
    expect(priorizarDestinos(destinos, (d) => d.r, 'ESTRATEGA').map((d) => d.slug)).toEqual(['b', 'd', 'c', 'a']);
    expect(priorizarDestinos(destinos, (d) => d.r, 'SENSATO')).toEqual(destinos);
    expect(priorizarDestinos(destinos, (d) => d.r, null)).toEqual(destinos);
  });

  it('el motivo es la comida solo si falta y el oficio la trae', () => {
    expect(motivoDeExpedicion('pescador', comida)).toBe('COMIDA');
    expect(motivoDeExpedicion('minero-cristal', comida)).toBeNull();
    expect(motivoDeExpedicion('pescador', [])).toBeNull();
  });

  it('comestible: lo recolectable consumible y lo que quita hambre', () => {
    expect(esComestible({ category: 'consumible', curaHambre: null })).toBe(true);
    expect(esComestible({ category: 'piel', curaHambre: 10 })).toBe(true);
    expect(esComestible({ category: 'alimento', curaHambre: null })).toBe(true);
    expect(esComestible({ category: 'mena', curaHambre: null })).toBe(false);
  });
});
