// Linajes y rastros (CR-52, hito 0.3 — decisiones Q8-Q14 de la Fase C; idea de la usuaria del
// 2026-10-06). Cada familia es un linaje que el motor sigue por generaciones: actor del Libro, hereda
// venganzas y recuerdos fuertes. Los Faerus no tienen apellido: tienen **rastro**, una pequeña manada
// dentro de la gran manada que los suyos reconocen por los sentidos («Tasko, del rastro Veyra»).
//
// Herencia (propuesta de lore para Álvaro): orcos, el apellido del progenitor de más rango (a igualdad,
// la madre, como el linaje Maktor); Goirntes, el del padre (con su casta); Nabieus, el de la madre;
// Faerus, el rastro de la madre. Un rastro de más de 12 puede escindirse con una pareja nueva.
//
// Los NPC del catálogo solo tienen linaje si su apellido está en el canon (Ketg, Koh, Kiugh, Marn…);
// a los demás no se les inventa ninguno: lo fundarán sus hijos.
import type { Prisma } from '@prisma/client';
import { generarApellido, generarRastro } from './nombres.js';
import { esAdulto, edadEnAnios, nacidoEnDe } from './edades.js';
import type { Reaccion } from './reacciones.js';

type Tx = Prisma.TransactionClient;

export const TAMANO_PARA_ESCINDIR_RASTRO = 12;
const PUEBLOS_CON_APELLIDO = new Set(['orcos', 'goirntes', 'nabieus']);

export type TipoLinaje = 'APELLIDO' | 'RASTRO';
export const tipoDeLinaje = (pueblo: string): TipoLinaje => (pueblo === 'faerus' ? 'RASTRO' : 'APELLIDO');

/// Puro: el apellido de un nombre del catálogo, o null. Solo cuenta la última palabra si es un nombre
/// propio que no es su facción («Maestro Herrero Serhu» es un rol, no un apellido).
export function apellidoDe(nombre: string, pueblo: string | null, faccion: string | null): string | null {
  if (!pueblo || !PUEBLOS_CON_APELLIDO.has(pueblo)) return null;
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return null;
  const ultimo = partes[partes.length - 1]!;
  if (!/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ']+$/.test(ultimo)) return null;
  if (faccion && faccion.split(/\s+/).includes(ultimo)) return null;
  if (['Serhu', 'Helsig', 'Goshg', 'Maktor'].includes(ultimo)) return null;
  return ultimo;
}

/// Puro: cómo se escribe el nombre con su linaje («Brakka Ketg», «Tasko, del rastro Veyra»).
export function nombreConLinaje(nombrePropio: string, linaje: { nombre: string; tipo: string } | null, corto = false): string {
  if (!linaje) return nombrePropio;
  if (linaje.tipo === 'RASTRO') return corto ? `${nombrePropio} de ${linaje.nombre}` : `${nombrePropio}, del rastro ${linaje.nombre}`;
  return `${nombrePropio} ${linaje.nombre}`;
}

export interface Progenitor {
  linajeId: string | null;
  /// Rango: tiene cargo (líder, heredero…) = 1; si no, 0.
  rango: number;
}

/// Puro (Q9): de qué linaje es la cría. Null = hay que fundar uno.
export function linajeDeCria(pueblo: string, madre: Progenitor, padre: Progenitor): string | null {
  switch (pueblo) {
    case 'orcos':
      if (padre.rango > madre.rango) return padre.linajeId ?? madre.linajeId;
      return madre.linajeId ?? padre.linajeId;
    case 'goirntes':
      return padre.linajeId ?? madre.linajeId;
    case 'nabieus':
    case 'faerus':
      return madre.linajeId ?? padre.linajeId;
    default:
      return madre.linajeId ?? padre.linajeId;
  }
}

// ─────────────────────────── Con base de datos ───────────────────────────

/// El linaje de alguien (o null).
export async function linajeDe(tx: Tx, saveId: string, entidadTipo: 'NPC' | 'SUBDITO' | 'PERSONAJE', entidadId: string) {
  const m = await tx.linajeMiembro.findFirst({ where: { saveId, entidadTipo, entidadId }, select: { linaje: true } });
  return m?.linaje ?? null;
}

/// Une a alguien a un linaje (si aún no es de ninguno).
export async function unirALinaje(tx: Tx, p: { saveId: string; linajeId: string; entidadTipo: 'NPC' | 'SUBDITO' | 'PERSONAJE'; entidadId: string; desdeMinutes: number }) {
  if (await tx.linajeMiembro.findFirst({ where: { saveId: p.saveId, entidadTipo: p.entidadTipo, entidadId: p.entidadId } })) return;
  await tx.linajeMiembro.createMany({ data: [p], skipDuplicates: true });
}

/// Funda un linaje nuevo para `pueblo` con un nombre que no exista ya en la partida.
/// Con `nombre` y `soloNuevo`, si ya hay una familia con ese nombre devuelve null: un apellido generado
/// al azar no hace pariente de nadie (quien lo lleve no se mete en los Ketg por casualidad).
export async function fundarLinaje(tx: Tx, p: { saveId: string; pueblo: string; desdeMinutes: number; random: () => number; nombre?: string; soloNuevo?: boolean }) {
  if (p.nombre && p.soloNuevo && (await tx.linaje.findUnique({ where: { saveId_pueblo_nombre: { saveId: p.saveId, pueblo: p.pueblo, nombre: p.nombre } } }))) return null;
  const tipo = tipoDeLinaje(p.pueblo);
  let nombre = p.nombre;
  for (let i = 0; !nombre && i < 20; i++) {
    const candidato = tipo === 'RASTRO' ? generarRastro(p.random) : generarApellido(p.pueblo, p.random);
    if (!(await tx.linaje.findUnique({ where: { saveId_pueblo_nombre: { saveId: p.saveId, pueblo: p.pueblo, nombre: candidato } } }))) nombre = candidato;
  }
  nombre ??= `${tipo === 'RASTRO' ? generarRastro(p.random) : generarApellido(p.pueblo, p.random)}${Math.floor(p.random() * 90) + 10}`;
  return tx.linaje.upsert({
    where: { saveId_pueblo_nombre: { saveId: p.saveId, pueblo: p.pueblo, nombre } },
    create: { saveId: p.saveId, nombre, pueblo: p.pueblo, tipo, origen: 'PARTIDA', desdeMinutes: p.desdeMinutes },
    update: {},
  });
}

/// Idempotente: los linajes del canon (por apellido) y el del personaje. Se llama al avanzar el mundo.
/// El del personaje se crea el último: si ya lo tiene, el resto está hecho y no se vuelve a mirar.
export async function asegurarLinajes(tx: Tx, saveId: string, ahora: number): Promise<void> {
  if (await linajeDe(tx, saveId, 'PERSONAJE', saveId)) return;
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, characterName: true } });
  const npcs = await tx.npc.findMany({
    where: { worldId: save.worldId, kind: 'PRINCIPAL', raza: { not: null }, OR: [{ saveId: null }, { saveId }] },
    select: { id: true, name: true, raza: true, faction: true },
  });
  const yaMiembros = new Set((await tx.linajeMiembro.findMany({ where: { saveId, entidadTipo: 'NPC' }, select: { entidadId: true } })).map((m) => m.entidadId));
  for (const n of npcs) {
    if (yaMiembros.has(n.id)) continue;
    const apellido = apellidoDe(n.name, n.raza, n.faction);
    if (!apellido) continue;
    const linaje = await tx.linaje.upsert({
      where: { saveId_pueblo_nombre: { saveId, pueblo: n.raza!, nombre: apellido } },
      create: { saveId, nombre: apellido, pueblo: n.raza!, tipo: tipoDeLinaje(n.raza!), origen: 'CATALOGO', desdeMinutes: 0 },
      update: {},
    });
    await unirALinaje(tx, { saveId, linajeId: linaje.id, entidadTipo: 'NPC', entidadId: n.id, desdeMinutes: 0 });
  }
  // Q11: el personaje también tiene linaje (de momento orco; el personaje propio llegará en el 0.7).
  {
    const apellido = apellidoDe(save.characterName, 'orcos', null);
    const linaje = apellido
      ? await tx.linaje.upsert({
          where: { saveId_pueblo_nombre: { saveId, pueblo: 'orcos', nombre: apellido } },
          create: { saveId, nombre: apellido, pueblo: 'orcos', tipo: 'APELLIDO', origen: 'PARTIDA', desdeMinutes: ahora },
          update: {},
        })
      : await tx.linaje.upsert({
          where: { saveId_pueblo_nombre: { saveId, pueblo: 'orcos', nombre: save.characterName } },
          create: { saveId, nombre: save.characterName, pueblo: 'orcos', tipo: 'APELLIDO', origen: 'PARTIDA', desdeMinutes: ahora },
          update: {},
        });
    await unirALinaje(tx, { saveId, linajeId: linaje.id, entidadTipo: 'PERSONAJE', entidadId: saveId, desdeMinutes: ahora });
  }
}

/// Rango de un NPC para la herencia orca: con cargo (líder, heredero…) cuenta más.
async function rangoDe(tx: Tx, saveId: string, npcId: string): Promise<number> {
  const e = await tx.npcState.findFirst({ where: { saveId, npcId, scope: '' }, select: { cargo: true } });
  if (e?.cargo) return 1;
  return (await tx.faction.count({ where: { saveId, liderNpcId: npcId } })) > 0 ? 1 : 0;
}

/// Para un nacimiento: el linaje de la cría según su pueblo y sus padres; si ninguno tiene, la pareja
/// funda uno (Q11). Un rastro faerus de más de 12 hace que la pareja funde uno nuevo (Q13).
export async function linajeParaNacido(
  tx: Tx,
  p: { saveId: string; pueblo: string; madreId: string; padreId: string; ahora: number; random: () => number; entidadTipo?: 'NPC' | 'SUBDITO' },
): Promise<{ id: string; nombre: string; tipo: string }> {
  // REI-120: también para las crías de súbditos (sin cargo: rango 0, a igualdad manda la madre).
  const tipo = p.entidadTipo ?? 'NPC';
  const [lm, lp] = await Promise.all([linajeDe(tx, p.saveId, tipo, p.madreId), linajeDe(tx, p.saveId, tipo, p.padreId)]);
  const [rm, rp] = tipo === 'NPC' ? await Promise.all([rangoDe(tx, p.saveId, p.madreId), rangoDe(tx, p.saveId, p.padreId)]) : [0, 0];
  let id = linajeDeCria(p.pueblo, { linajeId: lm?.id ?? null, rango: rm }, { linajeId: lp?.id ?? null, rango: rp });
  if (id && p.pueblo === 'faerus' && (await tx.linajeMiembro.count({ where: { linajeId: id } })) >= TAMANO_PARA_ESCINDIR_RASTRO) id = null;
  if (id) {
    const l = [lm, lp].find((x) => x?.id === id)!;
    return { id: l.id, nombre: l.nombre, tipo: l.tipo };
  }
  const nuevo = (await fundarLinaje(tx, { saveId: p.saveId, pueblo: p.pueblo, desdeMinutes: p.ahora, random: p.random }))!;
  for (const padre of [p.madreId, p.padreId]) {
    if (!(await linajeDe(tx, p.saveId, tipo, padre))) await unirALinaje(tx, { saveId: p.saveId, linajeId: nuevo.id, entidadTipo: tipo, entidadId: padre, desdeMinutes: p.ahora });
  }
  return { id: nuevo.id, nombre: nuevo.nombre, tipo: nuevo.tipo };
}

// ─────────────────────────── En el Libro ───────────────────────────


/// Q8: el linaje es actor del Libro. Todo suceso con alguien de una familia queda también apuntado a
/// su linaje (como AFECTADO), para poder contar su historia.
export const REACCIONES_LINAJES: Reaccion[] = [
  {
    id: 'LINAJE_EN_EL_LIBRO',
    escucha: ['NACIMIENTO_NOTABLE', 'NPC_DESTACA', 'MUERTE_NPC', 'MUERTE_CAUSADA', 'MUERTE_LIDER', 'CAMBIO_LIDER', 'SUCESION', 'PERDON_CONCEDIDO', 'COMBATE_GANADO', 'COMBATE_PERDIDO', 'HUIDA_DE_NPC', 'CAPTURA', 'RECLUTAMIENTO', 'INFORMANTE_DESCUBIERTO', 'HILO_ABIERTO', 'HILO_CERRADO'],
    prioridad: 5,
    condicion: async (ctx) => ctx.suceso.actores.some((a) => a.entidadTipo === 'NPC' || a.entidadTipo === 'SUBDITO'),
    efectos: async (ctx) => {
      const personas = ctx.suceso.actores.filter((a) => a.entidadTipo === 'NPC' || a.entidadTipo === 'SUBDITO');
      const miembros = await ctx.tx.linajeMiembro.findMany({
        where: { saveId: ctx.suceso.saveId, OR: personas.map((a) => ({ entidadTipo: a.entidadTipo, entidadId: a.entidadId })) },
        select: { linajeId: true },
      });
      const ya = new Set(ctx.suceso.actores.filter((a) => a.entidadTipo === 'LINAJE').map((a) => a.entidadId));
      const nuevos = [...new Set(miembros.map((m) => m.linajeId))].filter((id) => !ya.has(id));
      if (nuevos.length) {
        await ctx.tx.sucesoActor.createMany({
          data: nuevos.map((id) => ({ sucesoId: ctx.suceso.id, entidadTipo: 'LINAJE', entidadId: id, papel: 'AFECTADO' })),
          skipDuplicates: true,
        });
      }
      return [];
    },
  },
];

/// Q10: el adulto vivo del mismo linaje que toma una venganza cuando cae quien la llevaba (o null).
export async function herederoDeVenganza(tx: Tx, saveId: string, npcId: string): Promise<{ id: string; name: string; linaje: string } | null> {
  const m = await tx.linajeMiembro.findFirst({ where: { saveId, entidadTipo: 'NPC', entidadId: npcId }, select: { linajeId: true, linaje: { select: { nombre: true } } } });
  if (!m) return null;
  const otros = (await tx.linajeMiembro.findMany({ where: { linajeId: m.linajeId, entidadTipo: 'NPC', entidadId: { not: npcId } }, select: { entidadId: true } })).map((o) => o.entidadId);
  if (otros.length === 0) return null;
  const muertos = new Set((await tx.npcState.findMany({ where: { saveId, npcId: { in: otros }, OR: [{ muerto: true }, { condicionFisica: 'MUERTO' }] }, select: { npcId: true } })).map((e) => e.npcId));
  const vivos = await tx.npc.findMany({ where: { id: { in: otros.filter((o) => !muertos.has(o)) }, muertoEnMundo: false }, select: { id: true, name: true, slug: true, raza: true, nacidoEn: true }, orderBy: { slug: 'asc' } });
  const ahora = (await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0;
  const adulto = vivos.find((v) => esAdulto(v.raza, edadEnAnios(nacidoEnDe(v), ahora)));
  return adulto ? { id: adulto.id, name: adulto.name, linaje: m.linaje.nombre } : null;
}

/// Q10: ids de los NPC del mismo linaje que `npcId` (sin él).
export async function familiaDe(tx: Tx, saveId: string, npcIds: string[]): Promise<Map<string, string[]>> {
  const ms = await tx.linajeMiembro.findMany({ where: { saveId, entidadTipo: 'NPC', entidadId: { in: npcIds } }, select: { entidadId: true, linajeId: true } });
  if (ms.length === 0) return new Map();
  const todos = await tx.linajeMiembro.findMany({ where: { linajeId: { in: [...new Set(ms.map((m) => m.linajeId))] }, entidadTipo: 'NPC' }, select: { entidadId: true, linajeId: true } });
  return new Map(ms.map((m) => [m.entidadId, todos.filter((t) => t.linajeId === m.linajeId && t.entidadId !== m.entidadId).map((t) => t.entidadId)]));
}
