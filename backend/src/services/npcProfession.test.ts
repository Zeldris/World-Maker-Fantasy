import { describe, expect, it } from 'vitest';
import { aplicarXpNpc, nivelEfectivo } from './npcProfession.js';
import { professionLevelForXp, xpForProfessionLevel, MAX_PROFESSION_LEVEL } from './professionProgress.js';

describe('nivelEfectivo', () => {
  it('sin potencial: 0 (no puede ejercer)', () => {
    expect(nivelEfectivo({ nivel: 5, xp: 700 }, null)).toBe(0);
    expect(nivelEfectivo(null, undefined)).toBe(0);
  });
  it('con potencial y sin progreso: nivel 1', () => {
    expect(nivelEfectivo(null, { nivelMaximo: 6 })).toBe(1);
  });
  it('acota el nivel por nivelMaximo', () => {
    expect(nivelEfectivo({ nivel: 8, xp: 4400 }, { nivelMaximo: 6 })).toBe(6);
    expect(nivelEfectivo({ nivel: 3, xp: 150 }, { nivelMaximo: 6 })).toBe(3);
  });
});

describe('aplicarXpNpc', () => {
  it('sube de nivel con professionLevelForXp', () => {
    const r = aplicarXpNpc({ nivel: 3, xp: 150 }, { nivelMaximo: 6 }, 200);
    expect(r).toEqual({ nivel: professionLevelForXp(350), xp: 350 });
  });
  it('nunca pasa del tope aunque sobre XP', () => {
    const r = aplicarXpNpc({ nivel: 3, xp: 150 }, { nivelMaximo: 6 }, 100000);
    expect(r.nivel).toBe(6);
    expect(professionLevelForXp(r.xp)).toBe(6);
    expect(r.xp).toBe(xpForProfessionLevel(7) - 1);
  });
  it('tope 9: llega al máximo global', () => {
    const r = aplicarXpNpc({ nivel: 7, xp: 2400 }, { nivelMaximo: 9 }, 100000);
    expect(r.nivel).toBe(MAX_PROFESSION_LEVEL);
  });
  it('sin potencial no cambia nada; XP negativa se ignora', () => {
    expect(aplicarXpNpc({ nivel: 3, xp: 150 }, null, 500)).toEqual({ nivel: 3, xp: 150 });
    expect(aplicarXpNpc({ nivel: 3, xp: 150 }, { nivelMaximo: 6 }, -50)).toEqual({ nivel: 3, xp: 150 });
  });
});
