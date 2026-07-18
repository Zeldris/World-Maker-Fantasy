import 'dotenv/config';
import '../lib/setupFetch.js';
import { prisma } from '../lib/prisma.js';
import { retrieveLore, formatLoreForPrompt } from '../services/retrieval.js';

async function main() {
  const world = await prisma.world.findUniqueOrThrow({ where: { slug: 'helek-sirik' } });
  const query = process.argv.slice(2).join(' ') || 'Gorhorn enciende una hoguera al anochecer en las Llanuras';

  console.log(`Consulta: "${query}"\n`);
  const t0 = Date.now();
  const chunks = await retrieveLore(query, world.id, 10);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  chunks.forEach((c, i) => console.log(`${i + 1}. [dist ${c.distance.toFixed(3)}] ${c.title}`));
  console.log('\n--- formateado (topK=4, tope de caracteres) ---\n');
  formatLoreForPrompt(chunks.slice(0, 4)).forEach((f, i) => console.log(`${i + 1}. ${f}\n`));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
