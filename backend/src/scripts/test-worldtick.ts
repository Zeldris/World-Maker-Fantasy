import { resolveDueTransits } from '../workers/worldTick.js';
import { prisma } from '../lib/prisma.js';

async function main() {
  console.log('Resolviendo transitos vencidos...');
  await resolveDueTransits();
  console.log('Hecho.');
  await prisma.$disconnect();
}

main();
