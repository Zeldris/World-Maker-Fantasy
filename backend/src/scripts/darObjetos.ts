// QA-102 (2026-10-19): mete objetos del catálogo en el inventario de una partida de la base de juego, para
// preparar un escenario sin recolectar decenas de veces lo ya probado (p. ej. los materiales para fundar el
// reino). Origen «escenario de prueba», para distinguirlos. Lo lanza `tools/qa/escenario.sh dar`.
// Uso: DATABASE_URL=… npx tsx src/scripts/darObjetos.ts <saveId> <slug>:<n> [<slug>:<n>…]
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

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
await prisma.$transaction(
  lote.map(({ item, cantidad }) =>
    prisma.inventoryItem.createMany({
      data: Array.from({ length: cantidad }, () => ({
        saveId,
        name: item.name,
        description: item.description,
        origin: 'escenario de prueba',
        catalogSlug: item.slug,
        statBonuses: item.statBonuses ?? Prisma.JsonNull,
      })),
    }),
  ),
);
for (const { item, cantidad } of lote) console.log(`${cantidad} × ${item.name}`);
await prisma.$disconnect();
