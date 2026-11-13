import 'dotenv/config';
import '../lib/setupFetch.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { embed, toVectorLiteral } from '../lib/embeddings.js';
import { loreChunks } from './loreChunks.js';
import { trozosParaIndexar } from './loreTrozos.js';
import { aplicarArgumentosRag, configRag, textoDocumento, type ConfigIndice } from '../lib/ragConfig.js';
import { env } from '../config/env.js';

/// Reindexa el lore de Helek Sirik para recuperación semántica (RAG). Correr cada vez que
/// docs/rpgtarkor/*.md cambie y loreChunks.ts se actualice con los fragmentos afectados.
/// Uso: npm run reindex-lore -- [--tam-trozo <n>] [--solape <n>] [--prefijo-consulta <t>] [--prefijo-documento <t>]
///        [--plantilla <t>] [--prefijos-nomic]
/// Los mandos (`QA-330`, también por variables RAG_*) están en `src/lib/ragConfig.ts`; la configuración usada se
/// guarda en `World.loreIndice` para que `rag-eval` avise si no casa con la suya.

const WORLD_SLUG = 'helek-sirik';

async function ensureWorld(): Promise<string> {
  const world = await prisma.world.upsert({
    where: { slug: WORLD_SLUG },
    update: {},
    create: {
      slug: WORLD_SLUG,
      name: 'Helek Sirik',
      tagline: '«Origen Azul» — pueblos que se creen en lo correcto, en guerra por una verdad que nadie tiene completa.',
      synopsis:
        'Dos continentes, Vaelira y Berig, separados por un estrecho envuelto en niebla. Tras generaciones de paz vigilada, la Isla Cambiante que ambos sellaron ha desaparecido, y en su lugar ha surgido algo que ninguno de los dos bandos comprende. La guerra entre la Alianza de la Rama Blanca y la Concordia de Hierro ya ha empezado — y nadie sabe todavía que lo peor no viene del otro continente, sino de lo que ha despertado en el norte.',
      tone: 'Épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño que cada muerte deja cicatriz.',
      lethality: 'MEDIA',
      theme: {
        accent300: '#a8d8f0',
        accent400: '#7bc4e8',
        accent500: '#4aa8d8',
        accent600: '#3488b8',
        accent2300: '#b0bec8',
        accent2400: '#8a9aa8',
        accent2500: '#6b7d8c',
        accent2600: '#52626f',
      },
    },
  });
  return world.id;
}

async function main() {
  aplicarArgumentosRag(process.argv.slice(2));
  const cfg = configRag();
  console.log(`Reindexando ${loreChunks.length} fragmentos de lore...`);
  console.log(`  modelo ${env.ollamaModelEmbeddings}, trozo ${cfg.tamTrozo}, solape ${cfg.solape}, plantilla ${JSON.stringify(cfg.plantilla)}`);

  const worldId = await ensureWorld();

  // Reindexado completo: más simple y seguro que diffear cambio a cambio con un corpus de este tamaño.
  await prisma.loreChunk.deleteMany({ where: { worldId } });

  // Mientras se reindexa, el índice no tiene configuración conocida.
  await prisma.world.update({ where: { id: worldId }, data: { loreIndice: Prisma.DbNull } });
  let done = 0;
  for (const chunk of loreChunks) {
    const t0 = Date.now();
    // QA-167: una fila por trozo, todas con el texto entero (ver loreTrozos.ts).
    for (const trozo of trozosParaIndexar(chunk.text, cfg.tamTrozo, cfg.solape)) {
      const vector = await embed(textoDocumento(cfg, chunk.title, trozo));
      const id = crypto.randomUUID();

      await prisma.$executeRaw`
        INSERT INTO "LoreChunk" (id, "worldId", type, title, text, tags, "sourceDoc", embedding, "createdAt")
        VALUES (
          ${id},
          ${worldId},
          ${chunk.type}::"LoreChunkType",
          ${chunk.title},
          ${chunk.text},
          ${chunk.tags},
          ${chunk.sourceDoc},
          ${toVectorLiteral(vector)}::vector,
          now()
        )
      `;
    }

    done += 1;
    console.log(`  [${done}/${loreChunks.length}] ${chunk.title} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  const indice: ConfigIndice = { modelo: env.ollamaModelEmbeddings, ...cfg, fecha: new Date().toISOString() };
  await prisma.world.update({ where: { id: worldId }, data: { loreIndice: { ...indice } } });
  console.log('Reindexado completo.');
}

main()
  .catch((err) => {
    console.error('Error reindexando el lore:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
