// Compañeros que cuentan lo de su tierra (CR-42, hito 0.3 — decisión Q7 de la Fase 4): «¿Qué se sabe
// en tu tierra?». Un compañero con mente cuenta lo que se sabe en su región y en su facción de origen,
// con el mismo alcance que «¿Qué se cuenta?» de los NPC (CR-18), una vez al día y solo si te aprecia
// lo bastante (aprobación ≥ 40).
import type { PrismaClient } from '@prisma/client';
import { REGION_OWNING_FACTIONS } from '../reputation.js';
import { contarNoticias } from './difusion.js';

export const APROBACION_PARA_CONTAR = 40;

export type RespuestaTierra = { frase: string; contadas: number } | { error: string };

export async function preguntarCompanero(prisma: PrismaClient, saveId: string, companionId: string): Promise<RespuestaTierra> {
  return prisma.$transaction(async (tx) => {
    const c = await tx.companion.findFirst({ where: { id: companionId, saveId }, select: { name: true, tipo: true, aprobacion: true, sourceSlug: true, condicionFisica: true, save: { select: { worldId: true } } } });
    if (!c) return { error: 'Compañero no encontrado' };
    if (c.tipo !== 'NPC' || c.condicionFisica === 'MUERTO') return { error: `${c.name} no tiene nada que contarte.` };
    if (c.aprobacion < APROBACION_PARA_CONTAR) return { frase: `${c.name} se encoge de hombros: no tiene ganas de hablar contigo.`, contadas: 0 };
    const npc = c.sourceSlug ? await tx.npc.findFirst({ where: { worldId: c.save.worldId, slug: c.sourceSlug }, select: { faction: true } }) : null;
    const faccion = npc?.faction ?? null;
    const region = faccion ? (Object.entries(REGION_OWNING_FACTIONS).find(([, fs]) => fs.includes(faccion))?.[0] ?? null) : null;
    if (!region && !faccion) return { frase: `${c.name}: «De donde vengo no llegan noticias.»`, contadas: 0 };
    return contarNoticias(tx, {
      saveId, nombre: c.name, fuente: `companero:${companionId}`, quien: { region, faccion },
      sinNada: `${c.name}: «Hace tiempo que no sé nada de los míos.»`,
    });
  }, { maxWait: 10_000, timeout: 20_000 });
}
