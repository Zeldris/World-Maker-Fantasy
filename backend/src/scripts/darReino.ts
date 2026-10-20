// QA-143: mete recursos del REINO de una partida de la base de juego, lo que `darObjetos.ts` no alcanza (ese
// llena el inventario del personaje, de donde salen los materiales de construir, pero no el Almacén ni el tesoro).
//   comida=N / bebida=N   suman a `KingdomStats.comida` / `bebida` (el tope base del Almacén es 60; un Granero lo sube)
//   goirnos=N             suma a `Save.goirnos` (la bolsa del personaje)
//   tesoro=N              suma a `KingdomStats.riqueza` (el tesoro del Reino, en Goirnos)
//   almacen:<slug>:<n>    n objetos del catálogo en el Almacén del Reino (`AlmacenItem`; los de tipo RECURSO cuentan
//                         contra el tope de materiales, 60 base)
// Uso: DATABASE_URL=… npx tsx src/scripts/darReino.ts <saveId> comida=60 goirnos=300 almacen:cuerdas:10
// Lo lanza `tools/qa/escenario.sh dar-reino`.
import { prisma } from '../lib/prisma.js';
import { parsearPeticionReino } from './darReinoLib.js';

const [saveId, ...args] = process.argv.slice(2);
const peticion = parsearPeticionReino(args);
if (!saveId || 'error' in peticion) {
  console.error(`${'error' in peticion ? peticion.error + ' ' : ''}Uso: darReino.ts <saveId> comida=N bebida=N goirnos=N tesoro=N almacen:<slug>:<n>…`);
  process.exit(2);
}
const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
const stats = await prisma.kingdomStats.findUnique({ where: { saveId }, select: { id: true } });
if (!save || !stats) {
  console.error(`No hay partida ${saveId} con reino.`);
  process.exit(1);
}
// Se comprueban todos los slugs antes de meter nada.
const lote = [];
for (const { slug, cantidad } of peticion.almacen) {
  const item = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug } });
  if (!item) {
    console.error(`«${slug}»: no hay objeto con ese slug. No se ha dado nada.`);
    process.exit(1);
  }
  lote.push({ item, cantidad });
}
await prisma.$transaction([
  prisma.kingdomStats.update({ where: { saveId }, data: { comida: { increment: peticion.comida }, bebida: { increment: peticion.bebida }, riqueza: { increment: peticion.tesoro } } }),
  prisma.save.update({ where: { id: saveId }, data: { goirnos: { increment: peticion.goirnos } } }),
  ...lote.map(({ item, cantidad }) =>
    prisma.almacenItem.createMany({
      data: Array.from({ length: cantidad }, () => ({ saveId, name: item.name, description: item.description, catalogSlug: item.slug, statBonuses: item.statBonuses ?? undefined })),
    }),
  ),
]);
console.log(`comida +${peticion.comida}, bebida +${peticion.bebida}, bolsa +${peticion.goirnos} Goirnos, tesoro +${peticion.tesoro} Goirnos`);
for (const { item, cantidad } of lote) console.log(`Almacén: ${cantidad} × ${item.name}`);
await prisma.$disconnect();
