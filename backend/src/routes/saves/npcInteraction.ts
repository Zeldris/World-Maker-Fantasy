import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { rejectIfEnded, clearPendingOffer, toFrontendLogEntry } from './shared.js';
import { ayudarNpc } from '../../services/ayudarNpc.js';
import { ofrecerTrabajoDeNpc } from '../../services/cronista/generarMisiones.js';
import { OPCION_NOTICIAS, OPCION_TRABAJO } from '../../services/npcInteraction.js';
import { preguntarNoticias } from '../../services/cronista/difusion.js';

/// Menú contextual de interacción con NPC (2026-09-06, "Aprender oficio" deja de depender de una
/// habilidad suelta) — el motor ya decidió el candidato y sus opciones en el turno normal
/// (`npcInteractionOffer`, turnResolution.ts), esta única ruta solo resuelve la elección, mismo
/// espíritu que `POST /saves/:id/modo-dinamico/ignorar`/`quests/aceptar`: no vuelve a pasar por el
/// clasificador de intención de `/turn/narrate`.
export async function npcInteractionRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string; npcSlug: string }; Body: { opcion: string } }>(
    '/saves/:id/npc-interaction/:npcSlug/elegir',
    async (request, reply) => {
      const { opcion } = request.body;
      if (!opcion?.trim()) return reply.status(400).send({ error: 'Falta el campo: opcion' });

      const save = await prisma.save.findUnique({
        where: { id: request.params.id },
        select: { id: true, endedAt: true, pendingNpcInteractionOffer: true },
      });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;

      const offer = save.pendingNpcInteractionOffer as { npcSlug: string; npcName: string; options: string[] } | null;
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
      // 'Charlar' y 'Salir' no necesitan ninguna acción más allá de cerrar la tarjeta.
      return { accion: 'CERRAR' as const };
    },
  );
}
