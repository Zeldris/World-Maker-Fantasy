import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { getDefaultUserId } from '../lib/defaultUser.js';
import {
  computeBuildBlockedReason,
  CUARTEL_AVANZADO_RECIPE,
  CUARTEL_DE_GUERRA_RECIPE,
  PUESTO_COMERCIAL_RECIPE,
} from './construction.js';

/// Conquista territorial estilo X4 (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, 2026-09-21) — Cuartel
/// Avanzado: cupo NUEVO e independiente del de edificios normales, 1 por región, en región
/// DISTINTA a la del Ayuntamiento (justo lo contrario de la Choza). Test de integración real
/// contra Postgres, sin mocks — mismo patrón que descansarCampamento.integration.test.ts.
const ATTRS = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 };

describe('Cuartel Avanzado — conquista territorial (2026-09-21)', () => {
  let saveId: string;
  let worldId: string;
  let llanurasLocationId: string;
  let cristalHeladoLocationId: string;

  beforeAll(async () => {
    const userId = await getDefaultUserId();
    const world = await prisma.world.findFirstOrThrow({ where: { slug: 'helek-sirik' } });
    worldId = world.id;
    const hondonada = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'hondonada-del-eco' } });
    llanurasLocationId = hondonada.id;
    const helsig = await prisma.location.findFirstOrThrow({ where: { worldId, slug: 'campamento-helsig' } });
    cristalHeladoLocationId = helsig.id;

    const save = await prisma.save.create({
      data: {
        userId,
        worldId,
        characterName: 'Gorhorn de prueba (cuartel avanzado)',
        characterArchetype: 'guerrero',
        characterOrigin: 'Clan Maktor',
        characterMotivation: 'x',
        attributes: ATTRS,
        portraitInitial: 'G',
        currentLocationId: llanurasLocationId,
      },
    });
    saveId = save.id;
  });

  afterEach(async () => {
    await prisma.building.deleteMany({ where: { saveId } });
  });

  afterAll(async () => {
    await prisma.save.delete({ where: { id: saveId } });
  });

  it('sin Ayuntamiento, bloquea con el mensaje genérico de reino', async () => {
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_AVANZADO_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toMatch(/Ayuntamiento/);
  });

  it('con Ayuntamiento, en la MISMA región que el Ayuntamiento: bloqueado (para eso está la Choza)', async () => {
    await prisma.building.create({
      data: { saveId, locationId: llanurasLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_AVANZADO_RECIPE,
      activeRegion: 'Las Llanuras del Viento Rojo',
      currentLocationRecord: { id: llanurasLocationId },
    });
    expect(reason).toMatch(/regi[oó]n distinta/);
  });

  it('con Ayuntamiento pequeño (cupo 1), en OTRA región: permitido', async () => {
    await prisma.building.create({
      data: { saveId, locationId: llanurasLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_AVANZADO_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toBeNull();
  });

  it('con Ayuntamiento pequeño (cupo 1) y ya 1 Cuartel Avanzado ACTIVO: bloquea el segundo', async () => {
    await prisma.building.create({
      data: { saveId, locationId: llanurasLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    await prisma.building.create({
      data: { saveId, locationId: cristalHeladoLocationId, recipeKey: 'cuartel-avanzado', name: 'x', kind: 'cuartel-avanzado', description: 'x', status: 'ACTIVO' },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_AVANZADO_RECIPE,
      // Otra región distinta de ambas ya usadas — igual se bloquea por CUPO, no por "1 por región".
      activeRegion: 'La Meseta del Orden',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toMatch(/cupo m[aá]ximo de Cuarteles Avanzados \(1\)/);
  });

  it('con Ayuntamiento MEDIANO (cupo 5) y 1 Cuartel Avanzado ya ACTIVO: permite un segundo', async () => {
    await prisma.building.create({
      data: { saveId, locationId: llanurasLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 2 },
    });
    await prisma.building.create({
      data: { saveId, locationId: cristalHeladoLocationId, recipeKey: 'cuartel-avanzado', name: 'x', kind: 'cuartel-avanzado', description: 'x', status: 'ACTIVO' },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_AVANZADO_RECIPE,
      activeRegion: 'La Meseta del Orden',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toBeNull();
  });

  it('mejorar a Cuartel de Guerra: sin ningún Cuartel Avanzado ACTIVO, bloquea', async () => {
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_DE_GUERRA_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toMatch(/no tiene ning[uú]n Cuartel Avanzado/);
  });

  it('mejorar a Cuartel de Guerra: con un Cuartel Avanzado ACTIVO, permitido', async () => {
    await prisma.building.create({
      data: { saveId, locationId: cristalHeladoLocationId, recipeKey: 'cuartel-avanzado', name: 'x', kind: 'cuartel-avanzado', description: 'x', status: 'ACTIVO' },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CUARTEL_DE_GUERRA_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toBeNull();
  });

  it('bifurcación única: con Cuartel de Guerra ya ACTIVO, Puesto Comercial queda bloqueado', async () => {
    await prisma.building.create({
      data: { saveId, locationId: cristalHeladoLocationId, recipeKey: 'cuartel-avanzado', name: 'x', kind: 'cuartel-avanzado', description: 'x', status: 'ACTIVO' },
    });
    await prisma.building.create({
      data: { saveId, locationId: cristalHeladoLocationId, recipeKey: 'cuartel-de-guerra', name: 'x', kind: 'cuartel-de-guerra', description: 'x', status: 'ACTIVO' },
    });
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: PUESTO_COMERCIAL_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toMatch(/ya eligió su otra especialización/);
  });

  it('Ayuntamiento sigue exigiendo cercanía/región para la Choza (regresión: no romper el camino existente)', async () => {
    await prisma.building.create({
      data: { saveId, locationId: llanurasLocationId, recipeKey: 'ayuntamiento', name: 'x', kind: 'ayuntamiento', description: 'x', status: 'ACTIVO', tier: 1 },
    });
    const { CHOZA_RECIPE } = await import('./construction.js');
    const reason = await computeBuildBlockedReason({
      db: prisma,
      saveId,
      worldId,
      buildRecipe: CHOZA_RECIPE,
      activeRegion: 'Cristal Helado',
      currentLocationRecord: { id: cristalHeladoLocationId },
    });
    expect(reason).toMatch(/misma regi[oó]n donde est[aá] el Ayuntamiento/);
  });
});
