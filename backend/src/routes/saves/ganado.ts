// CR-55 (hito 0.3): ganado del Reino — corrales con sus animales y forraje.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { ownerKeyFor } from '../../services/reinoOwner.js';
import { corralesDelReino, entregarPastos, etapaDelAnimal, forrajeDeFibrerias, huecoDeForraje, sacrificar, llevarConsigo, devolverAlCorral } from '../../services/cronista/ganadoReino.js';
import { esGanado, etapasDe, produccionDelDia } from '../../services/cronista/ganaderia.js';
import { esCompanero, esGuardia } from '../../services/cronista/usosFauna.js';
import { esDomador } from '../../services/companionSupervivencia.js';
import { rejectIfEnded, rejectIfPendingDeath, lockRowForUpdate } from './shared.js';

export async function ganadoRoutes(app: FastifyInstance) {
  /// Reino › Corrales: cada corral con sus animales (etapa y días que le faltan para la siguiente),
  /// sus ganaderos, y la reserva de forraje del Reino.
  app.get<{ Params: { id: string } }>('/saves/:id/corrales', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, worldId: true, clase: true, especializacion: true, worldState: { select: { fictionalMinutes: true } } } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    const domadora = esDomador(save.clase, save.especializacion);
    const ahora = save.worldState?.fictionalMinutes ?? 0;
    return prisma.$transaction(async (tx) => {
      const corrales = await corralesDelReino(tx, save.id);
      const especies = [...new Set(corrales.flatMap((c) => c.animales.map((a) => a.especie)))];
      const fauna = await tx.npc.findMany({ where: { worldId: save.worldId, saveId: null, slug: { in: especies } }, select: { slug: true, name: true, faunaCategoria: true } });
      const porSlug = new Map(fauna.map((f) => [f.slug, f]));
      const productos = await tx.itemCatalog.findMany({ where: { worldId: save.worldId, slug: { in: ['leche-murgol', 'lana-murgol', 'huevo-corretolvas', 'plumas-rojizas'] } }, select: { slug: true, name: true } });
      const nombreProducto = new Map(productos.map((p) => [p.slug, p.name]));
      const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: ownerKeyFor({ saveId: save.id }) }, select: { forraje: true, ganadoDiasSinComer: true, ganadoDiasSinBeber: true } });
      const hayAnimales = corrales.some((c) => c.animales.length > 0);
      return {
        forraje: stats?.forraje ?? 0,
        huecoForraje: await huecoDeForraje(tx, save.id),
        forrajeDia: await forrajeDeFibrerias(tx, save.id),
        // P330: sin animales no hay carencia que avisar (los contadores viejos de partidas ya jugadas no cuentan).
        diasSinComer: hayAnimales ? (stats?.ganadoDiasSinComer ?? 0) : 0,
        diasSinBeber: hayAnimales ? (stats?.ganadoDiasSinBeber ?? 0) : 0,
        // CR-56 (Q4): compañeros animales que pueden volver al corral.
        fueraDelCorral: (await tx.companion.findMany({ where: { saveId: save.id, tipo: 'FAUNA', sourceSlug: { not: null }, condicionFisica: { not: 'MUERTO' } }, select: { id: true, name: true, sourceSlug: true } }))
          .filter((c) => esGanado(c.sourceSlug!))
          .map((c) => ({ id: c.id, name: c.name })),
        corrales: corrales.map((c) => ({
          ...c,
          especieNombre: c.especie ? (porSlug.get(c.especie)?.name ?? c.especie) : null,
          // CR-56 (Q3): sus animales defienden el Reino.
          guardia: !!c.especie && esGuardia(c.especie),
          // Q10: lo que produce de media al día con sus ganaderos (bien comido y bebido).
          produccionDia: (() => {
            if (!c.especie) return [];
            const cat = porSlug.get(c.especie)?.faunaCategoria ?? null;
            const etapas = c.animales.map((a) => etapaDelAnimal(a, cat, ahora).etapa);
            const suma: Record<string, number> = {};
            for (let d = 0; d < 6; d++) for (const [slug, n] of Object.entries(produccionDelDia(c.especie, etapas, c.ganaderos.length, d, true))) suma[slug] = (suma[slug] ?? 0) + n;
            return Object.entries(suma).map(([slug, n]) => ({ slug, nombre: nombreProducto.get(slug) ?? slug, porDia: Math.round((n / 6) * 10) / 10 }));
          })(),
          animales: c.animales.map((a) => {
            const cat = porSlug.get(a.especie)?.faunaCategoria ?? null;
            const { edadDias, etapa } = etapaDelAnimal(a, cat, ahora);
            const e = etapasDe(a.especie, cat);
            const siguiente = etapa === 'CRIA' ? e.cria : etapa === 'JOVEN' ? e.adulto : etapa === 'ADULTO' ? e.vejez : null;
            return { id: a.id, sexo: a.sexo, edadDias, etapa, diasParaSiguiente: siguiente === null ? null : siguiente - edadDias, puedeLlevar: domadora && etapa === 'ADULTO' && esCompanero(a.especie) };
          }),
        })),
      };
    });
  });

  /// Entrega al Reino los pastos de un tipo que lleva el personaje (2 de forraje cada uno).
  app.post<{ Params: { id: string }; Body: { catalogSlug: string } }>('/saves/:id/forraje/entregar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return entregarPastos(tx, save.id, request.body?.catalogSlug ?? '');
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// Sacrificar un animal del corral (Q8).
  app.post<{ Params: { id: string; ganadoId: string } }>('/saves/:id/ganado/:ganadoId/sacrificar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return sacrificar(tx, save.id, request.params.ganadoId, save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// CR-56 (Q4): la jugadora Domadora se lleva un adulto del corral como compañero.
  app.post<{ Params: { id: string; ganadoId: string } }>('/saves/:id/ganado/:ganadoId/llevar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return llevarConsigo(tx, save.id, request.params.ganadoId, save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });

  /// CR-56 (Q4): un compañero animal vuelve al corral.
  app.post<{ Params: { id: string; companionId: string } }>('/saves/:id/companeros/:companionId/al-corral', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, endedAt: true, pendingDeathResolution: true, worldState: { select: { fictionalMinutes: true } } } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return devolverAlCorral(tx, save.id, request.params.companionId, save.worldState?.fictionalMinutes ?? 0);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return r;
  });
}
