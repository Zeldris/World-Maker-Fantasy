// Hambruna (CR-12 paso 12c, hito 0.2 — roadmap-cronista.md § 7.1, tabla de reacciones): un reino
// con déficit de comida 3 días seguidos (`KingdomStats.diasHambre`, `hambrunaNueva`) registra
// `HAMBRUNA`; la reacción `HAMBRUNA_DIVIDE` (reacciones.ts) le baja la cohesión y puede desatar una
// `REBELION`. Vale para las facciones del mundo de la partida y para el Reino de la jugadora.
import type { Prisma } from '@prisma/client';
import { registrarSuceso } from './sucesos.js';

/// Registra la hambruna de un reino de la partida. `REINO_JUGADORA` = el Reino de la jugadora (la
/// facción de la partida sin `origenSlug`); si no lo tiene como facción, no se registra.
export async function registrarHambruna(tx: Prisma.TransactionClient, saveId: string, quien: { factionId: string } | 'REINO_JUGADORA'): Promise<string | null> {
  const faccion =
    quien === 'REINO_JUGADORA'
      ? await tx.faction.findFirst({ where: { saveId, origenSlug: null, disueltaEn: null }, select: { slug: true, name: true } })
      : await tx.faction.findFirst({ where: { id: quien.factionId, saveId, disueltaEn: null }, select: { slug: true, name: true } });
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
  if (!faccion || !ws) return null;
  return registrarSuceso(tx, {
    saveId, tipo: 'HAMBRUNA', fictionalMinutes: ws.fictionalMinutes, origen: 'MUNDO',
    actores: [{ entidadTipo: 'FACCION', entidadId: faccion.slug, papel: 'AFECTADO' }],
    datos: { reino: faccion.name },
  });
}
