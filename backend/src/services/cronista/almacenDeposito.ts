// Depositar un objeto de la mochila personal en el Almacén del Reino: la lógica de `POST /saves/:id/almacen/depositar/:itemId`
// (el botón «Depositar»), sacada de la ruta para que la usen también los pasos de preparación (`prepararReino.ts
// mochila-libre`, P367, QA-151: solo funciones del juego). Sin cambio de comportamiento: la ruta traduce `status` y `error`.
// NO mira la capacidad de la mochila: depositar sirve igual con la mochila llena (solo manda el tope de materiales del Almacén).
import type { PrismaClient } from '@prisma/client';
import { comidaDe } from './ganaderia.js';
import { esMaterial, huecoDeMateriales, motivoMaterialesLlenos } from './economiaReino.js';
import { pasaAComidaDelReino } from '../crafting.js';
import { autoEquiparDesdeAlmacen } from '../companionSupervivencia.js';
import { ownerKeyFor } from '../reinoOwner.js';

export type ResultadoDeposito = { ok: true; autoEquipados: number; comidaSumada?: number } | { ok: false; status: 404 | 400; error: string };

export async function depositarEnAlmacen(prisma: PrismaClient, saveId: string, itemId: string): Promise<ResultadoDeposito> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return { ok: false, status: 404, error: 'Partida no encontrada' };
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, saveId, slot: null, companionId: null, subjectId: null } });
  if (!item) return { ok: false, status: 404, error: 'Objeto no encontrado (o ya equipado)' };

  // CR-53 (Q2): los materiales caben hasta el tope del Almacén (base y Leñeras).
  if ((await esMaterial(prisma, saveId, item.catalogSlug)) && (await huecoDeMateriales(prisma, saveId)) <= 0) {
    return { ok: false, status: 400, error: await motivoMaterialesLlenos(prisma, saveId) };
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.delete({ where: { id: item.id } });
    // P215 (2026-10-19): la comida depositada cuenta para la Comida del Reino, como el plato de
    // una Cocina (`dailyTick.ts`): se convierte en el acto (`curaHambre` 10 = 1 de comida, mínimo 1)
    // y NO queda fila en el Almacén, así Retirar no puede duplicar la comida. Sin Reino fundado
    // (sin KingdomStats) no hay dónde sumar y el objeto se guarda como cualquier otro.
    const plato = item.catalogSlug ? await tx.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: item.catalogSlug }, select: { curaHambre: true } }) : null;
    if (plato?.curaHambre && pasaAComidaDelReino(item.catalogSlug, plato.curaHambre)) {
      const comida = Math.max(1, comidaDe(plato.curaHambre, 1));
      const { count } = await tx.kingdomStats.updateMany({ where: { ownerKey: ownerKeyFor({ saveId }) }, data: { comida: { increment: comida } } });
      if (count > 0) return { equipados: 0, comida };
    }
    await tx.almacenItem.create({
      data: { saveId, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined },
    });
    return autoEquiparDesdeAlmacen(tx, saveId);
  });
  return { ok: true, autoEquipados: result.equipados, ...('comida' in result ? { comidaSumada: result.comida } : {}) };
}
