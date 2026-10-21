// Partidas de caza (CR-63 paso 63b, hito 0.3 — decisiones Q4 y Q5 de la ronda de detalle). Una
// partida es un viajero de tipo CAZA (`viajeros.ts`):
//
// - Al llegar (Q4): busca su especie entre los grupos de fauna de la zona de destino y pelea de fondo
//   (8 contra 8, `combateDeFondo.ts`), como mucho dos encuentros o hasta 4 piezas por miembro. Cada
//   animal abatido es una pieza; el grupo de fauna y la población de la especie pierden los suyos.
//   Sin la especie, vuelve de vacío. Sus caídos quedan heridos; muere el 3 %.
// - Al volver (Q5): las piezas del Reino entran en el Almacén como «Pieza de <especie>», que se
//   estropean a los 3 días de cazadas.
// - Cada día, el Desolladero desuella las piezas que le caben (4 por escalón) y cada una da lo que da
//   esa especie (`aprovecharAnimal`, lo mismo que sacrificar un animal del corral).
import { CAZADORES_POR_PARTIDA, descargarCazaFaccion, faccionPuedeCazar } from './partidasFacciones.js';
import type { CondicionFisica, Prisma } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import { simularCombateDeFondo, TAMANO_SUBCOMBATE_FONDO, type CombatienteFondo } from './combateDeFondo.js';
import { baseDePueblo, NIVEL_SOLDADO_GENERICO, soldadoGenerico } from './cronista/combatientesFaccion.js';
import { combatienteDeNpc } from './factionExpeditions.js';
import { descontarZonePointCaza } from './caza.js';
import { decrementPopulationOnDeath } from './population.js';
import { aprovecharAnimal } from './cronista/ganadoReino.js';
import { recalcularPoblacion, subditosSinArma } from './cronista/subditos.js';
import { morir } from './cronista/salidas.js';
import { avisoDeViajero, TRABAJOS, type ViajeroFila } from './viajeros.js';

type Tx = Prisma.TransactionClient;

/// Q4: encuentros como mucho por salida y piezas por miembro.
export const ENCUENTROS_POR_SALIDA = 2;
export const PIEZAS_POR_MIEMBRO = 4;
/// Q5: días que aguanta una pieza.
export const DIAS_PIEZA = 3;
/// Piezas que desuella al día un Desolladero por escalón (Taller 4, Obrador 8, Gran obrador 12).
export const PIEZAS_DESOLLADERO_POR_ESCALON = 4;
export const SLUG_PIEZA = 'pieza';

const ORDEN_CONDICION: CondicionFisica[] = ['ILESO', 'HERIDO', 'GRAVE', 'CONVALECIENTE', 'MUERTO'];
export const peor = (a: CondicionFisica, b: CondicionFisica) => (ORDEN_CONDICION.indexOf(a) >= ORDEN_CONDICION.indexOf(b) ? a : b);
const enPie = (c: CondicionFisica) => c !== 'CONVALECIENTE' && c !== 'MUERTO';

export interface CargaCaza {
  especie: string;
  piezas: number;
  diaCaza: number;
  resumen: string;
  /// CR-63 (63c), partidas de captura: cuerdas que lleva y animales atados.
  cuerdas?: number;
  capturados?: number;
}

/// Q6: probabilidad de atar a un animal abatido (la de la especie, con el tope de la caza limpia).
export const CHANCE_CAPTURA_TOPE = 90;

export interface Cazador {
  c: CombatienteFondo;
  miembroId: string;
  companionId?: string;
  subjectId?: string;
  generico?: boolean;
}

/// Los combatientes de una partida: compañeros con sus atributos, súbditos y genéricos como soldados
/// de su pueblo (con su arma, Q3).
export async function cazadoresDe(tx: Tx, v: ViajeroFila, worldId: string): Promise<Cazador[]> {
  const out: Cazador[] = [];
  const companeros = await tx.companion.findMany({ where: { id: { in: v.miembros.map((m) => m.companionId).filter((x): x is string => !!x) }, condicionFisica: { notIn: ['MUERTO', 'CONVALECIENTE'] } } });
  for (const comp of companeros) {
    const a = (comp.attributes ?? {}) as unknown as AttributeBlock;
    const m = v.miembros.find((x) => x.companionId === comp.id)!;
    out.push({
      miembroId: m.id, companionId: comp.id,
      c: { id: comp.id, nombre: comp.name, bando: 'A', attributes: a, attribute: (a.destreza ?? 0) > (a.fuerza ?? 0) ? 'destreza' : 'fuerza', attributeBonus: 1, nivel: NIVEL_SOLDADO_GENERICO, conMoral: true, conNombre: true },
    });
  }
  const subditos = await tx.subject.findMany({ where: { id: { in: v.miembros.map((m) => m.subjectId).filter((x): x is string => !!x) }, estado: 'ACTIVO' } });
  // Q3 (P281): como un soldado, quien no tiene arma pelea sin su bono.
  const sinArma = subditos.length > 0 ? await subditosSinArma(tx, v.saveId, (await tx.worldState.findUnique({ where: { saveId: v.saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? 0) : new Set<string>();
  for (const s of subditos) {
    const m = v.miembros.find((x) => x.subjectId === s.id)!;
    out.push({ miembroId: m.id, subjectId: s.id, c: { ...soldadoGenerico(s.id, s.name, 'A', await baseDePueblo(tx, worldId, s.pueblo ?? 'orcos'), !sinArma.has(s.id)), conNombre: false } });
  }
  const raza = v.factionId ? (await tx.faction.findUnique({ where: { id: v.factionId }, select: { raza: true } }))?.raza ?? null : null;
  for (const m of v.miembros.filter((x) => x.genericos > 0)) {
    const base = await baseDePueblo(tx, worldId, raza);
    for (let i = 0; i < m.genericos; i++) out.push({ miembroId: m.id, generico: true, c: soldadoGenerico(`${m.id}-${i}`, 'Cazador', 'A', base, true) });
  }
  return out;
}

/// Lo que le queda a la partida tras una pelea: compañeros heridos o muertos, súbditos y genéricos
/// muertos (los genéricos se descuentan de su fila y, si son de una facción, de su gente).
export async function aplicarBajas(tx: Tx, saveId: string, cazadores: Cazador[], condicion: Map<string, CondicionFisica>, muertos: Set<string>, dia: number, causa: 'caza' | 'combate' | 'guerra', factionId: string | null = null): Promise<void> {
  let ahora: number | undefined;
  for (const h of cazadores) {
    const cond = muertos.has(h.c.id) ? 'MUERTO' : condicion.get(h.c.id) ?? 'ILESO';
    if (h.companionId && cond !== 'ILESO') {
      // Una pelea no cura: se queda con la peor de su condición de antes y la de ahora.
      const antes = (await tx.companion.findUnique({ where: { id: h.companionId }, select: { condicionFisica: true } }))?.condicionFisica as CondicionFisica | undefined;
      await tx.companion.update({ where: { id: h.companionId }, data: { condicionFisica: antes ? peor(antes, cond) : cond } });
    }
    if (h.subjectId && cond === 'MUERTO') {
      ahora ??= (await tx.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } }))?.fictionalMinutes ?? dia * 1440;
      await morir(tx, saveId, { id: h.subjectId, name: h.c.nombre }, causa, ahora);
    }
  }
  const genericosMuertos = new Map<string, number>();
  for (const h of cazadores) if (h.generico && muertos.has(h.c.id)) genericosMuertos.set(h.miembroId, (genericosMuertos.get(h.miembroId) ?? 0) + 1);
  for (const [miembroId, n] of genericosMuertos) await tx.viajeroMiembro.update({ where: { id: miembroId }, data: { genericos: { decrement: n } } });
  const caidos = [...genericosMuertos.values()].reduce((s, n) => s + n, 0);
  if (factionId && caidos > 0) {
    const k = await tx.kingdomStats.findFirst({ where: { factionId }, select: { id: true, poblacion: true, trabajadores: true } });
    if (k) await tx.kingdomStats.update({ where: { id: k.id }, data: { poblacion: Math.max(0, k.poblacion - caidos), trabajadores: Math.max(0, k.trabajadores - caidos) } });
  }
  if (cazadores.some((h) => h.subjectId && muertos.has(h.c.id))) {
    await recalcularPoblacion(tx, saveId, ahora ?? dia * 1440);
  }
}

/// Q4: lo que hace la partida en su destino.
/// `cuerdas`: en una partida de captura, cuántos puede atar (uno por cuerda); los abatidos que no ata
/// son piezas.
export async function cazarEnDestino(tx: Tx, v: ViajeroFila, dia: number, random: () => number, cuerdas = 0): Promise<CargaCaza> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const especie = v.objetivo ?? '';
  const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: especie } });
  const lugar = await tx.location.findUniqueOrThrow({ where: { id: v.ubicacionLocationId }, select: { name: true, region: true } });
  const cazadores = await cazadoresDe(tx, v, save.worldId);
  const tope = PIEZAS_POR_MIEMBRO * cazadores.length;
  const condicion = new Map<string, CondicionFisica>(cazadores.map((h) => [h.c.id, 'ILESO']));
  const muertos = new Set<string>();
  let piezas = 0;
  let capturados = 0;
  let encuentros = 0;
  const grupos = npc
    ? await tx.zonePoint.findMany({ where: { saveId: v.saveId, locationId: v.ubicacionLocationId, tipo: 'FAUNA', targetSlug: especie, activo: true, cantidad: { gt: 0 } }, orderBy: [{ cantidad: 'desc' }, { id: 'asc' }] })
    : [];
  for (const grupo of grupos) {
    if (encuentros >= ENCUENTROS_POR_SALIDA || piezas + capturados >= tope) break;
    const enCampo = cazadores.filter((h) => enPie(condicion.get(h.c.id)!)).slice(0, TAMANO_SUBCOMBATE_FONDO);
    if (enCampo.length === 0) break;
    const nFauna = Math.min(grupo.cantidad, TAMANO_SUBCOMBATE_FONDO);
    const base = combatienteDeNpc(npc!);
    const fauna: CombatienteFondo[] = Array.from({ length: nFauna }, (_, i) => ({ id: `fauna-${grupo.id}-${i}`, nombre: npc!.name, bando: 'B', attributes: base.attributes, attribute: base.attribute, attributeBonus: base.attributeBonus, nivel: npc!.level, conMoral: false }));
    const r = simularCombateDeFondo([...enCampo.map((h) => h.c), ...fauna], random);
    encuentros++;
    let abatidos = Math.min(tope - piezas - capturados, r.estados.filter((e) => e.id.startsWith('fauna-') && !enPie(e.condicion)).length);
    // Q6: los abatidos vivos se intentan atar mientras queden cuerdas (los muertos no).
    const vivos = r.estados.filter((e) => e.id.startsWith('fauna-') && e.condicion === 'CONVALECIENTE').length;
    const atables = Math.min(vivos, abatidos);
    for (let i = 0; i < atables && capturados < cuerdas; i++) {
      if (random() * 100 < Math.min(CHANCE_CAPTURA_TOPE, npc!.capturablePct)) {
        capturados++;
        abatidos--;
        await descontarZonePointCaza(tx, v.saveId, grupo.id, 1);
      }
    }
    for (const e of r.estados) {
      if (!condicion.has(e.id)) continue;
      condicion.set(e.id, peor(condicion.get(e.id)!, e.condicion));
      if (e.muerto) muertos.add(e.id);
    }
    if (abatidos > 0) {
      piezas += abatidos;
      await descontarZonePointCaza(tx, v.saveId, grupo.id, abatidos);
      for (let i = 0; i < abatidos; i++) await decrementPopulationOnDeath(tx, v.saveId, null, especie, lugar.region);
    }
  }

  await aplicarBajas(tx, v.saveId, cazadores, condicion, muertos, dia, 'caza', v.factionId);

  const nombre = npc?.name ?? especie;
  const quien = cuerdas > 0 ? 'La partida de captura' : 'La partida de caza';
  // P280: una partida que pelea y no abate nada lo cuenta (quién cae, quién no tenía arma), no «abate 0».
  const caidos = cazadores.filter((h) => !enPie(condicion.get(h.c.id)!) || muertos.has(h.c.id)).length;
  const heridos = cazadores.filter((h) => condicion.get(h.c.id) !== 'ILESO').length;
  const desarmados = cazadores.filter((h) => h.c.attributeBonus === 0 && !h.companionId).length;
  const resumen = encuentros === 0
    ? `${quien} no encuentra ${nombre} en ${lugar.name} y vuelve de vacío.`
    : piezas === 0 && capturados === 0
      ? `${quien} planta cara a ${nombre} en ${lugar.name} y no abate ninguno: ${heridos > 0 ? `${heridos} de los suyos salen heridos${caidos > 0 ? ` (${caidos} fuera de combate)` : ''} y` : 'los suyos'} se retiran${muertos.size > 0 ? `; caen ${muertos.size}` : ''}${desarmados > 0 ? `. ${desarmados} iban sin arma` : ''}.`
      : `${quien} ${capturados > 0 ? `ata ${capturados} y ` : ''}abate ${piezas} ${nombre} en ${lugar.name}${muertos.size > 0 ? `; caen ${muertos.size} de los suyos` : ''}.`;
  return { especie, piezas, diaCaza: dia, resumen, ...(cuerdas > 0 ? { cuerdas: cuerdas - capturados, capturados } : {}) };
}

/// Aviso en el Reino (los de una facción no se avisan).
export async function avisoDelReino(tx: Tx, saveId: string, text: string) {
  await avisoDeViajero(tx, { saveId, factionId: null }, text);
}

/// Q5: al volver, las piezas del Reino entran en el Almacén con su caducidad.
export async function descargarCaza(tx: Tx, v: ViajeroFila, dia: number): Promise<number> {
  const carga = v.carga as unknown as CargaCaza | null;
  if (!carga?.especie || !carga.piezas || carga.piezas <= 0 || v.factionId) return 0;
  const caduca = carga.diaCaza + DIAS_PIEZA;
  if (caduca <= dia) {
    await avisoDelReino(tx, v.saveId, `La partida de caza vuelve, pero sus ${carga.piezas} piezas ya se han echado a perder.`);
    return 0;
  }
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: v.saveId }, select: { worldId: true } });
  const nombre = (await tx.npc.findFirst({ where: { worldId, saveId: null, slug: carga.especie }, select: { name: true } }))?.name ?? carga.especie;
  await tx.almacenItem.createMany({
    data: Array.from({ length: carga.piezas }, () => ({ saveId: v.saveId, name: `Pieza de ${nombre}`, description: `${nombre} abatido por una partida de caza; se echa a perder si nadie lo desuella.`, catalogSlug: SLUG_PIEZA, especieSlug: carga.especie, caducaEnDia: caduca })),
  });
  await avisoDelReino(tx, v.saveId, `La partida de caza vuelve con ${carga.piezas} piezas de ${nombre}. Se estropean en ${caduca - dia} día${caduca - dia === 1 ? '' : 's'}: llévalas al Desolladero.`);
  return carga.piezas;
}

/// Cada día: el Desolladero desuella las piezas que le caben y las que pasan de su día se pierden.
export async function revisarPiezas(tx: Tx, saveId: string, dia: number): Promise<{ desolladas: number; perdidas: number }> {
  const piezas = await tx.almacenItem.findMany({ where: { saveId, catalogSlug: SLUG_PIEZA }, orderBy: [{ caducaEnDia: 'asc' }, { createdAt: 'asc' }] });
  if (piezas.length === 0) return { desolladas: 0, perdidas: 0 };
  let capacidad = await capacidadDesolladero(tx, saveId);
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const porEspecie = new Map<string, number>();
  const borrar: string[] = [];
  let perdidas = 0;
  for (const p of piezas) {
    if (capacidad > 0 && (p.caducaEnDia ?? Infinity) > dia && p.especieSlug) {
      porEspecie.set(p.especieSlug, (porEspecie.get(p.especieSlug) ?? 0) + 1);
      borrar.push(p.id);
      capacidad--;
    } else if ((p.caducaEnDia ?? Infinity) <= dia) {
      borrar.push(p.id);
      perdidas++;
    }
  }
  // Las de la misma especie se desuellan de una vez (el rendimiento es por animal).
  for (const [especie, n] of porEspecie) await aprovecharAnimal(tx, saveId, worldId, especie, n);
  if (borrar.length > 0) await tx.almacenItem.deleteMany({ where: { id: { in: borrar } } });
  const desolladas = borrar.length - perdidas;
  if (desolladas > 0) await avisoDelReino(tx, saveId, `El Desolladero desuella ${desolladas} pieza${desolladas === 1 ? '' : 's'}: su carne va a la comida y lo demás al Almacén.`);
  if (perdidas > 0) await avisoDelReino(tx, saveId, `Se echan a perder ${perdidas} pieza${perdidas === 1 ? '' : 's'} de caza sin desollar.`);
  return { desolladas, perdidas };
}

TRABAJOS.CAZA = {
  alLlegar: async (tx, v, dia, random) => {
    const carga = await cazarEnDestino(tx, v, dia, random);
    await tx.viajero.update({ where: { id: v.id }, data: { carga: carga as unknown as Prisma.InputJsonValue } });
    if (!v.factionId) await avisoDelReino(tx, v.saveId, carga.resumen);
  },
  alVolver: async (tx, v, dia) => {
    if (v.factionId) await descargarCazaFaccion(tx, v);
    else await descargarCaza(tx, v, dia);
  },
  // Q7/Q12: una facción solo repite con 7 días de reserva; el Reino, si el Desolladero da abasto.
  antesDeRepetir: async (tx, v) => {
    if (v.factionId) {
      if (v.miembros.reduce((s, m) => s + m.genericos, 0) < CAZADORES_POR_PARTIDA) return { ok: false, motivo: 'le faltan cazadores' };
      return (await faccionPuedeCazar(tx, v.factionId)) ? { ok: true } : { ok: false, motivo: 'le falta comida de reserva' };
    }
    return (await desolladeroDaAbasto(tx, v.saveId)) ? { ok: true } : { ok: false, motivo: 'el Desolladero no da abasto con las piezas que hay' };
  },
};

/// Q7: el Reino deja de mandar piezas si ya tiene más sin desollar de las que su Desolladero puede
/// tratar antes de que se estropeen (sin Desolladero, con cualquier pieza pendiente).
export async function desolladeroDaAbasto(tx: Tx, saveId: string): Promise<boolean> {
  const [pendientes, porDia] = await Promise.all([tx.almacenItem.count({ where: { saveId, catalogSlug: SLUG_PIEZA } }), capacidadDesolladero(tx, saveId)]);
  return pendientes <= porDia * DIAS_PIEZA;
}

/// Piezas que desuellan al día los Desolladeros del Reino.
export async function capacidadDesolladero(tx: Tx, saveId: string): Promise<number> {
  const desolladeros = await tx.building.findMany({ where: { saveId, recipeKey: 'desolladero', status: 'ACTIVO' }, select: { tier: true } });
  return desolladeros.reduce((s, b) => s + PIEZAS_DESOLLADERO_POR_ESCALON * Math.max(1, b.tier ?? 1), 0);
}
