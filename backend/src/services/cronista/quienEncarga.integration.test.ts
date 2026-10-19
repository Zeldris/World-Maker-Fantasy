import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { conQuienVisibleEnLote } from './quienEncarga.js';
import { nombreOcultoPorRaza } from '../dynamicMode.js';

// P200 (QA-27) y `/code-review`: quien encarga, con el nombre con que lo ves; en lote, para el detalle.
describe('conQuienVisibleEnLote', () => {
  let saveId: string;
  beforeAll(async () => {
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId: world.id, characterName: 'Encargos', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'E',
      },
    });
    saveId = save.id;
  });
  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin descubrir, por su raza en la descripción y en «Encarga»; descubierto, su nombre; sin NPC, la facción', async () => {
    const npc = await prisma.npc.findFirstOrThrow({ where: { kind: 'PRINCIPAL', faction: 'Clan Serhu' }, orderBy: { slug: 'asc' } });
    const oculto = nombreOcultoPorRaza(npc.raza, npc.genero);
    const misiones = [
      { id: 'a', huecos: { npc: { id: npc.id, nombre: npc.name } }, descripcion: `${npc.name}: «Hay trabajo.» Plazo: 5 días.` },
      { id: 'b', huecos: { faccion: { nombre: 'Clan Serhu' } }, descripcion: 'Hay trabajo. Plazo: 5 días.' },
    ];
    const antes = await conQuienVisibleEnLote(prisma, saveId, misiones);
    expect(antes.get('a')).toEqual({ descripcion: `${oculto}: «Hay trabajo.» Plazo: 5 días.`, encarga: oculto });
    expect(antes.get('b')).toEqual({ descripcion: 'Hay trabajo. Plazo: 5 días.', encarga: 'Clan Serhu' });
    await prisma.discoveredEntity.create({ data: { saveId, entityType: 'npc', entitySlug: npc.slug } });
    expect((await conQuienVisibleEnLote(prisma, saveId, misiones)).get('a')).toEqual({ descripcion: misiones[0]!.descripcion, encarga: npc.name });
  });
});
