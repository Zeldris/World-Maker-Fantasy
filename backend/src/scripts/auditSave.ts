import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

/// Comando "revisar partida" (memoria feedback_comando_revisar_partida): vuelca el estado real
/// de una partida (por defecto, la más jugada recientemente) para auditar consistencia narrativa
/// y mecánica — LogEntry cronológico, Quest, NpcState, inventario, hechos de mundo. Solo lectura.
/// Uso: npx tsx src/scripts/auditSave.ts [saveId]

async function main() {
  const saveId = process.argv[2];
  const save = await prisma.save.findFirst({
    where: saveId ? { id: saveId } : {},
    orderBy: saveId ? undefined : { lastPlayedAt: 'desc' },
    include: {
      world: true,
      worldState: true,
      currentLocation: true,
      logEntries: { orderBy: { createdAt: 'asc' } },
      quests: { orderBy: { createdAt: 'asc' } },
      inventoryItems: { orderBy: { createdAt: 'asc' } },
      companions: true,
      sessionSummaries: { orderBy: { chapterNumber: 'asc' } },
      characterTransit: true,
    },
  });

  if (!save) {
    console.log('No hay ninguna partida.');
    process.exit(0);
  }

  const npcStates = await prisma.npcState.findMany({
    where: { saveId: save.id },
    include: { npc: { select: { name: true, kind: true, slug: true } } },
  });

  console.log('=== SAVE ===');
  console.log(
    JSON.stringify(
      {
        id: save.id,
        character: save.characterName,
        world: save.world.name,
        level: save.level,
        xp: save.xp,
        condicionFisica: save.condicionFisica,
        salud: save.salud,
        deathCount: save.deathCount,
        dificultad: save.dificultad,
        currentLocation: save.currentLocation ? `${save.currentLocation.name} (${save.currentLocation.region})` : null,
        fictionalDateLabel: save.worldState?.fictionalDateLabel,
        endedAt: save.endedAt,
      },
      null,
      2,
    ),
  );

  console.log('\n=== FACTS/FACCIONES ===');
  console.log(JSON.stringify({ facts: save.worldState?.facts, factionsStatus: save.worldState?.factionsStatus }, null, 2));

  console.log('\n=== TRÁNSITO ===');
  console.log(
    save.characterTransit
      ? `${save.characterTransit.activity} — ocupado hasta ${save.characterTransit.busyUntil.toISOString()}`
      : '(sin tránsito activo)',
  );

  console.log('\n=== QUESTS ===');
  console.log(save.quests.map((q) => `[${q.status}] ${q.title} — ${q.description.slice(0, 80)}`).join('\n') || '(ninguna)');

  console.log('\n=== NPCSTATE ===');
  console.log(
    npcStates
      .map((s) => `${s.npc.name} (${s.npc.kind}, scope=${s.scope || '(global)'}): ${s.condicionFisica}${s.saqueado ? ', saqueado' : ''}`)
      .join('\n') || '(ninguno)',
  );

  console.log('\n=== INVENTARIO ===');
  console.log(save.inventoryItems.map((i) => `${i.name}${i.slot ? ` [${i.slot}]` : ''} — ${i.origin ?? 'sin origen'}`).join('\n') || '(vacío)');

  console.log('\n=== COMPAÑEROS ===');
  console.log(save.companions.map((c) => `${c.name} (${c.role})`).join('\n') || '(ninguno)');

  console.log('\n=== CAPÍTULOS ===');
  console.log(save.sessionSummaries.map((c) => `Cap. ${c.chapterNumber}: ${c.summary.slice(0, 100)}`).join('\n') || '(ninguno)');

  console.log(`\n=== LOG (${save.logEntries.length} entradas) ===`);
  for (const e of save.logEntries) {
    const tag = e.channel === 'CHARACTER' ? (e.isPlayerAction ? 'TÚ' : 'PJ') : 'MUNDO';
    console.log(`[${e.timeLabel}] (${tag}) ${e.text}${e.xpDelta ? ` [+${e.xpDelta} XP]` : ''}`);
  }

  process.exit(0);
}

main();
