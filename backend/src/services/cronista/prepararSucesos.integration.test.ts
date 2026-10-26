import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { getDefaultUserId } from '../../lib/defaultUser.js';
import { asegurarMundoDePartida } from '../mundoPartida.js';
import { evaluarConsecuencias } from './consecuencias.js';
import { procesarReacciones } from './reacciones.js';
import { NOMBRES_GOIRNTES } from './nombresFaccion.js';
import { aliarTrasRuptura, matarLiderDeFaccion, vasalloPagaConDeuda } from './prepararSucesos.js';
import { asegurarVasallajes, cuotaSemanal, revisarVasallajes } from './vasallaje.js';
import { resembrarFacciones } from './economiaFacciones.js';
import { syncFactionPopulationToKingdomStats } from '../population.js';

// QA-259: los pasos `lider-muere`, `alianza` y `vasallo-paga` de `prepararReino.ts`, contra el mundo de una partida.
describe('pasos de preparación de sucesos del mundo (QA-259)', () => {
  const saveIds: string[] = [];
  const DIA = 1440;

  async function partida(nombre: string, minutos = 480) {
    const worldId = (await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } })).id;
    const save = await prisma.save.create({
      data: {
        userId: await getDefaultUserId(), worldId, characterName: nombre, characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
        attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 }, portraitInitial: 'Q',
        worldState: { create: { fictionalMinutes: minutos } },
      },
    });
    saveIds.push(save.id);
    await asegurarMundoDePartida(prisma, save.id);
    await procesarReacciones(prisma, save.id);
    return { saveId: save.id, worldId };
  }

  afterAll(async () => {
    await prisma.save.deleteMany({ where: { id: { in: saveIds } } });
  });

  it('lider-muere (CR-43): muere el líder goirnte de viejo y, al pasar los días, la facción se escinde con nombre goirnte', async () => {
    const { saveId } = await partida('Líder (QA-259)');
    const antes = await prisma.faction.findFirstOrThrow({ where: { saveId, slug: 'concordia-de-hierro' } });
    const r = await matarLiderDeFaccion(prisma, { saveId, faccionSlug: 'concordia-de-hierro' });
    if ('error' in r) throw new Error(r.error);
    expect(r.candidatos.length).toBeGreaterThanOrEqual(2);
    // La muerte es la del motor: «de viejo», y el líder queda muerto en la partida.
    const muerte = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'MUERTE_NPC' } });
    expect((muerte.datos as { causa?: string }).causa).toBe('de viejo');
    expect((await prisma.npcState.findFirstOrThrow({ where: { saveId, npcId: antes.liderNpcId!, scope: '' } })).muerto).toBe(true);
    // La sucesión sigue abierta: sale al avanzar (1-3 días).
    await procesarReacciones(prisma, saveId);
    expect(await prisma.consecuencia.count({ where: { saveId, regla: 'SUCESION_PENDIENTE', estado: 'PENDIENTE' } })).toBe(1);
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 480 + 3 * DIA } });
    await evaluarConsecuencias(prisma, saveId);
    await procesarReacciones(prisma, saveId);
    const nueva = await prisma.faction.findFirstOrThrow({ where: { saveId, origenSlug: 'concordia-de-hierro', slug: { not: 'concordia-de-hierro' } } });
    expect(NOMBRES_GOIRNTES.map(([n]) => n)).toContain(nueva.name);
    expect(await prisma.suceso.count({ where: { saveId, tipo: 'FACCION_ESCINDIDA' } })).toBe(1);
  });

  it('lider-muere se niega sin líder o sin facción', async () => {
    const { saveId } = await partida('Líder (QA-259) errores');
    expect(await matarLiderDeFaccion(prisma, { saveId, faccionSlug: 'no-existe' })).toMatchObject({ error: expect.stringContaining('no hay facción') });
  });

  it('alianza (P247): dos alianzas de las mismas facciones con una ruptura en medio; la segunda se cuenta', async () => {
    const { saveId } = await partida('Alianza (QA-259)');
    const r = await aliarTrasRuptura(prisma, { saveId, facA: 'clan-serhu', facB: 'concordia-de-hierro' });
    expect(r).not.toHaveProperty('error');
    const sucesos = await prisma.suceso.findMany({
      where: { saveId, tipo: { in: ['ALIANZA', 'CAMBIO_RELACION'] }, actores: { some: { entidadId: 'clan-serhu' } } },
      orderBy: [{ fictionalMinutes: 'asc' }, { id: 'asc' }],
      select: { tipo: true },
    });
    // Desde neutral: sellar (ALIANZA), romper (CAMBIO_RELACION), sellar otra vez (ALIANZA), con los cambios de banda del camino.
    const tipos = sucesos.map((s) => s.tipo);
    expect(tipos.filter((t) => t === 'ALIANZA')).toHaveLength(2);
    const primera = tipos.indexOf('ALIANZA');
    const ultima = tipos.lastIndexOf('ALIANZA');
    expect(tipos.slice(primera + 1, ultima)).toContain('CAMBIO_RELACION');
    expect((await prisma.factionRelation.findFirstOrThrow({ where: { saveId, sourceFaction: { slug: 'clan-serhu' }, targetFaction: { slug: 'concordia-de-hierro' } } })).type).toBe('ALIANZA');
  });

  it('alianza rechaza una facción que no existe', async () => {
    const { saveId } = await partida('Alianza (QA-259) errores');
    expect(await aliarTrasRuptura(prisma, { saveId, facA: 'clan-serhu', facB: 'nadie' })).toMatchObject({ error: expect.stringContaining('nadie') });
  });

  it('vasallo-paga (P314): con deuda vieja y fondos de cuota y media, la semana sale «pagada-con-deuda»', async () => {
    const { saveId } = await partida('Vasallo (QA-259)', 0);
    await prisma.$transaction(async (tx) => {
      await resembrarFacciones(tx, saveId);
      await syncFactionPopulationToKingdomStats(tx, { saveId });
      await asegurarVasallajes(tx, saveId, 0);
    });
    // Sin deuda no hay nada que arrastrar.
    expect(await vasalloPagaConDeuda(prisma, { saveId, vasalloSlug: 'clan-serhu' })).toMatchObject({ error: expect.stringContaining('al corriente') });
    // Una semana impagada (sin fondos) deja la deuda: lo hace la regla del juego.
    const serhu = await prisma.kingdomStats.findFirstOrThrow({ where: { faction: { saveId, slug: 'clan-serhu' } } });
    await prisma.kingdomStats.update({ where: { id: serhu.id }, data: { riqueza: 0 } });
    await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 14, 14 * DIA, () => 0.99));
    await prisma.worldState.update({ where: { saveId }, data: { fictionalMinutes: 14 * DIA } });

    const r = await vasalloPagaConDeuda(prisma, { saveId, vasalloSlug: 'clan-serhu' });
    if ('error' in r) throw new Error(r.error);
    const cuota = cuotaSemanal(serhu.soldados);
    expect(r).toMatchObject({ cuota, deuda: cuota });
    expect((await prisma.kingdomStats.findFirstOrThrow({ where: { faction: { saveId, slug: 'clan-serhu' } } })).riqueza).toBe(r.riqueza);
    expect(r.riqueza).toBeGreaterThanOrEqual(cuota);
    expect(r.riqueza).toBeLessThan(2 * cuota);

    await prisma.$transaction((tx) => revisarVasallajes(tx, saveId, 21, 21 * DIA, () => 0.99));
    const linea = await prisma.suceso.findFirstOrThrow({ where: { saveId, tipo: 'PATRULLA_VASALLO' }, orderBy: { fictionalMinutes: 'desc' } });
    expect(linea.datos).toMatchObject({ estado: 'pagada-con-deuda', porcentaje: 100 });
    // Pagó la cuota entera y sigue debiendo lo que no llegó a cubrir de lo pendiente.
    expect((await prisma.vasallaje.findFirstOrThrow({ where: { saveId } })).deuda).toBe(2 * cuota - r.riqueza);
  });
});
