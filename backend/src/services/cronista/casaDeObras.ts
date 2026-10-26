// Construcción por oficio y Casa de obras (diseño aprobado 2026-10-21; P277, P282, P284).
//
// - La Casa de obras tiene 3 niveles: cubre obras de tier 1-3, 4-6 y 7-9, con 1, 2 y 3 plazas.
// - Sus trabajadores son súbditos con la tarea «constructor». Cada día, las obras de la cola, en
//   orden, toman a los constructores libres, el de más nivel primero.
// - Decisión de la usuaria 2026-10-22 (X4 y Manor Lords): el nivel del Ayuntamiento abre los tiers
//   (`ayuntamientoNivelMinimoPorTier`, construction.ts) y el del constructor solo da velocidad
//   (`avanceDiario`): cualquier constructor trabaja cualquier obra que la Casa cubra.
// - Una obra de tier N son N días de trabajo (una reparación, 1); un constructor de nivel n hace
//   `avanceDiario(n)` al día. Gasta del Almacén los materiales exactos de su receta según avanza, al
//   estilo de X4 (`cuotaDelDia`). Si un día falta alguno, la obra se para ese día con un aviso y no
//   gasta nada, sin perder lo avanzado. Una reparación sigue gastando materiales genéricos
//   (`costeDeReparar`).
// - Una obra por encima de lo que cubre la Casa lleva el aviso «🔒N». Una reparación no: se repara
//   cualquier edificio dañado, sea del tier que sea.
// - Al estilo de X4 (la estación trabaja en lo que tiene recursos), una obra sin materiales ese día
//   no se queda el constructor: pasa a la siguiente de la cola que sí pueda avanzar.
// - Al terminar se revalida con las reglas de siempre (`computeBuildBlockedReason`) y se levanta
//   (o se mejora en el sitio, `mejorarEnSitio`); una reparación usa `repararEdificio` (asaltos.ts).
// - El constructor sube de nivel construyendo, con la misma XP por tier que el oficio del personaje.
import type { Prisma } from '@prisma/client';
import {
  CONSTRUCTION_RECIPES,
  buildingTierFor,
  computeBuildBlockedReason,
  mejorarEnSitio,
  recetaDeEdificio,
  type ConstructionRecipe,
} from '../construction.js';
import { repararEdificio } from '../asaltos.js';
import { baseNameOf, planConsumption, totalQuantity, type CatalogLookup, type InventoryRowLike } from '../ingredients.js';
import { professionLevelForXp, xpForCraftSuccess } from '../professionProgress.js';
import { registrarSuceso } from './sucesos.js';
import { avisarEnReino, esAdultoSubdito, rolDeSubdito } from './subditos.js';
import { slugify } from '../../lib/slugify.js';

type Tx = Prisma.TransactionClient;

export const CASA_DE_OBRAS_KEY = 'casa-de-obras';

/// Tier máximo que cubre una Casa de obras de ese nivel (1-3, 4-6, 7-9).
export function tierMaximoDeCasa(nivel: number): number {
  return Math.min(3, Math.max(1, nivel)) * 3;
}

/// Plazas de constructor de una Casa de obras de ese nivel (1, 2, 3).
export function plazasDeCasa(nivel: number): number {
  return Math.min(3, Math.max(1, nivel));
}

/// Total de materiales de una receta, en unidades.
export function materialesDeReceta(recipe: ConstructionRecipe): number {
  return recipe.requirements.reduce((s, q) => s + q.cantidad, 0);
}

/// Velocidad del constructor (decisión de la usuaria 2026-10-22): +10 % de trabajo al día por cada
/// nivel por encima de 1 (nivel 1: 1 día de obra al día; nivel 6: 1,5; nivel 9: 1,8).
export const VELOCIDAD_POR_NIVEL_CONSTRUCTOR = 0.1;

/// Días de obra que hace en una jornada un constructor de ese nivel.
export function avanceDiario(nivelConstructor: number): number {
  return 1 + VELOCIDAD_POR_NIVEL_CONSTRUCTOR * (Math.max(1, nivelConstructor) - 1);
}

/// El avance se guarda con dos decimales para que sumar 1,1 cada día no acumule error.
const redondearAvance = (x: number) => Math.round(x * 100) / 100;

/// Puro: unidades de un material que se gastan al pasar una obra de `dias` días de `diasHechos` a
/// `diasHechos + avance`. Lo acumulado hasta el avance p es ceil(cantidad·p/dias), así que al acabar
/// se llega justo a la cantidad de la receta.
export function cuotaDelDia(cantidad: number, dias: number, diasHechos: number, avance = 1): number {
  const d = Math.max(1, dias);
  const acumulado = (n: number) => Math.ceil((cantidad * Math.min(n, d)) / d - 1e-9);
  return acumulado(redondearAvance(diasHechos + avance)) - acumulado(diasHechos);
}

/// Gasta del Almacén la cuota de hoy de cada material de la receta (por slug exacto o por categoría
/// del catálogo). Una fila apilada («Leña (12)») cuenta por su cantidad y, si sobra, se queda con el
/// resto. Todo o nada: si falta alguno, no toca ninguna fila y devuelve qué falta.
async function gastarCuotaDelDia(
  tx: Tx,
  saveId: string,
  recipe: ConstructionRecipe,
  dias: number,
  diasHechos: number,
  avance: number,
): Promise<{ ok: true; gastadas: number } | { ok: false; faltan: string[] }> {
  const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  const catalogo = await tx.itemCatalog.findMany({ where: { worldId: save.worldId }, select: { slug: true, tipo: true, category: true } });
  const catalogBySlug = new Map<string, CatalogLookup>(catalogo.map((c) => [c.slug, { tipo: c.tipo, category: c.category }]));
  let libres: InventoryRowLike[] = await tx.almacenItem.findMany({ where: { saveId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, catalogSlug: true } });
  const borrar: string[] = [];
  const renombrar = new Map<string, string>();
  const faltan: string[] = [];
  let gastadas = 0;
  for (const req of recipe.requirements) {
    const cantidad = cuotaDelDia(req.cantidad, dias, diasHechos, avance);
    if (cantidad <= 0) continue;
    const hoy = { ...req, cantidad };
    const tienes = totalQuantity(libres, hoy, catalogBySlug);
    if (tienes < cantidad) {
      faltan.push(`${cantidad - tienes} de ${req.label}`);
      continue;
    }
    const plan = planConsumption(libres, hoy, catalogBySlug);
    const usadas = new Set(plan.deleteIds);
    borrar.push(...usadas);
    renombrar.forEach((_, id) => usadas.has(id) && renombrar.delete(id));
    libres = libres.filter((r) => !usadas.has(r.id));
    if (plan.updateRemainder) {
      const { id, newQuantity } = plan.updateRemainder;
      const fila = libres.find((r) => r.id === id)!;
      fila.name = newQuantity > 1 ? `${baseNameOf(fila.name)} (${newQuantity})` : baseNameOf(fila.name);
      renombrar.set(id, fila.name);
    }
    gastadas += cantidad;
  }
  if (faltan.length > 0) return { ok: false, faltan };
  if (borrar.length > 0) await tx.almacenItem.deleteMany({ where: { id: { in: borrar } } });
  for (const [id, name] of renombrar) await tx.almacenItem.update({ where: { id }, data: { name } });
  return { ok: true, gastadas };
}

export interface ConstructorParaReparto {
  id: string;
  nivelConstructor: number;
}
export interface ObraParaReparto {
  id: string;
  tier: number;
  /// Una reparación no pasa por el tope de tier de la Casa.
  tipo?: string;
}
export type Reparto = Map<string, { constructorId: string } | { aviso: string }>;

/// Puro: por qué una obra no puede ni intentarse hoy (🔒 por nivel de Casa, o sin constructores).
function bloqueoDeObra(o: ObraParaReparto, hayConstructores: boolean, nivelCasa: number): string | null {
  const tope = tierMaximoDeCasa(nivelCasa);
  if (o.tipo !== 'REPARAR' && o.tier > tope) return `🔒${o.tier}: la Casa de obras de nivel ${nivelCasa} llega hasta nivel ${tope}`;
  if (!hayConstructores) return 'Sin constructores: pon a algún súbdito trabajador con la tarea «Constructor».';
  return null;
}
const AVISO_ESPERANDO_TURNO = 'Esperando turno: sus constructores están en otras obras.';

/// Reparto de una jornada: la cola en orden, cada obra prueba con el constructor libre más rápido y,
/// solo si `trabajar` dice que trabajó, se lo queda; si no (le faltan materiales), el constructor pasa
/// a la siguiente obra. Devuelve el aviso de cada obra que no se intentó.
async function repartirJornada<O extends ObraParaReparto, C extends ConstructorParaReparto>(
  obras: O[],
  constructores: C[],
  nivelCasa: number,
  trabajar: (o: O, c: C) => Promise<boolean>,
): Promise<Map<string, string>> {
  const libres = [...constructores].sort((a, b) => b.nivelConstructor - a.nivelConstructor);
  const avisos = new Map<string, string>();
  for (const o of obras) {
    const bloqueo = bloqueoDeObra(o, constructores.length > 0, nivelCasa);
    if (bloqueo) {
      avisos.set(o.id, bloqueo);
      continue;
    }
    const c = libres[0];
    if (!c) {
      avisos.set(o.id, AVISO_ESPERANDO_TURNO);
      continue;
    }
    if (await trabajar(o, c)) libres.shift();
  }
  return avisos;
}

/// Puro: qué constructor trabaja hoy cada obra (cola en orden), o por qué no avanza, si todas tienen
/// material. El nivel del constructor no bloquea ningún tier: la primera obra se lleva al más rápido.
export function repartirObras(obras: ObraParaReparto[], constructores: ConstructorParaReparto[], nivelCasa: number): Reparto {
  const libres = [...constructores].sort((a, b) => b.nivelConstructor - a.nivelConstructor);
  const r: Reparto = new Map();
  for (const o of obras) {
    const bloqueo = bloqueoDeObra(o, constructores.length > 0, nivelCasa);
    const c = bloqueo ? undefined : libres.shift();
    r.set(o.id, c ? { constructorId: c.id } : { aviso: bloqueo ?? AVISO_ESPERANDO_TURNO });
  }
  return r;
}

async function casaDelReino(tx: Tx, saveId: string): Promise<{ id: string; nivel: number } | null> {
  const casa = await tx.building.findFirst({ where: { saveId, recipeKey: CASA_DE_OBRAS_KEY, status: 'ACTIVO' }, select: { id: true, tier: true } });
  return casa ? { id: casa.id, nivel: casa.tier ?? 1 } : null;
}

async function ayuntamientoDelReino(tx: Tx, saveId: string) {
  return tx.building.findFirst({
    where: { saveId, recipeKey: 'ayuntamiento', status: { in: ['ACTIVO', 'DANADO'] } },
    select: { id: true, locationId: true, territoryId: true, x: true, y: true, location: { select: { region: true } } },
  });
}

/// La tarea del súbdito, en una constante: `tarea: '…'` literal es la marca de una tarea de la IA (QA-137).
const TAREA_CONSTRUCTOR = 'constructor';

/// Súbditos constructores que trabajan hoy en la Casa: adultos, trabajadores, fuera de la milicia;
/// los de más nivel primero, hasta las plazas de la Casa.
export async function constructoresDeLaCasa(tx: Tx, saveId: string, plazas: number, ahora: number) {
  const subditos = await tx.subject.findMany({
    where: { saveId, estado: 'ACTIVO', tarea: TAREA_CONSTRUCTOR, enMilicia: false },
    select: { id: true, name: true, role: true, pueblo: true, nacidoEn: true, nivelConstructor: true, xpConstructor: true },
    orderBy: [{ nivelConstructor: 'desc' }, { createdAt: 'asc' }],
  });
  return subditos.filter((s) => rolDeSubdito(s.role) === 'trabajador' && esAdultoSubdito(s, ahora)).slice(0, plazas);
}

/// Revalida una obra con las reglas de siempre, como si la levantara la Casa junto al Ayuntamiento.
async function motivoDeBloqueo(tx: Tx, saveId: string, recipe: ConstructionRecipe): Promise<string | null> {
  const ayto = await ayuntamientoDelReino(tx, saveId);
  if (!ayto?.locationId) return 'necesita un Ayuntamiento en pie';
  const { worldId } = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
  return computeBuildBlockedReason({
    db: tx,
    saveId,
    worldId,
    buildRecipe: recipe,
    activeRegion: ayto.location?.region ?? null,
    currentLocationRecord: { id: ayto.locationId },
    quien: 'casa-de-obras',
  });
}

async function siguienteOrden(tx: Tx, saveId: string): Promise<number> {
  const ultima = await tx.obraCola.findFirst({ where: { saveId }, orderBy: { orden: 'desc' }, select: { orden: true } });
  return (ultima?.orden ?? 0) + 1;
}

/// Encarga una obra a la Casa de obras (al final de la cola).
export async function encargarObra(tx: Tx, saveId: string, recipeKey: string): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const recipe = CONSTRUCTION_RECIPES.find((r) => r.key === recipeKey);
  if (!recipe) return { ok: false, motivo: 'No hay ninguna obra así.' };
  if (recipe.key === 'ayuntamiento') return { ok: false, motivo: 'El Ayuntamiento lo funda el personaje en persona.' };
  if (!(await casaDelReino(tx, saveId))) return { ok: false, motivo: 'Hace falta una Casa de obras en pie (Reino › Edificios).' };
  const enCola = await tx.obraCola.findMany({ where: { saveId, tipo: 'CONSTRUIR' }, select: { recipeKey: true } });
  if (enCola.some((o) => o.recipeKey === recipeKey)) return { ok: false, motivo: `${recipe.name} ya está en la cola.` };
  // Una mejora espera a que su base esté levantada, y dos eslabones de la misma cadena no van a la vez.
  if (recipe.upgradesRecipeKey) {
    const recetaEnCola = (o: { recipeKey: string | null }) => CONSTRUCTION_RECIPES.find((r) => r.key === o.recipeKey);
    // Con una base ya en pie (p. ej. una segunda Empalizada en la cola), la mejora va sobre la levantada.
    const base = enCola.find((o) => o.recipeKey === recipe.upgradesRecipeKey);
    const enPie = base ? await tx.building.count({ where: { saveId, recipeKey: recipe.upgradesRecipeKey, status: 'ACTIVO' } }) : 0;
    if (base && enPie === 0) return { ok: false, motivo: `${recipe.name} mejora ${recetaEnCola(base)?.name ?? 'un edificio'}, que aún está en la cola: encárgala cuando esté levantado.` };
    const hermana = enCola.map(recetaEnCola).find((r) => r?.upgradesRecipeKey === recipe.upgradesRecipeKey);
    if (hermana) return { ok: false, motivo: `${recipe.name} mejora el mismo edificio que ${hermana.name}, que ya está en la cola: espera a que termine.` };
  }
  const motivo = await motivoDeBloqueo(tx, saveId, recipe);
  if (motivo) return { ok: false, motivo: `No se puede encargar ${recipe.name}: ${motivo}.` };
  const obra = await tx.obraCola.create({
    data: { saveId, orden: await siguienteOrden(tx, saveId), tipo: 'CONSTRUIR', recipeKey, tier: recipe.tier, dias: recipe.tier },
  });
  return { ok: true, id: obra.id };
}

/// Encarga la reparación de un edificio dañado (o una Empalizada caída) a la Casa de obras.
export async function encargarReparacion(tx: Tx, saveId: string, buildingId: string): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const b = await tx.building.findFirst({ where: { id: buildingId, saveId }, select: { name: true, recipeKey: true, tier: true, status: true, caida: true } });
  if (!b) return { ok: false, motivo: 'No tienes ese edificio.' };
  if (b.status !== 'DANADO' && !b.caida) return { ok: false, motivo: `${b.name} está en pie.` };
  if (!(await casaDelReino(tx, saveId))) return { ok: false, motivo: 'Hace falta una Casa de obras en pie (Reino › Edificios).' };
  if (await tx.obraCola.findFirst({ where: { saveId, tipo: 'REPARAR', buildingId } })) return { ok: false, motivo: `${b.name} ya está en la cola.` };
  // El tier solo da la XP del constructor: una reparación no pasa por el tope de la Casa (repartirObras).
  const tier = (b.recipeKey ? recetaDeEdificio(b.recipeKey, b.tier)?.tier : undefined) ?? 1;
  const obra = await tx.obraCola.create({ data: { saveId, orden: await siguienteOrden(tx, saveId), tipo: 'REPARAR', buildingId, tier, dias: 1 } });
  return { ok: true, id: obra.id };
}

export async function quitarObra(tx: Tx, saveId: string, obraId: string): Promise<boolean> {
  return (await tx.obraCola.deleteMany({ where: { id: obraId, saveId } })).count > 0;
}

/// Reordena la cola: `ids` en el orden nuevo (las que falten van detrás, en su orden de antes).
export async function reordenarCola(tx: Tx, saveId: string, ids: string[]): Promise<void> {
  const cola = await tx.obraCola.findMany({ where: { saveId }, orderBy: { orden: 'asc' }, select: { id: true } });
  const conocidas = new Set(cola.map((o) => o.id));
  const pedidas = ids.filter((id, i) => conocidas.has(id) && ids.indexOf(id) === i);
  const resto = cola.map((o) => o.id).filter((id) => !pedidas.includes(id));
  const orden = [...pedidas, ...resto];
  for (let i = 0; i < orden.length; i++) await tx.obraCola.update({ where: { id: orden[i] }, data: { orden: i + 1 } });
}

/// Para la vista (Reino › Edificios): la Casa, sus constructores y la cola con su aviso.
export async function verCasaDeObras(tx: Tx, saveId: string, ahora: number) {
  const casa = await casaDelReino(tx, saveId);
  const nivel = casa?.nivel ?? 0;
  const constructores = casa ? await constructoresDeLaCasa(tx, saveId, plazasDeCasa(nivel), ahora) : [];
  const cola = await tx.obraCola.findMany({ where: { saveId }, orderBy: { orden: 'asc' } });
  const edificios = await tx.building.findMany({ where: { saveId, id: { in: cola.map((o) => o.buildingId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nombrePor = new Map(edificios.map((b) => [b.id, b.name]));
  return {
    casa: casa ? { nivel, tierMaximo: tierMaximoDeCasa(nivel), plazas: plazasDeCasa(nivel) } : null,
    constructores: constructores.map((c) => ({ id: c.id, name: c.name, nivel: c.nivelConstructor })),
    cola: cola.map((o) => {
      const recipe = o.recipeKey ? CONSTRUCTION_RECIPES.find((r) => r.key === o.recipeKey) : undefined;
      return {
        id: o.id,
        tipo: o.tipo as 'CONSTRUIR' | 'REPARAR',
        nombre: o.tipo === 'REPARAR' ? `Reparar ${nombrePor.get(o.buildingId ?? '') ?? 'edificio'}` : recipe?.name ?? o.recipeKey ?? 'obra',
        tier: o.tier,
        dias: o.dias,
        diasHechos: o.diasHechos,
        aviso: o.aviso,
      };
    }),
  };
}

/// XP por el trabajo hecho: la de la obra entera repartida por días de obra (`avance` de `dias`).
async function darXp(tx: Tx, c: { id: string; xpConstructor: number; nivelConstructor: number }, tier: number, dias: number, avance = 1) {
  const xp = c.xpConstructor + Math.ceil((xpForCraftSuccess(tier) * avance) / Math.max(1, dias) - 1e-9);
  const nivel = Math.max(c.nivelConstructor, professionLevelForXp(xp));
  await tx.subject.update({ where: { id: c.id }, data: { xpConstructor: xp, nivelConstructor: nivel } });
}

/// Levanta (o mejora en el sitio) la obra terminada. Devuelve el motivo si ya no se puede.
async function terminarObra(tx: Tx, saveId: string, recipe: ConstructionRecipe, constructorId: string | null, ahora: number): Promise<string | null> {
  const motivo = await motivoDeBloqueo(tx, saveId, recipe);
  if (motivo) return motivo;
  const ayto = (await ayuntamientoDelReino(tx, saveId))!;
  const region = ayto.location?.region ?? null;
  let edificioId: string;
  if (recipe.upgradesRecipeKey) {
    // `motivoDeBloqueo` ya exige el edificio que se mejora; si aun así no aparece, la obra no se da
    // por terminada: se queda en la cola con su aviso (y lo gastado) hasta que se pueda aplicar.
    const mejorado = await mejorarEnSitio(tx, saveId, recipe, region);
    if (!mejorado) return 'no está el edificio que mejora';
    edificioId = mejorado.id;
  } else {
    const creado = await tx.building.create({
      data: {
        saveId,
        locationId: ayto.locationId ?? undefined,
        territoryId: ayto.territoryId ?? undefined,
        recipeKey: recipe.key,
        name: recipe.name,
        kind: recipe.key,
        description: recipe.description,
        status: 'ACTIVO',
        tier: buildingTierFor(recipe) ?? undefined,
        x: ayto.x ?? undefined,
        y: ayto.y ?? undefined,
      },
    });
    edificioId = creado.id;
  }
  await registrarSuceso(tx, {
    saveId,
    tipo: 'EDIFICIO_CONSTRUIDO',
    fictionalMinutes: ahora,
    regionSlug: region ? slugify(region) : null,
    locationId: ayto.locationId,
    origen: 'MOTOR',
    actores: [
      ...(constructorId ? [{ entidadTipo: 'SUBDITO' as const, entidadId: constructorId, papel: 'AUTOR' as const }] : []),
      { entidadTipo: 'EDIFICIO', entidadId: edificioId, papel: 'BENEFICIARIO' },
    ],
    datos: { edificio: recipe.name },
  });
  await avisarEnReino(tx, saveId, `La Casa de obras termina ${recipe.name}.`, ahora);
  return null;
}

/// Una jornada de la Casa de obras (avanceDiario.ts, una vez por día simulado).
export async function avanzarCasaDeObras(tx: Tx, saveId: string, ahora: number): Promise<{ avanzadas: number; terminadas: number }> {
  const res = { avanzadas: 0, terminadas: 0 };
  const cola = await tx.obraCola.findMany({ where: { saveId }, orderBy: { orden: 'asc' } });
  if (cola.length === 0) return res;
  const casa = await casaDelReino(tx, saveId);
  if (!casa) {
    await tx.obraCola.updateMany({ where: { saveId }, data: { aviso: 'La Casa de obras no está en pie.' } });
    return res;
  }
  // Una obra con todos sus días hechos que no se pudo levantar ya no ocupa constructor: se reintenta
  // levantar cada día y, mientras no se pueda, se queda con su aviso.
  const acabadas = cola.filter((o) => o.tipo === 'CONSTRUIR' && o.diasHechos >= o.dias);
  for (const o of acabadas) {
    const recipe = CONSTRUCTION_RECIPES.find((x) => x.key === o.recipeKey);
    const motivo = recipe ? await terminarObra(tx, saveId, recipe, null, ahora) : null;
    if (motivo) {
      const aviso = `Terminada, pero no se puede levantar: ${motivo}.`;
      if (o.aviso !== aviso) await tx.obraCola.update({ where: { id: o.id }, data: { aviso } });
      continue;
    }
    await tx.obraCola.delete({ where: { id: o.id } });
    if (recipe) res.terminadas++;
  }
  const pendientes = cola.filter((o) => !acabadas.includes(o));
  const constructores = await constructoresDeLaCasa(tx, saveId, plazasDeCasa(casa.nivel), ahora);
  const ponerAviso = async (o: (typeof cola)[number], aviso: string | null) => {
    if (o.aviso !== aviso) await tx.obraCola.update({ where: { id: o.id }, data: { aviso } });
  };
  /// Trabaja una obra con ese constructor; true si lo ha ocupado la jornada.
  const trabajar = async (o: (typeof cola)[number], c: (typeof constructores)[number]): Promise<boolean> => {
    if (o.tipo === 'REPARAR') {
      const rep = o.buildingId ? await repararEdificio(tx, saveId, o.buildingId) : { ok: false as const, motivo: 'Ese edificio ya no existe.', sinArreglo: true };
      if (rep.ok || rep.sinArreglo) {
        await tx.obraCola.delete({ where: { id: o.id } });
        if (!rep.ok) return false;
        await darXp(tx, c, o.tier, o.dias);
        res.terminadas++;
        return true;
      }
      await ponerAviso(o, rep.motivo);
      return false;
    }
    const recipe = CONSTRUCTION_RECIPES.find((x) => x.key === o.recipeKey);
    if (!recipe) {
      await tx.obraCola.delete({ where: { id: o.id } });
      return false;
    }
    const avance = Math.min(avanceDiario(c.nivelConstructor), o.dias - o.diasHechos);
    const gasto = await gastarCuotaDelDia(tx, saveId, recipe, o.dias, o.diasHechos, avance);
    if (!gasto.ok) {
      await ponerAviso(o, `Faltan materiales en el Almacén: ${gasto.faltan.join(', ')}.`);
      return false;
    }
    const hechos = Math.min(o.dias, redondearAvance(o.diasHechos + avance));
    await tx.obraCola.update({ where: { id: o.id }, data: { diasHechos: hechos, gastados: { increment: gasto.gastadas }, aviso: null } });
    await darXp(tx, c, o.tier, o.dias, avance);
    res.avanzadas++;
    if (hechos < o.dias) return true;
    const motivo = await terminarObra(tx, saveId, recipe, c.id, ahora);
    if (motivo) {
      await tx.obraCola.update({ where: { id: o.id }, data: { aviso: `Terminada, pero no se puede levantar: ${motivo}.` } });
      return true;
    }
    await tx.obraCola.delete({ where: { id: o.id } });
    res.terminadas++;
    return true;
  };
  const avisos = await repartirJornada(pendientes, constructores, casa.nivel, trabajar);
  for (const o of pendientes) {
    const aviso = avisos.get(o.id);
    if (aviso) await ponerAviso(o, aviso);
  }
  return res;
}
