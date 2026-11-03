// QA-102 (2026-10-19): mete objetos del catálogo en el inventario de una partida de la base de juego, para
// preparar un escenario sin recolectar decenas de veces lo ya probado (p. ej. los materiales para fundar el
// reino). Origen «escenario de prueba», para distinguirlos. Lo lanza `tools/qa/escenario.sh dar`.
// Uso: DATABASE_URL=… npx tsx src/scripts/darObjetos.ts <saveId> <slug>:<n> [<slug>:<n>…]
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { effectiveInventorySlotsBonus } from '../services/equipment.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../services/inventoryCapacity.js';
import { avisoDeCarga, repartirPorCapacidad } from './darObjetosLib.js';

const [saveId, ...pares] = process.argv.slice(2);
if (!saveId || pares.length === 0) {
  console.error('Uso: darObjetos.ts <saveId> <slug>:<n> [<slug>:<n>…]');
  process.exit(2);
}
const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
if (!save) {
  console.error(`No hay partida ${saveId}.`);
  process.exit(1);
}
// Se comprueban todos los pares antes de meter nada: con uno mal no queda medio inventario dado.
const lote = [];
for (const par of pares) {
  const [slug, n] = par.split(':');
  const cantidad = Number(n ?? 1);
  const item = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug } });
  if (!item || !Number.isInteger(cantidad) || cantidad < 1) {
    console.error(`«${par}»: no hay objeto con ese slug o la cantidad no vale. No se ha dado nada.`);
    process.exit(1);
  }
  lote.push({ item, cantidad });
}
// P367: se da lo que cabe en el inventario (capacidad - carga), no más; lo demás se avisa y se queda fuera.
const partida = await prisma.save.findUnique({ where: { id: saveId }, select: { attributes: true } });
const [items, equipados] = await Promise.all([
  prisma.inventoryItem.findMany({ where: { saveId }, select: { name: true } }),
  prisma.inventoryItem.findMany({ where: { saveId, slot: { not: null } }, select: { statBonuses: true } }),
]);
const atributos = partida!.attributes as { fuerza: number; constitucion: number };
const capacidad = inventoryCapacityFor(atributos.fuerza, atributos.constitucion, effectiveInventorySlotsBonus(equipados));
const carga = totalInventoryUnits(items);
const previo = avisoDeCarga(carga, capacidad);
if (previo) console.warn(previo);
const reparto = repartirPorCapacidad(lote.map(({ item, cantidad }) => ({ slug: item.slug, nombre: item.name, cantidad })), carga, capacidad);
const porSlug = new Map(lote.map(({ item }) => [item.slug, item]));
await prisma.$transaction(
  reparto.dar.map(({ slug, cantidad }) => {
    const item = porSlug.get(slug)!;
    return prisma.inventoryItem.createMany({
      data: Array.from({ length: cantidad }, () => ({
        saveId,
        name: item.name,
        description: item.description,
        origin: 'escenario de prueba',
        catalogSlug: item.slug,
        statBonuses: item.statBonuses ?? Prisma.JsonNull,
      })),
    });
  }),
);
for (const { nombre, cantidad } of reparto.dar) console.log(`${cantidad} × ${nombre}`);
for (const aviso of reparto.avisos) console.warn(aviso);
await prisma.$disconnect();
