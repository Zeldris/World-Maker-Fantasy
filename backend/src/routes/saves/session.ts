import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { contraataqueDifficultyFor, scopeFor } from '../../services/npcScene.js';
import { effectiveAttributes, effectiveDefense } from '../../services/equipment.js';
import { rollCheck } from '../../services/dice.js';
import type { AttributeBlock } from '../../services/dice.js';
import { oneStepWorseThan } from '../../services/death.js';
import { rejectIfEnded } from './shared.js';

/// Control del estado de una partida EN CURSO (deuda técnica 2026-07-30, split de saves.ts):
/// pausar/reanudar, cancelar una acción por tiempo, y huir antes de que un combate llegue a
/// empezar — las cuatro son "el jugador cambia de idea sobre algo que ya estaba en marcha", a
/// diferencia de creation.ts (arranca la partida) o detail.ts (solo lee su estado).
export async function sessionRoutes(app: FastifyInstance) {
  // Pausa/reanuda la partida (roadmap 2026-07-20, petición explícita: "quiero que la partida se
  // pause si salgo de ella"). El frontend llama a pause al salir de GameView (desmontaje o
  // beforeunload) y a resume al volver a entrar — ver `pausedAt` en schema.prisma para el
  // razonamiento completo. Solo afecta a `resolveDueTransits` (worldTick.ts): mientras está
  // pausada, un CharacterTransit vencido no se resuelve; al reanudar, `busyUntil` se alarga
  // exactamente lo que ha durado la pausa, sin perder ni regalar tiempo de espera.
  app.post<{ Params: { id: string } }>('/saves/:id/pause', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (!save.pausedAt) {
      await prisma.save.update({ where: { id: save.id }, data: { pausedAt: new Date() } });
    }
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>('/saves/:id/resume', async (request, reply) => {
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { characterTransit: true } });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (save.pausedAt) {
      const pausedMs = Date.now() - save.pausedAt.getTime();
      const ops: Prisma.PrismaPromise<unknown>[] = [prisma.save.update({ where: { id: save.id }, data: { pausedAt: null } })];
      if (save.characterTransit && pausedMs > 0) {
        ops.push(
          prisma.characterTransit.update({
            where: { saveId: save.id },
            data: { busyUntil: new Date(save.characterTransit.busyUntil.getTime() + pausedMs) },
          }),
        );
      }
      await prisma.$transaction(ops);
    }
    return reply.status(204).send();
  });

  // Cancelar una acción extendida/larga en curso (roadmap 2026-07-21, petición explícita de la
  // usuaria: "quiero meter un botón para poder cancelarla... no se realizará la acción") — borra
  // el CharacterTransit para que worldTick nunca la resuelva, y deja constancia en el diario de
  // que el personaje cambió de idea, en vez de fingir que la acción llegó a completarse.
  app.post<{ Params: { id: string } }>('/saves/:id/transit/cancel', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { characterTransit: true, worldState: true },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (!save.characterTransit || save.characterTransit.busyUntil <= new Date()) {
      return reply.status(404).send({ error: 'No hay ninguna acción cancelable ahora mismo' });
    }
    // Bug real (auditoría 2026-08-06): `busyUntil` por sí solo NO distingue "todavía esperando"
    // de "worldTick ya lo reclamó y lo está narrando" — el reclamo empuja `busyUntil` 10 minutos
    // al futuro precisamente para cubrir la narración, así que durante esa ventana este `if` de
    // arriba dejaba cancelar una acción que ya estaba en marcha de verdad (sin duplicar nada — el
    // borrado dentro de `narrateAndPersistTurn` aborta limpio si la fila desaparece antes—, pero
    // tirando a la basura una narración ya generada y dejando un LogEntry falso de "cambia de idea
    // antes de empezar"). `claimedAt` (zoneContext, ver worldTick.ts) es la marca real.
    if ((save.characterTransit.zoneContext as { claimedAt?: string } | null)?.claimedAt) {
      return reply.status(409).send({ error: 'La acción ya se estaba resolviendo, no se pudo cancelar' });
    }

    // Mismo patrón de "reclamo atómico" que worldTick.ts: si busyUntil ya pasó a estar en el
    // pasado justo antes de este borrado (carrera con el worker de fondo resolviéndola), el
    // borrado no afecta a ninguna fila y se avisa en vez de fingir que se canceló.
    const deleted = await prisma.characterTransit.deleteMany({
      where: { saveId: save.id, busyUntil: { gt: new Date() } },
    });
    if (deleted.count === 0) {
      return reply.status(409).send({ error: 'La acción ya se estaba resolviendo, no se pudo cancelar' });
    }

    // Building.status EN_CONSTRUCCION real (2026-08-23, Grupo 3 § Building.status) — si lo que se
    // canceló era una construcción determinista, la fila ya existía (turn.ts,
    // planDeterministicBuild) desde antes de este cancel; se borra aquí en vez de dejarla
    // huérfana para siempre en EN_CONSTRUCCION. Guard de status por si acaso, aunque el `if` de
    // `claimedAt` de arriba ya descarta que se esté resolviendo de verdad a la vez.
    const buildingId = (save.characterTransit.zoneContext as { buildingId?: string | null } | null)?.buildingId;
    if (buildingId) {
      await prisma.building.deleteMany({ where: { id: buildingId, status: 'EN_CONSTRUCCION' } });
    }

    await prisma.logEntry.create({
      data: {
        saveId: save.id,
        channel: 'CHARACTER',
        text: `${save.characterName} decide no seguir adelante con eso — cambia de idea antes de empezar.`,
        timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      },
    });
    return reply.status(204).send();
  });

  // Huir ANTES de entrar al combate (petición explícita de la usuaria, 2026-07-24, tras la
  // auditoría "revisa todo bien bien" — punto: el "Huir" de dentro de CombatModal.tsx pasa por
  // todo el pipeline classify+narrate y cierra el popup de inmediato sin esperar a que termine,
  // así que una resincronización a mitad de ese hueco podía resucitar el aviso de "Combatir" para
  // una pelea de la que ya se había huido). Botón nuevo junto al aviso de "⚔️ Combatir", ANTES de
  // abrir el popup: una única tirada determinista de destreza (misma fórmula que el contraataque,
  // cuanto más nivel el enemigo, más difícil escapar), sin IA — si sale bien limpia el combate
  // pendiente del todo (ya no hay carrera posible: es una sola llamada atómica); si falla, el
  // frontend abre igualmente el popup de combate normal.
  app.post<{ Params: { id: string } }>('/saves/:id/combat/flee', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { worldState: true, inventoryItems: { where: { slot: { not: null } } } },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (rejectIfEnded(save, reply)) return;

    const pendingSlugs = (save.pendingCombatNpcSlugs as string[] | null) ?? [];
    if (pendingSlugs.length === 0) {
      return reply.status(404).send({ error: 'No hay ningún combate pendiente del que huir' });
    }

    const npcs = await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: pendingSlugs } } });
    const maxNpcLevel = npcs.reduce((max, n) => Math.max(max, n.level), 1);
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const defensa = effectiveDefense(save.inventoryItems);
    const dificultad = contraataqueDifficultyFor(maxNpcLevel, save.level, defensa);
    const roll = rollCheck(attributes, 'destreza', dificultad);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

    // Bug real reportado jugando (2026-08-30, mismo endpoint hermano de huir-en-curso): texto fijo
    // sin variación ni desglose de tirada visible — ver comentario completo en /combat/huir-en-curso.
    const textosExitoPre = [
      `${save.characterName} logra escapar antes de que el combate llegue a empezar de verdad — pero huir así, dejando la pelea sin dar la cara, es una mancha en su honor que no se borra sola.`,
      `${save.characterName} se aleja a tiempo, sin llegar a cruzar un solo golpe — aunque la retirada le pesa en el orgullo.`,
      `${save.characterName} lee la situación y decide no arriesgarse — se retira antes de que nadie pueda impedírselo.`,
    ];
    const textosFalloPre = [
      `${save.characterName} intenta escapar antes de que empiece la pelea, pero no lo consigue — no hay forma de zafarse de esto ahora mismo.`,
      `${save.characterName} busca una salida, pero el rival se interpone antes de que pueda alejarse — no hay escapatoria posible.`,
      `${save.characterName} da un paso atrás buscando distancia, pero queda atrapado — el enfrentamiento es inevitable.`,
    ];
    const text = roll.success ? textosExitoPre[roll.roll % textosExitoPre.length] : textosFalloPre[roll.roll % textosFalloPre.length];

    // Condición de carrera real (auditoría de código 2026-08-25): un turno real de `/turn/narrate`
    // (protegido por `claimTurnInFlight`) puede estar resolviendo un intercambio de combate en
    // paralelo y actualizando `pendingCombatNpcSlugs` (nuevo NPC entra en combate, o cambia el set)
    // justo en la ventana entre la lectura de arriba y este `update` — sin bloquear la fila, esa
    // escritura paralela se perdía en silencio bajo el `pendingCombatNpcSlugs: []` de huir. Se
    // bloquea la fila de `Save` (`SELECT ... FOR UPDATE`, mismo patrón que `progression.ts`/
    // `companeros.ts`/`cazar.ts`) y solo se limpia si el set sigue siendo EXACTAMENTE el mismo que
    // se leyó al principio — si cambió entre medias, se aborta con 409 en vez de pisarlo.
    const outcome = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ pendingCombatNpcSlugs: string[] | null }[]>`
        SELECT "pendingCombatNpcSlugs" FROM "Save" WHERE id = ${save.id} FOR UPDATE
      `;
      const freshSlugs = locked.pendingCombatNpcSlugs ?? [];
      const mismoSet = freshSlugs.length === pendingSlugs.length && freshSlugs.every((s) => pendingSlugs.includes(s));
      if (roll.success && !mismoSet) return { kind: 'cambiado' as const };

      await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, roll: roll as unknown as Prisma.InputJsonValue } });
      if (roll.success) await tx.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: [] } });
      return { kind: 'ok' as const };
    });

    if (outcome.kind === 'cambiado') {
      return reply.status(409).send({ error: 'El combate cambió mientras intentabas huir — vuelve a intentarlo.' });
    }
    return { escaped: roll.success, text, roll };
  });

  // Huir DENTRO de un combate ya iniciado (bug real 2026-08-28, ronda de correcciones — petición
  // explícita: "el huir es un turno pero no debería defenderte, o huyes o recibes un golpe
  // directo... que huir tenga un riesgo, y que esto se represente en la narración"). Antes,
  // `handleCombatHuir` (frontend) enviaba "Intento huir..." como texto libre normal, resuelto por
  // el motor de intercambio como un ataque/defensa disfrazado — indistinguible mecánicamente de
  // Defenderse. Este endpoint reutiliza la MISMA tirada determinista que `/combat/flee` (arriba,
  // huir ANTES de entrar), pero con una consecuencia real distinta si falla: en vez de solo narrar
  // que no lo consigue y dejar el combate intacto, aplica un golpe directo SIN tirada de defensa —
  // el escalón de condición física empeora un paso real (`oneStepWorseThan`), sin posibilidad de
  // bloquear/esquivar, mismo espíritu que "arriesgas algo real a cambio de intentar escapar".
  app.post<{ Params: { id: string } }>('/saves/:id/combat/huir-en-curso', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      include: { worldState: true, inventoryItems: { where: { slot: { not: null } } } },
    });
    if (!save) {
      return reply.status(404).send({ error: 'Partida no encontrada' });
    }
    if (rejectIfEnded(save, reply)) return;

    const pendingSlugs = (save.pendingCombatNpcSlugs as string[] | null) ?? [];
    if (pendingSlugs.length === 0) {
      return reply.status(404).send({ error: 'No hay ningún combate en curso del que huir' });
    }
    if (save.condicionFisica === 'CONVALECIENTE' || save.condicionFisica === 'MUERTO') {
      // El golpe directo de un fallo llevaría a MUERTO sin ninguna posibilidad de reacción — el
      // mismo caso ya bloqueado para cualquier otra acción de combate en este estado (Matar/
      // Capturar/Clemente son las únicas salidas reales desde CONVALECIENTE).
      return reply.status(409).send({ error: 'No puedes intentar huir estando convaleciente — resuelve tu propia condición primero.' });
    }

    const npcs = await prisma.npc.findMany({ where: { worldId: save.worldId, slug: { in: pendingSlugs } } });
    const maxNpcLevel = npcs.reduce((max, n) => Math.max(max, n.level), 1);
    const attributes = effectiveAttributes(save.attributes as AttributeBlock, save.inventoryItems);
    const defensa = effectiveDefense(save.inventoryItems);
    const dificultad = contraataqueDifficultyFor(maxNpcLevel, save.level, defensa);
    const roll = rollCheck(attributes, 'destreza', dificultad);
    const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';

    const nuevaCondicion = roll.success ? save.condicionFisica : oneStepWorseThan(save.condicionFisica);
    // Bug real reportado jugando (2026-08-30): 3 intentos de huir seguidos narraban EXACTAMENTE la
    // misma frase fija, sin ningún desglose visible — parecía un error repitiendo texto en vez de 3
    // intentos reales distintos. Fix: varias variantes por `gradoExito` (mismo criterio que el
    // resto del motor de tiradas) + el `roll` completo se devuelve en la respuesta para que el
    // frontend lo pinte con `RollBadge`, igual que cualquier otra tirada — antes se calculaba y se
    // descartaba, sin llegar nunca al jugador.
    const textosExito = [
      `${save.characterName} rompe el contacto de un salto certero y logra escapar del combate — no sin dejar atrás el orgullo de haber dado la cara.`,
      `${save.characterName} encuentra el hueco justo y se escabulle del combate antes de que el rival pueda reaccionar.`,
      `${save.characterName} finta, gira sobre sus talones y logra poner distancia real — el combate queda atrás.`,
    ];
    const textosFallo = [
      `${save.characterName} intenta huir, pero el rival aprovecha el movimiento para conectar un golpe directo, sin darle tiempo a defenderse.`,
      `${save.characterName} se vuelve para escapar, pero el rival es más rápido y le alcanza de lleno antes de que pueda alejarse.`,
      `${save.characterName} rompe a correr, pero tropieza en el peor momento — el rival aprovecha el traspié para golpear sin oposición.`,
    ];
    const text = roll.success ? textosExito[roll.roll % textosExito.length] : textosFallo[roll.roll % textosFallo.length];

    // Mismo candado que /combat/flee (auditoría de código 2026-08-25) — un turno real de
    // /turn/narrate en paralelo puede estar actualizando `pendingCombatNpcSlugs` justo ahora.
    const outcomeEnCurso = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ pendingCombatNpcSlugs: string[] | null }[]>`
        SELECT "pendingCombatNpcSlugs" FROM "Save" WHERE id = ${save.id} FOR UPDATE
      `;
      const freshSlugs = locked.pendingCombatNpcSlugs ?? [];
      const mismoSet = freshSlugs.length === pendingSlugs.length && freshSlugs.every((s) => pendingSlugs.includes(s));
      if (roll.success && !mismoSet) return { kind: 'cambiado' as const };

      await tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, roll: roll as unknown as Prisma.InputJsonValue } });
      await tx.save.update({
        where: { id: save.id },
        data: {
          condicionFisica: nuevaCondicion,
          ...(roll.success ? { pendingCombatNpcSlugs: [] } : {}),
        },
      });
      return { kind: 'ok' as const };
    });

    if (outcomeEnCurso.kind === 'cambiado') {
      return reply.status(409).send({ error: 'El combate cambió mientras intentabas huir — vuelve a intentarlo.' });
    }
    return { escaped: roll.success, text, condicionFisica: nuevaCondicion, roll };
  });

  // CONVALECIENTE deja de ser "victoria automática" (petición explícita, 2026-08-26): sobre un
  // enemigo CONVALECIENTE la jugadora elige Capturar (`/capturar/:npcSlug`, ya existía), Matar
  // (Decapitar, ya existía) o Dejarlo vivir — este último, nuevo. Determinista, sin tirada: la
  // jugadora ya ganó el derecho a decidir en cuanto lo dejó CONVALECIENTE, no hace falta jugárselo
  // otra vez. Saca al NPC de `pendingCombatNpcSlugs` (deja de ser objetivo activo — el combate
  // sigue con el resto si queda alguien, o termina si era el último) pero NO toca
  // `condicionFisica`: se queda CONVALECIENTE de verdad, recupera solo con las horas de ficción
  // (misma regla ya existente, `applyCondicionTimeouts`).
  app.post<{ Params: { id: string; npcSlug: string }; Body: { participantId?: string } }>(
    '/saves/:id/combat/dejar-vivir/:npcSlug',
    async (request, reply) => {
      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        include: { worldState: true, currentLocation: { select: { id: true } } },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const npc = await prisma.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: request.params.npcSlug } } });
      if (!npc) return reply.status(404).send({ error: 'NPC no encontrado' });

      // Combate múltiple real (2026-08-29, bug real jugando en vivo — ver comentario de
      // `CombatParticipant.dismissedGrupo` en schema.prisma): con `participantId`, la condición
      // real del individuo vive en `CombatParticipant.condicionFisicaGrupo` para un miembro de
      // grupo (null para un solitario dentro de un CombatEncounter, que sigue usando NpcState como
      // siempre) — nunca en `NpcState`, que es una fila COMPARTIDA por toda la especie. Marcar
      // `dismissedGrupo: true` es lo que `detail.ts` respeta al reconstruir la tarjeta pendiente
      // tras recargar.
      const participantId = request.body?.participantId;
      if (participantId) {
        const participant = await prisma.combatParticipant.findUnique({ where: { id: participantId } });
        if (!participant || participant.npcId !== npc.id) {
          return reply.status(404).send({ error: 'Ese combatiente no existe en este combate.' });
        }
        const condicionReal =
          participant.condicionFisicaGrupo ??
          (await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope: participant.npcScope } } }))
            ?.condicionFisica ??
          'ILESO';
        if (condicionReal !== 'CONVALECIENTE') {
          return reply.status(400).send({ error: 'Solo puedes dejar vivir a un enemigo CONVALECIENTE.' });
        }

        const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
        const text = `${save.characterName} deja con vida a ${npc.name}, convaleciente en el suelo — se aparta sin darle el golpe final.`;
        const logEntry = await prisma.$transaction(async (tx) => {
          await tx.combatParticipant.update({ where: { id: participantId }, data: { dismissedGrupo: true } });
          return tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel } });
        });
        return { npcSlug: npc.slug, participantId, logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() } };
      }

      const scope = scopeFor(npc.kind, save.currentLocation?.id ?? null);
      const state = await prisma.npcState.findUnique({ where: { saveId_npcId_scope: { saveId: save.id, npcId: npc.id, scope } } });
      if (!state || state.condicionFisica !== 'CONVALECIENTE') {
        return reply.status(400).send({ error: 'Solo puedes dejar vivir a un enemigo CONVALECIENTE.' });
      }

      const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
      const text = `${save.characterName} deja con vida a ${npc.name}, convaleciente en el suelo — se aparta sin darle el golpe final.`;

      // Mismo candado que /combat/flee (auditoría de código 2026-08-25) — un turno real de
      // /turn/narrate en paralelo puede estar actualizando `pendingCombatNpcSlugs` justo ahora.
      const logEntry = await prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<{ pendingCombatNpcSlugs: string[] | null }[]>`
          SELECT "pendingCombatNpcSlugs" FROM "Save" WHERE id = ${save.id} FOR UPDATE
        `;
        const freshSlugs = (locked.pendingCombatNpcSlugs ?? []).filter((s) => s !== npc.slug);
        await tx.save.update({ where: { id: save.id }, data: { pendingCombatNpcSlugs: freshSlugs } });
        return tx.logEntry.create({ data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel } });
      });

      return { npcSlug: npc.slug, logEntry: { id: logEntry.id, text, timeLabel, createdAt: logEntry.createdAt.toISOString() } };
    },
  );
}
