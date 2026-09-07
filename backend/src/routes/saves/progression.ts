import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { attributeCapForLevel } from '../../services/progression.js';
import type { AttributeBlock, Attribute } from '../../services/dice.js';
import { VALID_ATTRIBUTES, rejectIfEnded, rejectIfPendingDeath, lockRowForUpdate } from './shared.js';
import {
  classAbilityUnlocksFor,
  especializacionAbilityUnlocksFor,
  especializacionesConHuecosPara,
  savedActionDataFromAbility,
} from '../../services/classAbilities.js';
import { Clase, Especializacion } from '@prisma/client';

/// Nivel mínimo real para elegir especialización (docs/rpgtarkor/clases.md, "cada una con 2-4
/// especializaciones elegidas a nivel 10") — mismo criterio que el resto de topes de partida del
/// proyecto (cifra citada del propio diseño, no inventada aquí).
export const NIVEL_MINIMO_ESPECIALIZACION = 10;

/// Progresión "manual" del personaje (deuda técnica 2026-07-30, split de saves.ts): repartir un
/// punto de atributo ganado por nivel — decisión puntual de la jugadora sobre su propio personaje,
/// sin relación con el ciclo de vida de la partida ni con el combate.
///
/// La ruta de "elegir profesión" (`POST /saves/:id/profesion`) se quitó en el rediseño de
/// profesiones (2026-08-07, petición explícita: "eso de adoptar profesiones no es lo que quiero")
/// — no enganchaba con ninguna mecánica real (`ProfessionProgress` ya es independiente de cuál
/// estuviera "activa"). Sustituido por oficios que se aprenden de verdad (nivel ≥ 1 en
/// `ProfessionProgress`), sembrados al crear personaje o, más adelante, enseñados por un NPC.
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
      if (!VALID_ATTRIBUTES.includes(attribute)) {
        return reply.status(400).send({ error: `Atributo no válido: "${attribute}"` });
      }
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      // Mismo guard que turn.ts/combat/flee/cazar/recolectar/reino (auditoría de bugs 2026-08-21
      // + decisión explícita de la usuaria al cerrar la ronda de preguntas abiertas): repartir
      // puntos de atributo tras una muerte definitiva no debería seguir permitido, aunque no
      // toque ningún recurso compartido del mundo.
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      // Bug real (auditoría 2026-08-06): `Save.attributes` es un único Json — sin bloquear la fila,
      // dos POST casi simultáneos (doble clic, dos pestañas) leían el mismo `attributes` desde
      // ANTES de que ninguno escribiera, así que los dos calculaban `fuerza + 1` sobre el mismo
      // valor de partida: `pendingAttributePoints` (decrement, sí atómico en Postgres) acababa
      // consumiendo 2 puntos, pero `attributes` solo subía +1 — un punto de ascenso se perdía en
      // silencio. `SELECT ... FOR UPDATE` bloquea la fila hasta que la primera transacción
      // termina, así la segunda ve ya el `attributes` actualizado antes de calcular el suyo.
      const attributeCap = attributeCapForLevel(save.level);
      let outcome: { kind: 'ok'; attributes: AttributeBlock; pendingAttributePoints: number } | { kind: 'no-points' } | { kind: 'at-max' };
      try {
        outcome = await prisma.$transaction(async (tx) => {
          const locked = await lockRowForUpdate<{ pendingAttributePoints: number; attributes: AttributeBlock }>(tx, 'Save', save.id, [
            'pendingAttributePoints',
            'attributes',
          ]);
          if (locked.pendingAttributePoints <= 0) return { kind: 'no-points' };
          if (locked.attributes[attribute] >= attributeCap) return { kind: 'at-max' };
          const updated = await tx.save.update({
            where: { id: save.id },
            data: {
              pendingAttributePoints: { decrement: 1 },
              attributes: { ...locked.attributes, [attribute]: locked.attributes[attribute] + 1 },
            },
          });
          return { kind: 'ok', attributes: updated.attributes as AttributeBlock, pendingAttributePoints: updated.pendingAttributePoints };
        });
      } catch (err) {
        // Deuda técnica cerrada (auditoría 2026-09-01): `catch {}` mudo aquí no distinguía un
        // deadlock/timeout real de Postgres de un caso de negocio normal — cualquier fallo real de
        // la transacción se devolvía como el mismo 500 genérico, sin dejar ningún rastro para
        // diagnosticar qué pasó de verdad.
        console.error(`[progression] error repartiendo punto de atributo para save ${save.id}:`, err);
        return reply.status(500).send({ error: 'No se pudo repartir el punto de atributo' });
      }

      if (outcome.kind === 'no-points') {
        return reply.status(400).send({ error: 'No quedan puntos de atributo pendientes' });
      }
      if (outcome.kind === 'at-max') {
        return reply.status(400).send({ error: `${attribute} ya está en el máximo (${attributeCap})` });
      }
      return { attributes: outcome.attributes, pendingAttributePoints: outcome.pendingAttributePoints };
    },
  );

  // Cierre del hueco "Save.clase sin ningún flujo de asignación" (2026-08-29, confirmado con datos
  // reales: la partida de Gorhorn tenía `clase: NULL` en Postgres pese a estar decidida
  // narrativamente, sin ningún camino de UI para fijarla — corregido esa vez con un UPDATE manual
  // en la base de datos). Solo permite fijarla UNA vez (mismo criterio que `especializacion` a
  // nivel 10: es una decisión, no un respec libre) — si `save.clase` ya no es `null`, 409. Al
  // fijarla, concede de golpe TODO el tronco común ya alcanzado por el nivel actual del
  // personaje (`classAbilityUnlocksFor`, ver classAbilities.ts) — cubre tanto elegir clase al
  // crear personaje (nivel 1, un solo desbloqueo) como decidirla más tarde jugando (como pasó de
  // verdad con Gorhorn), sin dejar huecos de niveles ya alcanzados.
  app.patch<{ Params: { id: string }; Body: { clase: Clase } }>('/saves/:id/clase', async (request, reply) => {
    const { clase } = request.body;
    if (!clase || !Object.values(Clase).includes(clase)) {
      return reply.status(400).send({ error: `Clase no válida: "${clase}"` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (save.clase) {
      return reply.status(409).send({ error: `Esta partida ya tiene clase asignada: ${save.clase}` });
    }

    // Anti-duplicado (bug real encontrado antes de reproducir esto en la partida real de la
    // usuaria, 2026-08-29): una partida creada ANTES de este fix pudo recibir ya alguna de estas
    // habilidades por el camino viejo (fallback por `characterName` dentro de la propia
    // `classAbilityUnlocksFor` — ver comentario ahí) — p. ej. Gorhorn/Cazador ya tenía "Analisis
    // Salvaje" (nivel 1) al crear su partida, mucho antes de que existiera este endpoint. Sin este
    // guard, fijar la clase ahora la duplicaría. Comparado por nombre (igual que el resto del
    // motor identifica una SavedAction "de serie" — no hay otro id compartido entre el catálogo
    // estático de habilidades y la fila ya persistida).
    const yaTiene = new Set((await prisma.savedAction.findMany({ where: { saveId: save.id, category: 'combate' }, select: { name: true } })).map((a) => a.name));

    const nuevasHabilidades = Array.from({ length: save.level }, (_, i) => i + 1)
      .flatMap((lvl) => classAbilityUnlocksFor(save.characterName, lvl, clase))
      .filter((ability) => !yaTiene.has(ability.name))
      .map((ability) => savedActionDataFromAbility(save.id, ability));

    await prisma.$transaction([
      prisma.save.update({ where: { id: save.id }, data: { clase } }),
      ...(nuevasHabilidades.length > 0 ? [prisma.savedAction.createMany({ data: nuevasHabilidades })] : []),
      prisma.logEntry.create({
        data: {
          saveId: save.id,
          channel: 'CHARACTER',
          text: `${save.characterName} asume su clase: ${clase}.`,
          timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
          // Bug real (2026-09-05, ver comentario completo en schema.prisma § isSystemMessage) —
          // texto fijo determinista, nunca generado por el LLM: sin esto, el turno SIGUIENTE lo
          // recibía como "tu propia narración del turno anterior" y podía repetirlo literalmente.
          isSystemMessage: true,
        },
      }),
    ]);

    return { clase };
  });

  // Cierre del hueco "Save.especializacion sin ningún flujo de asignación" (roadmap de
  // consolidación 2026-09-01, mismo hueco que `Save.clase` tenía hasta el endpoint de arriba, que
  // sirve de molde) — `Especializacion` existe en el schema desde el sistema de clases (2026-08-24),
  // pero nunca tuvo endpoint propio. Solo permite fijarla UNA vez (mismo criterio que `clase`: es
  // una decisión, no un respec libre). Concede de golpe SOLO los huecos de la rama de
  // especialización elegida ya alcanzados por el nivel actual — el tronco común ya se concedió al
  // fijar `clase` (o al subir de nivel, turnResolution.ts); `classAbilityUnlocksFor` los excluye a
  // propósito (`!u.especializacion`) para no duplicarlos aquí.
  app.patch<{ Params: { id: string }; Body: { especializacion: Especializacion } }>('/saves/:id/especializacion', async (request, reply) => {
    const { especializacion } = request.body;
    if (!especializacion || !Object.values(Especializacion).includes(especializacion)) {
      return reply.status(400).send({ error: `Especialización no válida: "${especializacion}"` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (rejectIfEnded(save, reply)) return;
    if (rejectIfPendingDeath(save, reply)) return;
    if (!save.clase) {
      return reply.status(409).send({ error: 'Esta partida todavía no tiene clase asignada — hay que elegir clase antes que especialización' });
    }
    if (save.level < NIVEL_MINIMO_ESPECIALIZACION) {
      return reply.status(409).send({ error: `Nivel insuficiente: la especialización se elige a partir de nivel ${NIVEL_MINIMO_ESPECIALIZACION} (actual: ${save.level})` });
    }
    if (save.especializacion) {
      return reply.status(409).send({ error: `Esta partida ya tiene especialización asignada: ${save.especializacion}` });
    }
    const validas = especializacionesConHuecosPara(save.clase);
    if (!validas.includes(especializacion)) {
      return reply.status(400).send({ error: `"${especializacion}" no es una especialización real de ${save.clase} (válidas: ${validas.join(', ') || 'ninguna construida todavía'})` });
    }

    // Mismo guard anti-duplicado que `/saves/:id/clase` — por si alguna habilidad de esta rama ya
    // existiera por otro camino (ninguno conocido hoy para especialización, pero el mismo criterio
    // defensivo del endpoint hermano se mantiene por consistencia).
    const yaTiene = new Set((await prisma.savedAction.findMany({ where: { saveId: save.id, category: 'combate' }, select: { name: true } })).map((a) => a.name));

    const nuevasHabilidades = especializacionAbilityUnlocksFor(save.clase, especializacion, save.level)
      .filter((ability) => !yaTiene.has(ability.name))
      .map((ability) => savedActionDataFromAbility(save.id, ability));

    await prisma.$transaction([
      prisma.save.update({ where: { id: save.id }, data: { especializacion } }),
      ...(nuevasHabilidades.length > 0 ? [prisma.savedAction.createMany({ data: nuevasHabilidades })] : []),
      prisma.logEntry.create({
        data: {
          saveId: save.id,
          channel: 'CHARACTER',
          text: `${save.characterName} se especializa: ${especializacion}.`,
          timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
          isSystemMessage: true,
        },
      }),
    ]);

    return { especializacion };
  });
}
