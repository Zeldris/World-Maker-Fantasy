// CR-48 (hito 0.2): cuánto tarda el avance diario con el motor completo, paso a paso.
// Uso: npm run benchmark-avance -- [días=10]
// Crea una partida de prueba en el mundo helek-sirik, simula 1 día y luego N de golpe (como un viaje
// largo), imprime el tiempo de cada paso y borra la partida.
process.env.AVANCE_PERFIL = '1';
const { prisma } = await import('../lib/prisma.js');
const { getDefaultUserId } = await import('../lib/defaultUser.js');
const { avanzarMundoHasta, leerPerfilAvance } = await import('../services/avanceDiario.js');

const dias = Number(process.argv[2] ?? 10);
const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
const lugar = await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } });
const save = await prisma.save.create({
  data: {
    userId: await getDefaultUserId(), worldId: world.id, characterName: 'Benchmark avance', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x',
    attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 0 }, portraitInitial: 'B',
    currentLocationId: lugar.id, worldState: { create: { fictionalMinutes: 600 } },
  },
});

const imprimir = (titulo: string, totalMs: number) => {
  const perfil = Object.entries(leerPerfilAvance()).sort((a, b) => b[1].ms - a[1].ms);
  console.log(`\n${titulo}: ${totalMs.toFixed(0)} ms`);
  for (const [nombre, { ms, veces }] of perfil) console.log(`  ${nombre.padEnd(20)} ${ms.toFixed(0).padStart(7)} ms  (${veces}×)`);
};

try {
  let t = performance.now();
  await avanzarMundoHasta(prisma, save.id, 600 + 1440);
  imprimir('1 día (incluye clonar el mundo de la partida)', performance.now() - t);
  t = performance.now();
  await avanzarMundoHasta(prisma, save.id, 600 + 1440 * 2);
  imprimir('1 día más', performance.now() - t);
  t = performance.now();
  await avanzarMundoHasta(prisma, save.id, 600 + 1440 * (2 + dias));
  imprimir(`${dias} días de golpe`, performance.now() - t);
} finally {
  await prisma.save.delete({ where: { id: save.id } });
  await prisma.$disconnect();
}
