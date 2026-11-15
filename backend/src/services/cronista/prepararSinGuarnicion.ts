// P427 (2026-11-11): paso `sin-guarnicion` de `prepararReino.ts`. Para que un asalto tomara Maktor hubo que poner los
// súbditos a SE_FUE y los edificios `caida` por SQL (un `asentamientoId` nulo sigue contando como guarnición de la Capital).
// Aquí se deja el Reino sin quien lo defienda sin borrar a nadie: cada soldado y vigía activo pasa a trabajador con la misma
// función que el cambio de rol del panel (`cambiarRolSubdito`), la milicia armada se licencia (`licenciarMilicia`, el fin
// de la alarma) y las Armerías se quedan sin equipos de milicia, para que la vigilancia no la arme sola con la jugadora
// fuera (`planMilicia`). Los guardias de fauna de los corrales (`guardiasDeRegion`) no se tocan: se cuentan y se avisa.
import type { PrismaClient } from '@prisma/client';
import { cambiarRolSubdito } from './subditos.js';
import { asentamientosDelReino, esGuarnicion, guardiasDeRegion, licenciarMilicia } from '../defensaReino.js';

export type ResultadoSinGuarnicion = { aTrabajador: string[]; licenciados: number; equiposQuitados: number; guardias: number };

export async function dejarSinGuarnicion(prisma: PrismaClient, { saveId }: { saveId: string }): Promise<ResultadoSinGuarnicion | { error: string }> {
  const save = await prisma.save.findUnique({ where: { id: saveId }, select: { endedAt: true, worldId: true, worldState: { select: { fictionalMinutes: true } } } });
  if (!save) return { error: `sin-guarnicion: no hay partida ${saveId}.` };
  if (save.endedAt) return { error: 'sin-guarnicion: la partida ha terminado.' };
  const ahora = save.worldState?.fictionalMinutes ?? 0;
  return prisma.$transaction(async (tx) => {
    const asentamientos = await asentamientosDelReino(tx, saveId);
    if (asentamientos.length === 0) return { error: 'sin-guarnicion: el Reino no tiene Ayuntamiento activo.' };
    const armados = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true }, orderBy: { createdAt: 'asc' } });
    const aTrabajador: string[] = [];
    for (const s of armados.filter((x) => esGuarnicion(x.role))) {
      const r = await cambiarRolSubdito(tx, saveId, s.id, 'trabajador', ahora);
      if (!r.ok) throw new Error(`sin-guarnicion: ${s.name} no deja la guarnición (${r.motivo})`);
      aTrabajador.push(s.name);
    }
    const licenciados = await licenciarMilicia(tx, saveId, ahora);
    const { count: equiposQuitados } = await tx.building.updateMany({ where: { saveId, recipeKey: 'armeria', equiposMilicia: { gt: 0 } }, data: { equiposMilicia: 0 } });
    let guardias = 0;
    for (const region of new Set(asentamientos.map((a) => a.region))) guardias += (await guardiasDeRegion(tx, saveId, save.worldId, region, ahora)).length;
    return { aTrabajador, licenciados, equiposQuitados, guardias };
  });
}
