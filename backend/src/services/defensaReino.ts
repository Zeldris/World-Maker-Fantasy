// CR-65 (hito 0.3, Fase E, paso 65b): la defensa de cada asentamiento del Reino con base de datos.
// Asentamiento = la Capital (Ayuntamiento) o un Cuartel Avanzado (Q1, X4: cada estación con sus
// módulos). Sus módulos son los edificios de defensa de su región; su guarnición, los soldados y
// vigías asignados (Q7; los que no tienen asentamiento son de la Capital, Q10). Reglas en
// `cronista/defensa.ts`.
import type { Prisma } from '@prisma/client';
import { DEFENSA_RECIPE_KEYS } from './construction.js';
import { efectoDefensa, EQUIPOS_ARMERIA, moduloDeRecipeKey, type EfectoDefensa, type ModulosAsentamiento } from './cronista/defensa.js';
import { costeDePiezas, equipoDeAlta, gastarMateriales, piezasEnCasa, talleresDelReino } from './cronista/facturaEquipo.js';
import { rolDeSubdito } from './cronista/subditos.js';
import { ownerKeyFor } from './reinoOwner.js';

type Tx = Prisma.TransactionClient;

export interface ModuloFila {
  id: string;
  modulo: string;
  nombre: string;
  escalon: number;
  golpes: number;
  caida: boolean;
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
    tx.building.findMany({ where: { saveId, recipeKey: { in: DEFENSA_RECIPE_KEYS }, status: 'ACTIVO' }, select: { id: true, recipeKey: true, name: true, tier: true, golpesDefensa: true, caida: true, equiposMilicia: true, location: { select: { region: true } } } }),
    tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true, asentamientoId: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  return nucleos.map((n) => {
    const aqui = modulos.filter((m) => m.location?.region === n.location!.region);
    const escalon = (k: string) => aqui.find((m) => m.recipeKey === k)?.tier ?? 0;
    const guarnicion = subditos
      .filter((s) => esGuarnicion(s.role) && (s.asentamientoId === n.id || (!s.asentamientoId && n.id === capital?.id)))
      .map((s) => ({ id: s.id, nombre: s.name, rol: esGuarnicion(s.role)! }));
    const m: ModulosAsentamiento = {
      empalizada: escalon('empalizada'),
      torre: escalon('torre-vigia'),
      armeria: escalon('armeria'),
      barracon: escalon('barracon'),
      empalizadaCaida: aqui.find((x) => x.recipeKey === 'empalizada')?.caida ?? false,
      vigiaEnTorre: guarnicion.some((g) => g.rol === 'vigia'),
    };
    return {
      id: n.id,
      nombre: n.name,
      capital: n.id === capital?.id,
      region: n.location!.region,
      locationId: n.location!.id,
      modulos: aqui.map((x) => ({ id: x.id, modulo: moduloDeRecipeKey(x.recipeKey)!, nombre: x.name, escalon: x.tier ?? 1, golpes: x.golpesDefensa, caida: x.caida, equiposMilicia: x.equiposMilicia })),
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
