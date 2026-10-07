import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import { ownerKeyFor } from './reinoOwner.js';
import { botinDe, repararEmpalizada, resolverAsaltoDeFondo } from './asaltos.js';
import { simularCombateDeFondo, type CombatienteFondo } from './combateDeFondo.js';
import { soldadoGenerico } from './cronista/combatientesFaccion.js';
import { TIPO_ASALTO } from './defensaReino.js';

function semilla(s: number) {
  let x = s;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}
const BASE = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

/// CR-65 (65d): un asalto de fondo contra un asentamiento.
describe('asaltos de fondo (CR-65 65d)', () => {
  it('el botín: lo que cargan, nunca más de la cuarta parte', () => {
    expect(botinDe(3, { comida: 1000, goirnos: 1000, objetos: 100 })).toEqual({ comida: 30, goirnos: 15, objetos: 6 });
    expect(botinDe(30, { comida: 100, goirnos: 40, objetos: 8 })).toEqual({ comida: 25, goirnos: 10, objetos: 2 });
  });

  it('la cobertura de la Empalizada se nota: con +5 defienden más veces', () => {
    const ganadas = (cobertura: number) => {
      let n = 0;
      for (let s = 1; s <= 60; s++) {
        const def: CombatienteFondo[] = Array.from({ length: 4 }, (_, i) => ({ ...soldadoGenerico(`d${i}`, 'D', 'A', BASE, true), bonoDefensa: cobertura }));
        const ata = Array.from({ length: 5 }, (_, i) => soldadoGenerico(`a${i}`, 'A', 'B', BASE, true));
        if (simularCombateDeFondo([...def, ...ata], semilla(s)).ganador === 'A') n++;
      }
      return n;
    };
    expect(ganadas(5)).toBeGreaterThan(ganadas(0));
  });

  describe('contra la Capital', () => {
    let saveId: string;
    let casa: string;
    let capitalId: string;
    let empalizadaId: string;

    beforeAll(async () => {
      const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
      casa = (await prisma.location.findFirstOrThrow({ where: { worldId: world.id, slug: 'hondonada-del-eco' } })).id;
      saveId = (await prisma.save.create({
        data: { userId: await getDefaultUserId(), worldId: world.id, characterName: 'Gorhorn (CR-65d)', characterArchetype: 'guerrero', characterOrigin: 'x', characterMotivation: 'x', attributes: BASE, portraitInitial: 'G' },
      })).id;
      await prisma.kingdomStats.create({ data: { saveId, ownerKey: ownerKeyFor({ saveId }), comida: 400, riqueza: 200 } });
      capitalId = (await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'ayuntamiento', name: 'Karot', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
      empalizadaId = (await prisma.building.create({ data: { saveId, locationId: casa, recipeKey: 'empalizada', name: 'una empalizada', kind: 'empalizada', description: 'x', status: 'ACTIVO', tier: 1 } })).id;
      await prisma.almacenItem.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ saveId, name: `Cosa ${i}`, description: 'x', catalogSlug: 'piedra-suelta' })) });
      for (let i = 0; i < 3; i++) await prisma.subject.create({ data: { saveId, name: `Guardia ${i}`, role: 'soldado', notes: '', pueblo: 'orcos' } });
    });
    afterAll(async () => {
      await prisma.save.delete({ where: { id: saveId } });
    });

    const asalto = (n: number) => prisma.viajero.create({ data: { saveId, tipo: TIPO_ASALTO, origenLocationId: casa, destinoLocationId: casa, ubicacionLocationId: casa, ruta: [], diaSalida: 1, ultimoDia: 1, miembros: { create: [{ genericos: n, rol: 'bandido' }] } }, include: { miembros: true } });

    it('un asalto pequeño se rechaza', async () => {
      const v = await asalto(1);
      const r = await prisma.$transaction((tx) => resolverAsaltoDeFondo(tx, saveId, v, capitalId, 2, semilla(3)));
      expect(r).toMatchObject({ defendido: true, defensores: 3, botin: null });
      expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'aguanta el asalto' } } })).toBe(1);
    });

    it('uno grande toma la Capital: saquea, la Empalizada cae y se repara', async () => {
      const v = await asalto(20);
      const r = await prisma.$transaction((tx) => resolverAsaltoDeFondo(tx, saveId, v, capitalId, 3, semilla(5)));
      expect(r!.defendido).toBe(false);
      expect(r!.botin!.comida).toBeGreaterThan(0);
      const k = await prisma.kingdomStats.findFirstOrThrow({ where: { saveId } });
      expect(k.comida).toBe(400 - r!.botin!.comida);
      expect(await prisma.almacenItem.count({ where: { saveId } })).toBe(12 - r!.botin!.objetos);
      // Escalón 1: aguanta 1 asalto perdido.
      expect(r!.empalizadaCaida).toBe(true);
      expect((await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).carga).toMatchObject({ botin: r!.botin });
      // Sin materiales no se repara; con la mitad de su coste (12), sí.
      await prisma.almacenItem.deleteMany({ where: { saveId } });
      expect(await prisma.$transaction((tx) => repararEmpalizada(tx, saveId, empalizadaId))).toMatchObject({ ok: false });
      const world = await prisma.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true } });
      const recurso = await prisma.itemCatalog.findFirstOrThrow({ where: { worldId: world.worldId, tipo: 'RECURSO' }, select: { slug: true } });
      await prisma.almacenItem.createMany({ data: Array.from({ length: 12 }, () => ({ saveId, name: 'Material', description: 'x', catalogSlug: recurso.slug })) });
      expect(await prisma.$transaction((tx) => repararEmpalizada(tx, saveId, empalizadaId))).toEqual({ ok: true });
      expect(await prisma.building.findUniqueOrThrow({ where: { id: empalizadaId } })).toMatchObject({ caida: false, golpesDefensa: 0 });
    });

    it('un asalto que llega a la Capital se resuelve solo con el avance de los viajeros', async () => {
      const { avanzarViajeros } = await import('./viajeros.js');
      const v = await asalto(1);
      await prisma.viajero.update({ where: { id: v.id }, data: { estado: 'TRABAJANDO', ultimoDia: 9 } });
      await avanzarViajeros(prisma, saveId, 10, semilla(7));
      expect(await prisma.logEntry.count({ where: { saveId, text: { contains: 'aguanta el asalto' } } })).toBe(2);
      expect((await prisma.viajero.findUniqueOrThrow({ where: { id: v.id } })).estado).not.toBe('TRABAJANDO');
    });
  });
});
