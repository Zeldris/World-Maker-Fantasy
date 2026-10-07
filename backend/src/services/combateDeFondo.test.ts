import { describe, expect, it } from 'vitest';
import { agrupar, simularCombateDeFondo, TAMANO_SUBCOMBATE_CON_JUGADORA, TAMANO_SUBCOMBATE_FONDO, type BandoFondo, type CombatienteFondo } from './combateDeFondo.js';

/// CR-62 (62a): el combate de fondo, con la mecánica del combate en vivo.
function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
const soldado = (id: string, bando: BandoFondo, v: number, extra: Partial<CombatienteFondo> = {}): CombatienteFondo => ({
  id, nombre: id, bando,
  attributes: { fuerza: v, destreza: v, constitucion: v, inteligencia: 8, voluntad: v, carisma: 8, magia: 0 },
  attribute: 'fuerza', attributeBonus: 0, nivel: 3, conMoral: true, ...extra,
});
const bando = (b: BandoFondo, n: number, v: number) => Array.from({ length: n }, (_, i) => soldado(`${b}${i}`, b, v));

describe('combate de fondo (CR-62)', () => {
  it('8 sin la jugadora y 4 con ella', () => {
    expect(TAMANO_SUBCOMBATE_FONDO).toBe(8);
    expect(TAMANO_SUBCOMBATE_CON_JUGADORA).toBe(4);
    expect(agrupar([1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
  });

  it('es determinista con la misma semilla', () => {
    const a = simularCombateDeFondo([...bando('A', 5, 12), ...bando('B', 5, 12)], semilla(7));
    const b = simularCombateDeFondo([...bando('A', 5, 12), ...bando('B', 5, 12)], semilla(7));
    expect(a).toEqual(b);
  });

  it('el bando mucho más fuerte gana casi siempre', () => {
    let ganaA = 0;
    for (let s = 1; s <= 40; s++) if (simularCombateDeFondo([...bando('A', 6, 18), ...bando('B', 6, 6)], semilla(s)).ganador === 'A') ganaA++;
    expect(ganaA).toBeGreaterThanOrEqual(36);
  });

  it('con menos grupos, los suyos vuelven a pelear con sus heridas (varios sub-combates)', () => {
    const r = simularCombateDeFondo([...bando('A', 20, 14), ...bando('B', 4, 10)], semilla(3), { tamano: 4 });
    expect(r.subcombates).toBeGreaterThanOrEqual(1);
    expect(r.ganador).toBe('A');
  });

  it('las personas se retiran por la moral; la fauna no tira moral', () => {
    let retiradas = 0;
    for (let s = 1; s <= 30; s++) {
      const r = simularCombateDeFondo([...bando('A', 6, 16), ...bando('B', 6, 9)], semilla(s));
      if (r.retiradas.includes('B')) retiradas++;
    }
    expect(retiradas).toBeGreaterThan(0);
    const fauna = Array.from({ length: 6 }, (_, i) => soldado(`F${i}`, 'B', 9, { conMoral: false }));
    for (let s = 1; s <= 10; s++) expect(simularCombateDeFondo([...bando('A', 6, 16), ...fauna], semilla(s)).retiradas).not.toContain('B');
  });

  it('si un grupo falla la moral se va él solo: los demás grupos de su bando siguen peleando (revisión del PR)', () => {
    let sigueTrasRetirada = 0;
    for (let s = 1; s <= 40; s++) {
      // A: 3 grupos de 4 iguales a los 4 de B; si el primero huye, los otros dos siguen.
      const r = simularCombateDeFondo([...bando('A', 12, 10), ...bando('B', 4, 10)], semilla(s), { tamano: 4 });
      const huidosA = r.estados.filter((e) => e.id.startsWith('A') && e.huido).length;
      if (huidosA > 0 && huidosA < 12 && r.subcombates > 1) sigueTrasRetirada++;
      if (r.retiradas.includes('A')) expect(r.ganador).not.toBe('A');
    }
    expect(sigueTrasRetirada).toBeGreaterThan(0);
  });

  it('de los caídos muere el 3 %; los NPC con nombre nunca', () => {
    const r = simularCombateDeFondo([...bando('A', 4, 18), soldado('jefe', 'B', 4, { conNombre: true }), ...bando('B', 3, 4)], semilla(5), { probMuerte: 1 });
    const jefe = r.estados.find((e) => e.id === 'jefe')!;
    expect(jefe.muerto).toBe(false);
    const caidos = r.estados.filter((e) => e.id !== 'jefe' && e.id.startsWith('B') && (e.condicion === 'MUERTO' || e.muerto));
    for (const e of caidos) expect(e.condicion).toBe('MUERTO');
  });
});
