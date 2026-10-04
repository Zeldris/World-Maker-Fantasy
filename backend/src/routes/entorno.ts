import type { FastifyInstance } from 'fastify';
import { generateSurroundings } from '../services/entorno.js';
import { prisma } from '../lib/prisma.js';
import { recordEntityDiscoveries } from '../services/entityDiscovery.js';
import { rastrosDeRegion } from '../services/cronista/rastros.js';

interface EntornoBody {
  saveId: string;
}

/// Panel "El mundo" v1, ya con persistencia real: solo necesita `saveId`, carga el resto de
/// Postgres y escribe el resultado como LogEntry de canal WORLD — puramente descriptivo, nunca
/// toca el canal CHARACTER (petición explícita de la usuaria, 2026-07-23: "el sondeo ambiental
/// solo tiene que lanzarse en el chat de mundo").
///
/// Simplificado a plantillas deterministas (auditoría 2026-07-24): `generateSurroundings` ya no
/// llama a Ollama, así que tampoco hace falta el RAG de lore ni el anclaje por continente/región
/// que existían solo para alimentarle contexto a esa llamada — las plantillas ya viven organizadas
/// por región real dentro de `entorno.ts`, sin ningún paso intermedio que pueda desviarse.
export async function entornoRoutes(app: FastifyInstance) {
  app.post<{ Body: EntornoBody }>('/entorno', async (request, reply) => {
    const { saveId } = request.body;

    if (!saveId) {
      return reply.status(400).send({ error: 'Falta el campo: saveId' });
    }

    const save = await prisma.save.findUnique({
      where: { id: saveId },
      include: { worldState: true, currentLocation: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

    // Bug real encontrado auditando la partida de Gorhorn (2026-07-23, "revisar partida"): el
    // frontend llama a este endpoint cada 10 min reales mientras la partida está abierta — si el
    // jugador se queda un buen rato sin actuar, el reloj FICTICIO no avanza (nada lo mueve salvo
    // una acción), pero cada llamada seguía pidiendo un párrafo nuevo igualmente, acumulando
    // varias entradas de MUNDO casi idénticas para el mismo instante ficticio. Si el último WORLD
    // ya es de este mismo `timeLabel` y no ha habido ninguna acción real del jugador desde
    // entonces, no hay nada nuevo que describir: se reutiliza el texto ya generado en vez de pedir
    // otro de cero (sigue teniendo sentido aunque generar ya no cueste nada: evita un LogEntry
    // casi duplicado en el diario de mundo).
    const lastWorldEntry = await prisma.logEntry.findFirst({ where: { saveId, channel: 'WORLD' }, orderBy: { createdAt: 'desc' } });
    if (lastWorldEntry && lastWorldEntry.timeLabel === timeLabel) {
      const actedSince = await prisma.logEntry.findFirst({
        where: { saveId, isPlayerAction: true, createdAt: { gt: lastWorldEntry.createdAt } },
      });
      if (!actedSince) {
        return { description: lastWorldEntry.text, logEntryId: lastWorldEntry.id };
      }
    }

    // Anti-repetición (bug real jugando en vivo, revisión de partida 2026-08-08): `lastWorldEntry`
    // ya se leyó arriba para el corte por `timeLabel` — se reutiliza su texto para que
    // `generateSurroundings` pueda evitar repetirlo literalmente si vuelve a tocar la misma franja.
    const generado = generateSurroundings({ region: save.currentLocation?.region ?? null, timeLabel }, undefined, lastWorldEntry?.text ?? null);
    // CR-12 (12d): el rastro de lo que ha pasado hace poco en la región (incendio, crecida, fauna…).
    const region = save.currentLocation?.region;
    const rastros = region ? await rastrosDeRegion(prisma, saveId, region, save.worldState?.fictionalMinutes ?? 480) : [];
    const result = rastros.length > 0 ? { ...generado, description: `${generado.description} ${rastros.join(' ')}` } : generado;

    // Ya no se toca el canal CHARACTER desde aquí (petición explícita de la usuaria, 2026-07-23 —
    // ver comentario del módulo). El "gancho"/evento con "¿Qué haces?" que antes vivía aquí
    // llegó a interrumpir un combate real en curso con una "sorpresa" del mismo NPC que ya estaba
    // atacando — puramente descriptivo desde ahora, una sola fila de canal WORLD.
    const worldLogEntry = await prisma.logEntry.create({
      data: { saveId, channel: 'WORLD', text: result.description, timeLabel, fictionalMinutes: save.worldState?.fictionalMinutes ?? 480 },
    });

    // Bug real (2026-08-14, petición explícita: "lo que se menciona en el log de mundo" no se
    // marcaba como descubierto en la Enciclopedia) — este endpoint nunca llamaba a
    // `recordEntityDiscoveries`, a diferencia del canal CHARACTER (turnResolution.ts), así que
    // cualquier NPC/fauna/ubicación citado solo en la ambientación de "El mundo" se quedaba sin
    // desbloquear su ficha aunque el jugador ya lo hubiera "visto" en el texto.
    await recordEntityDiscoveries({ saveId, worldId: save.worldId, mentionedText: result.description });

    return { ...result, logEntryId: worldLogEntry.id };
  });
}
