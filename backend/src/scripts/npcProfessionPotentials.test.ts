import { describe, expect, it } from 'vitest';
import { npcs, fauna, npcProfessionPotentials } from './worldCatalog.js';
import { professions } from '../data/professions.js';
import { professionLevelForXp, xpForProfessionLevel } from '../services/professionProgress.js';

const professionIds = new Set(professions.map((p) => p.id));
const npcSlugs = new Set([...npcs, ...fauna].map((n) => n.slug));

describe('npcProfessionPotentials (catálogo, sin BD)', () => {
  it('todo NPC con teachesProfession tiene potencial 9 en ese oficio', () => {
    for (const npc of npcs.filter((n) => n.teachesProfession)) {
      const p = npcProfessionPotentials[npc.slug]?.find((e) => e.professionId === npc.teachesProfession);
      expect(p, npc.slug).toBeDefined();
      expect(p!.nivelMaximo, npc.slug).toBe(9);
    }
  });
  it('todo professionId del mapa existe en professions.ts', () => {
    for (const [slug, list] of Object.entries(npcProfessionPotentials)) {
      for (const e of list) expect(professionIds.has(e.professionId), `${slug}: ${e.professionId}`).toBe(true);
    }
  });
  it('todo slug del mapa es un NPC del catálogo', () => {
    for (const slug of Object.keys(npcProfessionPotentials)) expect(npcSlugs.has(slug), slug).toBe(true);
  });
  it('nivelInicial <= nivelMaximo y niveles válidos; sin oficios duplicados por NPC', () => {
    for (const [slug, list] of Object.entries(npcProfessionPotentials)) {
      expect(new Set(list.map((e) => e.professionId)).size, slug).toBe(list.length);
      for (const e of list) {
        expect(e.nivelInicial, slug).toBeLessThanOrEqual(e.nivelMaximo);
        expect(e.nivelInicial, slug).toBeGreaterThanOrEqual(1);
        expect(professionLevelForXp(xpForProfessionLevel(e.nivelInicial))).toBe(e.nivelInicial);
      }
    }
  });
  it('la fauna nunca tiene potencial', () => {
    for (const f of fauna) expect(npcProfessionPotentials[f.slug], f.slug).toBeUndefined();
  });
});
