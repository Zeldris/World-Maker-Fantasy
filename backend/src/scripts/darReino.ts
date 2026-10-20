// QA-143: mete recursos del REINO de una partida de la base de juego, lo que `darObjetos.ts` no alcanza (ese
// llena el inventario del personaje, de donde salen los materiales de construir, pero no el Almacén ni el tesoro).
//   comida=N / bebida=N   suman a `KingdomStats.comida` / `bebida` (el tope base del Almacén es 60; un Granero lo sube; si se
//                         pasa del tope, se rechaza todo y se dice el tope)
//   goirnos=N             suma a `Save.goirnos` (la bolsa del personaje)
//   tesoro=N              suma a `KingdomStats.riqueza` (el tesoro del Reino, en Goirnos)
//   almacen:<slug>:<n>    n objetos del catálogo en el Almacén del Reino (`AlmacenItem`; los de tipo RECURSO cuentan
//                         contra el tope de materiales, 60 base)
//   edificio:<receta>     añade ya terminado (ACTIVO) un edificio de esa receta (`ConstructionRecipe.key`, p. ej. granero),
//                         en la Location del Ayuntamiento y junto a él, con las condiciones de `computeBuildBlockedReason`; si la receta
//                         mejora otra (`upgradesRecipeKey`) actualiza ese edificio, como `turnResolution.ts`
// Uso: DATABASE_URL=… npx tsx src/scripts/darReino.ts <saveId> comida=60 goirnos=300 almacen:cuerdas:10
// Lo lanza `tools/qa/escenario.sh dar-reino`.
import { prisma } from '../lib/prisma.js';
import { CONSTRUCTION_RECIPES, buildingTierFor, computeBuildBlockedReason } from '../services/construction.js';
import { materialesDelAlmacen, suministrosDelReino } from '../services/cronista/economiaReino.js';
import { parsearPeticionReino, posicionJuntoAlAyuntamiento, primerExcesoDeTope } from './darReinoLib.js';

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
const lote: { item: NonNullable<Awaited<ReturnType<typeof prisma.itemCatalog.findFirst>>>; cantidad: number }[] = [];
for (const { slug, cantidad } of peticion.almacen) {
  const item = await prisma.itemCatalog.findFirst({ where: { worldId: save.worldId, slug } });
  if (!item) {
    console.error(`«${slug}»: no hay objeto con ese slug. No se ha dado nada.`);
    process.exit(1);
  }
  lote.push({ item, cantidad });
}
// Edificios: la receta tiene que existir y el Reino un Ayuntamiento al que colgarlos.
const ayto = peticion.edificios.length ? await prisma.building.findFirst({ where: { saveId, recipeKey: 'ayuntamiento', status: 'ACTIVO' }, select: { locationId: true, x: true, y: true, location: { select: { id: true, region: true } } } }) : null;
const edificios = peticion.edificios.map((clave) => ({ clave, receta: CONSTRUCTION_RECIPES.find((r) => r.key === clave) }));
const sinReceta = edificios.find((e) => !e.receta);
if (sinReceta || (peticion.edificios.length && !ayto?.location)) {
  console.error(sinReceta ? `«${sinReceta.clave}»: no hay receta con esa clave. No se ha dado nada.` : 'El reino no tiene Ayuntamiento activo. No se ha dado nada.');
  process.exit(1);
}
class Rechazo extends Error {}
// Todo en una transacción: un rechazo (condiciones, topes) la deshace entera. Los edificios se aplican uno a uno, para que
// las condiciones y los topes vean los de la misma orden (`edificio:granero comida=120` vale).
try {
  await prisma.$transaction(async (tx) => {
    for (const { clave, receta } of edificios) {
      // Mismas condiciones que al construir en el juego (cupo del Ayuntamiento, nivel previo, sitio, único por región…).
      const motivo = await computeBuildBlockedReason({ db: tx, saveId, worldId: save.worldId, buildRecipe: receta!, activeRegion: ayto!.location!.region, currentLocationRecord: { id: ayto!.location!.id } });
      if (motivo) throw new Rechazo(`«${clave}»: ${motivo}.`);
      if (receta!.upgradesRecipeKey) {
        // Como turnResolution.ts: la mejora actualiza el edificio existente de la receta base, no crea otro.
        const objetivo = await tx.building.findFirst({ where: { saveId, recipeKey: receta!.upgradesRecipeKey, status: 'ACTIVO' } });
        if (!objetivo) throw new Rechazo(`«${clave}»: no hay ningún «${receta!.upgradesRecipeKey}» activo que mejorar.`);
        await tx.building.update({ where: { id: objetivo.id }, data: { name: receta!.name, description: receta!.description, tier: buildingTierFor(receta!) ?? undefined, status: 'ACTIVO' } });
        continue;
      }
      const ocupadas = await tx.building.findMany({ where: { saveId, locationId: ayto!.locationId }, select: { x: true, y: true } });
      const pos = posicionJuntoAlAyuntamiento(ayto!, ocupadas);
      await tx.building.create({
        data: { saveId, locationId: ayto!.locationId ?? undefined, recipeKey: receta!.key, name: receta!.name, kind: receta!.key, description: receta!.description, status: 'ACTIVO', tier: buildingTierFor(receta!) ?? undefined, x: pos?.x, y: pos?.y },
      });
    }
    // Topes del Almacén con los edificios ya puestos (el Granero sube comida, etc.).
    const [sum, ks, recursos] = await Promise.all([suministrosDelReino(tx, saveId), tx.kingdomStats.findUniqueOrThrow({ where: { saveId }, select: { comida: true, bebida: true } }), materialesDelAlmacen(tx, saveId)]);
    const materiales = lote.filter(({ item }) => item.tipo === 'RECURSO').reduce((n, { cantidad }) => n + cantidad, 0);
    const exceso = primerExcesoDeTope(
      { comida: peticion.comida, bebida: peticion.bebida, materiales },
      { comida: ks.comida, bebida: ks.bebida, materiales: recursos.guardados },
      { comida: sum.topeComida, bebida: sum.topeBebida, materiales: sum.topeMateriales },
    );
    if (exceso) throw new Rechazo(exceso);
    await tx.kingdomStats.update({ where: { saveId }, data: { comida: { increment: peticion.comida }, bebida: { increment: peticion.bebida }, riqueza: { increment: peticion.tesoro } } });
    await tx.save.update({ where: { id: saveId }, data: { goirnos: { increment: peticion.goirnos } } });
    for (const { item, cantidad } of lote) {
      await tx.almacenItem.createMany({
        data: Array.from({ length: cantidad }, () => ({ saveId, name: item.name, description: item.description, catalogSlug: item.slug, statBonuses: item.statBonuses ?? undefined })),
      });
    }
  });
} catch (e) {
  if (!(e instanceof Rechazo)) throw e;
  console.error(`${e.message} No se ha dado nada.`);
  await prisma.$disconnect();
  process.exit(1);
}
console.log(`comida +${peticion.comida}, bebida +${peticion.bebida}, bolsa +${peticion.goirnos} Goirnos, tesoro +${peticion.tesoro} Goirnos`);
for (const { receta } of edificios) console.log(`Edificio: ${receta!.name}`);
for (const { item, cantidad } of lote) console.log(`Almacén: ${cantidad} × ${item.name}`);
await prisma.$disconnect();
