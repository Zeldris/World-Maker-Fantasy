import { describe, it, expect } from 'vitest';
import { azarFijo, copiaDelTexto, parejasDelFragmento, promptGeneracion, repartir, slug } from './ragGenerar.js';
import { validarCasos, validarParejas } from './ragEval.js';

const f = { title: 'Clan Maktor — aniquilado dos veces', text: 'El clan de Gorhorn fue borrado de la tierra por los humanos en la primera guerra.' };

describe('ragGenerar (QA-331)', () => {
  it('slug sin tildes ni signos', () => {
    expect(slug('Clan Maktor — aniquilado dos veces')).toBe('clan-maktor-aniquilado-dos-veces');
    expect(slug('Él, ¿qué?')).toBe('el-que');
  });

  it('copiaDelTexto: 4 palabras seguidas del texto, sin mayúsculas ni tildes', () => {
    expect(copiaDelTexto('¿Quién fue BORRADO DE LA TIERRA?', [f.text])).toBe(true);
    expect(copiaDelTexto('¿qué le pasó al clan de Gorhorn?', [f.text])).toBe(false);
    expect(copiaDelTexto('Clan Maktor aniquilado dos', [f.title])).toBe(true);
  });

  it('el prompt lleva el título y el fragmento', () => {
    const p = promptGeneracion(f);
    expect(p).toContain(`Título: ${f.title}`);
    expect(p).toContain(`Fragmento: ${f.text}`);
  });

  it('parejas es/en con el título de esperado; descarta copias, vacías y repetidas', () => {
    const vistas = new Set<string>();
    const { casos, descartes } = parejasDelFragmento(
      f,
      [
        { es: '¿qué le pasó al clan de Gorhorn?', en: "what happened to Gorhorn's clan?" },
        { es: '¿quién fue borrado de la tierra?', en: 'who was wiped out?' },
        { es: '¿Qué le pasó al clan de Gorhorn', en: 'x' },
        { es: '', en: 'only english' },
        { es: '¿quién acabó con los Maktor?', en: 'who destroyed the Maktor?' },
      ],
      vistas,
    );
    expect(casos.map((c) => c.id)).toEqual([
      'b-clan-maktor-aniquilado-dos-veces-1',
      'b-clan-maktor-aniquilado-dos-veces-1-en',
      'b-clan-maktor-aniquilado-dos-veces-2',
      'b-clan-maktor-aniquilado-dos-veces-2-en',
    ]);
    expect(descartes.map((d) => d.motivo)).toEqual(['copia', 'repetida', 'vacia']);
    expect(casos[1]).toMatchObject({ lang: 'en', esperados: [f.title], origen: 'B', causa: null, debe_pasar: false });
    expect([...validarCasos(casos), ...validarParejas(casos)]).toEqual([]);
  });

  it('repartir: fijo por semilla, sin partir parejas; los A son pareja y deben pasar', () => {
    const vistas = new Set<string>();
    const casos = Array.from({ length: 40 }, (_, i) =>
      parejasDelFragmento({ title: `Fragmento ${i}`, text: 'x' }, [{ es: `pregunta ${i}`, en: `question ${i}` }], vistas).casos,
    ).flat();
    const r = repartir(casos, 7, { nA: 3 });
    expect(r).toEqual(repartir(casos, 7, { nA: 3 }));
    expect(r.a).toHaveLength(6);
    expect(r.b.length + r.reserva.length + r.a.length).toBe(casos.length);
    expect(r.reserva.length).toBeGreaterThan(0);
    for (const lote of [r.a, r.b, r.reserva]) expect([...validarCasos(lote), ...validarParejas(lote)]).toEqual([]);
    expect(r.a.every((c) => c.origen === 'A' && c.debe_pasar && c.pair_id!.startsWith('a-'))).toBe(true);
    expect(azarFijo(7, 'p')).toBe(azarFijo(7, 'p'));
    expect(azarFijo(7, 'p')).not.toBe(azarFijo(8, 'p'));
  });
});
