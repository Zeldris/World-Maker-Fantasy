import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { generateSuggestions } from '../../services/narrador.js';
import { detectNpcsInScene } from '../../services/npcScene.js';
import { loadSessionFacts } from '../../services/worldFacts.js';
import { saludBandFor } from '../../services/death.js';
import { energiaMaxFor } from '../../services/energy.js';
import type { AttributeBlock } from '../../services/dice.js';

/// Sugerencias de próxima acción bajo demanda (petición explícita, 2026-08-15 — ver comentario de
/// cabecera de `generateSuggestions`, narrador.ts) — botón aparte junto a "Actuar", no dentro del
/// turno normal. Determinista en su recolección de contexto (mismo criterio que recolectar.ts/
/// cazar.ts: sin gastar turno, sin tocar el reloj de ficción, sin `$transaction`), la única llamada
/// a IA es la de `generateSuggestions` en sí.
const RECENT_LOG_ENTRIES = 6;
/// Últimos hechos de sesión pasados como "AMBIENTE" (petición explícita: "interactuar con algo que
/// se detectó en el ambiente") — una porción reciente, no la lista completa (`loadSessionFacts`
/// puede traer hasta 50): esta llamada es deliberadamente ligera, mismo criterio que `recentLog`.
const RECENT_AMBIENT_FACTS = 6;

/// Banda cualitativa de energía (nunca el número exacto — mismo criterio que `saludBandFor` para
/// salud): sin esto, la única señal de "descansar" que tendría el modelo sería un número suelto,
/// fácil de ignorar entre el resto del prompt.
function energiaBandFor(energia: number, energiaMax: number): string {
  const frac = energiaMax > 0 ? energia / energiaMax : 1;
  if (frac < 0.3) return `baja (${energia}/${energiaMax})`;
  if (frac < 0.6) return `moderada (${energia}/${energiaMax})`;
  return `buena (${energia}/${energiaMax})`;
}

export async function suggestionsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/saves/:id/suggestions', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { worldState: { select: { fictionalMinutes: true } } },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const recentEntries = await prisma.logEntry.findMany({
      where: { saveId: save.id, channel: 'CHARACTER' },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LOG_ENTRIES,
      select: { text: true },
    });
    const recentLog = recentEntries.map((e) => e.text).reverse();

    const sessionFacts = await loadSessionFacts(save.id);
    const npcsInScene = await detectNpcsInScene({
      action: '',
      worldId: save.worldId,
      sessionFacts,
      saveId: save.id,
      currentLocationId: save.currentLocationId,
      fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
    });

    const activeQuests = await prisma.quest.findMany({
      where: { saveId: save.id, status: 'ACTIVA' },
      select: { title: true, objetivo: true },
    });

    const attributes = save.attributes as AttributeBlock;
    const suggestions = await generateSuggestions({
      characterName: save.characterName,
      recentLog,
      npcsEnEscena: npcsInScene.map((n) => ({ name: n.name, condicionFisica: n.condicionFisica })),
      activeQuests,
      saludJugador: saludBandFor(save.condicionFisica),
      energiaJugador: energiaBandFor(save.energia, energiaMaxFor(attributes.constitucion)),
      ambiente: sessionFacts.slice(-RECENT_AMBIENT_FACTS),
    });

    return { suggestions };
  });
}
