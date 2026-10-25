// QA-245: ficha.ts (todo lo que el juego sabe de un slug). Datos inyectados pequeños + el catálogo real con 'hielaga'.
import { describe, it, expect } from 'vitest';
import { ficha, parecidos, secciones, contieneSlug, recortar, nombreVisible, cargarDatos, type FichaDatos } from './ficha.js';

const falso: FichaDatos = {
  catalogo: {
    items: [{ slug: 'cuerno-x', name: 'Cuerno X', category: 'material', description: 'a'.repeat(300) }],
    fauna: [{ slug: 'bicho', name: 'Bicho', kind: 'PLANTILLA', aliases: ['bicho'], role: 'presa', bio: 'Un bicho.' }],
    npcs: [],
    harvestYields: [
      { sourceSlug: 'bicho', itemSlug: 'cuerno-x', metodoObtencion: 'CAZA', cantidad: 2, condicion: 'solo de día' },
    ],
    harvestSourceRegion: { bicho: 'Valle' },
    otroDiccionario: { bicho: 'dato raro', clave: ['bicho'] },
    otraLista: [{ id: 1, ref: 'bicho' }, { id: 2, ref: 'nada' }],
    unSet: new Set(['bicho']),
  },
  poblaciones: [{ targetType: 'FAUNA', targetSlug: 'bicho', label: 'Bicho', poblacion: 5, poblacionMax: 9, distribucion: { Valle: 1 } }],
  recetas: [{ key: 'r1', resultCatalogSlug: 'cuerno-x', resultName: 'Cuerno X', ingredients: [{ match: { kind: 'exact', catalogSlug: 'bicho' }, cantidad: 3 }] }],
  chunks: [{ type: 'FAUNA', title: 'Fauna del Valle', text: 'El bicho vive aquí', tags: [], sourceDoc: 'valle.md' }],
};

describe('ficha (datos inyectados)', () => {
  it('reúne las secciones de un slug y recorta la descripción a ~200', () => {
    const t = secciones('bicho', falso).join('\n');
    expect(t).toContain('# Fauna: Bicho');
    expect(t).toContain('CAZA x2 — solo de día');
    expect(t).toContain('region=Valle');
    expect(t).toContain('FAUNA Bicho: 5/9');
    expect(t).toContain('Recetas que lo usan');
    expect(t).toContain('[FAUNA] Fauna del Valle — valle.md');
    expect(t).toContain('otroDiccionario[bicho]');
    expect(t).toContain('otraLista[1/2]');
    expect(t).toContain('unSet');
    expect(secciones('cuerno-x', falso).join('\n')).toContain('Se obtiene de');
    expect(recortar('a'.repeat(300)).length).toBe(200);
  });

  it('un slug inexistente sugiere parecidos y no se da por encontrado', () => {
    const r = ficha('bichu', falso);
    expect(r.encontrado).toBe(false);
    expect(r.texto).toContain('bicho');
    expect(ficha('bich', falso).encontrado).toBe(false);
  });

  it('parecidos ordena por contención y distancia; contieneSlug es exacto', () => {
    expect(parecidos('hielga', ['hielaga', 'piedra', 'zzz'], 2)[0]).toBe('hielaga');
    expect(contieneSlug({ a: ['x', { b: 'bicho' }] }, 'bicho')).toBe(true);
    expect(contieneSlug({ a: 'bichos' }, 'bicho')).toBe(false);
    expect(nombreVisible('bicho', falso)).toBe('Bicho');
  });
});

describe('ficha (catálogo real)', () => {
  it('hielaga: fauna, despiece, región, población y chunk', async () => {
    const d = await cargarDatos();
    const r = ficha('hielaga', d);
    expect(r.encontrado).toBe(true);
    for (const f of ['# Fauna: Hielaga', 'Despiece', 'region=Cristal Helado', '# Población', 'Chunks de lore']) expect(r.texto).toContain(f);
    expect(ficha('slug-que-no-existe-jamas', d).encontrado).toBe(false);
    expect(ficha('hielga', d).texto).toContain('hielaga');
    const parcial = ficha('hielag', d);
    expect(parcial.encontrado).toBe(false);
    expect(parcial.texto).toContain('hielaga');
  }, 60000);
});
