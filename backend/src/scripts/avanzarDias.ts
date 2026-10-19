// QA-102 (2026-10-19): avanza N días de ficción una partida de la base de juego, con el avance diario de
// siempre (`avanzarMundoHasta`): para probar lo que tarda días (llegadas, parejas, cosechas, asaltos) sin
// jugarlos. Lo lanza `tools/qa/escenario.sh avanzar <partida> <días>`, con el juego parado: el servidor pone en
// cola sus propios avances por partida (`enSegundoPlano`) y este proceso no la ve.
// Uso: DATABASE_URL=… npx tsx src/scripts/avanzarDias.ts <saveId> <días>
import { prisma } from '../lib/prisma.js';
import { avanzarMundoHasta } from '../services/avanceDiario.js';
import { avanzarRelojConTick } from '../services/dailyTick.js';
import { formatFictionalDate } from '../services/worldClock.js';

const [saveId, diasTexto] = process.argv.slice(2);
const dias = Number(diasTexto);
if (!saveId || !Number.isInteger(dias) || dias < 1) {
  console.error('Uso: avanzarDias.ts <saveId> <días ≥ 1>');
  process.exit(2);
}
const estado = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true, save: { select: { worldId: true } } } });
if (!estado) {
  console.error(`No hay partida ${saveId} (o no tiene reloj).`);
  process.exit(1);
}
const hasta = estado.fictionalMinutes + dias * 1440;
// Reloj + tick diario del Reino (P216), una vez por medianoche cruzada.
await prisma.$transaction((tx) => avanzarRelojConTick(tx, { saveId, worldId: estado.save.worldId, minutosAntes: estado.fictionalMinutes, minutosDespues: hasta }), { timeout: 120_000 });
// `avanzarMundoHasta` simula como mucho `MAX_DIAS_POR_LLAMADA` días por llamada: se repite hasta ponerse al día.
let total = 0;
for (;;) {
  const { diasSimulados } = await avanzarMundoHasta(prisma, saveId, hasta);
  if (diasSimulados === 0) break;
  total += diasSimulados;
}
console.log(`${total} días simulados; ahora: ${formatFictionalDate(hasta)}`);
await prisma.$disconnect();
