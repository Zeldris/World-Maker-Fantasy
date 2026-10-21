import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { lockRowForUpdate, rejectIfEnded, rejectIfPendingDeath, toFrontendLogEntry } from './shared.js';
import { repararEdificio } from '../../services/asaltos.js';
import { edificioDelPunto, encargadoDe, fichaDeEdificio } from '../../services/fichaEdificio.js';
import { abrirMenuDeNpc } from '../../services/menuDeNpc.js';
import { conDefinido, nombreVisibleDeNpc, quienEnAviso } from '../../services/dynamicMode.js';
import { celdaAdyacenteOMisma, celdaDePixel } from '../../services/zonaPosicion.js';

/// P178 (QA-27, decidido por la usuaria 2026-10-17): la ficha de un edificio del mapa (`fichaEdificio.ts`) e
/// «Interactuar» en él, que abre el menú de quien lo lleva (antes salía la tarjeta del NPC más cercano).
export async function edificiosRoutes(app: FastifyInstance) {
  /// P284/P296/P301: «Reparar» para todo edificio DANADO (y la Empalizada caída), por la mitad de su coste en materiales.
  app.post<{ Params: { id: string; buildingId: string } }>('/saves/:id/edificios/:buildingId/reparar', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { id: true, endedAt: true, pendingDeathResolution: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    const r = await prisma.$transaction(async (tx) => {
      await lockRowForUpdate(tx, 'Save', save.id, ['id']);
      return repararEdificio(tx, save.id, request.params.buildingId);
    });
    if (!r.ok) return reply.status(400).send({ error: r.motivo });
    return { ok: true, coste: r.coste };
  });

  app.get<{ Params: { id: string; zonePointId: string } }>('/saves/:id/zona/edificio/:zonePointId', async (request, reply) => {
    const ficha = await fichaDeEdificio(prisma, request.params.id, request.params.zonePointId);
    if (!ficha) return reply.status(404).send({ error: 'Ese edificio no está en tu partida' });
    return ficha;
  });

  app.post<{ Params: { id: string; zonePointId: string } }>('/saves/:id/zona/edificio/:zonePointId/interactuar', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, worldId: true, endedAt: true, pendingDeathResolution: true, pendingDynamicMode: true, pendingDynamicModeOffer: true, pendingCombatNpcSlugs: true, zonaPosX: true, zonaPosY: true, currentLocationId: true, characterName: true, worldState: { select: { fictionalMinutes: true, fictionalDateLabel: true } } },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (save.pendingDynamicMode) return reply.status(409).send({ error: 'Ya hay una conversación en curso' });
    // Alguien hostil que te corta el paso, o un combate, va antes que la tienda (`/code-review`).
    if ((save.pendingDynamicModeOffer as { combateForzado?: boolean } | null)?.combateForzado || ((save.pendingCombatNpcSlugs as string[] | null) ?? []).length > 0) {
      return reply.status(409).send({ error: 'Ahora no: alguien no te deja marcharte' });
    }
    const encontrado = await edificioDelPunto(prisma, save.id, request.params.zonePointId);
    if (!encontrado || encontrado.punto.locationId !== save.currentLocationId) return reply.status(404).send({ error: 'Ese edificio no está aquí' });
    const { punto, edificio } = encontrado;
    if (save.zonaPosX == null || save.zonaPosY == null || !celdaAdyacenteOMisma(celdaDePixel({ x: save.zonaPosX, y: save.zonaPosY }), celdaDePixel(punto))) {
      return reply.status(409).send({ error: 'Tienes que acercarte más al edificio' });
    }
    const nombreEdificio = edificio?.name ?? punto.label ?? punto.targetSlug;
    // El mismo encargado (y el mismo «está aquí») que enseña la ficha.
    const llevado = edificio ? await encargadoDe(prisma, save.id, save.worldId, edificio, punto.locationId) : null;
    const npc = llevado?.npc;
    // Sin artículo delante del nombre del edificio: el catálogo no lo guarda y no se adivina por el nombre.
    if (!npc || !llevado.aqui) return { menu: null, motivo: `${nombreEdificio}: no hay nadie atendiendo ahora mismo.` };
    const { nombre, oculto } = await nombreVisibleDeNpc(prisma, save.id, npc);
    // P199: con su artículo de catálogo («el Maestro Herrero Serhu»), o por su raza («el orco desconocido»).
    const enFrase = conDefinido(nombre, oculto ? null : npc.articulo);
    const menu = await abrirMenuDeNpc(prisma, save.id, npc.slug, nombre, 'edificio');
    if (!menu) return { menu: null, motivo: `${quienEnAviso('NPC', nombre, oculto ? null : npc.articulo)} no tiene nada que ofrecerte aquí.` };
    const entrada = await prisma.logEntry.create({
      data: {
        saveId: save.id, channel: 'CHARACTER', isSystemMessage: true,
        text: `${nombreEdificio}: ${enFrase} atiende a ${save.characterName}.`,
        fictionalMinutes: save.worldState?.fictionalMinutes ?? 0, timeLabel: save.worldState?.fictionalDateLabel ?? '',
      },
    });
    return { menu, logEntry: toFrontendLogEntry(entrada) };
  });
}
