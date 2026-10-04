// CR-8 (hito 0.2): migra las partidas existentes al mundo por partida (roadmap-cronista.md § 16).
//   npm run cronista:migrar-partidas            → solo informa (no cambia nada)
//   npm run cronista:migrar-partidas -- --aplicar → aplica (idempotente)
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { migrarTodasLasPartidas } from '../services/cronista/migrarPartidas.js';

const aplicar = process.argv.includes('--aplicar');

const { informes, muertosDeMundoLiberados } = await migrarTodasLasPartidas(prisma, aplicar);
console.log(aplicar ? 'Migración APLICADA.' : 'Simulación (sin cambios). Para aplicar: -- --aplicar');
console.table(informes);
console.log(`Partidas: ${informes.length}. Clonan su mundo: ${informes.filter((i) => i.clonaMundo).length}.`);
console.log(`NPC muertos de mundo que pasan a cada partida existente: ${muertosDeMundoLiberados}.`);
await prisma.$disconnect();
