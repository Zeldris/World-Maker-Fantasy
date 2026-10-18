// P160 (QA-27): la energía que se recupera con el paso del tiempo, en un solo sitio. Andar por el mapa de
// zona la daba (B11) y recolectar, que también hace pasar el tiempo, no; cada camino que adelanta el
// reloj fuera de un turno la suma con esto (un turno la suma en `turnResolution`, con su propio cálculo
// de energía del turno).
import type { Prisma } from '@prisma/client';
import { energiaMaxFor, energiaPasivaEntre } from './energy.js';
import { effectiveAttributes } from './equipment.js';
import type { AttributeBlock } from './dice.js';

/// Suma la energía pasiva de `antes` a `despues` (minutos de ficción), sin pasar del máximo con el equipo
/// puesto. Devuelve la energía nueva, o null si no cambia (P161: para que el HUD la refresque).
export async function sumarEnergiaPasiva(tx: Prisma.TransactionClient, saveId: string, antes: number, despues: number): Promise<number | null> {
  const ganada = energiaPasivaEntre(antes, despues);
  if (ganada <= 0) return null;
  const save = await tx.save.findUnique({
    where: { id: saveId },
    select: { energia: true, attributes: true, inventoryItems: { where: { slot: { not: null } } } },
  });
  if (!save) return null;
  const maximo = energiaMaxFor(effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems).constitucion);
  const energia = Math.min(maximo, save.energia + ganada);
  if (energia === save.energia) return null;
  await tx.save.update({ where: { id: saveId }, data: { energia } });
  return energia;
}
