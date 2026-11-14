// QA-102 (2026-10-19): avanza N días de ficción una partida de la base de juego, con el avance diario de
// siempre (`avanzarMundoHasta`): para probar lo que tarda días (llegadas, parejas, cosechas, asaltos) sin
// jugarlos. Lo lanza `tools/qa/escenario.sh avanzar <partida> <días>`, con el juego parado: el servidor pone en
// cola sus propios avances por partida (`enSegundoPlano`) y este proceso no la ve.
// P369: con `--reparar` avanza día a día y, tras cada día, repara los edificios DANADO con la función del botón «Reparar»
// (`repararDanados`, cuesta materiales del Almacén; si faltan lo dice y sigue): esquiva las tormentas sin cambiar el motor.
// P377: al final repone los puntos de fauna del lugar actual con la función del juego (`reponerZonaActual`).
// Uso: DATABASE_URL=… npx tsx src/scripts/avanzarDias.ts <saveId> <días> [--reparar]
import { prisma } from '../lib/prisma.js';
import { avanzarMundoHasta } from '../services/avanceDiario.js';
import { avanzarRelojConTick } from '../services/dailyTick.js';
import { formatFictionalDate } from '../services/worldClock.js';
import { reponerZonaActual } from '../services/cronista/prepararAvance.js';
import { repararDanados, textoSinReparar } from '../services/cronista/prepararEdificios.js';

const [saveId, diasTexto, ...resto] = process.argv.slice(2);
const reparar = resto.includes('--reparar');
const dias = Number(diasTexto);
if (!saveId || !Number.isInteger(dias) || dias < 1) {
  console.error('Uso: avanzarDias.ts <saveId> <días ≥ 1> [--reparar]');
  process.exit(2);
}
const estado = await prisma.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true, save: { select: { worldId: true } } } });
if (!estado) {
  console.error(`No hay partida ${saveId} (o no tiene reloj).`);
  process.exit(1);
}
const hastaFinal = estado.fictionalMinutes + dias * 1440;
let total = 0;
let desde = estado.fictionalMinutes;
const reparados: string[] = [];
const sinReparar = new Map<string, string>();
while (desde < hastaFinal) {
  const hasta = reparar ? desde + 1440 : hastaFinal;
  // Reloj + tick diario del Reino (P216), una vez por medianoche cruzada.
  await prisma.$transaction((tx) => avanzarRelojConTick(tx, { saveId, worldId: estado.save.worldId, minutosAntes: desde, minutosDespues: hasta }), { timeout: 120_000 });
  // `avanzarMundoHasta` simula como mucho `MAX_DIAS_POR_LLAMADA` días por llamada: se repite hasta ponerse al día.
  for (;;) {
    const { diasSimulados } = await avanzarMundoHasta(prisma, saveId, hasta);
    if (diasSimulados === 0) break;
    total += diasSimulados;
  }
  desde = hasta;
  if (reparar) {
    const r = await repararDanados(prisma, saveId);
    reparados.push(...r.reparados.map((x) => x.nombre));
    for (const x of r.sinReparar) sinReparar.set(x.nombre, textoSinReparar(x));
  }
}
console.log(`${total} días simulados; ahora: ${formatFictionalDate(hastaFinal)}`);
// P377: como el juego al abrir el mapa de zona, repone la fauna del lugar actual con el reloj ya avanzado.
const repuesta = await reponerZonaActual(prisma, saveId);
if (repuesta) console.log(`Fauna de ${repuesta.lugar} repuesta como al abrir el mapa de zona`);
if (reparar) {
  console.log(`Reparados tras cada día: ${reparados.length}${reparados.length ? ` (${reparados.join(', ')})` : ''}`);
  for (const [nombre, motivo] of sinReparar) console.log(`AVISO ${nombre} sigue dañado: ${motivo}`);
}
await prisma.$disconnect();
