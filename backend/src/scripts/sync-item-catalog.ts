import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { sincronizarObjetosDeCatalogo } from '../services/itemCatalogSync.js';

/// Pone al día en las partidas existentes los `statBonuses` de InventoryItem/AlmacenItem con
/// `catalogSlug` y desequipa lo que ya no cabe en su ranura (ver services/itemCatalogSync.ts).
/// Idempotente, por lotes. Correr tras `seed-catalog`. Uso: npm run sync-item-catalog
async function main() {
  console.log('Resincronizando objetos de catálogo en las partidas...');
  const r = await sincronizarObjetosDeCatalogo(prisma);
  console.log(`  Filas revisadas: ${r.revisados}`);
  console.log(`  Inventario: ${r.inventarioActualizados} actualizados, ${r.inventarioDesequipados} desequipados (siguen en la mochila)`);
  console.log(`  Almacén: ${r.almacenActualizados} actualizados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
