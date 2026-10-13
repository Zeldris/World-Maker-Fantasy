import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, rejectIfPendingDeath, clearPendingOffer, toFrontendLogEntry } from './shared.js';
import { ayudarNpc } from '../../services/ayudarNpc.js';
import { ofrecerTrabajoDeNpc } from '../../services/cronista/generarMisiones.js';
import { OPCION_INFORMANTE, OPCION_NOTICIAS, OPCION_TRABAJO, OPCION_UNIRSE } from '../../services/npcInteraction.js';
import { proponer } from '../../services/cronista/reclutamiento.js';
import { Prisma } from '@prisma/client';
import { preguntarNoticias } from '../../services/cronista/difusion.js';
import { abrirMenuDeNpc } from '../../services/menuDeNpc.js';

interface OfertaDeMenu { npcSlug: string; npcName: string; options: string[]; desdeEncuentro?: boolean }

/// Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de depender de una
/// habilidad suelta) — el motor ya decidió el candidato y sus opciones en el turno normal
/// (`npcInteractionOffer`, turnResolution.ts), esta única ruta solo resuelve la elección, mismo
/// espíritu que `POST /saves/:id/modo-dinamico/ignorar`/`quests/aceptar`: no vuelve a pasar por el
/// clasificador de intención de `/turn/narrate`.
export async function npcInteractionRoutes(app: FastifyInstance) {
  /// P142 (2026-10-13): «Interactuar» en la tarjeta de un NPC del mapa abre su menú fijo (oficio,
  /// trabajo, noticias…) en vez de ir directo a la escena libre, que pasa a ser «Charlar». Solo
  /// sobre el encuentro pendiente de ese NPC; uno que te corta el paso no tiene menú. Responde
  /// `{ menu: null }` si el NPC no tiene menú propio (la tarjeta abre la escena de siempre).
  app.post<{ Params: { id: string; npcSlug: string } }>('/saves/:id/npc-interaction/:npcSlug/abrir', async (request, reply) => {
    const save = await prisma.save.findUnique({
      where: { id: request.params.id },
      select: { id: true, endedAt: true, pendingDeathResolution: true, pendingDynamicMode: true, pendingDynamicModeOffer: true },
    });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
    if (rejectIfEnded(save, reply)) return;
    // Mismas comprobaciones que `/modo-dinamico/interactuar`, que es lo que sustituye.
    if (rejectIfPendingDeath(save, reply)) return;
    if (save.pendingDynamicMode) return reply.status(409).send({ error: 'Ya hay un modo dinámico en curso' });
    const encuentro = save.pendingDynamicModeOffer as { tipo?: string; targetSlug?: string; targetName?: string; combateForzado?: boolean } | null;
    if (!encuentro || encuentro.tipo !== 'NPC' || encuentro.targetSlug !== request.params.npcSlug) {
      return reply.status(409).send({ error: 'Esa interacción ya no está disponible' });
    }
    if (encuentro.combateForzado) return { menu: null };
    const menu = await abrirMenuDeNpc(prisma, save.id, request.params.npcSlug, encuentro.targetName ?? request.params.npcSlug);
    return { menu };
  });

  app.post<{ Params: { id: string; npcSlug: string }; Body: { opcion: string } }>(
    '/saves/:id/npc-interaction/:npcSlug/elegir',
    async (request, reply) => {
      const { opcion } = request.body;
      if (!opcion?.trim()) return reply.status(400).send({ error: 'Falta el campo: opcion' });

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        select: { id: true, endedAt: true, pendingNpcInteractionOffer: true, pendingDynamicModeOffer: true },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const offer = save.pendingNpcInteractionOffer as OfertaDeMenu | null;
      // Guard de "oferta ya no vigente" (mismo patrón que dynamicMode.ts) — evita resolver una
      // elección sobre una tarjeta que ya no es la actual (p. ej. dos pestañas abiertas, o la
      // oferta se limpió por otro camino mientras tanto).
      if (!offer || offer.npcSlug !== request.params.npcSlug) {
        return reply.status(409).send({ error: 'Esa interacción ya no está disponible' });
      }
      if (!offer.options.includes(opcion)) {
        return reply.status(400).send({ error: 'Esa opción no está disponible para este NPC ahora mismo' });
      }

      await clearPendingOffer(save.id, 'pendingNpcInteractionOffer');

      // P142: el menú abierto desde un encuentro del mapa. «Charlar» abre la escena libre de ese
      // encuentro y «Combatir» lo convierte en combate (el frontend reutiliza el Interactuar del
      // encuentro, que sigue pendiente); cualquier otra opción lo da por resuelto. Solo si el
      // encuentro pendiente sigue siendo el de este NPC: si ya no, el menú está caducado y no se toca
      // el encuentro de otro (`/code-review` del PR #53).
      if (offer.desdeEncuentro) {
        const encuentro = save.pendingDynamicModeOffer as { tipo?: string; targetSlug?: string } | null;
        if (encuentro?.tipo !== 'NPC' || encuentro.targetSlug !== offer.npcSlug) {
          return reply.status(409).send({ error: 'Ese encuentro ya no está disponible' });
        }
        if (opcion === 'Charlar') return { accion: 'CHARLAR' as const };
        if (opcion === 'Combatir') return { accion: 'FORZAR_COMBATE' as const, npcSlug: offer.npcSlug, desdeEncuentro: true };
        await prisma.save.update({ where: { id: save.id }, data: { pendingDynamicModeOffer: Prisma.JsonNull } });
      }

      // Traducción de la opción elegida a una señal que el frontend ya sabe interpretar — cada
      // rama reutiliza un flujo YA EXISTENTE y probado (aprenderOficio.ts/companeros.ts/combate),
      // esta ruta no reimplementa ninguna de esas mecánicas, solo decide cuál abrir.
      if (opcion === 'Aprender profesión') return { accion: 'ABRIR_APRENDER_OFICIO' as const };
      if (opcion === 'Reclutar') return { accion: 'ABRIR_RECLUTAR' as const };
      if (opcion === 'Combatir') return { accion: 'FORZAR_COMBATE' as const, npcSlug: offer.npcSlug };
      // CR-12: ayudar a un malherido (ver `ayudarNpc.ts`).
      if (opcion === 'Ayudar') {
        const entrada = await ayudarNpc(prisma, save.id, offer.npcSlug);
        return entrada ? { accion: 'AYUDADO' as const, logEntry: toFrontendLogEntry(entrada) } : { accion: 'CERRAR' as const };
      }
      if (opcion.startsWith('Misión: ')) return { accion: 'MOSTRAR_OFERTA_MISION' as const };
      // CR-40 (40f): misión personal del NPC, de las plantillas del motor (nunca inventada).
      if (opcion === OPCION_TRABAJO) {
        const aviso = await ofrecerTrabajoDeNpc(prisma, save.id, offer.npcSlug);
        return aviso
          ? { accion: 'OFERTA_TRABAJO' as const, npcName: offer.npcName, aviso }
          : { accion: 'SIN_TRABAJO' as const, texto: `${offer.npcName} no tiene ningún encargo para ti ahora mismo.` };
      }
      // CR-18 (18c): lo que se dice por aquí; las noticias van a «El mundo» y la frase del NPC, al registro.
      if (opcion === OPCION_NOTICIAS) {
        const contado = await preguntarNoticias(prisma, save.id, offer.npcSlug);
        if (!contado) return { accion: 'CERRAR' as const };
        const ws = await prisma.worldState.findUnique({ where: { saveId: save.id }, select: { fictionalMinutes: true, fictionalDateLabel: true } });
        const entrada = await prisma.logEntry.create({
          data: { saveId: save.id, channel: 'CHARACTER', isSystemMessage: true, text: contado.frase, fictionalMinutes: ws?.fictionalMinutes ?? 0, timeLabel: ws?.fictionalDateLabel ?? '' },
        });
        return { accion: 'CONTADO' as const, logEntry: toFrontendLogEntry(entrada) };
      }
      // CR-32: reclutar sin pelear o captar un informante, con su tirada de Carisma en el registro.
      if (opcion === OPCION_UNIRSE || opcion === OPCION_INFORMANTE) {
        const r = await proponer(prisma, save.id, offer.npcSlug, opcion === OPCION_UNIRSE ? 'RECLUTAR' : 'INFORMANTE');
        const ws = await prisma.worldState.findUnique({ where: { saveId: save.id }, select: { fictionalMinutes: true, fictionalDateLabel: true } });
        const entrada = await prisma.logEntry.create({
          data: {
            saveId: save.id, channel: 'CHARACTER', isSystemMessage: true, text: r.ok ? r.texto : r.motivo,
            fictionalMinutes: ws?.fictionalMinutes ?? 0, timeLabel: ws?.fictionalDateLabel ?? '',
            ...(r.ok ? { roll: r.roll as unknown as Prisma.InputJsonValue } : {}),
          },
        });
        return { accion: 'PROPUESTA' as const, logEntry: toFrontendLogEntry(entrada), unido: r.ok && r.exito && !!r.companionId };
      }
      // 'Charlar' y 'Salir' no necesitan ninguna acción más allá de cerrar la tarjeta.
      return { accion: 'CERRAR' as const };
    },
  );
}
