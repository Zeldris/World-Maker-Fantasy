import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { zonePointVisiblePara, questSlugsAceptadosPara } from './zonePoints.js';
import { ORCO_ENFURECIDO_QUEST_SLUG } from '../routes/saves/quests.js';

/// Gate de aparición narrativa (2026-09-09, bug real jugando en vivo — Álvaro: "estás pintando el
/// orco enfurecido antes de hablar con gistera en el mapa... se debe añadir a la zona después de
/// hablar con gistera y aceptar su misión", confirmado: "justo cuando Gistera te da la misión el
/// Orco entra en la zona por primera vez"). Prueba el helper compartido (`zonePointVisiblePara` +
/// `questSlugsAceptadosPara`) contra Postgres real, sin pasar por HTTP — los 3 consumidores reales
/// (GET /zona, detectarEncuentroEnCelda, avanzarZonePointsUnPaso) ya delegan en este mismo par de
/// funciones, así que probarlas aquí cubre el comportamiento compartido por los tres a la vez.
describe('zonePointVisiblePara + questSlugsAceptadosPara (Postgres real)', () => {
  let saveId: string;
  let worldId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (gate Orco Enfurecido)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
        portraitInitial: 'G',
      },
    });
    saveId = save.id;
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  afterEach(async () => {
    await prisma.quest.deleteMany({ where: { saveId } });
  });

  it('el Orco Enfurecido está OCULTO antes de aceptar la misión de Gistera', async () => {
    const questSlugsAceptados = await questSlugsAceptadosPara(prisma, saveId);
    expect(zonePointVisiblePara('orco-enfurecido-hondonada', questSlugsAceptados)).toBe(false);
  });

  it('el Orco Enfurecido queda VISIBLE en cuanto la Quest de Gistera existe (aceptada), sin importar su status', async () => {
    await prisma.quest.create({
      data: { saveId, title: 'Acabar con el Orco Enfurecido', description: 'x', status: 'ACTIVA', questSlug: ORCO_ENFURECIDO_QUEST_SLUG },
    });
    const questSlugsAceptados = await questSlugsAceptadosPara(prisma, saveId);
    expect(zonePointVisiblePara('orco-enfurecido-hondonada', questSlugsAceptados)).toBe(true);
  });

  it('un ZonePoint sin gate (cualquier otro slug) siempre es visible, sin consultar Quest', async () => {
    const questSlugsAceptados = await questSlugsAceptadosPara(prisma, saveId);
    expect(zonePointVisiblePara('gistera-koh', questSlugsAceptados)).toBe(true);
    expect(zonePointVisiblePara('kirelon-arenoso', questSlugsAceptados)).toBe(true);
  });
});
