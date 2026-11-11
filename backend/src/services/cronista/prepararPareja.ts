// P433 (2026-11-11): `subditos:<pueblo>:<n>:sexo=pareja` de `prepararReino.ts` deja a los súbditos emparejados. El juego
// enlaza una pareja con `parejaId` en los dos sentidos y `crias: 0` (`familias.ts#revisarFamilias`); esto hace lo mismo
// sin esperar a la revisión semanal ni a su tirada de probabilidad.
import type { Prisma } from '@prisma/client';

export async function formarPareja(tx: Prisma.TransactionClient, aId: string, bId: string): Promise<void> {
  await tx.subject.update({ where: { id: aId }, data: { parejaId: bId, crias: 0 } });
  await tx.subject.update({ where: { id: bId }, data: { parejaId: aId, crias: 0 } });
}

/// Empareja de dos en dos en el orden dado (macho, hembra, macho, hembra…); un último sin compañero queda libre. Devuelve cuántas parejas.
export async function emparejarDeADos(tx: Prisma.TransactionClient, ids: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i + 1 < ids.length; i += 2) {
    await formarPareja(tx, ids[i]!, ids[i + 1]!);
    n++;
  }
  return n;
}
