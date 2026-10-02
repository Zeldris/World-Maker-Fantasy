import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { registrarSuceso, minutosDeFiccion } from '../../services/cronista/sucesos.js';
import { slugify } from '../../lib/slugify.js';
import { rejectIfEnded, rejectIfPendingDeath } from './shared.js';
import { professionLevelForXp, alivioForLevel } from '../../services/professionProgress.js';
import { recordFactionEvent, espiarFactionRelation, nivelDiplomaticoRequerido, xpPorNegociacion, type FactionEventType } from '../../services/factionRelations.js';
import { precioDinamico } from '../../services/economia.js';
import { quantityOf } from '../../services/ingredients.js';

/// Fundación de reino (2026-08-04, docs/mecanicas/17-reglas-construcciones-reino.md) — el popup que se abre
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

      const ayuntamiento = await prisma.building.findFirst({ where: { saveId: save.id, recipeKey: 'ayuntamiento' }, include: { location: true } });
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
      // Zona-interior navegable propia del reino (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4,
      // 2026-09-21) — mismo patrón que `factionSlug` de arriba: slug determinista con `save.id`
      // para que nunca choque con el catálogo (Location de facción NPC) ni con otra partida del
      // mismo mundo (`@@unique([worldId, slug])`). Primera vez que el motor crea una `Location` en
      // TIEMPO DE PARTIDA (hasta ahora, 100% catálogo sembrado a mano) — deliberado, ver § 7.4.
      const kingdomLocationSlug = `ayuntamiento-interior-${save.id}`;

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

          // Sin `x`/`y` propias a propósito (mismo criterio que `campamento-serhu-interior`): vive
          // "dentro" de las coordenadas de la Location exterior donde está el Ayuntamiento, no es
          // un punto nuevo del mapa de MUNDO. `region` hereda la del Ayuntamiento — coherente con
          // que hoy solo existe una capital por reino, en la región donde se fundó.
          const kingdomLocation = await tx.location.create({
            data: {
              worldId: save.worldId,
              slug: kingdomLocationSlug,
              name: `Hogar de ${finalKingdomName}`,
              region: ayuntamiento.location?.region ?? '',
              kind: 'interior',
              description: `Dentro de la empalizada de ${finalKingdomName}: tierra apisonada en torno al Ayuntamiento — cada construcción real del reino tiene su propia posición marcada en el mapa de la zona.`,
              aliases: [slugify(finalKingdomName)],
            },
          });
          if (ayuntamiento.locationId) {
            // Entrada/salida instantánea (mismo criterio que el resto de interiores de facción,
            // `minutosBase: 0` — "es solo cruzar la empalizada"). Una sola fila basta:
            // `buildAdjacency` (travel.ts) ya trata cada `LocationLink` como bidireccional.
            await tx.locationLink.create({
              data: { fromId: ayuntamiento.locationId, toId: kingdomLocation.id, minutosBase: 0, terreno: 'La entrada del Ayuntamiento' },
            });
          }

          // Parcelas (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 7.4, "concepto estilo Travian") — huecos
          // de construcción marcados a priori en el lienzo 800×600, centro en (400,300)/CELL_SIZE_PX
          // 50 (zonaPosicion.ts). La AVANZADA del centro ya está OCUPADA desde el minuto uno por el
          // Ayuntamiento que se acaba de construir (fundar reino es un paso posterior, nunca
          // simultáneo) — se enlaza a `ayuntamiento.id` real, no queda vacía. Las 3 BÁSICAS
          // alrededor quedan vacías: primera pasada deliberadamente modesta (poca variedad de
          // edificios todavía, se amplía sembrando más cuando haga falta).
          await tx.parcela.create({
            data: { locationId: kingdomLocation.id, x: 400, y: 300, tipo: 'AVANZADA', recipeKeyFijo: 'ayuntamiento', buildingId: ayuntamiento.id },
          });
          await tx.parcela.createMany({
            data: [
              { locationId: kingdomLocation.id, x: 400, y: 150, tipo: 'BASICA' },
              { locationId: kingdomLocation.id, x: 250, y: 400, tipo: 'BASICA' },
              { locationId: kingdomLocation.id, x: 550, y: 400, tipo: 'BASICA' },
            ],
          });

          // Libro de Sucesos (CR-3, hito 0.2).
          const region = ayuntamiento.location?.region ?? '';
          await registrarSuceso(tx, {
            saveId: save.id,
            tipo: 'REINO_FUNDADO',
            fictionalMinutes: await minutosDeFiccion(tx, save.id),
            regionSlug: region ? slugify(region) : null,
            locationId: ayuntamiento.locationId,
            origen: 'JUGADOR',
            actores: [
              { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
              { entidadTipo: 'FACCION', entidadId: faction.slug, papel: 'BENEFICIARIO' },
              ...(ayuntamiento.locationId ? [{ entidadTipo: 'LOCATION' as const, entidadId: ayuntamiento.locationId, papel: 'LUGAR' as const }] : []),
            ],
            datos: { reino: finalKingdomName, fundador: save.characterName, region: region || 'tierra sin nombre' },
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

  // Diplomacia (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md § 4.4/§ 5-bis punto 6, 2026-09-21) — acción
  // PUNTUAL de un Companion/Subject del jugador con nivel de oficio 'diplomatico' suficiente,
  // estilo Agente de X4: nunca un Npc de facción (decisión explícita: "una cosa son companions...
  // y otra es NPC/fauna de facción, van por separado"), nunca exige nada de la facción destino.
  const DIPLOMACIA_ACCIONES: Record<'negociar' | 'sabotear' | 'espiar', FactionEventType | null> = {
    negociar: 'NEGOCIACION_TREGUA',
    sabotear: 'SABOTAJE_DIPLOMATICO',
    espiar: null, // el espionaje nunca mueve presion — ver espiarFactionRelation
  };

  /// Señal interna para abortar por nivel insuficiente sin que Prisma la trate como un error de
  /// escritura real (mismo patrón que `CapturaEnCursoError`, companeros.ts) — capturada justo
  /// después del `$transaction`, nunca se propaga.
  class NivelDiplomaticoInsuficienteError extends Error {
    constructor(public nivel: number, public nivelExigido: number) {
      super('Nivel de diplomacia insuficiente');
    }
  }

  app.post<{ Params: { id: string }; Body: { companionId: string; targetFactionSlug: string; accion: 'negociar' | 'sabotear' | 'espiar' } }>(
    '/saves/:id/reino/diplomacia',
    async (request, reply) => {
      const { companionId, targetFactionSlug, accion } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;
      if (accion !== 'espiar' && accion !== 'negociar' && accion !== 'sabotear') {
        return reply.status(400).send({ error: `Acción desconocida: ${accion}` });
      }

      const companion = await prisma.companion.findFirst({ where: { id: companionId, saveId: save.id, rolReino: 'diplomatico' } });
      if (!companion) return reply.status(400).send({ error: 'Ese Companion no es un diplomático de tu Reino (rolReino: "diplomatico")' });

      const sourceFaction = await prisma.faction.findFirst({ where: { saveId: save.id }, select: { id: true, name: true, worldId: true } });
      if (!sourceFaction) return reply.status(400).send({ error: 'Todavía no has fundado tu Reino' });

      const targetFaction = await prisma.faction.findFirst({ where: { worldId: sourceFaction.worldId, slug: targetFactionSlug }, select: { id: true, name: true, slug: true } });
      if (!targetFaction) return reply.status(404).send({ error: `Facción desconocida: ${targetFactionSlug}` });
      if (targetFaction.id === sourceFaction.id) return reply.status(400).send({ error: 'No puedes hacer diplomacia contra tu propio Reino' });

      const progreso = await prisma.professionProgress.findUnique({
        where: { companionId_professionId: { companionId: companion.id, professionId: 'diplomatico' } },
        select: { xp: true },
      });
      const nivel = professionLevelForXp(progreso?.xp ?? 0);

      const resultado = await prisma
        .$transaction(async (tx) => {
          if (accion === 'espiar') {
            const info = await espiarFactionRelation(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id);
            // Libro de Sucesos (CR-3, hito 0.2).
            await registrarSuceso(tx, {
              saveId: save.id, tipo: 'ESPIONAJE', fictionalMinutes: await minutosDeFiccion(tx, save.id), origen: 'JUGADOR',
              actores: [
                { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
                { entidadTipo: 'COMPANERO', entidadId: companion.id, papel: 'AUTOR' },
                { entidadTipo: 'FACCION', entidadId: targetFaction.slug, papel: 'AFECTADO' },
              ],
              datos: { autor: sourceFaction.name, espiada: targetFaction.name },
            });
            return { ok: true as const, accion, targetFaction: targetFaction.name, hechoDeMundo: null as string | null, ...info };
          }

          // Gate de nivel — mismo criterio que trabajadorPuedeProducir (kingdomProduction.ts):
          // cuanto más lejos del neutro ya está la relación, más nivel exige moverla más.
          const relacionPrevia = await espiarFactionRelation(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id);
          const nivelExigido = nivelDiplomaticoRequerido(relacionPrevia.presion);
          if (nivelExigido > Math.max(1, alivioForLevel(nivel) + 1)) {
            throw new NivelDiplomaticoInsuficienteError(nivel, nivelExigido);
          }

          const event = DIPLOMACIA_ACCIONES[accion]!;
          const hechoDeMundo = await recordFactionEvent(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id, event, save.id);
          // Libro de Sucesos (CR-3, hito 0.2): el sabotaje es un suceso aunque no cambie la banda;
          // negociar solo cuenta cuando la cambia (tregua, tratado…), y eso ya lo apunta recordFactionEvent.
          if (accion === 'sabotear') {
            await registrarSuceso(tx, {
              saveId: save.id, tipo: 'SABOTAJE', fictionalMinutes: await minutosDeFiccion(tx, save.id), origen: 'JUGADOR',
              actores: [
                { entidadTipo: 'PERSONAJE', entidadId: save.id, papel: 'AUTOR' },
                { entidadTipo: 'COMPANERO', entidadId: companion.id, papel: 'AUTOR' },
                { entidadTipo: 'FACCION', entidadId: targetFaction.slug, papel: 'VICTIMA' },
              ],
              datos: { autor: sourceFaction.name, victima: targetFaction.name },
            });
          }

          // H-5 parcial (decisión de Álvaro, 2026-09-29): cada negociación conseguida da XP de
          // oficio 'diplomatico' al diplomático — así el gate de nivel deja de bloquear tras la
          // primera tregua. Solo 'negociar' (el "sube negociando"); sabotear/espiar no dan XP.
          // Mismo upsert que dailyTick.ts para el XP de oficio de un Companion.
          let xpGanada = 0;
          let nivelDiplomatico = nivel;
          if (accion === 'negociar') {
            xpGanada = xpPorNegociacion(nivelExigido);
            const xpNueva = (progreso?.xp ?? 0) + xpGanada;
            nivelDiplomatico = professionLevelForXp(xpNueva);
            await tx.professionProgress.upsert({
              where: { companionId_professionId: { companionId: companion.id, professionId: 'diplomatico' } },
              create: { companionId: companion.id, professionId: 'diplomatico', nivel: nivelDiplomatico, xp: xpNueva },
              update: { xp: { increment: xpGanada }, nivel: nivelDiplomatico },
            });
          }
          return { ok: true as const, accion, targetFaction: targetFaction.name, hechoDeMundo, xpGanada, nivelDiplomatico };
        })
        .catch((err) => {
          if (err instanceof NivelDiplomaticoInsuficienteError) return err;
          throw err;
        });

      if (resultado instanceof NivelDiplomaticoInsuficienteError) {
        return reply.status(409).send({
          error: `${companion.name} no tiene nivel de diplomacia suficiente (nivel ${resultado.nivel}, se exige al menos nivel ${resultado.nivelExigido} para mover una relación tan asentada).`,
        });
      }
      return resultado;
    },
  );

  // Mercado regulado — jugador↔Faction, con goirnos personales (docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md
  // § 4.4, 2026-09-21) — requisito real de tratado comercial (decisión explícita de Álvaro: cierra
  // el bucle diplomacia→mercado, negociar de verdad ABRE comercio, sabotear lo CIERRA). El comercio
  // de VOLUMEN Reino↔Faction (KingdomStats.riqueza) es una pieza aparte, sin código todavía.
  const TIPOS_CON_ACCESO_A_MERCADO = new Set<string>(['TRATADO_COMERCIAL', 'ALIANZA']);

  class SinTratadoComercialError extends Error {}
  class StockInsuficienteError extends Error {}

  async function verificaTratadoComercial(tx: Prisma.TransactionClient, worldId: string, sourceFactionId: string, targetFactionId: string): Promise<void> {
    const relation = await espiarFactionRelation(tx, worldId, sourceFactionId, targetFactionId);
    if (!TIPOS_CON_ACCESO_A_MERCADO.has(relation.type)) throw new SinTratadoComercialError();
  }

  /// Catálogo de mercado (hueco E, rediseño de frontend 2026-09-21) — sin esto, `comprar` exigía
  /// que el cliente YA conociera el `almacenItemId` exacto de antemano, imposible de obtener por
  /// ninguna vía. Consulta pura (GET, nunca 409): sin tratado responde `tratado:false` con
  /// `items:[]` en vez de rechazar — es el frontend quien decide mostrar "negocia un tratado
  /// primero" en vez de una pantalla de error. Un `almacenItemId` representativo por `catalogSlug`
  /// (cualquiera del grupo: todos con el mismo `catalogSlug` son intercambiables al mismo precio,
  /// igual que ya asume `stockDisponible` en comprar/vender).
  app.get<{ Params: { id: string; targetFactionSlug: string } }>(
    '/saves/:id/reino/mercado/:targetFactionSlug',
    async (request, reply) => {
      const { targetFactionSlug } = request.params;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

      const sourceFaction = await prisma.faction.findFirst({ where: { saveId: save.id }, select: { id: true, worldId: true } });
      if (!sourceFaction) return reply.status(400).send({ error: 'Todavía no has fundado tu Reino' });
      const targetFaction = await prisma.faction.findFirst({ where: { worldId: sourceFaction.worldId, slug: targetFactionSlug }, select: { id: true, name: true } });
      if (!targetFaction) return reply.status(404).send({ error: `Facción desconocida: ${targetFactionSlug}` });

      const tratado = await prisma
        .$transaction((tx) => verificaTratadoComercial(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id))
        .then(() => true)
        .catch((err) => {
          if (err instanceof SinTratadoComercialError) return false;
          throw err;
        });
      if (!tratado) return { ok: true, tratado: false, items: [] };

      const almacenRows = await prisma.almacenItem.findMany({
        where: { factionId: targetFaction.id, catalogSlug: { not: null } },
        select: { id: true, name: true, catalogSlug: true },
      });
      const grupos = new Map<string, { almacenItemId: string; name: string; catalogSlug: string; stock: number }>();
      for (const row of almacenRows) {
        const slug = row.catalogSlug!;
        const existing = grupos.get(slug);
        if (existing) existing.stock += 1;
        else grupos.set(slug, { almacenItemId: row.id, name: row.name, catalogSlug: slug, stock: 1 });
      }
      const catalogSlugs = [...grupos.keys()];
      const catalogRows = catalogSlugs.length
        ? await prisma.itemCatalog.findMany({ where: { worldId: sourceFaction.worldId, slug: { in: catalogSlugs } }, select: { slug: true, valorGoirnos: true } })
        : [];
      const valorBySlug = new Map(catalogRows.map((c) => [c.slug, c.valorGoirnos]));

      const items = [...grupos.values()]
        .filter((g) => (valorBySlug.get(g.catalogSlug) ?? 0) > 0)
        .map((g) => ({
          almacenItemId: g.almacenItemId,
          name: g.name,
          catalogSlug: g.catalogSlug,
          stock: g.stock,
          // Precio del montón entero que se va a traspasar (F9-5): comprar cobra `precio × cantidad`.
          precio: precioDinamico(valorBySlug.get(g.catalogSlug)!, g.stock) * quantityOf(g.name),
        }));

      return { ok: true, tratado: true, items };
    },
  );

  /// Comprar: el jugador paga `goirnos` propios por un objeto del Almacén de una Faction con
  /// tratado comercial/alianza real — el objeto pasa de `AlmacenItem.factionId` a
  /// `AlmacenItem.saveId` (mismo Almacén, solo cambia de dueño, ni el jugador ni la facción tienen
  /// mochila personal separada del Almacén de Reino para este flujo). Precio dinámico sobre el
  /// STOCK DE QUIEN VENDE (la facción).
  app.post<{ Params: { id: string }; Body: { targetFactionSlug: string; almacenItemId: string } }>(
    '/saves/:id/reino/mercado/comprar',
    async (request, reply) => {
      const { targetFactionSlug, almacenItemId } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const sourceFaction = await prisma.faction.findFirst({ where: { saveId: save.id }, select: { id: true, worldId: true } });
      if (!sourceFaction) return reply.status(400).send({ error: 'Todavía no has fundado tu Reino' });
      const targetFaction = await prisma.faction.findFirst({ where: { worldId: sourceFaction.worldId, slug: targetFactionSlug }, select: { id: true, name: true } });
      if (!targetFaction) return reply.status(404).send({ error: `Facción desconocida: ${targetFactionSlug}` });

      const item = await prisma.almacenItem.findFirst({ where: { id: almacenItemId, factionId: targetFaction.id } });
      if (!item) return reply.status(404).send({ error: 'Ese objeto no está en el Almacén de esa facción' });
      if (!item.catalogSlug) return reply.status(400).send({ error: 'Objeto sin catalogSlug, no comerciable' });
      const catalog = await prisma.itemCatalog.findFirst({ where: { worldId: sourceFaction.worldId, slug: item.catalogSlug }, select: { valorGoirnos: true } });
      if (!catalog || catalog.valorGoirnos <= 0) return reply.status(400).send({ error: 'Objeto sin valor de mercado (no comerciable)' });

      const resultado = await prisma
        .$transaction(async (tx) => {
          await verificaTratadoComercial(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id);
          const stockDisponible = await tx.almacenItem.count({ where: { factionId: targetFaction.id, catalogSlug: item.catalogSlug } });
          // Un montón ("Trozo de quitina roja (3)") se traspasa entero: se cobra por su cantidad real.
          const cantidad = quantityOf(item.name);
          const precio = precioDinamico(catalog.valorGoirnos, stockDisponible) * cantidad;

          const saveFresco = await tx.save.findUniqueOrThrow({ where: { id: save.id }, select: { goirnos: true } });
          if (saveFresco.goirnos < precio) throw new StockInsuficienteError();

          await tx.save.update({ where: { id: save.id }, data: { goirnos: { decrement: precio } } });
          await tx.almacenItem.update({ where: { id: item.id }, data: { saveId: save.id, factionId: null } });
          return { ok: true as const, precio, cantidad, item: item.name, targetFaction: targetFaction.name };
        })
        .catch((err) => {
          if (err instanceof SinTratadoComercialError || err instanceof StockInsuficienteError) return err;
          throw err;
        });

      if (resultado instanceof SinTratadoComercialError) {
        return reply.status(409).send({ error: `No tienes tratado comercial ni alianza con ${targetFaction.name} — no puedes comerciar con ellos.` });
      }
      if (resultado instanceof StockInsuficienteError) {
        return reply.status(400).send({ error: 'No tienes suficientes Goirnos para esta compra.' });
      }
      return resultado;
    },
  );

  /// Vender: el jugador entrega un objeto de SU PROPIO Almacén a una Faction con tratado, cobrando
  /// `goirnos`. Precio dinámico sobre el stock de quien vende (el jugador, en este caso).
  app.post<{ Params: { id: string }; Body: { targetFactionSlug: string; almacenItemId: string } }>(
    '/saves/:id/reino/mercado/vender',
    async (request, reply) => {
      const { targetFactionSlug, almacenItemId } = request.body;
      const save = await prisma.save.findUnique({ where: { id: request.params.id } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });
      if (rejectIfEnded(save, reply)) return;
      if (rejectIfPendingDeath(save, reply)) return;

      const sourceFaction = await prisma.faction.findFirst({ where: { saveId: save.id }, select: { id: true, worldId: true } });
      if (!sourceFaction) return reply.status(400).send({ error: 'Todavía no has fundado tu Reino' });
      const targetFaction = await prisma.faction.findFirst({ where: { worldId: sourceFaction.worldId, slug: targetFactionSlug }, select: { id: true, name: true } });
      if (!targetFaction) return reply.status(404).send({ error: `Facción desconocida: ${targetFactionSlug}` });

      const item = await prisma.almacenItem.findFirst({ where: { id: almacenItemId, saveId: save.id } });
      if (!item) return reply.status(404).send({ error: 'Ese objeto no está en tu Almacén' });
      if (!item.catalogSlug) return reply.status(400).send({ error: 'Objeto sin catalogSlug, no comerciable' });
      const catalog = await prisma.itemCatalog.findFirst({ where: { worldId: sourceFaction.worldId, slug: item.catalogSlug }, select: { valorGoirnos: true } });
      if (!catalog || catalog.valorGoirnos <= 0) return reply.status(400).send({ error: 'Objeto sin valor de mercado (no comerciable)' });

      const resultado = await prisma
        .$transaction(async (tx) => {
          await verificaTratadoComercial(tx, sourceFaction.worldId, sourceFaction.id, targetFaction.id);
          const stockDisponible = await tx.almacenItem.count({ where: { saveId: save.id, catalogSlug: item.catalogSlug } });
          // Un montón ("Trozo de quitina roja (3)") se traspasa entero: se cobra por su cantidad real.
          const cantidad = quantityOf(item.name);
          const precio = precioDinamico(catalog.valorGoirnos, stockDisponible) * cantidad;

          await tx.save.update({ where: { id: save.id }, data: { goirnos: { increment: precio } } });
          await tx.almacenItem.update({ where: { id: item.id }, data: { saveId: null, factionId: targetFaction.id } });
          return { ok: true as const, precio, cantidad, item: item.name, targetFaction: targetFaction.name };
        })
        .catch((err) => {
          if (err instanceof SinTratadoComercialError) return err;
          throw err;
        });

      if (resultado instanceof SinTratadoComercialError) {
        return reply.status(409).send({ error: `No tienes tratado comercial ni alianza con ${targetFaction.name} — no puedes comerciar con ellos.` });
      }
      return resultado;
    },
  );
}
