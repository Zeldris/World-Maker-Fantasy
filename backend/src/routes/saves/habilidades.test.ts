import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (auditoría de deuda técnica 2026-08-03): esta ruta tuvo un bug real (2026-07-29,
/// ver comentario en habilidades.ts) — DELETE borraba cualquier habilidad sin comprobar
/// `isStarting`/`isDynamic` (protegido solo ocultando el botón en frontend). Se arregló pero sin
/// test que bloqueara una regresión; el mismo criterio se repite en el PATCH, tampoco cubierto.
const findFirstSavedAction = vi.fn();
const createSavedAction = vi.fn();
const deleteManySavedAction = vi.fn();
const updateSavedAction = vi.fn();
const findManySavedAction = vi.fn();
const findUniqueSave = vi.fn();
const updateSave = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    savedAction: {
      findFirst: (...args: unknown[]) => findFirstSavedAction(...args),
      create: (...args: unknown[]) => createSavedAction(...args),
      deleteMany: (...args: unknown[]) => deleteManySavedAction(...args),
      update: (...args: unknown[]) => updateSavedAction(...args),
      findMany: (...args: unknown[]) => findManySavedAction(...args),
    },
    save: {
      findUnique: (...args: unknown[]) => findUniqueSave(...args),
      update: (...args: unknown[]) => updateSave(...args),
    },
  },
}));

const { habilidadesRoutes } = await import('./habilidades.js');

async function buildApp() {
  const app = Fastify();
  await app.register(habilidadesRoutes);
  return app;
}

describe('POST /saves/:id/habilidades', () => {
  beforeEach(() => {
    findFirstSavedAction.mockReset();
    createSavedAction.mockReset();
    findUniqueSave.mockReset();
  });

  it('rechaza category: "combate" — las de combate son fijas de la clase, no se crean a mano', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/saves/save1/habilidades',
      payload: { name: 'Golpe secreto', promptText: 'x', category: 'combate' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/son fijas de la clase/);
    expect(createSavedAction).not.toHaveBeenCalled();
  });

  it('rechaza name/promptText vacíos', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/habilidades', payload: { name: '  ', promptText: 'x' } });

    expect(res.statusCode).toBe(400);
    expect(createSavedAction).not.toHaveBeenCalled();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/habilidades', payload: { name: 'Silbido', promptText: 'x' } });

    expect(res.statusCode).toBe(404);
    expect(createSavedAction).not.toHaveBeenCalled();
  });

  // Bug real (auditoría de bugs, 2026-08-21 + decisión explícita al cerrar la ronda de preguntas
  // abiertas): esta ruta nunca comprobaba `save.endedAt` — con la partida ya terminada por muerte
  // definitiva, seguía dejando crear habilidades.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/habilidades', payload: { name: 'Silbido', promptText: 'x' } });

    expect(res.statusCode).toBe(409);
    expect(createSavedAction).not.toHaveBeenCalled();
  });

  it('crea la habilidad como category "general", siempre, aunque no se pida otra', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1' });
    createSavedAction.mockResolvedValue({
      id: 'a1', name: 'Silbido', promptText: 'Silbo fuerte', icon: '✨', description: '',
      isStarting: false, isDynamic: false, category: 'general', preferredAttribute: null, energyCost: null, energyRegen: null, isGeneric: false, dualWield: false,
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/habilidades', payload: { name: 'Silbido', promptText: 'Silbo fuerte' } });

    expect(res.statusCode).toBe(200);
    expect(createSavedAction).toHaveBeenCalledWith({
      data: { saveId: 'save1', name: 'Silbido', promptText: 'Silbo fuerte', icon: '✨', description: '', category: 'general' },
    });
  });
});

describe('DELETE /saves/:id/habilidades/:habilidadId', () => {
  beforeEach(() => {
    findFirstSavedAction.mockReset();
    deleteManySavedAction.mockReset();
    findUniqueSave.mockReset();
  });

  // Bug real (auditoría de bugs, 2026-08-21 + decisión explícita al cerrar la ronda de preguntas
  // abiertas): esta ruta nunca comprobaba `save.endedAt`.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: false });
    findUniqueSave.mockResolvedValue({ endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1/habilidades/a1' });

    expect(res.statusCode).toBe(409);
    expect(deleteManySavedAction).not.toHaveBeenCalled();
  });

  it('rechaza borrar una habilidad isStarting (kit inicial/clase)', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: true, isDynamic: false });
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1/habilidades/a1' });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no se puede borrar a mano/);
    expect(deleteManySavedAction).not.toHaveBeenCalled();
  });

  it('rechaza borrar una habilidad isDynamic (racial/de arma)', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: true });
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1/habilidades/a1' });

    expect(res.statusCode).toBe(400);
    expect(deleteManySavedAction).not.toHaveBeenCalled();
  });

  it('borra una habilidad "general" normal', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: false });
    deleteManySavedAction.mockResolvedValue({ count: 1 });
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1/habilidades/a1' });

    expect(res.statusCode).toBe(204);
    expect(deleteManySavedAction).toHaveBeenCalledWith({ where: { id: 'a1', saveId: 'save1' } });
  });

  it('204 silencioso si ya no existe (idempotente)', async () => {
    findFirstSavedAction.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'DELETE', url: '/saves/save1/habilidades/a1' });

    expect(res.statusCode).toBe(204);
    expect(deleteManySavedAction).not.toHaveBeenCalled();
  });
});

describe('PATCH /saves/:id/habilidades/:habilidadId', () => {
  beforeEach(() => {
    findFirstSavedAction.mockReset();
    updateSavedAction.mockReset();
    findUniqueSave.mockReset();
  });

  // Bug real (auditoría de bugs, 2026-08-21 + decisión explícita al cerrar la ronda de preguntas
  // abiertas): esta ruta nunca comprobaba `save.endedAt`.
  it('409 si la partida ya ha terminado (endedAt)', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: false });
    findUniqueSave.mockResolvedValue({ endedAt: new Date('2026-08-21T12:00:00Z') });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: 'Otro nombre' } });

    expect(res.statusCode).toBe(409);
    expect(updateSavedAction).not.toHaveBeenCalled();
  });

  it('rechaza editar una habilidad isStarting', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: true, isDynamic: false });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: 'Otro nombre' } });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/no se puede editar a mano/);
    expect(updateSavedAction).not.toHaveBeenCalled();
  });

  it('rechaza editar una habilidad isDynamic', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: true });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: 'Otro nombre' } });

    expect(res.statusCode).toBe(400);
    expect(updateSavedAction).not.toHaveBeenCalled();
  });

  it('404 si no existe', async () => {
    findFirstSavedAction.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: 'Otro nombre' } });

    expect(res.statusCode).toBe(404);
  });

  it('rechaza vaciar name o promptText', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: false });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: '   ' } });

    expect(res.statusCode).toBe(400);
    expect(updateSavedAction).not.toHaveBeenCalled();
  });

  it('edita una habilidad "general" normal', async () => {
    findFirstSavedAction.mockResolvedValue({ id: 'a1', isStarting: false, isDynamic: false });
    updateSavedAction.mockResolvedValue({
      id: 'a1', name: 'Nuevo nombre', promptText: 'x', icon: '✨', description: '',
      isStarting: false, isDynamic: false, category: 'general', preferredAttribute: null, energyCost: null, energyRegen: null, isGeneric: false, dualWield: false,
    });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/habilidades/a1', payload: { name: 'Nuevo nombre' } });

    expect(res.statusCode).toBe(200);
    expect(updateSavedAction).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { name: 'Nuevo nombre' } });
  });
});

/// Cobertura nueva (pendiente 2026-08-27 punto 3, "cinturón de combate" — 2026-08-28): saneado
/// real contra las habilidades de combate NO genéricas de AHORA MISMO, nunca confía en el cliente.
describe('PATCH /saves/:id/combat-abilities', () => {
  beforeEach(() => {
    findUniqueSave.mockReset();
    findManySavedAction.mockReset();
    updateSave.mockReset();
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/combat-abilities', payload: { names: ['Tajo Horizontal'] } });
    expect(res.statusCode).toBe(404);
  });

  it('descarta nombres que ya no son habilidades de combate reales del personaje', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: null });
    findManySavedAction.mockResolvedValue([
      { name: 'Tajo Horizontal', isGeneric: false },
      { name: 'Ataque Básico', isGeneric: true },
    ]);
    updateSave.mockResolvedValue({ activeCombatAbilityNames: ['Tajo Horizontal'] });
    const app = await buildApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/saves/save1/combat-abilities',
      payload: { names: ['Tajo Horizontal', 'Estocada Inventada', 'Ataque Básico'] },
    });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({
      where: { id: 'save1' },
      data: { activeCombatAbilityNames: ['Tajo Horizontal'], activeCombatAbilityNamesConfigured: true },
    });
  });

  it('marca activeCombatAbilityNamesConfigured incluso si el resultado saneado queda vacío', async () => {
    findUniqueSave.mockResolvedValue({ id: 'save1', endedAt: null });
    findManySavedAction.mockResolvedValue([{ name: 'Tajo Horizontal', isGeneric: false }]);
    updateSave.mockResolvedValue({ activeCombatAbilityNames: [] });
    const app = await buildApp();

    const res = await app.inject({ method: 'PATCH', url: '/saves/save1/combat-abilities', payload: { names: [] } });

    expect(res.statusCode).toBe(200);
    expect(updateSave).toHaveBeenCalledWith({
      where: { id: 'save1' },
      data: { activeCombatAbilityNames: [], activeCombatAbilityNamesConfigured: true },
    });
  });
});
