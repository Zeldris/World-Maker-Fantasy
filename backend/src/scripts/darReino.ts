// QA-143: mete recursos del REINO de una partida de la base de juego, lo que `darObjetos.ts` no alcanza (ese
// llena el inventario del personaje, de donde salen los materiales de construir, pero no el Almacén ni el tesoro).
//   comida=N / bebida=N   suman a `KingdomStats.comida` / `bebida` (el tope base del Almacén es 60; un Granero lo sube)
//   goirnos=N             suma a `Save.goirnos` (la bolsa del personaje)
//   tesoro=N              suma a `KingdomStats.riqueza` (el tesoro del Reino, en Goirnos)
//   almacen:<slug>:<n>    n objetos del catálogo en el Almacén del Reino (`AlmacenItem`; los de tipo RECURSO cuentan
//                         contra el tope de materiales, 60 base)
//   edificio:<receta>     añade ya terminado (ACTIVO) un edificio de esa receta (`ConstructionRecipe.key`, p. ej. granero),
//                         en la Location y la posición del Ayuntamiento, como hace `turnResolution.ts` al construir
// Uso: DATABASE_URL=… npx tsx src/scripts/darReino.ts <saveId> comida=60 goirnos=300 almacen:cuerdas:10
// Lo lanza `tools/qa/escenario.sh dar-reino`.
import { prisma } from '../lib/prisma.js';
import { CONSTRUCTION_RECIPES, buildingTierFor } from '../services/construction.js';
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
// Edificios: la receta tiene que existir y el Reino un Ayuntamiento al que colgarlos.
const ayto = peticion.edificios.length ? await prisma.building.findFirst({ where: { saveId, recipeKey: 'ayuntamiento', status: 'ACTIVO' }, select: { locationId: true, x: true, y: true } }) : null;
const edificios = peticion.edificios.map((clave) => ({ clave, receta: CONSTRUCTION_RECIPES.find((r) => r.key === clave) }));
const sinReceta = edificios.find((e) => !e.receta);
if (sinReceta || (peticion.edificios.length && !ayto)) {
  console.error(sinReceta ? `«${sinReceta.clave}»: no hay receta con esa clave. No se ha dado nada.` : 'El reino no tiene Ayuntamiento activo. No se ha dado nada.');
  process.exit(1);
}
await prisma.$transaction([
  ...edificios.map(({ receta }) =>
    prisma.building.create({
      data: { saveId, locationId: ayto!.locationId ?? undefined, recipeKey: receta!.key, name: receta!.name, kind: receta!.key, description: receta!.description, status: 'ACTIVO', tier: buildingTierFor(receta!) ?? undefined, x: ayto!.x ?? undefined, y: ayto!.y ?? undefined },
    }),
  ),
  prisma.kingdomStats.update({ where: { saveId }, data: { comida: { increment: peticion.comida }, bebida: { increment: peticion.bebida }, riqueza: { increment: peticion.tesoro } } }),
  prisma.save.update({ where: { id: saveId }, data: { goirnos: { increment: peticion.goirnos } } }),
  ...lote.map(({ item, cantidad }) =>
    prisma.almacenItem.createMany({
      data: Array.from({ length: cantidad }, () => ({ saveId, name: item.name, description: item.description, catalogSlug: item.slug, statBonuses: item.statBonuses ?? undefined })),
    }),
  ),
]);
console.log(`comida +${peticion.comida}, bebida +${peticion.bebida}, bolsa +${peticion.goirnos} Goirnos, tesoro +${peticion.tesoro} Goirnos`);
for (const { receta } of edificios) console.log(`Edificio: ${receta!.name}`);
for (const { item, cantidad } of lote) console.log(`Almacén: ${cantidad} × ${item.name}`);
await prisma.$disconnect();
