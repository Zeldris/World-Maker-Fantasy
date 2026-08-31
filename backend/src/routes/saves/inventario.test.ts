import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (2026-07-30, petición explícita: "categorizarlos por ranura para que no pueda
/// poner un casco en los pies") — ranura compatible (`equipSlot`/`equipSlotFamily`) es la parte
/// real y nueva de esta ruta; requisitos ya se dejan pasar (sin atributos configurados, nunca
/// hay shortfall) para aislar justo lo que se está probando.
const findFirstInventoryItem = vi.fn();
const findUniqueSave = vi.fn();
const findUniqueItemCatalog = vi.fn();
const updateInventoryItem = vi.fn();
const updateManyInventoryItem = vi.fn();
const findManyInventoryItem = vi.fn();
const transaction = vi.fn();

vi.mock('../../services/dynamicAbilities.js', () => ({
  resolveEquippedWeaponSlots: vi.fn(() => Promise.resolve([])),
  syncDynamicCombatAbilities: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    inventoryItem: {
      findFirst: (...args: unknown[]) => findFirstInventoryItem(...args),
      update: (...args: unknown[]) => updateInventoryItem(...args),
      updateMany: (...args: unknown[]) => updateManyInventoryItem(...args),
      findMany: (...args: unknown[]) => findManyInventoryItem(...args),
    },
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
    },
    itemCatalog: {
      findUnique: (...args: unknown[]) => findUniqueItemCatalog(...args),
    },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const { inventarioRoutes } = await import('./inventario.js');

async function buildApp() {
  const app = Fastify();
  await app.register(inventarioRoutes);
  return app;
}

describe('PATCH /saves/:id/inventario/:itemId — ranura compatible', () => {
  beforeEach(() => {
    findFirstInventoryItem.mockReset();
    findUniqueSave.mockReset();
    findUniqueItemCatalog.mockReset();
    updateInventoryItem.mockReset();
    updateManyInventoryItem.mockReset();
    findManyInventoryItem.mockReset().mockResolvedValue([]);
    transaction.mockReset().mockImplementation((ops: unknown[]) => Promise.all(ops));
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1 });
  });

  it('rechaza equipar un casco en la ranura de botas', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Yelmo de patrulla goirntes', catalogSlug: 'yelmo-patrulla-goirntes', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'CASCO', requisitos: null });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'BOTAS' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no se puede equipar ahí/);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('acepta un arma en CUALQUIERA de las dos manos (familia ARMA_PRINCIPAL/ARMA_SECUNDARIA)', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Cuchillo corto', catalogSlug: 'cuchillo-corto', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_SECUNDARIA' } });

    expect(res.statusCode).toBe(200);
    expect(updateInventoryItem).toHaveBeenCalledWith({ where: { id: 'item1' }, data: { slot: 'ARMA_SECUNDARIA' } });
  });

  it('acepta un anillo en CUALQUIERA de los dos dedos (familia ANILLO_1/ANILLO_2)', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Anillo de sello de la Concordia', catalogSlug: 'sello-anular-concordia', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ANILLO_1', requisitos: null });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ANILLO_2' } });

    expect(res.statusCode).toBe(200);
  });

  it('rechaza un objeto con catálogo real pero SIN equipSlot asignado (no es equipable en absoluto)', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Cataplasma de salvia del polvo', catalogSlug: 'cataplasma-salvia-polvo', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: null, requisitos: null });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'CAMISA' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no es un objeto equipable/);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('deja pasar un objeto narrativo SIN catalogSlug (inventado por el modelo, sin ninguna fila de catálogo que consultar)', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Recuerdo improvisado', catalogSlug: null, slot: null });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'COSMETICO_CINTURA' } });

    expect(res.statusCode).toBe(200);
    expect(findUniqueItemCatalog).not.toHaveBeenCalled();
  });

  it('rechaza un slot que no es ningún valor real de EquipSlot, incluso sin catalogSlug que consultar (auditoría 2026-08-06)', async () => {
    // Bug real: antes solo se comprobaba null-o-string, nunca contra el enum — un objeto
    // narrativo sin catalogSlug se saltaba entera la validación de ranura y llegaba un string
    // cualquiera al `update` de Prisma, reventando con un 500 genérico en vez de un 400 claro.
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Recuerdo improvisado', catalogSlug: null, slot: null });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'NO_ES_UNA_RANURA_REAL' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Ranura no válida/);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('desequipar (slot: null) siempre está permitido, sin comprobar ranura', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Yelmo de patrulla goirntes', catalogSlug: 'yelmo-patrulla-goirntes', slot: 'CASCO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: null } });

    expect(res.statusCode).toBe(200);
    expect(findUniqueItemCatalog).not.toHaveBeenCalled();
  });

  // Bug real (auditoría de bugs, 2026-08-21 + decisión explícita al cerrar la ronda de preguntas
  // abiertas): esta ruta nunca comprobaba `save.endedAt` — con la partida ya terminada por muerte
  // definitiva, seguía dejando equipar/desequipar objetos.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Yelmo de patrulla goirntes', catalogSlug: 'yelmo-patrulla-goirntes', slot: null });
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'CASCO' } });

    expect(res.statusCode).toBe(409);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });
});

// Restricción de armas por clase (2026-08-24, Grupo 3 § Sistema de clases, ver weaponPoolFor en
// weaponAbilities.ts) — solo Guerrero/Cazador/Chamán tienen pool construido.
describe('PATCH /saves/:id/inventario/:itemId — restricción de armas por clase', () => {
  beforeEach(() => {
    findFirstInventoryItem.mockReset();
    findUniqueSave.mockReset();
    findUniqueItemCatalog.mockReset();
    updateInventoryItem.mockReset();
    updateManyInventoryItem.mockReset();
    findManyInventoryItem.mockReset().mockResolvedValue([]);
    transaction.mockReset().mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  it('un Guerrero no puede equipar un arco (fuera de su pool cuerpo a cuerpo)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'GUERRERO', especializacion: 'BERSERKER' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Arco corto', catalogSlug: 'arco-corto', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null, tipoArma: 'ARCO_CORTO' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_PRINCIPAL' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no encaja con tu clase/);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('un Guerrero SÍ puede equipar un hacha (dentro de su pool)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'GUERRERO', especializacion: 'BERSERKER' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Hacha de guerra orca', catalogSlug: 'hacha-guerra-orca', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null, tipoArma: 'HACHA_1_MANO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_PRINCIPAL' } });

    expect(res.statusCode).toBe(200);
  });

  it('un Cazador Tirador solo puede equipar arcos, no un hacha', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 12, clase: 'CAZADOR', especializacion: 'TIRADOR' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Hacha de guerra orca', catalogSlug: 'hacha-guerra-orca', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null, tipoArma: 'HACHA_1_MANO' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_PRINCIPAL' } });

    expect(res.statusCode).toBe(400);
  });

  it('un Cazador SIN especialización elegida todavía no tiene restricción de armas (puede equipar cualquier cosa)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'CAZADOR', especializacion: null });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Arco corto', catalogSlug: 'arco-corto', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null, tipoArma: 'ARCO_CORTO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_PRINCIPAL' } });

    expect(res.statusCode).toBe(200);
  });

  it('una clase fuera de las 3 construidas no tiene restricción de armas todavía', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'ASESINO', especializacion: 'MAESTRO_ASESINO' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Arco corto', catalogSlug: 'arco-corto', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMA_PRINCIPAL', requisitos: null, tipoArma: 'ARCO_CORTO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMA_PRINCIPAL' } });

    expect(res.statusCode).toBe(200);
  });

  it('la restricción no toca objetos fuera de las manos (un casco pasa igual)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'GUERRERO', especializacion: 'BERSERKER' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Yelmo de patrulla goirntes', catalogSlug: 'yelmo-patrulla-goirntes', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'CASCO', requisitos: null });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'CASCO' } });

    expect(res.statusCode).toBe(200);
  });
});

// Restricción de armadura por peso (2026-08-31, Grupo 3 § Sistema de clases, ver
// pesoArmaduraPermitidoFor en weaponAbilities.ts) — a diferencia de armas, cubre las 9 clases de
// una vez.
describe('PATCH /saves/:id/inventario/:itemId — restricción de armadura por peso', () => {
  beforeEach(() => {
    findFirstInventoryItem.mockReset();
    findUniqueSave.mockReset();
    findUniqueItemCatalog.mockReset();
    updateInventoryItem.mockReset();
    updateManyInventoryItem.mockReset();
    findManyInventoryItem.mockReset().mockResolvedValue([]);
    transaction.mockReset().mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  it('un Mago no puede equipar armadura Pesada (solo Ligero, sin excepción)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'MAGO', especializacion: null });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Peto de placas óseas de gargantúa', catalogSlug: 'peto-placas-gargantua', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMADURA_SUPERIOR', requisitos: null, pesoArmadura: 'PESADO' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMADURA_SUPERIOR' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/pesa demasiado/);
    expect(updateInventoryItem).not.toHaveBeenCalled();
  });

  it('un Guerrero SÍ puede equipar armadura Pesada', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'GUERRERO', especializacion: 'BERSERKER' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Peto de placas óseas de gargantúa', catalogSlug: 'peto-placas-gargantua', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMADURA_SUPERIOR', requisitos: null, pesoArmadura: 'PESADO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMADURA_SUPERIOR' } });

    expect(res.statusCode).toBe(200);
  });

  it('Caballero del Valor puede equipar Medio, a diferencia de sus 2 hermanas (solo Pesado)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 10, clase: 'CABALLERO', especializacion: 'CABALLERO_DEL_VALOR' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Cota de aleación ligera goirntes', catalogSlug: 'cota-ligera-goirntes', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMADURA_SUPERIOR', requisitos: null, pesoArmadura: 'MEDIO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMADURA_SUPERIOR' } });

    expect(res.statusCode).toBe(200);
  });

  it('Caballero del Orden NO puede equipar Medio (solo Pesado, sin la flexibilidad del Valor)', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 10, clase: 'CABALLERO', especializacion: 'CABALLERO_DEL_ORDEN' });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Cota de aleación ligera goirntes', catalogSlug: 'cota-ligera-goirntes', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMADURA_SUPERIOR', requisitos: null, pesoArmadura: 'MEDIO' });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMADURA_SUPERIOR' } });

    expect(res.statusCode).toBe(400);
  });

  it('un objeto sin pesoArmadura (joyería/ropa interior) nunca dispara la restricción', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: 'MAGO', especializacion: null });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Anillo cualquiera', catalogSlug: 'anillo-cualquiera', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ACCESORIO', requisitos: null, pesoArmadura: null });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ACCESORIO' } });

    expect(res.statusCode).toBe(200);
  });

  it('un personaje sin clase asignada todavía (Save.clase null) no tiene restricción de peso', async () => {
    findUniqueSave.mockResolvedValue({ worldId: 'world1', attributes: {}, secondaryAttributes: {}, raza: null, level: 1, clase: null, especializacion: null });
    findFirstInventoryItem.mockResolvedValue({ id: 'item1', name: 'Peto de placas óseas de gargantúa', catalogSlug: 'peto-placas-gargantua', slot: null });
    findUniqueItemCatalog.mockResolvedValue({ equipSlot: 'ARMADURA_SUPERIOR', requisitos: null, pesoArmadura: 'PESADO' });
    updateInventoryItem.mockResolvedValue({});
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/inventario/item1', payload: { slot: 'ARMADURA_SUPERIOR' } });

    expect(res.statusCode).toBe(200);
  });
});
