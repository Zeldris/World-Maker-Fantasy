import type { Prisma, PrismaClient } from '@prisma/client';

/// P164 (QA-27, decidido por la usuaria 2026-10-17): ir directo a otra zona sin pasar una a una por las de
/// en medio (la lista de «Viajar») es cosa de una montura. Las monturas llegan con `CR-57` (hito `0.4`);
/// hasta entonces nadie lleva una y a pie se va de zona en zona por las salidas del mapa de zona.
export async function tieneMontura(_db: PrismaClient | Prisma.TransactionClient, _saveId: string): Promise<boolean> {
  return false;
}

export const SIN_MONTURA = 'Necesitas una montura para ir directo; a pie, por los caminos del mapa de zona';
