import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slugify.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';

/// Fundación de reino (2026-08-04, docs/17-reglas-construcciones-reino.md) — el popup que se abre
/// al terminar de construir el Ayuntamiento (tier 1) manda aquí el formulario. Decisión manual de
/// la jugadora, nunca del modelo (mismo criterio narrativo-sin-mecánica que el resto de Save).
///
/// Fundar tu reino TAMBIÉN funda tu propia facción (2026-08-06) — el propio documento de diseño
/// original ("fundar la facción") ya lo decía, pero el catálogo `Faction` de la Enciclopedia no
/// existía todavía cuando se construyó esto: solo llegó a crear el `Territory`. Ahora, en la misma
/// transacción, se crea también la fila `Faction` (escapada a esta partida vía `saveId`) y su
/// `DiscoveredEntity` — la jugadora ya "conoce" su propia facción en cuanto la funda.
/// Plantillas básicas por rol (hueco real cerrado, auditoría de lore 2026-08-25, ver
/// `companeros-y-supervivencia.md` § 6): "vienen ya hechas por rol, listas para usar sin
/// configurar nada" — se siembran aquí, al fundar el Reino, porque `PlantillaEquipo` es
/// saveId-scoped y no tiene sentido antes de tener un Reino donde asignarlas. Criterio de ranura
/// por rol, mismo vocabulario de `category` que usa el resto del catálogo (`arma`/`ropa`/
/// `herramienta`, ver `startingInventory.ts`: un objeto `category:'herramienta'` se equipa en
/// ARMA_SECUNDARIA, igual que el cuchillo de Gorhorn):
/// - guardia: arma + armadura — combate.
/// - trabajador/productor: solo herramienta — labor sin necesidad de armadura de combate.
/// `personalizada: false` las marca como no-editables (el frontend oculta "Borrar" para estas).
const PLANTILLAS_BASICAS: { name: string; rol: string; prioridad: number; slots: Prisma.InputJsonValue }[] = [
  { name: 'Guardia básico', rol: 'guardia', prioridad: 0, slots: { ARMA_PRINCIPAL: { category: 'arma' }, ARMADURA_SUPERIOR: { category: 'ropa' } } },
  { name: 'Trabajador básico', rol: 'trabajador', prioridad: 1, slots: { ARMA_SECUNDARIA: { category: 'herramienta' } } },
  { name: 'Productor básico', rol: 'productor', prioridad: 1, slots: { ARMA_SECUNDARIA: { category: 'herramienta' } } },
];

export async function reinoRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { kingdomName: string; description?: string } }>(
    '/saves/:id/reino/fundar',
    async (request, reply) => {
      const { kingdomName, description } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) {
        return reply.status(404).send({ error: 'Partida no encontrada' });
      }
      // Bug real (auditoría de bugs, 2026-08-21): a diferencia de /turn/classify y /combat/flee
      // (session.ts), esta ruta nunca comprobaba `save.endedAt` — con la partida ya terminada por
      // muerte definitiva, el composer principal queda bloqueado en el frontend, pero el panel de
      // Reino sigue accesible y permitía fundar un reino nuevo para un personaje que la propia
      // partida ya da por definitivamente muerto.
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const ayuntamiento = await prisma.building.findFirst({ where: { saveId: save.id, recipeKey: 'ayuntamiento' } });
      if (!ayuntamiento) {
        return reply.status(400).send({ error: 'Todavía no has construido ningún Ayuntamiento' });
      }
      // Fundar dos veces crearía dos filas de Faction con el mismo slug determinista (choca contra
      // @@unique([worldId, slug])) — el frontend solo abre este formulario una vez (al construir el
      // Ayuntamiento tier 1 desde cero), pero se guarda explícito en vez de dejar que reviente el
      // segundo intento con un error de base de datos poco claro.
      if (save.kingdomName) {
        return reply.status(400).send({ error: 'Ya has fundado tu reino' });
      }

      // Gorhorn (petición explícita, 2026-08-04): el nombre del reino viene precargado y
      // BLOQUEADO — "Maktor" — verificado aquí en el backend, no solo ocultando el campo en el
      // formulario del frontend (mismo criterio que isStarting/isDynamic en habilidades.ts).
      const isGorhorn = save.characterName === 'Gorhorn';
      const finalKingdomName = isGorhorn ? 'Maktor' : kingdomName?.trim();
      if (!finalKingdomName) {
        return reply.status(400).send({ error: 'Falta el campo: kingdomName' });
      }

      // Sin raza no hay bajo qué agrupar la facción en la Enciclopedia (petición explícita: "las
      // facciones agrupadas por raza") — no debería pasar en partidas nuevas (la raza se fija al
      // crear personaje), pero una partida antigua sin este campo no debe crear una facción rota.
      if (!save.raza) {
        return reply.status(400).send({ error: 'Tu personaje necesita una raza asignada para fundar una facción' });
      }

      const trimmedDescription = description?.trim();
      const factionSlug = `${slugify(finalKingdomName)}-${save.id}`;

      try {
        await prisma.$transaction(async (tx) => {
          await tx.save.update({ where: { id: save.id }, data: { kingdomName: finalKingdomName } });
          if (trimmedDescription && ayuntamiento.territoryId) {
            await tx.territory.update({ where: { id: ayuntamiento.territoryId }, data: { description: trimmedDescription } });
          }
          const faction = await tx.faction.create({
            data: {
              worldId: save.worldId,
              saveId: save.id,
              slug: factionSlug,
              name: finalKingdomName,
              raza: save.raza!,
              description: trimmedDescription || `Facción fundada por ${save.characterName}.`,
            },
          });
          await tx.discoveredEntity.create({
            data: { saveId: save.id, entityType: 'faction', entitySlug: faction.slug },
          });
          await tx.plantillaEquipo.createMany({
            data: PLANTILLAS_BASICAS.map((p) => ({ ...p, saveId: save.id, personalizada: false })),
          });
        });
      } catch (err) {
        // Condición de carrera (auditoría de código completa, 2026-08-07): el guard de
        // `save.kingdomName` de arriba se lee ANTES de esta transacción — dos "fundar reino" casi
        // simultáneos (doble clic) pasan ambos el guard con `kingdomName` todavía null, y el
        // segundo choca aquí contra el `@@unique` de `Faction.slug` (determinista, mismo saveId).
        // Sin este catch, ese choque se propagaba como 500 genérico en vez del mismo 400 claro que
        // ya da el guard normal.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.status(400).send({ error: 'Ya has fundado tu reino' });
        }
        throw err;
      }

      return { kingdomName: finalKingdomName };
    },
  );
}
