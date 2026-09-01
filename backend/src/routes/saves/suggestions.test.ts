import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

/// Cobertura nueva (petición explícita, 2026-08-15: sugerencias movidas a llamada aparte bajo
/// demanda, ver comentario de cabecera de `generateSuggestions` en narrador.ts) — este endpoint
/// solo reúne contexto determinista (últimos LogEntry, NPCs en escena, misiones activas, salud/
/// energía del jugador, hechos de sesión recientes) y delega en `generateSuggestions`; el foco del
/// test es que reúne y pasa bien ese contexto, no la calidad de la IA (eso lo cubre
/// `narrador.test.ts` con las funciones puras).
const findUniqueSave = vi.fn();
const findManyLogEntry = vi.fn();
const findManyQuest = vi.fn();
const generateSuggestions = vi.fn();
const detectNpcsInScene = vi.fn();
const loadSessionFacts = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    save: { findUnique: (...args: unknown[]) => findUniqueSave(...args) },
    logEntry: { findMany: (...args: unknown[]) => findManyLogEntry(...args) },
    quest: { findMany: (...args: unknown[]) => findManyQuest(...args) },
  },
}));

// `importOriginal` (no un reemplazo completo del módulo) — mismo patrón ya establecido en
// turn.classify.test.ts: un reemplazo completo tira también el resto de exports reales de
// narrador.js que otros módulos importan.
vi.mock('../../services/narrador.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/narrador.js')>();
  return {
    ...actual,
    generateSuggestions: (...args: unknown[]) => generateSuggestions(...args),
  };
});

vi.mock('../../services/npcScene.js', () => ({
  detectNpcsInScene: (...args: unknown[]) => detectNpcsInScene(...args),
}));

vi.mock('../../services/worldFacts.js', () => ({
  loadSessionFacts: (...args: unknown[]) => loadSessionFacts(...args),
}));

const { suggestionsRoutes } = await import('./suggestions.js');

async function buildApp() {
  const app = Fastify();
  await app.register(suggestionsRoutes);
  return app;
}

describe('POST /saves/:id/suggestions', () => {
  beforeEach(() => {
    findUniqueSave.mockReset().mockResolvedValue({
      id: 'save1',
      worldId: 'world1',
      characterName: 'Gorhorn',
      currentLocationId: 'loc1',
      condicionFisica: 'HERIDO',
      energia: 20,
      attributes: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, magia: 10 },
    });
    // El mock devuelve directamente lo que la query pediría en DESC (más reciente primero) — la
    // propia ruta hace `.reverse()` para pasarle a `generateSuggestions` el orden cronológico real.
    findManyLogEntry.mockReset().mockResolvedValue([
      { text: 'Gorhorn hunde su hacha en el hombro del Orco Enfurecido, dejándolo inmóvil.' },
      { text: 'Gorhorn ataca al Orco Enfurecido.' },
    ]);
    findManyQuest.mockReset().mockResolvedValue([{ title: 'Ayudar a Gistera Koh', objetivo: 'Derrotar al Orco Enfurecido' }]);
    detectNpcsInScene.mockReset().mockResolvedValue([{ name: 'Orco Enfurecido', condicionFisica: 'CONVALECIENTE' }]);
    loadSessionFacts.mockReset().mockResolvedValue(['Gorhorn localiza Cardo Brújula en la zona.']);
    generateSuggestions.mockReset().mockResolvedValue(['Remato al Orco Enfurecido', 'Registro su cuerpo', 'Sigo mi camino']);
  });

  it('reúne todo el contexto (log, NPCs, misiones activas, salud/energía, ambiente) y devuelve las sugerencias generadas', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/save1/suggestions' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ suggestions: ['Remato al Orco Enfurecido', 'Registro su cuerpo', 'Sigo mi camino'] });
    expect(generateSuggestions).toHaveBeenCalledWith({
      characterName: 'Gorhorn',
      recentLog: ['Gorhorn ataca al Orco Enfurecido.', 'Gorhorn hunde su hacha en el hombro del Orco Enfurecido, dejándolo inmóvil.'],
      npcsEnEscena: [{ name: 'Orco Enfurecido', condicionFisica: 'CONVALECIENTE' }],
      activeQuests: [{ title: 'Ayudar a Gistera Koh', objetivo: 'Derrotar al Orco Enfurecido' }],
      saludJugador: 'herido, ~75/100',
      energiaJugador: 'baja (20/80)',
      ambiente: ['Gorhorn localiza Cardo Brújula en la zona.'],
    });
    expect(findManyQuest).toHaveBeenCalledWith(expect.objectContaining({ where: { saveId: 'save1', status: 'ACTIVA' } }));
  });

  it('no gasta turno ni toca el reloj de ficción — solo lectura, sin $transaction', async () => {
    const app = await buildApp();

    await app.inject({ method: 'POST', url: '/saves/save1/suggestions' });

    expect(findManyLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ saveId: 'save1', channel: 'CHARACTER' }) }),
    );
  });

  it('404 si la partida no existe', async () => {
    findUniqueSave.mockResolvedValue(null);
    const app = await buildApp();

    const res = await app.inject({ method: 'POST', url: '/saves/nope/suggestions' });

    expect(res.statusCode).toBe(404);
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});
