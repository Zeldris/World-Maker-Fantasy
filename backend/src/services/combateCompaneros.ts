import type { PrismaClient, CondicionFisica } from '@prisma/client';

/// P445: un compañero de la jugadora en el combate, para el panel (su bando). Antes el panel solo
/// listaba a los rivales (`npcs`) y los compañeros solo salían en la iniciativa del diario.
export interface CompaneroDeCombate {
  participantId: string;
  name: string;
  condicionFisica: CondicionFisica;
}

/// Los participantes `COMPANION` de un combate, con su nombre y su condición real (`Companion`).
export async function companerosDeCombate(
  prisma: Pick<PrismaClient, 'companion'>,
  participantes: { id: string; tipo: string; companionId: string | null }[],
): Promise<CompaneroDeCombate[]> {
  const delBando = participantes.filter((p) => p.tipo === 'COMPANION' && p.companionId);
  if (delBando.length === 0) return [];
  const filas = await prisma.companion.findMany({
    where: { id: { in: delBando.map((p) => p.companionId!) } },
    select: { id: true, name: true, condicionFisica: true },
  });
  const porId = new Map(filas.map((c) => [c.id, c]));
  return delBando.flatMap((p) => {
    const c = porId.get(p.companionId!);
    return c ? [{ participantId: p.id, name: c.name, condicionFisica: c.condicionFisica }] : [];
  });
}
