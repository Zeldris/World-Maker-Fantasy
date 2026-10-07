// Partidas de captura (CR-63 paso 63c, hito 0.3 — decisión Q6 de la ronda de detalle). Como una
// partida de caza (`partidasCaza.ts`), pero lleva cuerdas del Almacén: los animales que abate vivos se
// intentan atar (probabilidad de la especie, `capturablePct`, con tope) y vuelven atados a una Jaula
// libre de su tamaño, donde se doman como los que ata la jugadora. Los que no ata son piezas.
import type { Prisma } from '@prisma/client';
import { jaulasLibresPara } from './companionSupervivencia.js';
import { avisoDelReino, cazarEnDestino, descargarCaza, type CargaCaza } from './partidasCaza.js';
import { TRABAJOS, type ViajeroFila } from './viajeros.js';

type Tx = Prisma.TransactionClient;

export const SLUG_CUERDAS = 'cuerdas';

/// Q6: antes de salir. Hace falta una Jaula libre del tamaño del animal y cuerdas en el Almacén; se
/// lleva una cuerda por Jaula libre (como mucho `cuantos`). Devuelve las cuerdas que lleva.
export async function prepararCaptura(tx: Tx, saveId: string, especie: string, cuantos = 1): Promise<{ ok: true; cuerdas: number } | { ok: false; motivo: string }> {
  const jaulas = await jaulasLibresPara(tx, saveId, especie);
  if (jaulas.length === 0) return { ok: false, motivo: 'Necesitas una Jaula libre de su tamaño para traerlo vivo.' };
  const filas = await tx.almacenItem.findMany({ where: { saveId, catalogSlug: SLUG_CUERDAS }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: Math.min(cuantos, jaulas.length) });
  if (filas.length === 0) return { ok: false, motivo: 'No hay cuerdas en el Almacén.' };
  await tx.almacenItem.deleteMany({ where: { id: { in: filas.map((f) => f.id) } } });
  return { ok: true, cuerdas: filas.length };
}

/// Q6: al volver, cada animal atado entra en una Jaula libre (si se llenó mientras tanto, se suelta) y
/// las cuerdas que no usó vuelven al Almacén.
export async function descargarCaptura(tx: Tx, v: ViajeroFila, dia: number): Promise<{ enJaula: number; sueltos: number }> {
  const carga = v.carga as unknown as CargaCaza | null;
  await descargarCaza(tx, v, dia);
  if (!carga || v.factionId) return { enJaula: 0, sueltos: 0 };
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const npc = await tx.npc.findFirst({ where: { worldId, saveId: null, slug: carga.especie }, select: { id: true, name: true } });
  let enJaula = 0;
  let sueltos = 0;
  for (let i = 0; i < (carga.capturados ?? 0) && npc; i++) {
    const [jaula] = await jaulasLibresPara(tx, v.saveId, carga.especie);
    if (!jaula) {
      sueltos++;
      continue;
    }
    await tx.npcState.create({ data: { saveId: v.saveId, npcId: npc.id, scope: `partida-${v.id}-${i}`, condicionFisica: 'GRAVE', capturado: true, capturaFelicidad: 0, capturaJaulaBuildingId: jaula.id } });
    enJaula++;
  }
  const sobran = carga.cuerdas ?? 0;
  if (sobran > 0) {
    const cuerda = await tx.itemCatalog.findFirst({ where: { worldId, slug: SLUG_CUERDAS }, select: { name: true, description: true } });
    await tx.almacenItem.createMany({ data: Array.from({ length: sobran }, () => ({ saveId: v.saveId, name: cuerda?.name ?? 'Cuerdas', description: cuerda?.description ?? '', catalogSlug: SLUG_CUERDAS })) });
  }
  const nombre = npc?.name ?? carga.especie;
  if (enJaula > 0) await avisoDelReino(tx, v.saveId, `La partida de captura deja ${enJaula} ${nombre} atado${enJaula === 1 ? '' : 's'} en la Jaula: ya se puede domar.`);
  if (sueltos > 0) await avisoDelReino(tx, v.saveId, `No queda Jaula libre: la partida suelta ${sueltos} ${nombre}.`);
  return { enJaula, sueltos };
}

TRABAJOS.CAPTURA = {
  alLlegar: async (tx, v, dia, random) => {
    const llevadas = (v.carga as unknown as { cuerdas?: number } | null)?.cuerdas ?? 0;
    const carga = await cazarEnDestino(tx, v, dia, random, llevadas);
    await tx.viajero.update({ where: { id: v.id }, data: { carga: { ...carga, cuerdas: carga.cuerdas ?? llevadas, capturados: carga.capturados ?? 0 } as unknown as Prisma.InputJsonValue } });
    if (!v.factionId) await avisoDelReino(tx, v.saveId, carga.resumen);
  },
  alVolver: async (tx, v, dia) => {
    await descargarCaptura(tx, v, dia);
  },
  // Q7: cada salida se lleva sus cuerdas y necesita Jaula libre.
  antesDeRepetir: async (tx, v) => {
    const prep = await prepararCaptura(tx, v.saveId, v.objetivo ?? '');
    return prep.ok ? { ok: true, carga: { cuerdas: prep.cuerdas } } : { ok: false, motivo: prep.motivo.replace(/\.$/, '').toLowerCase() };
  },
};
