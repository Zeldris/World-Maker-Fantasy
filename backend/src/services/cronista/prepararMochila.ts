// P367 (2026-11-03): paso de preparación `mochila-libre[:<n>]`, SOLO con funciones del juego (QA-151): deja `n` unidades de
// hueco en la mochila depositando objetos sueltos en el Almacén del Reino con la función del botón «Depositar»
// (`almacenDeposito.ts`), las filas más grandes primero. Es lo contrario de un escenario «inventario lleno» (170/37):
// con la mochila libre el juego deja recoger, recolectar y comprar.
import type { PrismaClient } from '@prisma/client';
import { effectiveInventorySlotsBonus } from '../equipment.js';
import { quantityOf } from '../ingredients.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../inventoryCapacity.js';
import { depositarEnAlmacen } from './almacenDeposito.js';

export const HUECO_POR_DEFECTO = 10;

export type ResultadoMochila = { capacidad: number; antes: number; despues: number; hueco: number; depositados: number; sinDepositar: { nombre: string; motivo: string }[] } | { error: string };

export async function dejarMochilaLibre(prisma: PrismaClient, { saveId, hueco }: { saveId: string; hueco: number | null }): Promise<ResultadoMochila> {
  const n = hueco ?? HUECO_POR_DEFECTO;
  const partida = await prisma.save.findUnique({ where: { id: saveId }, select: { attributes: true } });
  if (!partida) return { error: `mochila-libre: no hay partida ${saveId}.` };
  const a = partida.attributes as { fuerza: number; constitucion: number };
  const medir = async () => {
    const [items, equipados] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { saveId }, select: { name: true } }),
      prisma.inventoryItem.findMany({ where: { saveId, slot: { not: null } }, select: { statBonuses: true } }),
    ]);
    return { carga: totalInventoryUnits(items), capacidad: inventoryCapacityFor(a.fuerza, a.constitucion, effectiveInventorySlotsBonus(equipados)) };
  };
  const inicio = await medir();
  if (n > inicio.capacidad) return { error: `mochila-libre: la capacidad es ${inicio.capacidad}: no se pueden dejar ${n} libres.` };
  const objetivo = inicio.capacidad - n;
  const sueltos = (await prisma.inventoryItem.findMany({ where: { saveId, slot: null, companionId: null, subjectId: null }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } }))
    .sort((x, y) => quantityOf(y.name) - quantityOf(x.name));
  let carga = inicio.carga;
  let depositados = 0;
  const sinDepositar: { nombre: string; motivo: string }[] = [];
  for (const it of sueltos) {
    if (carga <= objetivo) break;
    const r = await depositarEnAlmacen(prisma, saveId, it.id);
    if (r.ok) { depositados++; carga -= quantityOf(it.name); } else sinDepositar.push({ nombre: it.name, motivo: r.error });
  }
  const fin = await medir();
  if (fin.carga > objetivo) return { error: `mochila-libre: solo se llegó a ${fin.carga}/${fin.capacidad} (hacían falta ${n} libres): ${sinDepositar.length ? `el Almacén no admite ${sinDepositar.length} objeto(s), p. ej. «${sinDepositar[0]!.nombre}»: ${sinDepositar[0]!.motivo}` : 'no hay más objetos sueltos que depositar'}.` };
  return { capacidad: fin.capacidad, antes: inicio.carga, despues: fin.carga, hueco: fin.capacidad - fin.carga, depositados, sinDepositar };
}
