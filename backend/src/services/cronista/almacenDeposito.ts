// Depositar un objeto de la mochila personal en el Almacén del Reino: la lógica de `POST /saves/:id/almacen/depositar/:itemId`
// (el botón «Depositar»), sacada de la ruta para que la usen también los pasos de preparación (`prepararReino.ts
// mochila-libre`, P367, QA-151: solo funciones del juego). Sin cambio de comportamiento: la ruta traduce `status` y `error`.
// NO mira la capacidad de la mochila: depositar sirve igual con la mochila llena (solo manda el tope de materiales del Almacén).
import type { PrismaClient } from '@prisma/client';
import { comidaDe } from './ganaderia.js';
import { esMaterial, huecoDeMateriales, motivoMaterialesLlenos, suministrosDelReino } from './economiaReino.js';
import { pasaAComidaDelReino } from '../crafting.js';
import { autoEquiparDesdeAlmacen } from '../companionSupervivencia.js';
import { ownerKeyFor } from '../reinoOwner.js';
import { lockRowForUpdate } from '../../routes/saves/shared.js';

/// La comida no cabe en el Granero: deshace la transacción (el objeto vuelve a la mochila) y se responde 400 con el motivo.
class GraneroLleno extends Error {}

export type ResultadoDeposito = { ok: true; autoEquipados: number; comidaSumada?: number } | { ok: false; status: 404 | 400; error: string };

export async function depositarEnAlmacen(prisma: PrismaClient, saveId: string, itemId: string): Promise<ResultadoDeposito> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return { ok: false, status: 404, error: 'Partida no encontrada' };
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, saveId, slot: null, companionId: null, subjectId: null } });
  if (!item) return { ok: false, status: 404, error: 'Objeto no encontrado (o ya equipado)' };

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Un depósito a la vez por partida (como ganado.ts): evita pasar el tope de materiales y borrar dos veces el mismo objeto.
      await lockRowForUpdate(tx, 'Save', saveId, ['id']);
      // CR-53 (Q2): los materiales caben hasta el tope del Almacén (base y Leñeras).
      if ((await esMaterial(tx, saveId, item.catalogSlug)) && (await huecoDeMateriales(tx, saveId)) <= 0) {
        return { llena: await motivoMaterialesLlenos(tx, saveId) } as const;
      }
      // Si otra petición ya lo depositó, ya no está: 404, no un error.
      const { count: borrados } = await tx.inventoryItem.deleteMany({ where: { id: item.id, saveId, slot: null, companionId: null, subjectId: null } });
      if (borrados === 0) return { yaNoEsta: true } as const;
      // P215 (2026-10-19): la comida depositada cuenta para la Comida del Reino, como el plato de
      // una Cocina (`dailyTick.ts`): se convierte en el acto (`curaHambre` 10 = 1 de comida, mínimo 1)
      // y NO queda fila en el Almacén, así Retirar no puede duplicar la comida. Sin Reino fundado
      // (sin KingdomStats) no hay dónde sumar y el objeto se guarda como cualquier otro.
      const plato = item.catalogSlug ? await tx.itemCatalog.findFirst({ where: { worldId: save.worldId, slug: item.catalogSlug }, select: { curaHambre: true } }) : null;
      if (plato?.curaHambre && pasaAComidaDelReino(item.catalogSlug, plato.curaHambre)) {
        const comida = Math.max(1, comidaDe(plato.curaHambre, 1));
        const owner = ownerKeyFor({ saveId });
        const stats = await tx.kingdomStats.findUnique({ where: { ownerKey: owner }, select: { comida: true, forraje: true } });
        if (stats) {
          // P438: la comida respeta el tope del Granero (compartido con el forraje, Q7); lo que no cabe se queda en la mochila.
          const { topeComida } = await suministrosDelReino(tx, saveId);
          if (stats.comida + stats.forraje + comida > topeComida) {
            throw new GraneroLleno(`El Granero está lleno (${stats.comida + stats.forraje}/${topeComida}, la comida y el forraje comparten su hueco): la comida se queda en la mochila.`);
          }
          await tx.kingdomStats.update({ where: { ownerKey: owner }, data: { comida: { increment: comida } } });
          return { equipados: 0, comida };
        }
      }
      await tx.almacenItem.create({
        data: { saveId, name: item.name, description: item.description, catalogSlug: item.catalogSlug, statBonuses: item.statBonuses ?? undefined },
      });
      return autoEquiparDesdeAlmacen(tx, saveId);
    });
  } catch (e) {
    if (e instanceof GraneroLleno) return { ok: false, status: 400, error: e.message };
    throw e;
  }
  if ('llena' in result) return { ok: false, status: 400, error: result.llena ?? 'El Almacén está lleno de materiales.' };
  if ('yaNoEsta' in result) return { ok: false, status: 404, error: 'Objeto no encontrado (o ya equipado)' };
  return { ok: true, autoEquipados: result.equipados, ...('comida' in result ? { comidaSumada: result.comida } : {}) };
}

export type ResultadoDepositoTodo = { depositados: number; noCaben: number; autoEquipados: number; comidaSumada: number; motivoNoCaben: string | null };

/// P428: «Depositar todo» — deposita de una vez todo lo suelto de la mochila (lo que la lista de Reino › Almacén ofrece
/// objeto a objeto: sin equipar y sin dueño). Cada objeto sigue las reglas de `depositarEnAlmacen` (tope de materiales,
/// comida que pasa a la Comida del Reino); los que no caben se quedan en la mochila y se cuentan en `noCaben`.
export async function depositarTodoEnAlmacen(prisma: PrismaClient, saveId: string): Promise<ResultadoDepositoTodo | { ok: false; status: 404; error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { id: true } });
  if (!save) return { ok: false, status: 404, error: 'Partida no encontrada' };
  const items = await prisma.inventoryItem.findMany({ where: { saveId, slot: null, companionId: null, subjectId: null }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  const r: ResultadoDepositoTodo = { depositados: 0, noCaben: 0, autoEquipados: 0, comidaSumada: 0, motivoNoCaben: null };
  for (const it of items) {
    const d = await depositarEnAlmacen(prisma, saveId, it.id);
    if (d.ok) {
      r.depositados++;
      r.autoEquipados += d.autoEquipados;
      r.comidaSumada += d.comidaSumada ?? 0;
    } else if (d.status === 400) {
      r.noCaben++;
      // Materiales y comida pueden no caber por motivos distintos: se dicen todos, sin repetir.
      if (!r.motivoNoCaben?.includes(d.error)) r.motivoNoCaben = r.motivoNoCaben ? `${r.motivoNoCaben} ${d.error}` : d.error;
    }
  }
  return r;
}
