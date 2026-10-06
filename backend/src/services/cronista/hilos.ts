// Buscadores de historias e hilos (CR-17, hito 0.3 — roadmap-cronista.md § 7.4 y decisión Q6 de la
// Fase 4). Patrones sobre el Libro de Sucesos que abren una historia (hilo) y la cierran en su
// desenlace: VENGANZA, ASCENSO, CAIDA, DEUDA, RIVALIDAD y REDENCION. Por dentro alimentan al narrador;
// la jugadora ve en Leyendas («Historias en marcha») las que conoce.
import type { Prisma } from '@prisma/client';
import type { Efecto } from './efectos.js';
import type { CtxReaccion, Reaccion, SucesoEnCola } from './reacciones.js';
import { registrarSuceso } from './sucesos.js';

type Tx = Prisma.TransactionClient;

export type Patron = 'VENGANZA' | 'ASCENSO' | 'CAIDA' | 'DEUDA' | 'RIVALIDAD' | 'REDENCION';
type Registrador = (s: { tipo: 'HILO_ABIERTO' | 'HILO_CERRADO'; datos: { patron: string; resumen: string }; actores: ActorHilo[] }) => Promise<string>;

export interface ActorHilo {
  entidadTipo: string;
  entidadId: string;
}

/// Pérdidas de una facción (territorio o líder) en esta ventana que hacen una caída.
export const VENTANA_CAIDA_MIN = 10 * 1440;
export const PERDIDAS_PARA_CAIDA = 2;
export const ENFRENTAMIENTOS_PARA_RIVALIDAD = 3;
export const ACTOS_PARA_REDENCION = 2;
/// Etiquetas negativas que se pueden redimir (Q4).
export const ETIQUETAS_REDIMIBLES: Record<string, string> = { CARNICERO: 'Carnicero', ROMPE_JURAMENTOS: 'Rompejuramentos' };

const conPapel = (s: SucesoEnCola, entidadTipo: string, papel: string) =>
  s.actores.filter((a) => a.entidadTipo === entidadTipo && a.papel === papel).map((a) => a.entidadId);
const delPersonaje = (s: SucesoEnCola) => s.actores.some((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'AUTOR');
const yo = (s: SucesoEnCola): ActorHilo => ({ entidadTipo: 'PERSONAJE', entidadId: s.saveId });

async function nombreNpc(tx: Tx, id: string) {
  return (await tx.npc.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'alguien';
}
async function esConNombre(tx: Tx, id: string) {
  return (await tx.npc.count({ where: { id, kind: 'PRINCIPAL' } })) > 0;
}
async function personaje(tx: Tx, saveId: string) {
  return (await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { characterName: true } })).characterName;
}
async function abierto(tx: Tx, saveId: string, clave: string) {
  return (await tx.hilo.count({ where: { saveId, clave, estado: 'ABIERTO' } })) > 0;
}
const tensionDe = async (tx: Tx, sucesoId: string, extra = 0) =>
  Math.min(10, ((await tx.suceso.findUnique({ where: { id: sucesoId }, select: { importancia: true } }))?.importancia ?? 3) + extra);

// ─────────────────────────── Efectos ───────────────────────────

/// Efecto `abrirHilo`: abre la historia (si no estaba ya abierta) con su suceso `HILO_ABIERTO`.
/// `cerrado` = la historia nace con su desenlace (redención).
export async function aplicarAbrirHilo(
  tx: Tx,
  p: { saveId: string; fictionalMinutes: number; causa: string | null; patron: Patron; clave: string; actores: ActorHilo[]; tension: number; resumen: string; cerrado?: boolean },
  registrar: Registrador,
): Promise<string | null> {
  const previo = await tx.hilo.findUnique({ where: { saveId_clave: { saveId: p.saveId, clave: p.clave } } });
  if (previo?.estado === 'ABIERTO') return null;
  const sucesoId = await registrar({ tipo: 'HILO_ABIERTO', datos: { patron: p.patron, resumen: p.resumen }, actores: p.actores });
  const datos = {
    patron: p.patron, estado: p.cerrado ? 'CERRADO' : 'ABIERTO', tension: Math.max(0, Math.min(10, p.tension)),
    actores: p.actores as unknown as Prisma.InputJsonValue, sucesoIds: [...(p.causa ? [p.causa] : []), sucesoId],
    resumen: p.resumen, abiertoEn: p.fictionalMinutes, cerradoEn: p.cerrado ? p.fictionalMinutes : null,
  };
  await tx.hilo.upsert({ where: { saveId_clave: { saveId: p.saveId, clave: p.clave } }, create: { saveId: p.saveId, clave: p.clave, ...datos }, update: datos });
  if (p.cerrado) await registrar({ tipo: 'HILO_CERRADO', datos: { patron: p.patron, resumen: p.resumen }, actores: p.actores });
  return sucesoId;
}

/// Efecto `cerrarHilo`: la historia llega a su desenlace.
export async function aplicarCerrarHilo(
  tx: Tx,
  p: { saveId: string; fictionalMinutes: number; causa: string | null; clave: string; desenlace: string },
  registrar: Registrador,
): Promise<string | null> {
  const hilo = await tx.hilo.findUnique({ where: { saveId_clave: { saveId: p.saveId, clave: p.clave } } });
  if (!hilo || hilo.estado !== 'ABIERTO') return null;
  const sucesoId = await registrar({ tipo: 'HILO_CERRADO', datos: { patron: hilo.patron, resumen: p.desenlace }, actores: hilo.actores as unknown as ActorHilo[] });
  await tx.hilo.update({
    where: { id: hilo.id },
    data: { estado: 'CERRADO', cerradoEn: p.fictionalMinutes, resumen: `${hilo.resumen} ${p.desenlace}`, sucesoIds: [...hilo.sucesoIds, ...(p.causa ? [p.causa] : []), sucesoId] },
  });
  return sucesoId;
}

// ─────────────────────────── Aperturas ───────────────────────────

/// El testigo de la facción de la víctima que la vengará (el primero), si lo hay.
async function vengadorDe(tx: Tx, s: SucesoEnCola): Promise<string | null> {
  const victima = conPapel(s, 'NPC', 'VICTIMA')[0];
  const testigos = conPapel(s, 'NPC', 'TESTIGO');
  if (!victima || testigos.length === 0) return null;
  const v = await tx.npc.findUnique({ where: { id: victima }, select: { faction: true } });
  if (!v?.faction) return null;
  return (await tx.npc.findFirst({ where: { id: { in: testigos }, faction: v.faction }, select: { id: true }, orderBy: { slug: 'asc' } }))?.id ?? null;
}

type Apertura = (ctx: CtxReaccion) => Promise<Extract<Efecto, { tipo: 'abrirHilo' }> | null>;

const APERTURAS: { patron: Patron; escucha: string[]; abre: Apertura }[] = [
  {
    patron: 'VENGANZA',
    escucha: ['MUERTE_CAUSADA'],
    abre: async ({ tx, suceso }) => {
      if (!delPersonaje(suceso)) return null;
      const vengador = await vengadorDe(tx, suceso);
      if (!vengador || (await abierto(tx, suceso.saveId, `VENGANZA:${vengador}`))) return null;
      const victima = await nombreNpc(tx, conPapel(suceso, 'NPC', 'VICTIMA')[0]!);
      return {
        tipo: 'abrirHilo', patron: 'VENGANZA', clave: `VENGANZA:${vengador}`, actores: [{ entidadTipo: 'NPC', entidadId: vengador }, yo(suceso)],
        tension: await tensionDe(tx, suceso.id, 2), resumen: `${await nombreNpc(tx, vengador)} quiere vengar a ${victima} de ${await personaje(tx, suceso.saveId)}.`,
      };
    },
  },
  {
    patron: 'ASCENSO',
    escucha: ['CAMBIO_LIDER'],
    abre: async ({ tx, suceso }) => {
      const npc = conPapel(suceso, 'NPC', 'BENEFICIARIO')[0];
      const faccion = conPapel(suceso, 'FACCION', 'AFECTADO')[0];
      if (!npc || (await abierto(tx, suceso.saveId, `ASCENSO:${npc}`))) return null;
      const f = faccion ? await tx.faction.findFirst({ where: { saveId: suceso.saveId, slug: faccion }, select: { name: true } }) : null;
      return {
        tipo: 'abrirHilo', patron: 'ASCENSO', clave: `ASCENSO:${npc}`, actores: [{ entidadTipo: 'NPC', entidadId: npc }, ...(faccion ? [{ entidadTipo: 'FACCION', entidadId: faccion }] : [])],
        tension: await tensionDe(tx, suceso.id), resumen: `${await nombreNpc(tx, npc)} llega a mandar${f ? ` en ${f.name}` : ''}.`,
      };
    },
  },
  {
    patron: 'CAIDA',
    escucha: ['TERRITORIO_PERDIDO', 'MUERTE_LIDER'],
    abre: async ({ tx, suceso }) => {
      const faccion = conPapel(suceso, 'FACCION', 'VICTIMA')[0] ?? conPapel(suceso, 'FACCION', 'AFECTADO')[0];
      if (!faccion || (await abierto(tx, suceso.saveId, `CAIDA:${faccion}`))) return null;
      const perdidas = await tx.suceso.count({
        where: {
          saveId: suceso.saveId, tipo: { in: ['TERRITORIO_PERDIDO', 'MUERTE_LIDER'] }, fictionalMinutes: { gte: suceso.fictionalMinutes - VENTANA_CAIDA_MIN },
          actores: { some: { entidadTipo: 'FACCION', entidadId: faccion, papel: { in: ['VICTIMA', 'AFECTADO'] } } },
        },
      });
      if (perdidas < PERDIDAS_PARA_CAIDA) return null;
      const f = await tx.faction.findFirst({ where: { saveId: suceso.saveId, slug: faccion }, select: { name: true } });
      return {
        tipo: 'abrirHilo', patron: 'CAIDA', clave: `CAIDA:${faccion}`, actores: [{ entidadTipo: 'FACCION', entidadId: faccion }],
        tension: 7, resumen: `${f?.name ?? 'Una facción'} se tambalea: pierde demasiado y demasiado deprisa.`,
      };
    },
  },
  {
    patron: 'DEUDA',
    escucha: ['PERDON_CONCEDIDO', 'REGALO', 'AYUDA_PRESTADA'],
    abre: async ({ tx, suceso }) => {
      const npc = conPapel(suceso, 'NPC', 'BENEFICIARIO')[0];
      if (!delPersonaje(suceso) || !npc || !(await esConNombre(tx, npc)) || (await abierto(tx, suceso.saveId, `DEUDA:${npc}`))) return null;
      return {
        tipo: 'abrirHilo', patron: 'DEUDA', clave: `DEUDA:${npc}`, actores: [{ entidadTipo: 'NPC', entidadId: npc }, yo(suceso)],
        tension: await tensionDe(tx, suceso.id), resumen: `${await nombreNpc(tx, npc)} le debe algo a ${await personaje(tx, suceso.saveId)}.`,
      };
    },
  },
  {
    patron: 'RIVALIDAD',
    escucha: ['COMBATE_GANADO', 'COMBATE_PERDIDO', 'HUIDA_DE_NPC'],
    abre: async ({ tx, suceso }) => {
      const npc = conPapel(suceso, 'NPC', 'VICTIMA')[0] ?? conPapel(suceso, 'NPC', 'AUTOR')[0] ?? conPapel(suceso, 'NPC', 'AFECTADO')[0];
      if (!npc || !(await esConNombre(tx, npc)) || (await abierto(tx, suceso.saveId, `RIVALIDAD:${npc}`))) return null;
      const veces = await tx.suceso.count({
        where: { saveId: suceso.saveId, tipo: { in: ['COMBATE_GANADO', 'COMBATE_PERDIDO', 'HUIDA_DE_NPC'] }, actores: { some: { entidadTipo: 'NPC', entidadId: npc } } },
      });
      if (veces < ENFRENTAMIENTOS_PARA_RIVALIDAD) return null;
      return {
        tipo: 'abrirHilo', patron: 'RIVALIDAD', clave: `RIVALIDAD:${npc}`, actores: [{ entidadTipo: 'NPC', entidadId: npc }, yo(suceso)],
        tension: 6, resumen: `${await nombreNpc(tx, npc)} y ${await personaje(tx, suceso.saveId)} ya se han visto las caras demasiadas veces.`,
      };
    },
  },
];

const BUENOS_ACTOS = ['PERDON_CONCEDIDO', 'AYUDA_PRESTADA', 'REGALO', 'PROMESA_CUMPLIDA'];

/// REDENCION: con una etiqueta negativa activa, dos buenos actos después la apagan.
async function redencion(ctx: CtxReaccion): Promise<Efecto[]> {
  const { tx, suceso } = ctx;
  if (!delPersonaje(suceso)) return [];
  const negativas = await tx.etiqueta.findMany({
    where: { saveId: suceso.saveId, entidadTipo: 'PERSONAJE', activa: true, clave: { in: Object.keys(ETIQUETAS_REDIMIBLES) } },
    select: { clave: true, desdeMinutes: true },
  });
  const efectos: Efecto[] = [];
  for (const e of negativas) {
    const actos = await tx.suceso.count({
      where: { saveId: suceso.saveId, tipo: { in: BUENOS_ACTOS }, fictionalMinutes: { gte: e.desdeMinutes }, actores: { some: { entidadTipo: 'PERSONAJE', papel: 'AUTOR' } } },
    });
    if (actos < ACTOS_PARA_REDENCION) continue;
    const nombre = await personaje(tx, suceso.saveId);
    efectos.push(
      { tipo: 'quitarEtiqueta', clave: e.clave },
      {
        tipo: 'abrirHilo', patron: 'REDENCION', clave: `REDENCION:${e.clave}:${suceso.fictionalMinutes}`, actores: [yo(suceso)], tension: 5, cerrado: true,
        resumen: `${nombre} deja atrás lo que le hizo «${ETIQUETAS_REDIMIBLES[e.clave]}».`,
      },
    );
  }
  return efectos;
}

// ─────────────────────────── Cierres ───────────────────────────

/// Puro: si este suceso cierra el hilo, el desenlace; si no, null.
export function desenlace(hilo: { patron: string; actores: ActorHilo[] }, s: Pick<SucesoEnCola, 'tipo' | 'actores'>): string | null {
  const npc = hilo.actores.find((a) => a.entidadTipo === 'NPC')?.entidadId;
  const faccion = hilo.actores.find((a) => a.entidadTipo === 'FACCION')?.entidadId;
  const tiene = (tipo: string, id: string | undefined, papeles?: string[]) =>
    !!id && s.actores.some((a) => a.entidadTipo === tipo && a.entidadId === id && (!papeles || papeles.includes(a.papel)));
  const muere = ['MUERTE_CAUSADA', 'MUERTE_NPC'].includes(s.tipo) && tiene('NPC', npc, ['VICTIMA']);
  switch (hilo.patron) {
    case 'VENGANZA':
      if (muere) return 'El vengador ha muerto.';
      if (['COMBATE_GANADO', 'COMBATE_PERDIDO', 'HUIDA_DE_NPC'].includes(s.tipo) && tiene('NPC', npc)) return 'Por fin se han visto las caras.';
      return null;
    case 'ASCENSO':
      if (muere) return 'Su mando acaba con su muerte.';
      if (s.tipo === 'CAMBIO_LIDER' && tiene('FACCION', faccion) && !tiene('NPC', npc, ['BENEFICIARIO'])) return 'Otro ocupa su lugar.';
      return null;
    case 'CAIDA':
      return ['FACCION_CAE', 'FACCION_ABSORBIDA'].includes(s.tipo) && tiene('FACCION', faccion) ? 'Y cae.' : null;
    case 'DEUDA':
      if (muere) return 'Muere sin saldarla.';
      return ['REGALO', 'AYUDA_PRESTADA'].includes(s.tipo) && tiene('NPC', npc, ['AUTOR']) && s.actores.some((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'BENEFICIARIO')
        ? 'La deuda queda saldada.'
        : null;
    case 'RIVALIDAD':
      return muere ? 'La rivalidad acaba con una muerte.' : null;
    default:
      return null;
  }
}

const TIPOS_DE_CIERRE = ['MUERTE_CAUSADA', 'MUERTE_NPC', 'COMBATE_GANADO', 'COMBATE_PERDIDO', 'HUIDA_DE_NPC', 'CAMBIO_LIDER', 'FACCION_CAE', 'FACCION_ABSORBIDA', 'REGALO', 'AYUDA_PRESTADA'];

async function cierres(ctx: CtxReaccion): Promise<Efecto[]> {
  const hilos = await ctx.tx.hilo.findMany({ where: { saveId: ctx.suceso.saveId, estado: 'ABIERTO' }, select: { clave: true, patron: true, actores: true, sucesoIds: true } });
  return hilos
    .filter((h) => !h.sucesoIds.includes(ctx.suceso.id))
    .map((h) => ({ clave: h.clave, d: desenlace({ patron: h.patron, actores: h.actores as unknown as ActorHilo[] }, ctx.suceso) }))
    .filter((x): x is { clave: string; d: string } => !!x.d)
    .map((x): Efecto => ({ tipo: 'cerrarHilo', clave: x.clave, desenlace: x.d }));
}

export const REACCIONES_HILOS: Reaccion[] = [
  // Primero los cierres: el suceso que abre una venganza no la cierra.
  {
    id: 'HILOS_CIERRAN',
    escucha: TIPOS_DE_CIERRE as Reaccion['escucha'],
    prioridad: 70,
    condicion: async (ctx) => (await cierres(ctx)).length > 0,
    efectos: cierres,
  },
  {
    id: 'HILOS_ABREN',
    escucha: [...new Set(APERTURAS.flatMap((a) => a.escucha))] as Reaccion['escucha'],
    prioridad: 75,
    condicion: async () => true,
    efectos: async (ctx) => {
      const out: Efecto[] = [];
      for (const a of APERTURAS) {
        if (!a.escucha.includes(ctx.suceso.tipo)) continue;
        const e = await a.abre(ctx);
        if (e) out.push(e);
      }
      return out;
    },
  },
  {
    id: 'HILO_REDENCION',
    escucha: BUENOS_ACTOS as Reaccion['escucha'],
    prioridad: 80,
    condicion: async () => true,
    efectos: redencion,
  },
];

/// Para `efectos.ts`: registra los sucesos de hilo con el contexto del efecto.
/// Los actores del hilo van como AFECTADO (el personaje no es testigo de toda historia: la conoce si
/// conoce su causa).
export function registradorDeHilo(tx: Tx, base: { saveId: string; fictionalMinutes: number; causas?: string[]; nivelCascada?: number }): Registrador {
  return (s) =>
    registrarSuceso(tx, {
      saveId: base.saveId, tipo: s.tipo, fictionalMinutes: base.fictionalMinutes, origen: 'MOTOR', causas: base.causas, nivelCascada: base.nivelCascada,
      actores: s.actores.filter((a) => a.entidadTipo !== 'PERSONAJE').map((a) => ({ entidadTipo: a.entidadTipo as 'NPC', entidadId: a.entidadId, papel: 'AFECTADO' as const })),
      datos: s.datos,
    });
}
