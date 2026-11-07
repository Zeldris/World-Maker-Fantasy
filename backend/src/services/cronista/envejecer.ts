// Envejecer (CR-13 paso 13b, hito 0.2). Una vez por día simulado de la partida (`avanceDiario.ts`):
//
// - Los NPC nacidos en la partida (con `atributosPotenciales`) ajustan los atributos que cuentan a
//   su edad: crecen hasta la madurez y bajan en la vejez (`edades.ts`).
// - Los NPC con nombre de una facción pueden morir de viejo (`probMuerteDeViejoPorDia`): efecto
//   `matarNpc` con la causa «de viejo», que abre sucesión si era líder (reacciones de CR-10).
//
// Los del catálogo no cambian sus atributos (son del mundo): sus años de vejez en esta partida van a
// `NpcState.vejez` (CR-13 13c) y se restan al usarlos en escena y en combate (`restarVejez`).
import type { PrismaClient } from '@prisma/client';
import { npcSinMorirEnPartida } from '../mundoPartida.js';
import { aplicarEfecto } from './efectos.js';
import { anosDeVejez, atributosPorEdad, edadEnAnios, nacidoEnDe, probMuerteDeViejoPorDia } from './edades.js';
import type { Atributos } from './herencia.js';

/// La muerte de un NPC con nombre «de viejo»: efecto `matarNpc`, que si era líder abre la sucesión (reacciones de
/// CR-10/CR-11). La usan `envejecerDia` y el paso `lider-muere` de `prepararReino.ts` (QA-268, QA-151: la misma escritura).
export function morirDeViejo(
  prisma: PrismaClient,
  { saveId, worldId, ahora, npcId, random = Math.random }: { saveId: string; worldId: string; ahora: number; npcId: string; random?: () => number },
) {
  return prisma.$transaction((tx) => aplicarEfecto({ tx, saveId, worldId, fictionalMinutes: ahora, origen: 'MUNDO', random }, { tipo: 'matarNpc', npcId, causa: 'de viejo' }));
}

export async function envejecerDia(prisma: PrismaClient, saveId: string, dia: number, random: () => number = Math.random): Promise<{ ajustados: number; muertos: string[] }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save?.worldState) return { ajustados: 0, muertos: [] };
  const ahora = Math.min(dia * 1440 + 720, save.worldState.fictionalMinutes);
  const worldId = save.worldId;

  const npcs = await prisma.npc.findMany({
    // Ni los muertos fuera de escena ni los que cayeron en combate con la jugadora.
    where: { worldId, kind: 'PRINCIPAL', faction: { not: null }, ...npcSinMorirEnPartida(saveId) },
    select: { id: true, slug: true, raza: true, nacidoEn: true, attributes: true, atributosPotenciales: true, saveId: true },
    orderBy: { id: 'asc' },
  });

  const vejezPorNpc = new Map(
    (await prisma.npcState.findMany({ where: { saveId, scope: '', npcId: { in: npcs.map((n) => n.id) } }, select: { npcId: true, vejez: true } })).map((s) => [s.npcId, s.vejez]),
  );
  let ajustados = 0;
  const muertos: string[] = [];
  for (const npc of npcs) {
    const edad = edadEnAnios(nacidoEnDe(npc), ahora);
    if (npc.saveId === saveId && npc.atributosPotenciales) {
      const atributos = atributosPorEdad(npc.atributosPotenciales as Atributos, npc.raza, edad);
      if (JSON.stringify(atributos) !== JSON.stringify(npc.attributes)) {
        await prisma.npc.update({ where: { id: npc.id }, data: { attributes: atributos } });
        ajustados++;
      }
    } else if (npc.saveId === null) {
      // CR-13 13c: los del catálogo guardan su vejez en esta partida (sus atributos son del mundo).
      const vejez = anosDeVejez(npc.raza, edad);
      const actual = vejezPorNpc.get(npc.id) ?? 0;
      if (vejez !== actual) {
        await prisma.npcState.upsert({
          where: { saveId_npcId_scope: { saveId, npcId: npc.id, scope: '' } },
          create: { saveId, npcId: npc.id, scope: '', vejez },
          update: { vejez },
        });
        ajustados++;
      }
    }
    if (random() < probMuerteDeViejoPorDia(npc.raza, edad)) {
      const r = await morirDeViejo(prisma, { saveId, worldId, ahora, npcId: npc.id, random });
      if (r.aplicado) muertos.push(npc.id);
    }
  }
  return { ajustados, muertos };
}
