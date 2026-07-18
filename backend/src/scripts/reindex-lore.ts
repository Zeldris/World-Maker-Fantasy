import 'dotenv/config';
import '../lib/setupFetch.js';
import { prisma } from '../lib/prisma.js';
import { embed, toVectorLiteral } from '../lib/embeddings.js';
import { loreChunks } from './loreChunks.js';

/// Reindexa el lore de Helek Sirik para recuperación semántica (RAG). Correr cada vez que
/// docs/rpgtarkor/*.md cambie y loreChunks.ts se actualice con los fragmentos afectados.
/// Uso: npm run reindex-lore

const WORLD_SLUG = 'helek-sirik';

async function ensureWorld(): Promise<string> {
  const world = await prisma.world.upsert({
    where: { slug: WORLD_SLUG },
    update: {},
    create: {
      slug: WORLD_SLUG,
      name: 'Helek Sirik',
      tagline: '"Origen Azul" — pueblos que se creen en lo correcto, en guerra por una verdad que nadie tiene completa.',
      synopsis:
        'Dos continentes, Vaelira y Berig, separados por un estrecho envuelto en niebla. Tras generaciones de paz vigilada, la Isla Cambiante que ambos sellaron ha desaparecido, y en su lugar ha surgido algo que ninguno de los dos bandos comprende. La guerra entre la Alianza de la Rama Blanca y la Concordia de Hierro ya ha empezado — y nadie sabe todavía que lo peor no viene del otro continente, sino de lo que ha despertado en el norte.',
      tone: 'Épico y trágico: pueblos que se creen en lo correcto libran una guerra sobre una verdad que nadie tiene completa, en un mundo tan pequeño que cada muerte deja cicatriz.',
      lethality: 'MEDIA',
      factions: [
        'Alianza de la Rama Blanca',
        'Concordia de Hierro',
        'Reino oculto Kalisar',
        'Clanes orcos de las Llanuras del Viento Rojo',
      ],
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
  console.log(`Reindexando ${loreChunks.length} fragmentos de lore...`);

  const worldId = await ensureWorld();

  // Reindexado completo: más simple y seguro que diffear cambio a cambio con un corpus de este tamaño.
  await prisma.loreChunk.deleteMany({ where: { worldId } });

  let done = 0;
  for (const chunk of loreChunks) {
    const t0 = Date.now();
    const vector = await embed(`${chunk.title}\n${chunk.text}`);
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

    done += 1;
    console.log(`  [${done}/${loreChunks.length}] ${chunk.title} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log('Reindexado completo.');
}

main()
  .catch((err) => {
    console.error('Error reindexando el lore:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
