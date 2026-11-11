// P443 (para verlo jugando): el paso `huida-rival[:<npc>]` de `prepararReino.ts`. En las tandas 110-112 el rival nunca huyó y la línea
// de huida (que tiene que llevar el nombre que ve la jugadora, «orco desconocido», no el real) no se pudo ver. El juego hace tirar
// la moral al bando enemigo cuando alguien cae a GRAVE por primera vez (`revisarMoralDelCombate`, moralGrupo.ts): este paso deja a un
// rival con moral del combate en curso GRAVE con la escritura de un golpe recibido (`dejarHeridoEnCombate`) y sin tirada de moral
// hecha, para que la ronda siguiente la tire. Las reglas son las del juego (QA-151): la moral y el escape siguen siendo tiradas, así
// que el rival puede aguantar; entonces se repite con un rival nuevo (`huida-rival:<otro>`) o se vuelve a preparar el escenario.
import type { PrismaClient } from '@prisma/client';
import { nombresVisiblesDeNpcs } from '../dynamicMode.js';
import { tieneMoral } from '../moralCombate.js';
import { dejarHeridoEnCombate } from './prepararHerido.js';

/// `nombreVisible`: cómo lo ve la jugadora (y cómo tiene que salir en la línea de huida).
export type ResultadoHuidaRival = { nombre: string; slug: string; nombreVisible: string; rivalesEnPie: number };

export async function dejarRivalAPuntoDeHuir(
  prisma: PrismaClient,
  { saveId, npcSlug }: { saveId: string; npcSlug: string | null },
): Promise<ResultadoHuidaRival | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { endedAt: true } });
  if (!save) return { error: `huida-rival: no hay partida ${saveId}.` };
  if (save.endedAt) return { error: 'huida-rival: la partida ha terminado.' };
  const encuentro = await prisma.combatEncounter.findFirst({ where: { saveId, estado: 'EN_CURSO' }, include: { participantes: true } });
  if (!encuentro) return { error: 'huida-rival: no hay combate en curso (abre uno antes, p. ej. con combate:<npc>,…).' };
  const rivales = encuentro.participantes.filter((p) => p.bando === 'ENEMIGO' && p.tipo === 'NPC' && p.npcId && !p.huido);
  const npcs = await prisma.npc.findMany({
    where: { id: { in: rivales.map((p) => p.npcId!) } },
    select: { id: true, slug: true, name: true, kind: true, raza: true, genero: true, faunaCategoria: true },
  });
  const conMoral = rivales.flatMap((p) => {
    const npc = npcs.find((n) => n.id === p.npcId);
    return npc && tieneMoral({ raza: npc.raza, faunaCategoria: npc.faunaCategoria }) ? [{ p, npc }] : [];
  });
  const elegido = npcSlug ? conMoral.find((c) => c.npc.slug === npcSlug) : conMoral.find((c) => c.p.condicionFisicaGrupo !== 'CONVALECIENTE' && c.p.condicionFisicaGrupo !== 'MUERTO');
  if (!elegido) {
    return { error: npcSlug ? `huida-rival: ${npcSlug} no es un rival del combate en curso con moral (una persona, no fauna) que siga en él.` : 'huida-rival: ningún rival del combate en curso tiene moral (solo huyen las personas, no la fauna).' };
  }
  // Sin tirada de moral hecha: caer a GRAVE es lo que la dispara (moralGrupo.ts).
  await prisma.combatParticipant.update({ where: { id: elegido.p.id }, data: { moralTirada: false } });
  const r = await dejarHeridoEnCombate(prisma, { saveId, npcSlug: elegido.npc.slug, condicion: 'GRAVE' });
  if ('error' in r) return { error: r.error.replace(/^herido:/, 'huida-rival:') };
  const visibles = await nombresVisiblesDeNpcs(prisma, saveId, [elegido.npc]);
  return { nombre: elegido.npc.name, slug: elegido.npc.slug, nombreVisible: visibles.get(elegido.npc.slug) ?? elegido.npc.name, rivalesEnPie: conMoral.length };
}
