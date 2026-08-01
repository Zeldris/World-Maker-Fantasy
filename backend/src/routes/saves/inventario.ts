import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { syncDynamicCombatAbilities, resolveEquippedWeaponSlots } from '../../services/dynamicAbilities.js';
import { normalizeSecondaryAttributes } from '../../services/secondaryAttributes.js';
import { checkRequisitos, shortfallLabel, type Requisitos } from '../../services/requisitos.js';
import { equipSlotFamily } from '../../services/equipment.js';
import type { AttributeBlock } from '../../services/dice.js';
import type { EquipSlot } from '@prisma/client';

/// Asignar/quitar un hueco de equipo (deuda técnica 2026-07-30, split de saves.ts) — decisión
/// manual de la jugadora, el modelo nunca la toma (mismo criterio narrativo-sin-mecánica que el
/// resto de InventoryItem). Como mucho un objeto por hueco: si otro objeto ya ocupaba ese slot,
/// se desequipa a la mochila en la misma transacción.
export async function inventarioRoutes(app: FastifyInstance) {
  app.patch<{ Params: { id: string; itemId: string }; Body: { slot: EquipSlot | null } }>(
    '/saves/:id/inventario/:itemId',
    async (request, reply) => {
      const { slot } = request.body;
      if (slot !== null && typeof slot !== 'string') {
        return reply.status(400).send({ error: 'Falta el campo: slot (EquipSlot o null)' });
      }
      const item = await prisma.inventoryItem.findFirst({ where: { id: request.params.itemId, saveId: request.params.id } });
      if (!item) {
        return reply.status(404).send({ error: 'Objeto no encontrado' });
      }

      // Requisitos de equipar (sesión de diseño 2026-07-23) + ranura compatible (2026-07-30,
      // petición explícita: "categorizarlos por ranura para que no pueda poner un casco en los
      // pies") — ambos UMBRAL puro, solo al EQUIPAR (slot !== null; desequipar siempre está
      // permitido). Sin `catalogSlug` (objeto puramente narrativo, sin fila de catálogo conocida)
      // no hay nada que comprobar en ninguno de los dos — se deja pasar, permisivo, igual que
      // siempre (no hay dato contra el que validar).
      if (slot && item.catalogSlug) {
        const save = await prisma.save.findUnique({ where: { id: request.params.id } });
        if (!save) {
          return reply.status(404).send({ error: 'Partida no encontrada' });
        }
        const catalogItem = await prisma.itemCatalog.findUnique({
          where: { worldId_slug: { worldId: save.worldId, slug: item.catalogSlug } },
        });

        // Ranura compatible (2026-07-30, ajustado tras probarlo en vivo: la primera versión era
        // permisiva "sin dato = vale en cualquier ranura", y eso dejaba equipar una Cataplasma o
        // un Mapa en la Camisa — justo el bug que se pedía evitar). Con `catalogItem` real
        // encontrado, hace falta una `equipSlot` real y que la ranura pedida esté en su familia
        // (`equipSlotFamily`: cualquier arma en cualquier mano, cualquier anillo en cualquier
        // dedo). Solo se queda permisivo si NO hay fila de catálogo en absoluto que consultar
        // (objeto narrativo suelto inventado por el modelo, `newItem`, sin dato contra el que
        // validar nada).
        if (catalogItem && (!catalogItem.equipSlot || !equipSlotFamily(catalogItem.equipSlot).includes(slot))) {
          return reply.status(400).send({
            error: catalogItem.equipSlot
              ? `"${item.name}" no se puede equipar ahí — va en ${catalogItem.equipSlot}, no en ${slot}.`
              : `"${item.name}" no es un objeto equipable.`,
          });
        }

        const shortfalls = checkRequisitos(
          catalogItem?.requisitos as Requisitos | undefined,
          save.attributes as AttributeBlock,
          normalizeSecondaryAttributes(save.secondaryAttributes),
        );
        if (shortfalls.length > 0) {
          return reply.status(400).send({
            error: `No cumples los requisitos para equipar "${item.name}": ${shortfalls.map(shortfallLabel).join(', ')}`,
          });
        }
      }

      await prisma.$transaction([
        ...(slot
          ? [
              prisma.inventoryItem.updateMany({
                where: { saveId: request.params.id, slot, NOT: { id: item.id } },
                data: { slot: null },
              }),
            ]
          : []),
        prisma.inventoryItem.update({ where: { id: item.id }, data: { slot } }),
      ]);

      // Habilidades de arma (2026-07-29) — recalculadas cada vez que cambia lo que llevas en
      // ARMA_PRINCIPAL/ARMA_SECUNDARIA, para que la habilidad refleje siempre el arma puesta
      // ahora mismo. Fuera de la transacción de arriba (recalcula sobre el estado YA guardado);
      // aceptable no ser 100% atómico aquí, es solo una resincronización determinista.
      if (slot === 'ARMA_PRINCIPAL' || slot === 'ARMA_SECUNDARIA' || item.slot === 'ARMA_PRINCIPAL' || item.slot === 'ARMA_SECUNDARIA') {
        const save = await prisma.save.findUnique({ where: { id: request.params.id }, select: { raza: true, level: true, worldId: true } });
        if (save) {
          const equippedRows = await prisma.inventoryItem.findMany({
            where: { saveId: request.params.id, slot: { in: ['ARMA_PRINCIPAL', 'ARMA_SECUNDARIA'] } },
            select: { slot: true, catalogSlug: true },
          });
          const equippedWeaponSlots = await resolveEquippedWeaponSlots(prisma, save.worldId, equippedRows);
          await syncDynamicCombatAbilities(prisma, request.params.id, save.raza, save.level, equippedWeaponSlots);
        }
      }

      return { id: item.id, slot };
    },
  );
}
