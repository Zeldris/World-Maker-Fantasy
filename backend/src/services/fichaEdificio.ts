// P178 (QA-27, decidido por la usuaria 2026-10-17): la ficha de un edificio de una facción y quién
// te atiende en él. Contrastado con los juegos de referencia (X4 marca el camino): la cabecera con el
// dueño y tu relación con él, y el estado (la ficha de estación de X4, con su integridad; el estado y
// las reparaciones de Manor Lords); quién lo lleva (el gerente de X4, el dueño de cada puesto de
// Medieval Dynasty, los trabajadores asignados de Manor Lords y Bellwright); qué ofrece (lo que compra
// y vende una estación de X4, el comerciante del puesto en BG3). El almacén y la producción esperan al
// comercio en persona (`CR-51`), como «Comerciar».
import type { Prisma, PrismaClient } from '@prisma/client';
import { nombreVisibleDeNpc } from './dynamicMode.js';
import { normalizeText } from './travel.js';
import { npcSinCaerEnPartida } from './mundoPartida.js';
import { opcionesDeMenu } from './menuDeNpc.js';
import { OPCION_TRABAJO } from './npcInteraction.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface OfertaDeEdificio {
  label: string;
  disponible: boolean;
  motivo?: string;
}

export interface FichaEdificio {
  zonePointId: string;
  nombre: string;
  descripcion: string | null;
  nivel: number | null;
  faccion: string | null;
  /// «En pie», «Dañado», «En construcción», «Abandonado» o «Caído».
  estado: string;
  /// Lo que pesa sobre su estado: asaltos perdidos, equipos de milicia, guarnición.
  detallesEstado: string[];
  /// Quien lo lleva, con el nombre con que lo conoce la jugadora; `aqui`: si ahora está en la zona.
  encargado: { slug: string; nombre: string; aqui: boolean } | null;
  ofrece: OfertaDeEdificio[];
}

const ESTADO: Record<string, string> = { ACTIVO: 'En pie', DANADO: 'Dañado', EN_CONSTRUCCION: 'En construcción', ABANDONADO: 'Abandonado' };
export const COMERCIAR_PENDIENTE = 'Llega con el comercio en persona';

/// El edificio de un punto EDIFICIO del mapa (su `targetSlug` es el `recipeKey` del edificio): primero la
/// copia de la partida, si no la del catálogo.
export async function edificioDelPunto(db: Db, saveId: string, zonePointId: string) {
  const punto = await db.zonePoint.findFirst({ where: { id: zonePointId, saveId, tipo: 'EDIFICIO' }, select: { id: true, x: true, y: true, locationId: true, targetSlug: true, label: true } });
  if (!punto) return null;
  const edificio =
    (await db.building.findFirst({ where: { recipeKey: punto.targetSlug, faction: { saveId } }, include: { faction: { select: { name: true, liderNpcId: true } }, _count: { select: { guarnicion: true } } } })) ??
    (await db.building.findFirst({ where: { recipeKey: punto.targetSlug, faction: { saveId: null } }, include: { faction: { select: { name: true, liderNpcId: true } }, _count: { select: { guarnicion: true } } } }));
  return { punto, edificio };
}

type EdificioConFaccion = NonNullable<Awaited<ReturnType<typeof edificioDelPunto>>>['edificio'];

/// Quién lleva un edificio: el maestro de su oficio en su facción (`Npc.teachesProfession` = `Building.kind`),
/// o, en su salón (`sede`), el líder de la facción. Vivo en la partida; si hay varios, el que está en este
/// lugar. `aqui`: si ahora tiene su punto en el lugar del edificio. Lo usan la ficha y «Interactuar».
export async function encargadoDe(db: Db, saveId: string, worldId: string, edificio: NonNullable<EdificioConFaccion>, locationId: string) {
  const faccion = edificio.faction?.name;
  if (!faccion) return null;
  const candidatos =
    edificio.kind === 'sede'
      ? edificio.faction?.liderNpcId
        ? await db.npc.findMany({ where: { id: edificio.faction.liderNpcId, ...npcSinCaerEnPartida(saveId) } })
        : []
      : await db.npc.findMany({ where: { worldId, faction: faccion, teachesProfession: edificio.kind, ...npcSinCaerEnPartida(saveId) }, orderBy: { slug: 'asc' } });
  if (candidatos.length === 0) return null;
  const presentes = new Set(
    (await db.zonePoint.findMany({ where: { saveId, locationId, tipo: 'NPC', activo: true, targetSlug: { in: candidatos.map((n) => n.slug) } }, select: { targetSlug: true } })).map((p) => p.targetSlug),
  );
  const npc = candidatos.find((n) => presentes.has(n.slug)) ?? candidatos[0]!;
  return { npc, aqui: presentes.has(npc.slug) };
}

export async function fichaDeEdificio(db: Db, saveId: string, zonePointId: string): Promise<FichaEdificio | null> {
  const encontrado = await edificioDelPunto(db, saveId, zonePointId);
  if (!encontrado) return null;
  const { punto, edificio } = encontrado;
  const save = await db.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const nombre = edificio?.name ?? punto.label ?? punto.targetSlug;
  if (!edificio) {
    return { zonePointId, nombre, descripcion: null, nivel: null, faccion: null, estado: 'En pie', detallesEstado: [], encargado: null, ofrece: [] };
  }
  const detallesEstado: string[] = [];
  if (edificio.golpesDefensa > 0) detallesEstado.push(`${edificio.golpesDefensa} ${edificio.golpesDefensa === 1 ? 'asalto perdido' : 'asaltos perdidos'}`);
  if (edificio.equiposMilicia > 0) detallesEstado.push(`${edificio.equiposMilicia} ${edificio.equiposMilicia === 1 ? 'equipo' : 'equipos'} de milicia`);
  if (edificio._count.guarnicion > 0) detallesEstado.push(`guarnición de ${edificio._count.guarnicion}`);

  const llevado = await encargadoDe(db, saveId, save.worldId, edificio, punto.locationId);
  let encargado: FichaEdificio['encargado'] = null;
  const ofrece: OfertaDeEdificio[] = [];
  if (llevado) {
    const { npc, aqui } = llevado;
    // P195 (QA-27): si la descripción del edificio ya lo nombra entero («sede de la Terk'ikar Ulkha Ketg»),
    // leerla lo deja citado en la Enciclopedia: la ficha, el mapa y su menú lo llaman ya por su nombre.
    if (edificio.description && normalizeText(edificio.description).includes(normalizeText(npc.name))) {
      await db.discoveredEntity.createMany({ data: [{ saveId, entityType: 'npc', entitySlug: npc.slug }], skipDuplicates: true });
    }
    const { nombre: visible } = await nombreVisibleDeNpc(db, saveId, npc);
    encargado = { slug: npc.slug, nombre: visible, aqui };
    // Lo mismo que daría su menú ahora (oficio, encargos según tu reputación…).
    const opciones = aqui ? await opcionesDeMenu(db, saveId, npc.slug) : [];
    const oferta = (label: string, opcion: string, tiene: boolean) => {
      if (!tiene) return;
      const disponible = opciones.includes(opcion);
      ofrece.push({ label, disponible, ...(disponible ? {} : { motivo: aqui ? 'Ahora no te lo ofrece' : 'Quien lo lleva no está ahora' }) });
    };
    oferta('Aprender su oficio', 'Aprender oficio', !!npc.teachesProfession);
    oferta('Encargos', OPCION_TRABAJO, true);
  }
  if (edificio.kind !== 'sede') ofrece.push({ label: 'Comerciar', disponible: false, motivo: COMERCIAR_PENDIENTE });

  return {
    zonePointId,
    nombre,
    descripcion: edificio.description || null,
    nivel: edificio.tier ?? null,
    faccion: edificio.faction?.name ?? null,
    estado: edificio.caida ? 'Caído' : (ESTADO[edificio.status] ?? 'En pie'),
    detallesEstado,
    encargado,
    ofrece,
  };
}
