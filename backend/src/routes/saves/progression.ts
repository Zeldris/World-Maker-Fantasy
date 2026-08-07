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

      // Bug real (auditoría 2026-08-06): `Save.attributes` es un único Json — sin bloquear la fila,
      // dos POST casi simultáneos (doble clic, dos pestañas) leían el mismo `attributes` desde
      // ANTES de que ninguno escribiera, así que los dos calculaban `fuerza + 1` sobre el mismo
      // valor de partida: `pendingAttributePoints` (decrement, sí atómico en Postgres) acababa
      // consumiendo 2 puntos, pero `attributes` solo subía +1 — un punto de ascenso se perdía en
      // silencio. `SELECT ... FOR UPDATE` bloquea la fila hasta que la primera transacción
      // termina, así la segunda ve ya el `attributes` actualizado antes de calcular el suyo.
      let outcome: { kind: 'ok'; attributes: AttributeBlock; pendingAttributePoints: number } | { kind: 'no-points' } | { kind: 'at-max' };
      try {
        outcome = await prisma.$transaction(async (tx) => {
          const [locked] = await tx.$queryRaw<{ pendingAttributePoints: number; attributes: AttributeBlock }[]>`
            SELECT "pendingAttributePoints", attributes FROM "Save" WHERE id = ${save.id} FOR UPDATE
          `;
          if (locked.pendingAttributePoints <= 0) return { kind: 'no-points' };
          if (locked.attributes[attribute] >= MAX_ATTRIBUTE) return { kind: 'at-max' };
          const updated = await tx.save.update({
            where: { id: save.id },
            data: {
              pendingAttributePoints: { decrement: 1 },
              attributes: { ...locked.attributes, [attribute]: locked.attributes[attribute] + 1 },
            },
          });
          return { kind: 'ok', attributes: updated.attributes as AttributeBlock, pendingAttributePoints: updated.pendingAttributePoints };
        });
      } catch {
        return reply.status(500).send({ error: 'No se pudo repartir el punto de atributo' });
      }

      if (outcome.kind === 'no-points') {
        return reply.status(400).send({ error: 'No quedan puntos de atributo pendientes' });
      }
      if (outcome.kind === 'at-max') {
        return reply.status(400).send({ error: `${attribute} ya está en el máximo (${MAX_ATTRIBUTE})` });
      }
      return { attributes: outcome.attributes, pendingAttributePoints: outcome.pendingAttributePoints };
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
