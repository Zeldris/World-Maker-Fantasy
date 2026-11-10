import { describe, it, expect } from 'vitest';
import type { Prisma } from '@prisma/client';
import { testigosDelBando } from './testigos.js';
import { ORCO_ENFURECIDO_QUEST_SLUG } from '../../routes/saves/quests.js';

// P375 (usuaria, 2026-11-10): el robo visto tampoco cuenta a quien el juego oculta en la zona. En el mundo de
// prueba ningún NPC con bando se oculta por misión, así que se simula la base de datos.
function txCon(questsAceptadas: string[]) {
  const pedidos: string[][] = [];
  const tx = {
    zonePoint: { findMany: () => Promise.resolve([{ targetSlug: 'gistera-koh' }, { targetSlug: 'guardia-1' }]) },
    worldState: { findUnique: () => Promise.resolve({ fictionalMinutes: 720 }) },
    npcState: { findMany: () => Promise.resolve([]) },
    quest: { findMany: () => Promise.resolve(questsAceptadas.map((questSlug) => ({ questSlug }))) },
    npc: {
      findMany: (args: { where: { slug: { in: string[] } } }) => {
        pedidos.push(args.where.slug.in);
        return Promise.resolve(args.where.slug.in.map((slug) => ({ id: `id-${slug}` })));
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, pedidos };
}

describe('testigosDelBando (P375)', () => {
  it('cuenta al NPC visible en la zona', async () => {
    const { tx } = txCon([]);
    expect(await testigosDelBando(tx, 's', 'w', 'l', 'bando')).toEqual(['id-gistera-koh', 'id-guardia-1']);
  });

  it('no cuenta al NPC que la misión aceptada oculta', async () => {
    const { tx, pedidos } = txCon([ORCO_ENFURECIDO_QUEST_SLUG]);
    expect(await testigosDelBando(tx, 's', 'w', 'l', 'bando')).toEqual(['id-guardia-1']);
    expect(pedidos).toEqual([['guardia-1']]);
  });
});
