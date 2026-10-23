import type { Prisma, PrismaClient } from '@prisma/client';

/// P164 (QA-27, decidido por la usuaria 2026-10-17): ir directo a otra zona sin pasar una a una por las de
/// en medio (la lista de «Viajar») es cosa de una montura. Las monturas llegan con `CR-57` (hito `0.4`);
/// hasta entonces nadie lleva una y a pie se va de zona en zona por las salidas del mapa de zona.
/// Solo para rondas de pruebas: con `WMF_MONTURA_PRUEBAS=1` (y fuera de producción) cuenta como si la jugadora
/// llevara montura, para probar la lista «Viajar» y las interrupciones de viaje (P46, P47, P321) antes de CR-57.
export function monturaDePruebas(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WMF_MONTURA_PRUEBAS === '1' && env.NODE_ENV !== 'production';
}

export async function tieneMontura(_db: PrismaClient | Prisma.TransactionClient, _saveId: string): Promise<boolean> {
  return monturaDePruebas();
}

export const SIN_MONTURA = 'Necesitas una montura para ir directo; a pie, por los caminos del mapa de zona';
