// CR-65 (hito 0.3, Fase E, paso 65b): la defensa de cada asentamiento del Reino con base de datos.
// Asentamiento = la Capital (Ayuntamiento) o un Cuartel Avanzado (Q1, X4: cada estación con sus
// módulos). Sus módulos son los edificios de defensa de su región; su guarnición, los soldados y
// vigías asignados (Q7; los que no tienen asentamiento son de la Capital, Q10). Reglas en
// `cronista/defensa.ts`.
import type { Prisma } from '@prisma/client';
import { DEFENSA_RECIPE_KEYS } from './construction.js';
import { efectoDefensa, EQUIPOS_ARMERIA, moduloDeRecipeKey, type EfectoDefensa, type ModulosAsentamiento } from './cronista/defensa.js';
import { costeDePiezas, equipoDeAlta, gastarMateriales, piezasEnCasa, talleresDelReino } from './cronista/facturaEquipo.js';
import { esAdultoSubdito, rolDeSubdito } from './cronista/subditos.js';
import type { PrismaClient } from '@prisma/client';
import { ownerKeyFor } from './reinoOwner.js';
import { recalcularPoblacion } from './cronista/subditos.js';
import { ocupanteDe } from './cronista/campamentosBandidos.js';
import { defensaEstimada, esIntensidad, esTamano, type Intensidad, type TamanoAsaltos } from './cronista/decisionAsalto.js';
import { esGuardia } from './cronista/usosFauna.js';
import { etapaDe, etapasDe } from './cronista/ganaderia.js';
import { avisoDeViajero, enlacesDelMundo, lugaresATramos } from './viajeros.js';

type Tx = Prisma.TransactionClient;

export interface ModuloFila {
  id: string;
  modulo: string;
  nombre: string;
  escalon: number;
  golpes: number;
  caida: boolean;
  /// P296: el módulo está DANADO (no cuenta hasta repararlo, sale en la lista para poder repararlo).
  danado: boolean;
  equiposMilicia: number;
}

export interface Asentamiento {
  id: string;
  nombre: string;
  capital: boolean;
  region: string;
  locationId: string;
  modulos: ModuloFila[];
  guarnicion: { id: string; nombre: string; rol: 'soldado' | 'vigia' }[];
  efecto: EfectoDefensa;
}

const esGuarnicion = (role: string) => {
  const r = rolDeSubdito(role);
  return r === 'soldado' || r === 'vigia' ? r : null;
};

/// Los asentamientos del Reino con sus módulos, su guarnición y lo que suman.
export async function asentamientosDelReino(tx: Tx, saveId: string): Promise<Asentamiento[]> {
  const nucleos = await tx.building.findMany({
    where: { saveId, recipeKey: { in: ['ayuntamiento', 'cuartel-avanzado'] }, status: 'ACTIVO', location: { isNot: null } },
    select: { id: true, name: true, recipeKey: true, location: { select: { id: true, region: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const capital = nucleos.find((n) => n.recipeKey === 'ayuntamiento');
  const [modulos, subditos] = await Promise.all([
    tx.building.findMany({ where: { saveId, recipeKey: { in: DEFENSA_RECIPE_KEYS }, status: { in: ['ACTIVO', 'DANADO'] } }, select: { id: true, status: true, recipeKey: true, name: true, tier: true, golpesDefensa: true, caida: true, equiposMilicia: true, location: { select: { region: true } } } }),
    tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, asentamientoId: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  return nucleos.map((n) => {
    const aqui = modulos.filter((m) => m.location?.region === n.location!.region);
    // P296: un módulo DANADO sale en la lista (para repararlo) pero no suma; la Empalizada dañada cuenta como caída.
    const escalon = (k: string) => aqui.find((m) => m.recipeKey === k && (m.status === 'ACTIVO' || k === 'empalizada'))?.tier ?? 0;
    const guarnicion = subditos
      .filter((s) => esGuarnicion(s.role) && (s.asentamientoId === n.id || (!s.asentamientoId && n.id === capital?.id)))
      .map((s) => ({ id: s.id, nombre: s.name, rol: esGuarnicion(s.role)! }));
    const m: ModulosAsentamiento = {
      empalizada: escalon('empalizada'),
      torre: escalon('torre-vigia'),
      armeria: escalon('armeria'),
      barracon: escalon('barracon'),
      empalizadaCaida: (() => { const e = aqui.find((x) => x.recipeKey === 'empalizada'); return !!e && (e.caida || e.status === 'DANADO'); })(),
      vigiaEnTorre: guarnicion.some((g) => g.rol === 'vigia'),
    };
    return {
      id: n.id,
      nombre: n.name,
      capital: n.id === capital?.id,
      region: n.location!.region,
      locationId: n.location!.id,
      modulos: aqui.map((x) => ({ id: x.id, modulo: moduloDeRecipeKey(x.recipeKey)!, nombre: x.name, escalon: x.tier ?? 1, golpes: x.golpesDefensa, caida: x.caida || (x.recipeKey === 'empalizada' && x.status === 'DANADO'), danado: x.status === 'DANADO', equiposMilicia: x.equiposMilicia })),
      guarnicion,
      efecto: efectoDefensa(m),
    };
  });
}

/// Q7: asigna un soldado o vigía a un asentamiento, si le quedan plazas de guarnición.
export async function asignarGuarnicion(tx: Tx, saveId: string, subjectId: string, asentamientoId: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const s = await tx.subject.findFirst({ where: { id: subjectId, saveId, estado: 'ACTIVO' }, select: { role: true, asentamientoId: true } });
  if (!s || !esGuarnicion(s.role)) return { ok: false, motivo: 'Solo se asignan soldados y vigías.' };
  const destino = (await asentamientosDelReino(tx, saveId)).find((a) => a.id === asentamientoId);
  if (!destino) return { ok: false, motivo: 'Ese asentamiento no es tuyo.' };
  if (destino.guarnicion.some((g) => g.id === subjectId)) return { ok: true };
  if (destino.guarnicion.length >= destino.efecto.plazasGuarnicion) return { ok: false, motivo: `${destino.nombre} no tiene más plazas de guarnición (${destino.efecto.plazasGuarnicion}): levanta o mejora su Barracón.` };
  await tx.subject.update({ where: { id: subjectId }, data: { asentamientoId: destino.capital ? null : destino.id } });
  return { ok: true };
}

/// Q6: compra equipos de milicia para una Armería (un arma cada uno, con la factura de `CR-58`:
/// Goirnos si se compra fuera, materiales si hay taller en casa), hasta lo que caben.
export async function comprarEquiposMilicia(tx: Tx, saveId: string, armeriaId: string, n: number): Promise<{ ok: true; comprados: number } | { ok: false; motivo: string }> {
  const armeria = await tx.building.findFirst({ where: { id: armeriaId, saveId, recipeKey: 'armeria', status: 'ACTIVO' }, select: { tier: true, equiposMilicia: true } });
  if (!armeria) return { ok: false, motivo: 'No tienes esa Armería.' };
  const caben = EQUIPOS_ARMERIA[Math.min(3, Math.max(1, armeria.tier ?? 1))] - armeria.equiposMilicia;
  const cuantos = Math.min(Math.max(0, Math.floor(n)), caben);
  if (cuantos <= 0) return { ok: false, motivo: 'La Armería ya está llena.' };
  const una = costeDePiezas(equipoDeAlta('cazador'), piezasEnCasa(await talleresDelReino(tx, saveId)));
  const coste = { goirnos: una.goirnos * cuantos, materiales: una.materiales * cuantos };
  const ownerKey = ownerKeyFor({ saveId });
  const { count } = await tx.kingdomStats.updateMany({ where: { ownerKey, riqueza: { gte: coste.goirnos } }, data: { riqueza: { decrement: coste.goirnos } } });
  if (count === 0) return { ok: false, motivo: `No te llega: ${coste.goirnos} Goirnos.` };
  if (!(await gastarMateriales(tx, saveId, coste.materiales))) throw new Error(`Faltan ${coste.materiales} materiales en el Almacén.`);
  await tx.building.update({ where: { id: armeriaId }, data: { equiposMilicia: { increment: cuantos } } });
  return { ok: true, comprados: cuantos };
}

/// Q3/Q5: un viajero hostil es una partida de asalto (las lanzan los bandidos de `CR-50` y la guerra
/// de `CR-37`).
export const TIPO_ASALTO = 'ASALTO';

export interface Avistamiento {
  asentamientoId: string;
  asentamiento: string;
  viajeroId: string;
  quien: string;
  gente: number;
  tramos: number;
  /// CR-67 (Q5): por qué viene.
  motivo?: string;
  /// P295: por qué «Llamar a la milicia» no serviría ahora (si sirve, no está).
  sinMilicia?: string;
}

/// Q5 (X4: lo que entra en el alcance de tus satélites): los asaltos que se ven desde la Torre de
/// cada asentamiento, a cuántos tramos están.
export async function radarDelReino(tx: Tx, saveId: string, ahora: number): Promise<Avistamiento[]> {
  const asentamientos = (await asentamientosDelReino(tx, saveId)).filter((a) => a.efecto.radioTramos > 0);
  if (asentamientos.length === 0) return [];
  const hostiles = await tx.viajero.findMany({
    where: { saveId, tipo: TIPO_ASALTO, estado: { not: 'TERMINADO' } },
    select: { id: true, ubicacionLocationId: true, carga: true, faction: { select: { name: true } }, miembros: { select: { genericos: true, companionId: true, subjectId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (hostiles.length === 0) return [];
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const enlaces = await enlacesDelMundo(tx, worldId);
  const out: Avistamiento[] = [];
  for (const a of asentamientos) {
    const alcance = lugaresATramos(enlaces, a.locationId, a.efecto.radioTramos);
    for (const h of hostiles) {
      const tramos = alcance.get(h.ubicacionLocationId);
      if (tramos === undefined) continue;
      const gente = h.miembros.reduce((s, m) => s + m.genericos + (m.companionId || m.subjectId ? 1 : 0), 0);
      const sinMilicia = (await planMilicia(tx, saveId, a.id, ahora)).motivo;
      out.push({ asentamientoId: a.id, asentamiento: a.nombre, viajeroId: h.id, quien: h.faction?.name ?? (await grupoDeAsalto(tx, h.carga)), gente, tramos, ...(sinMilicia ? { sinMilicia } : {}), ...((h.carga as { motivo?: string } | null)?.motivo ? { motivo: (h.carga as { motivo: string }).motivo } : {}) });
    }
  }
  return out;
}

/// Q6: arma a la milicia de un asentamiento: tantos trabajadores adultos como equipos haya en su
/// Armería. Mientras dura, no producen.
export async function convocarMilicia(tx: Tx, saveId: string, asentamientoId: string, ahora: number): Promise<number> {
  const { llamados } = await planMilicia(tx, saveId, asentamientoId, ahora);
  if (llamados.length === 0) return 0;
  await tx.subject.updateMany({ where: { id: { in: llamados } }, data: { enMilicia: true } });
  await recalcularPoblacion(tx, saveId, ahora);
  return llamados.length;
}

/// P295: a quién llamaría la milicia de un asentamiento ahora y, si a nadie, por qué (sin Armería
/// sana o sin equipos, sin trabajadores adultos libres, o todos los equipos ya en uso).
export async function planMilicia(tx: Tx, saveId: string, asentamientoId: string, ahora: number): Promise<{ llamados: string[]; motivo: string | null }> {
  const a = (await asentamientosDelReino(tx, saveId)).find((x) => x.id === asentamientoId);
  if (!a) return { llamados: [], motivo: 'Ese asentamiento no existe.' };
  const armeria = a.modulos.find((m) => m.modulo === 'armeria' && !m.danado);
  const equipos = armeria?.equiposMilicia ?? 0;
  const sujetos = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, role: true, pueblo: true, nacidoEn: true, enMilicia: true }, orderBy: { createdAt: 'asc' } });
  const trabajadores = sujetos.filter((s) => rolDeSubdito(s.role) === 'trabajador' && esAdultoSubdito(s, ahora));
  const yaArmados = sujetos.filter((s) => s.enMilicia).length;
  const llamados = trabajadores.filter((s) => !s.enMilicia).slice(0, Math.max(0, equipos - yaArmados)).map((s) => s.id);
  if (llamados.length > 0) return { llamados, motivo: null };
  if (!armeria) return { llamados, motivo: 'No hay una Armería en pie que arme a la milicia.' };
  if (equipos === 0) return { llamados, motivo: 'La Armería no tiene equipos de milicia: compra alguno en Defensa.' };
  if (trabajadores.length === 0) return { llamados, motivo: 'No hay trabajadores adultos que armar.' };
  return { llamados, motivo: yaArmados >= equipos ? 'Toda la milicia ya está armada.' : 'No hay trabajadores libres que armar.' };
}

/// Fin de la alarma: los milicianos vuelven al trabajo.
export async function licenciarMilicia(tx: Tx, saveId: string, ahora: number): Promise<number> {
  const { count } = await tx.subject.updateMany({ where: { saveId, enMilicia: true }, data: { enMilicia: false } });
  if (count > 0) await recalcularPoblacion(tx, saveId, ahora);
  return count;
}

/// Un día de vigilancia (avance diario): avisa de cada asalto que entra en el radio de una Torre;
/// si el personaje no está en ese asentamiento, la milicia se arma sola (Q6). Sin asaltos a la
/// vista, la milicia vuelve al trabajo.
export async function vigilarDelReino(prisma: PrismaClient, saveId: string, dia: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const ahora = dia * 1440;
    const vistos = await radarDelReino(tx, saveId, ahora);
    const nuevos = await tx.viajero.findMany({ where: { id: { in: [...new Set(vistos.map((v) => v.viajeroId))] }, avistado: false }, select: { id: true } });
    const nuevosIds = new Set(nuevos.map((n) => n.id));
    const save = await tx.save.findUnique({ where: { id: saveId }, select: { currentLocationId: true } });
    const avisados = new Set<string>();
    for (const v of vistos) {
      if (!nuevosIds.has(v.viajeroId) || avisados.has(v.viajeroId)) continue;
      avisados.add(v.viajeroId);
      const asentamiento = (await asentamientosDelReino(tx, saveId)).find((a) => a.id === v.asentamientoId)!;
      const fuera = save?.currentLocationId !== asentamiento.locationId;
      const armados = fuera ? await convocarMilicia(tx, saveId, v.asentamientoId, ahora) : 0;
      await avisoDeViajero(tx, { saveId, factionId: null }, `Desde la Torre de vigía de ${v.asentamiento} se ve venir a ${v.quien}: ${v.gente} a ${v.tramos} tramo${v.tramos === 1 ? '' : 's'} de camino.${v.motivo ? ` ${v.motivo}` : ''}${armados > 0 ? ` Estás fuera: ${armados} trabajadores toman las armas de la Armería.` : fuera ? '' : ' Puedes llamar a la milicia.'}`);
    }
    if (avisados.size > 0) await tx.viajero.updateMany({ where: { id: { in: [...avisados] } }, data: { avistado: true } });
    if (vistos.length === 0) await licenciarMilicia(tx, saveId, ahora);
    return avisados.size;
  });
}

/// Q9 (X4: el alcance de un satélite): los lugares que vigila la Torre de cada asentamiento, para
/// dibujarlos en el mapa de Berig.
export async function alcancesDeTorres(tx: Tx, saveId: string): Promise<{ asentamiento: string; slugs: string[] }[]> {
  const conTorre = (await asentamientosDelReino(tx, saveId)).filter((a) => a.efecto.radioTramos > 0);
  if (conTorre.length === 0) return [];
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const enlaces = await enlacesDelMundo(tx, worldId);
  const out: { asentamiento: string; slugs: string[] }[] = [];
  for (const a of conTorre) {
    const ids = [...lugaresATramos(enlaces, a.locationId, a.efecto.radioTramos).keys()];
    const lugares = await tx.location.findMany({ where: { id: { in: ids } }, select: { slug: true }, orderBy: { slug: 'asc' } });
    out.push({ asentamiento: a.nombre, slugs: lugares.map((l) => l.slug.replace(/-interior$/, '')) });
  }
  return out;
}

/// CR-50: el nombre del grupo de un asalto de bandidos (el de los ocupantes de su campamento).
async function grupoDeAsalto(tx: Tx, carga: Prisma.JsonValue): Promise<string> {
  const id = (carga as { campamentoId?: string } | null)?.campamentoId;
  const c = id ? await tx.campamento.findUnique({ where: { id }, select: { ocupante: true } }) : null;
  return (c && ocupanteDe(c.ocupante)?.grupo) || 'Bandidos';
}

// ─────────────────────────── CR-67: lo que ve un atacante ───────────────────────────

/// Ajustes de partida de los asaltos (Configuración › Partida).
export async function ajustesAsaltos(tx: Tx, saveId: string): Promise<{ intensidad: Intensidad; tamano: TamanoAsaltos }> {
  const ws = await tx.worldState.findUnique({ where: { saveId }, select: { intensidadAsaltos: true, tamanoAsaltos: true } });
  return { intensidad: esIntensidad(ws?.intensidadAsaltos) ? ws.intensidadAsaltos : 'NORMAL', tamano: esTamano(ws?.tamanoAsaltos) ? ws.tamanoAsaltos : 'NORMAL' };
}

/// Los guardias de fauna crecidos (adultos o viejos) de los corrales de una región (`CR-56`).
export async function guardiasDeRegion(tx: Tx, saveId: string, worldId: string, region: string, ahora: number) {
  const ganado = (await tx.ganado.findMany({ where: { saveId, building: { location: { region } } }, select: { id: true, especie: true, nacidoEn: true } })).filter((g) => esGuardia(g.especie));
  const npcs = await tx.npc.findMany({ where: { worldId, saveId: null, slug: { in: [...new Set(ganado.map((g) => g.especie))] } } });
  return ganado.flatMap((g) => {
    const npc = npcs.find((n) => n.slug === g.especie);
    if (!npc || /CRIA|JOVEN/.test(etapaDe(etapasDe(g.especie, npc.faunaCategoria), Math.floor((ahora - g.nacidoEn) / 1440)))) return [];
    return [{ ganadoId: g.id, npc }];
  });
}

/// Lo que no cambia entre asentamientos al estimar defensas en un mismo día (se carga una vez).
export interface ContextoDefensa {
  worldId: string;
  /// Trabajadores adultos del Reino (la gente vive en la Capital: su milicia sale de ahí).
  trabajadores: number;
  guardiasPorRegion: Map<string, number>;
}

export async function contextoDefensa(tx: Tx, saveId: string, ahora: number): Promise<ContextoDefensa> {
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const trabajadores = (await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { role: true, pueblo: true, nacidoEn: true } }))
    .filter((s) => rolDeSubdito(s.role) === 'trabajador' && esAdultoSubdito(s, ahora)).length;
  return { worldId, trabajadores, guardiasPorRegion: new Map() };
}

/// Q1: la defensa que estima un atacante en un asentamiento: guarnición, milicia que podría armarse
/// (en la Capital, equipos de su Armería y trabajadores; en un Cuartel Avanzado no vive nadie que
/// armar), guardias de fauna de la región, cobertura y moral.
export async function defensaVista(tx: Tx, saveId: string, a: Asentamiento, ahora: number, ctx: ContextoDefensa): Promise<number> {
  const equipos = a.modulos.find((m) => m.modulo === 'armeria' && !m.danado)?.equiposMilicia ?? 0;
  if (!ctx.guardiasPorRegion.has(a.region)) ctx.guardiasPorRegion.set(a.region, (await guardiasDeRegion(tx, saveId, ctx.worldId, a.region, ahora)).length);
  return defensaEstimada({ guarnicion: a.guarnicion.length, milicia: a.capital ? Math.min(equipos, ctx.trabajadores) : 0, guardias: ctx.guardiasPorRegion.get(a.region)!, cobertura: a.efecto.cobertura, bonoMoral: a.efecto.bonoMoral });
}
