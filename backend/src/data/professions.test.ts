import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { professions } from './professions.js';
import { npcs, factionBuildings, items } from '../scripts/worldCatalog.js';
import { CRAFTING_RECIPES } from '../services/crafting.js';
import { CONSTRUCTION_RECIPES } from '../services/construction.js';
import { matchesOficioPrefix } from '../services/harvestAbilities.js';
import { startingProfessionsFor, primerosAuxiliosProfessionFor } from '../services/startingProfessions.js';
import { expectedFrontendContent, PROFESSIONS_FRONTEND_COPY } from '../scripts/syncProfessions.js';

const ids = new Set(professions.map((p) => p.id));
const RAZAS = ['orcos', 'faerus', 'nabieus', 'goirntes'];
const REGIONES = ['llanuras', 'cristal', 'cienaga', 'margen', 'meseta'];
const UNIVERSALES = new Set(['pescador', 'diplomatico']);

describe('slugs de oficio unificados (H-10)', () => {
  it('no hay ids duplicados', () => {
    expect(ids.size).toBe(professions.length);
  });

  it('todos siguen <oficio>-<raza plural>-<región>, <oficio>-<región> (minero/talador) o son universales', () => {
    const malos = professions.map((p) => p.id).filter((id) => {
      if (UNIVERSALES.has(id)) return false;
      const m = id.match(/^([a-z-]+?)-(orcos|faerus|nabieus|goirntes)-(llanuras|cristal|cienaga|margen|meseta)$/);
      if (m) return false;
      return !/^(minero|talador)-(llanuras|cristal|cienaga|margen|meseta)$/.test(id);
    });
    expect(malos).toEqual([]);
    expect(RAZAS.length + REGIONES.length).toBeGreaterThan(0);
  });

  it('sin variantes antiguas (orco singular, nabierus)', () => {
    expect([...ids].filter((id) => /-orco-|nabierus/.test(id))).toEqual([]);
  });

  it('los Maestros de oficio solo enseñan slugs existentes', () => {
    const usados = npcs.map((n) => n.teachesProfession).filter((s): s is string => !!s);
    expect(usados.length).toBeGreaterThan(0);
    expect(usados.filter((s) => !ids.has(s))).toEqual([]);
  });

  it('las recetas de crafteo y construcción usan oficios existentes', () => {
    const usados = [
      ...CRAFTING_RECIPES.map((r) => r.oficio),
      ...CONSTRUCTION_RECIPES.flatMap((r) => [r.oficio, r.oficioProducido]),
    ].filter((s): s is string => !!s);
    expect(usados.length).toBeGreaterThan(0);
    // `constructor` a secas es un prefijo (OFICIOS_CONSTRUCCION_REQUERIDOS), no un slug guardado.
    expect([...new Set(usados)].filter((s) => !ids.has(s) && !professions.some((p) => matchesOficioPrefix(p.id, s)))).toEqual([]);
  });

  it('los edificios de facción con oficio usan slugs existentes', () => {
    const usados = factionBuildings.map((b) => b.profession).filter((s): s is string => !!s);
    expect(usados.length).toBeGreaterThan(0);
    expect(usados.filter((s) => !ids.has(s))).toEqual([]);
  });

  it('herramientaParaOficio apunta a prefijos de oficios existentes', () => {
    const prefijos = new Set(items.flatMap((i) => i.herramientaParaOficio ?? []));
    const sueltos = [...prefijos].filter(
      (pre) => !professions.some((p) => matchesOficioPrefix(p.id, pre)) && !['pescador-pescar', 'pescador-buscar'].includes(pre),
    );
    expect(sueltos).toEqual([]);
  });

  it('los oficios de serie existen (Gorhorn y primeros auxilios de todas las combinaciones)', () => {
    expect(startingProfessionsFor('Gorhorn', 'orcos', 'Las Llanuras del Viento Rojo').filter((s) => !ids.has(s))).toEqual([]);
    const regiones: Record<string, string> = {
      llanuras: 'Las Llanuras del Viento Rojo', cristal: 'Cristal Helado', cienaga: 'Ciénaga Troncal',
      margen: 'El Margen Silencioso', meseta: 'La Meseta del Orden',
    };
    for (const raza of RAZAS) for (const [tok, region] of Object.entries(regiones)) {
      const slug = primerosAuxiliosProfessionFor(raza, region);
      if (slug) expect(ids.has(slug)).toBe(true);
    }
  });

  it('frontend/src/data/professions.ts no diverge de la fuente única (ejecuta `npm run sync-professions`)', () => {
    expect(readFileSync(PROFESSIONS_FRONTEND_COPY, 'utf8')).toBe(expectedFrontendContent());
  });
});
