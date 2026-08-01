import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { MAX_ATTRIBUTE } from '../../services/progression.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import type { AttributeBlock, Attribute } from '../../services/dice.js';

/// Progresión "manual" del personaje (deuda técnica 2026-07-30, split de saves.ts): repartir un
/// punto de atributo ganado por nivel, y elegir profesión — las dos son decisiones puntuales de
/// la jugadora sobre su propio personaje, sin relación con el ciclo de vida de la partida ni con
/// el combate.
export async function progressionRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { attribute: Attribute } }>(
    '/saves/:id/attribute-points',
    async (request, reply) => {
      // Reparte UN punto pendiente de ascenso (ASI) en el atributo pedido (docs/10-niveles-xp-reino.md
      // § 4.2) — se llama una vez por punto, tope duro 18, nunca gasta más de lo disponible.
      const { attribute } = request.body;
      // Bug real (auditoría 2026-07-28): `attribute` solo se validaba a nivel de TypeScript, nunca
      // en runtime — un valor no válido (o ausente) pasaba de largo la comprobación de tope
      // (`attributes[attribute]` da `undefined`, y `undefined >= MAX_ATTRIBUTE` es `false`) y
      // `attributes[attribute] + 1` = `NaN` se persistía como clave espuria en el JSON de
      // atributos, consumiendo un punto de ascenso sin dar ningún beneficio real.
      const VALID_ATTRIBUTES: Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'arcano'];
      if (!VALID_ATTRIBUTES.includes(attribute)) {
        return reply.status(400).send({ error: `Atributo no válido: "${attribute}"` });
      }
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      if (save.pendingAttributePoints <= 0) {
        return reply.status(400).send({ error: 'No quedan puntos de atributo pendientes' });
      }
      const attributes = save.attributes as AttributeBlock;
      if (attributes[attribute] >= MAX_ATTRIBUTE) {
        return reply.status(400).send({ error: `${attribute} ya está en el máximo (${MAX_ATTRIBUTE})` });
      }

      const updated = await prisma.save.update({
        where: { id: save.id },
        data: {
          pendingAttributePoints: { decrement: 1 },
          attributes: { ...attributes, [attribute]: attributes[attribute] + 1 },
        },
      });

      return { attributes: updated.attributes, pendingAttributePoints: updated.pendingAttributePoints };
    },
  );

  app.post<{ Params: { id: string }; Body: { profession: string } }>('/saves/:id/profesion', async (request, reply) => {
    const { profession } = request.body;
    if (!profession?.trim()) {
      return reply.status(400).send({ error: 'Falta el campo: profession' });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }

    const fact = `${save.characterName} ejerce como ${profession}.`;

    await prisma.save.update({ where: { id: save.id }, data: { profession } });
    // Fuera de la transacción a propósito (embebe vía Ollama, ver comentario de appendSessionFacts
    // en turnResolution.ts) — no hay riesgo real de dejar `profession` sin su hecho asociado: en el
    // peor caso (fallo justo aquí) el hecho se puede volver a añadir, no rompe ninguna invariante.
    const sessionFacts = await loadSessionFacts(save.id);
    await appendSessionFacts(save.id, sessionFacts, [fact]);

    return { profession };
  });
}
