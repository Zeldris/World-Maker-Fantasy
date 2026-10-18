import { describe, it, expect } from 'vitest';
import { bando, cantidadPorExceso, dificultadDe, hayExceso, recompensaDe, textoDeMision, validarHuecos, TIPOS_MISION, PLAZO_DIAS, type HuecosMision } from './misiones.js';

const serhu = { slug: 'clan-serhu', nombre: 'Clan Serhu', pueblo: 'orcos' };
const base = (h: Partial<HuecosMision>): HuecosMision => ({ tipo: 'CAZAR', motivo: 'EXCESO_FAUNA', faccion: serhu, region: 'Las Llanuras del Viento Rojo', cantidad: 5, plazoDias: 5, especie: { slug: 'canizor', nombre: 'canizores' }, ...h });

describe('misiones secundarias: plantillas cerradas (CR-40 40a)', () => {
  it('una misión completa es válida', () => {
    expect(validarHuecos(base({}))).toEqual([]);
  });

  it('un hueco sin dato válido impide crearla (Q10)', () => {
    expect(validarHuecos(base({ especie: undefined }))).toContain('falta especie');
    expect(validarHuecos(base({ cantidad: 20 }))).toContain('cantidad fuera de rango: 20');
    expect(validarHuecos(base({ region: '' }))).toContain('falta la región');
    expect(validarHuecos(base({ tipo: 'COMBATIR', especie: undefined, enemiga: { slug: 'clan-serhu', nombre: 'Clan Serhu' }, lugar: { id: 'l', nombre: 'X' }, cantidad: 1 }))).toContain('no se combate a la propia facción');
    expect(validarHuecos(base({ tipo: 'ELIMINAR', especie: undefined, cantidad: 1, npc: { id: 'n', nombre: 'A' }, objetivoNpc: { id: 'n', nombre: 'A' } }))).toContain('quien la encarga no puede ser el objetivo');
  });

  it('cada tipo tiene plazo, título y texto con sus huecos, sin dejar huecos vacíos', () => {
    const huecos: Record<string, Partial<HuecosMision>> = {
      ENTREGAR: { objeto: { slug: 'carne', nombre: 'carne de canizor' } },
      CAZAR: {},
      ELIMINAR: { objetivoNpc: { id: 'v', nombre: 'Drask' }, enemiga: { slug: 'clan-helsig', nombre: 'Clan Helsig' }, cantidad: 1 },
      EXPLORAR: { lugar: { id: 'l', nombre: 'Restos de Maktor' }, cantidad: 1 },
      AYUDAR: { objetivoNpc: { id: 'h', nombre: 'Ulkha' }, lugar: { id: 'l', nombre: 'Cruce de las Cenizas' }, cantidad: 1 },
      COMBATIR: { enemiga: { slug: 'clan-helsig', nombre: 'Clan Helsig' }, lugar: { id: 'l', nombre: 'Paso de los Huesos' }, cantidad: 1 },
    };
    for (const tipo of TIPOS_MISION) {
      const h = base({ tipo, ...huecos[tipo] });
      expect(validarHuecos(h)).toEqual([]);
      expect(PLAZO_DIAS[tipo]).toBeGreaterThan(0);
      const t = textoDeMision(h, 1);
      expect(t.titulo.length).toBeGreaterThan(5);
      expect(t.descripcion).not.toMatch(/undefined|null|\{|\}/);
      expect(t.descripcion).toContain('Plazo: 5 días.');
    }
  });

  it('el pueblo de quien la encarga da el cierre; un NPC lo dice en persona', () => {
    expect(textoDeMision(base({}), 0).descripcion).toContain('Que la caza sea limpia.');
    const personal = textoDeMision(base({ npc: { id: 'n', nombre: 'Ulkha Ketg' } }), 0).descripcion;
    expect(personal.startsWith('Ulkha Ketg: «')).toBe(true);
    expect(textoDeMision(base({ faccion: { ...serhu, pueblo: 'desconocido' } }), 0).descripcion).not.toContain('«');
  });

  it('recompensa por tabla: más difícil paga más, el NPC con nombre algo más, y contra otra facción resta con ella', () => {
    expect(dificultadDe({ tipo: 'CAZAR', cantidad: 3 })).toBe(1);
    expect(dificultadDe({ tipo: 'CAZAR', cantidad: 8 })).toBe(3);
    const facil = recompensaDe({ tipo: 'CAZAR', cantidad: 3 });
    const dificil = recompensaDe({ tipo: 'CAZAR', cantidad: 8 });
    expect(dificil.xp).toBeGreaterThan(facil.xp);
    expect(recompensaDe({ tipo: 'CAZAR', cantidad: 3, npc: { id: 'n', nombre: 'A' } }).goirnos).toBeGreaterThan(facil.goirnos);
    expect(facil.reputacionAlFallar).toBeLessThan(0);
    expect(facil.reputacionConEnemiga).toBe(0);
    expect(recompensaDe({ tipo: 'COMBATIR', cantidad: 1 }).reputacionConEnemiga).toBeLessThan(0);
  });

  it('exceso de población: más del 80 % del máximo, cazar entre 3 y 8', () => {
    expect(hayExceso(80, 100)).toBe(false);
    expect(hayExceso(81, 100)).toBe(true);
    expect(hayExceso(10, 0)).toBe(false);
    expect(cantidadPorExceso(1100, 1200)).toBe(7);
    expect(cantidadPorExceso(1200, 1200)).toBe(8);
    expect(cantidadPorExceso(970, 1200)).toBe(3);
  });
});

// P180 (QA-27): «7 × Madera Jumba para Clan Serhu», «Clan Serhu anda escasa de…».
describe('bando', () => {
  it('pone el artículo y contrae la preposición', () => {
    expect(bando('Clan Serhu', 'para')).toBe('para el Clan Serhu');
    expect(bando('Clan Serhu', 'a', true)).toBe('Al Clan Serhu');
    expect(bando('Clan Serhu', 'de')).toBe('del Clan Serhu');
    expect(bando('Concordia de Hierro', '', true)).toBe('La Concordia de Hierro');
  });
  it('los nombres propios y los que ya llevan artículo van tal cual', () => {
    expect(bando('Feg Ger', 'para')).toBe('para Feg Ger');
    expect(bando('Los del Obelisco', 'de')).toBe('de los del Obelisco');
    expect(bando('Los del Obelisco', '', true)).toBe('Los del Obelisco');
  });
});

describe('textoDeMision de ENTREGAR (P180)', () => {
  it('con artículo y sin género del bando', () => {
    const h = base({ tipo: 'ENTREGAR', motivo: 'CARENCIA', cantidad: 7, objeto: { slug: 'madera-jumba', nombre: 'Madera Jumba' } });
    expect(textoDeMision(h, 0).titulo).toBe('7 × Madera Jumba para el Clan Serhu');
    expect(textoDeMision(h, 1).descripcion).toMatch(/^Al Clan Serhu le falta Madera Jumba: pide 7/);
  });
});
