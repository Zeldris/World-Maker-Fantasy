import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { metodoForOficio } from '../../services/harvestAbilities.js';
import { detectHarvestSourcesInScene } from '../../services/harvest.js';
import { detectNpcsInScene, scopeFor } from '../../services/npcScene.js';
import { loadSessionFacts, appendSessionFacts } from '../../services/worldFacts.js';
import { inventoryCapacityFor, totalInventoryUnits } from '../../services/inventoryCapacity.js';
import { effectiveInventorySlotsBonus } from '../../services/equipment.js';
import { stripRegionArticle } from '../../services/population.js';
import { quantityOf } from '../../services/ingredients.js';
import { closeItemQuests } from '../../services/questResolution.js';
import type { AttributeBlock } from '../../services/dice.js';
import type { MetodoObtencion } from '@prisma/client';

/// Recolección (rediseño de profesiones, 2026-08-07) — lado "recolectora" (minero/talador/
/// desollador): a diferencia de las de oficio creador (crafting.ts, un solo objeto por texto
/// libre), aquí el pop-up de la habilidad base ("Minar"/"Talar"/"Desollar") necesita saber QUÉ hay
/// recolectable antes de que el jugador escriba nada.
///
/// Desuello (CAZA, petición explícita 2026-08-09: "que al usar la habilidad de profesión de
/// desollar funcione como el resto y explore la zona con los cadáveres derrotados en la zona")
/// funciona distinto al resto de recolectoras: no hay `WorldPopulation` tipo RECURSO ni
/// "Explorar" propio — sus "fuentes" son fauna YA vencida en combate (INCAPACITADO/MUERTO,
/// decapitada o no) que la propia escena ya reconoce (`detectNpcsInScene`, mismo mecanismo
/// determinista que saqueo/decapitar) y que todavía no se ha despiezado. Ver
/// `carcassCandidatesFor` más abajo.

/// Cooldown real por fuente (bug real jugando en vivo, 2026-08-07: "puedo darle a minar
/// indefinidamente sin moverme de la zona" — la habilidad no costaba turno ni tenía ningún límite
/// entre usos, así que una veta de 500 de población se sentía infinita en la práctica). Real, no
/// de ficción: mismo criterio que `updatedAt`/crecimiento de `growAllPopulations` (population.ts),
/// más simple que depender del reloj de ficción de una `Save` concreta para una fila que es del
/// `World` (compartida entre partidas). Cifra de partida, ajustable — no es un cierre definitivo.
const RECOLECCION_COOLDOWN_MS = 30 * 60_000;

interface SourceCandidate {
  sourceSlug: string;
  sourceName: string;
  disponible: number;
  yields: { itemSlug: string; itemName: string; cantidadMaxima: number }[];
}

/// Fuentes candidatas para `oficio` en la región actual: las que tienen HarvestYield con el
/// método correcto Y una fila WorldPopulation tipo RECURSO con población real > 0 en esa región
/// (nunca se ofrece recolectar algo que el propio mundo dice que no queda) Y que no estén en
/// cooldown por haberse recolectado hace poco EN ESTA MISMA Location. `anyOnCooldown` distingue
/// "no hay nada aquí" de "lo que hay está agotado por ahora" para el mensaje del frontend.
///
/// Cooldown location-aware (bug real jugando en vivo, 2026-08-13: "avanzo por la hondonada
/// buscando más elementos... ahí sí que debería poder volver a usarla, al igual que si cambiamos
/// de zona" — antes el cooldown de 30 min era puro reloj, sin memoria de sitio, así que moverte a
/// otra Location no servía de nada). Pasa el guard si CUALQUIERA de las dos condiciones se cumple:
/// pasaron los 30 min reales, O `locationId` no coincide con `lastHarvestedLocationId`.
async function candidateSourcesFor(
  worldId: string,
  metodo: MetodoObtencion,
  region: string | null,
  locationId: string | null,
): Promise<{ candidates: SourceCandidate[]; anyOnCooldown: boolean }> {
  const rows = await prisma.harvestYield.findMany({ where: { worldId, metodoObtencion: metodo }, include: { item: true } });
  if (rows.length === 0) return { candidates: [], anyOnCooldown: false };
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }
  const populations = await prisma.worldPopulation.findMany({
    where: { worldId, targetType: 'RECURSO', targetSlug: { in: [...bySlug.keys()] }, poblacion: { gt: 0 } },
  });
  const cooldownCutoff = Date.now() - RECOLECCION_COOLDOWN_MS;
  const candidates: SourceCandidate[] = [];
  let anyOnCooldown = false;
  for (const pop of populations) {
    // Sin región conocida (save.currentLocation nulo — posible según el schema), falla CERRADO:
    // ninguna fuente es candidata, en vez de ofrecer las de todas las regiones del mundo por
    // saltarse el filtro (bug real encontrado en auditoría, 2026-08-07 — antes `region && ...`
    // con region=null no filtraba nada).
    if (!region) continue;
    // `distribucion` se siembra SIN artículo ("Llanuras del Viento Rojo"), `region` siempre lo
    // lleva completo ("Las Llanuras del Viento Rojo") — ver stripRegionArticle (population.ts,
    // bug real encontrado jugando en vivo 2026-08-07).
    const distribucion = pop.distribucion as Record<string, number>;
    if (!(distribucion[stripRegionArticle(region)] > 0)) continue;
    const sourceRows = bySlug.get(pop.targetSlug) ?? [];
    if (sourceRows.length === 0) continue;
    const sameLocation = locationId !== null && pop.lastHarvestedLocationId === locationId;
    if (pop.lastHarvestedAt && pop.lastHarvestedAt.getTime() > cooldownCutoff && sameLocation) {
      anyOnCooldown = true;
      continue;
    }
    candidates.push({
      sourceSlug: pop.targetSlug,
      sourceName: sourceRows[0].sourceName,
      disponible: pop.poblacion,
      yields: sourceRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad })),
    });
  }
  return { candidates, anyOnCooldown };
}

/// Desuello (2026-08-09, ver comentario de cabecera) — "candidatos" son fauna ya en escena
/// (`detectNpcsInScene`, mismo mecanismo determinista que ya usan saqueo/decapitar) que está
/// vencida (`condicionFisica` INCAPACITADO o MUERTO — se pueda o no rematar/decapitar, no hace
/// falta que esté MUERTA en concreto) y que todavía no se ha despiezado (`!saqueado`, mismo campo
/// que ya reutiliza harvest.ts § `detectHarvest` para "yaDespiezada"). Solo cuenta fauna real
/// (`ataqueNatural` no nulo — humanoides no se desuellan) con al menos una fila HarvestYield de
/// método CAZA para su slug. Sin cooldown ni "Explorar": no hay nada que redescubrir, o el cadáver
/// sigue en escena o no.
async function carcassCandidatesFor(worldId: string, saveId: string, currentLocationId: string | null, sessionFacts: string[]): Promise<SourceCandidate[]> {
  const npcsInScene = await detectNpcsInScene({ action: '', worldId, sessionFacts, saveId, currentLocationId });
  const carcasses = npcsInScene.filter(
    (n) => n.ataqueNatural !== null && !n.saqueado && (n.condicionFisica === 'INCAPACITADO' || n.condicionFisica === 'MUERTO'),
  );
  if (carcasses.length === 0) return [];

  const rows = await prisma.harvestYield.findMany({
    where: { worldId, metodoObtencion: 'CAZA', sourceSlug: { in: carcasses.map((c) => c.slug) } },
    include: { item: true },
  });
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!bySlug.has(row.sourceSlug)) bySlug.set(row.sourceSlug, []);
    bySlug.get(row.sourceSlug)!.push(row);
  }

  return carcasses
    .filter((c) => bySlug.has(c.slug))
    .map((c) => {
      const yieldRows = bySlug.get(c.slug)!;
      return {
        sourceSlug: c.slug,
        sourceName: c.name,
        // A diferencia de RECURSO (`disponible` = población real, un tope compartido entre
        // yields), un cadáver da CADA yield una sola vez, entero — `disponible` aquí solo existe
        // para no truncar `Math.min(cantidadMaxima, disponible)` en el modal, así que se fija al
        // mayor `cantidad` de sus propios yields (nunca el cuello de botella real).
        disponible: Math.max(1, ...yieldRows.map((r) => r.cantidad)),
        yields: yieldRows.map((r) => ({ itemSlug: r.item.slug, itemName: r.item.name, cantidadMaxima: r.cantidad })),
      };
    });
}

export async function recolectarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo) {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    if (metodo === 'CAZA') {
      const sessionFacts = await loadSessionFacts(save.id);
      const sources = await carcassCandidatesFor(save.worldId, save.id, save.currentLocationId, sessionFacts);
      return { sources, puedeExplorar: false, enCooldown: false };
    }

    const { candidates, anyOnCooldown } = await candidateSourcesFor(save.worldId, metodo, save.currentLocation?.region ?? null, save.currentLocationId);
    if (candidates.length === 0) return { sources: [], puedeExplorar: false, enCooldown: anyOnCooldown };

    const sessionFacts = await loadSessionFacts(save.id);
    const localizados = detectHarvestSourcesInScene(
      sessionFacts,
      candidates.map((c) => c.sourceSlug),
    );
    const sources = candidates.filter((c) => localizados.includes(c.sourceSlug));
    return { sources, puedeExplorar: sources.length === 0, enCooldown: sources.length === 0 && anyOnCooldown };
  });

  // Determinista, sin gastar turno ni pasar por Ollama (decisión de diseño, 2026-08-07: ya existe
  // WorldPopulation con población real por región, no hace falta narrar para saber qué hay) —
  // registra el hallazgo como hecho de sesión para que futuras aperturas del pop-up (y el propio
  // Narrador) ya lo den por localizado sin tener que volver a explorar.
  app.post<{ Params: { id: string; oficio: string } }>('/saves/:id/recolectar/:oficio/explorar', async (request, reply) => {
    const metodo = metodoForOficio(request.params.oficio);
    if (!metodo || metodo === 'CAZA') {
      return reply.status(400).send({ error: `"${request.params.oficio}" no es un oficio recolector con exploración` });
    }
    const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { currentLocation: true } });
    if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

    const { candidates, anyOnCooldown } = await candidateSourcesFor(save.worldId, metodo, save.currentLocation?.region ?? null, save.currentLocationId);
    if (candidates.length === 0) return { sources: [], enCooldown: anyOnCooldown };

    const sessionFacts = await loadSessionFacts(save.id);
    await appendSessionFacts(
      save.id,
      sessionFacts,
      candidates.map((c) => `${save.characterName} localiza ${c.sourceName.toLowerCase()} en la zona.`),
    );
    return { sources: candidates };
  });

  app.post<{ Params: { id: string }; Body: { selections: { sourceSlug: string; itemSlug: string; cantidad: number }[] } }>(
    '/saves/:id/recolectar/confirmar',
    async (request, reply) => {
      const { selections } = request.body;
      if (!Array.isArray(selections) || selections.length === 0) {
        return reply.status(400).send({ error: 'Falta el campo: selections' });
      }

      const save = await prisma.save.findUnique({ where: { id: request.params.id }, include: { worldState: true } });
      if (!save) return reply.status(404).send({ error: 'Partida no encontrada' });

      interface TouchedStack {
        id: string;
        catalogName: string;
        description: string;
        catalogSlug: string;
        /// true = la fila YA existía antes de esta petición (el cliente ya la tiene en su estado
        /// local, hay que decirle que cambió de nombre); false = fila nueva, creada en esta misma
        /// petición (el cliente todavía no la conoce, hay que dársela entera).
        wasPreexisting: boolean;
        quantity: number;
      }

      const cooldownCutoff = new Date(Date.now() - RECOLECCION_COOLDOWN_MS);
      const touched = await prisma.$transaction(async (tx) => {
        // Capacidad real (Parte D) — releída DENTRO de la transacción, igual que el resto de
        // gates de este proyecto (revalidar justo antes de escribir, no confiar en un conteo de
        // antes de abrir la transacción).
        //
        // Bug real jugando en vivo (2026-08-08, "podemos tener inventario infinito"): esto contaba
        // FILAS (`InventoryItem.count()`) contra el número de SELECCIONES de la petición — una vez
        // existe una pila ("Piedra (1)"), recolectar más solo incrementa su cantidad sin crear
        // fila nueva, así que `count()` nunca sube: inventario sin límite real para cualquier
        // recurso ya poseído. Ahora se mide en UNIDADES totales (`totalInventoryUnits`) — la
        // cantidad pedida (`sel.cantidad`, no 1 por selección) es lo que de verdad pesa.
        const [currentItems, equippedItems] = await Promise.all([
          tx.inventoryItem.findMany({ where: { saveId: save.id }, select: { name: true } }),
          tx.inventoryItem.findMany({ where: { saveId: save.id, slot: { not: null } }, select: { statBonuses: true } }),
        ]);
        const capacity = inventoryCapacityFor(
          (save.attributes as AttributeBlock).fuerza,
          (save.attributes as AttributeBlock).constitucion,
          effectiveInventorySlotsBonus(equippedItems),
        );
        // Topa por espacio libre real igual que ya se topa por `HarvestYield.cantidad`/población
        // más abajo — nunca un rechazo duro de toda la petición: si solo caben 3 de las 9 pedidas,
        // se añaden esas 3 (mismo criterio de "coger lo que se pueda" que el resto de este motor).
        let unitsRemaining = Math.max(0, capacity - totalInventoryUnits(currentItems));

        // Acumula en la pila ya existente en vez de crear siempre una fila nueva (bug real jugando
        // en vivo, 2026-08-07: "Piedra (3)" + "Piedra (3)" sueltas en vez de "Piedra (6)") — mismo
        // patrón de cantidad-en-el-nombre que ya usa crafteo/construcción (`quantityOf`/
        // `baseNameOf`, ingredients.ts). Keyed por `catalogSlug` para que dos selecciones del MISMO
        // objeto dentro de esta misma petición (dos fuentes distintas con el mismo yield) también
        // se sumen entre sí, no solo contra lo que ya hubiera de antes.
        const touched = new Map<string, TouchedStack>();
        // Fuentes (no objetos) ya validadas/depletadas EN ESTA MISMA petición — cooldown y
        // población son por `sourceSlug`, no por `itemSlug`; una fuente con 2 yields distintos
        // seleccionados a la vez solo debe pasar el guard de cooldown una vez (si no, la segunda
        // selección vería el `lastHarvestedAt` que la primera acaba de fijar hace un instante y se
        // bloquearía a sí misma en la misma petición).
        const sourcesTouchedThisRequest = new Set<string>();
        // Solo para el texto determinista final (2026-08-09): "recolecta" no encaja para desuello
        // ("Gorhorn recolecta: Piel de Corretolvas" suena a que la piel crecía en el suelo) — si
        // TODO lo conseguido en esta petición vino de CAZA, el texto dice "despieza" en su lugar.
        // El pop-up nunca mezcla oficios en una sola petición, pero esto no depende de esa
        // suposición: si hay una mezcla real, se queda con el verbo neutro ("recolecta").
        let anyCaza = false;
        let anyNonCaza = false;
        for (const sel of selections) {
          if (sel.cantidad <= 0 || unitsRemaining <= 0) continue;

          // Validación contra la fuente de verdad (2026-08-07, auditoría: sin esto, `selections`
          // viene del cliente sin comprobar nada — se podía pedir cualquier itemSlug para
          // cualquier sourceSlug, y `sel.cantidad` no tenía más tope que la población total del
          // mundo, saltándose por completo el máximo real por recolección de `HarvestYield.cantidad`
          // (p. ej. "3 piedras por recolección" se convertía en "toda la veta de una vez").
          const yieldRow = await tx.harvestYield.findFirst({
            where: { worldId: save.worldId, sourceSlug: sel.sourceSlug, item: { slug: sel.itemSlug } },
            include: { item: true },
          });
          if (!yieldRow) continue;
          const cantidad = Math.min(sel.cantidad, yieldRow.cantidad, unitsRemaining);

          if (yieldRow.metodoObtencion === 'CAZA') {
            // Desuello (2026-08-09): no hay `WorldPopulation` que depletar — el "recurso" es la
            // presa misma, ya reducida al morir en combate. Claim atómico sobre `NpcState.saqueado`
            // (mismo guard-en-el-where que ya usa el saqueo de NPCs con nombre): una única fuente
            // puede dar varios yields distintos (piel + hueso del mismo cadáver) en la misma
            // petición, así que el claim solo se intenta la PRIMERA vez que aparece este
            // `sourceSlug` — las siguientes selecciones de la misma fuente ya lo dan por hecho
            // (si no, la segunda vería `saqueado:true` recién puesto por la primera y se
            // bloquearía a sí misma dentro de la misma petición).
            if (!sourcesTouchedThisRequest.has(sel.sourceSlug)) {
              const npc = await tx.npc.findUnique({ where: { worldId_slug: { worldId: save.worldId, slug: sel.sourceSlug } }, select: { id: true, kind: true } });
              if (!npc) continue;
              const scope = scopeFor(npc.kind, save.currentLocationId);
              const claimed = await tx.npcState.updateMany({
                where: { saveId: save.id, npcId: npc.id, scope, saqueado: false },
                data: { saqueado: true },
              });
              if (claimed.count === 0) continue;
              sourcesTouchedThisRequest.add(sel.sourceSlug);
            }
            anyCaza = true;
          } else {
            // Depleción atómica (mismo patrón que decrementPopulationOnDeath, population.ts) — el
            // guard `poblacion: { gte: cantidad }` evita bajar de 0 sin necesitar releer nada antes.
            // Cooldown real (bug real jugando en vivo, 2026-08-07: "minar indefinidamente sin
            // moverme de la zona") en el MISMO guard atómico: si ya se recolectó esta fuente hace
            // menos de `RECOLECCION_COOLDOWN_MS`, `count` da 0 igual que si no quedara población.
            // Location-aware (bug real jugando en vivo, 2026-08-13: "avanzo por la hondonada
            // buscando más elementos... debería poder volver a usarla, al igual que si cambiamos
            // de zona") — el cooldown también se salta si `currentLocationId` no coincide con
            // dónde se recolectó la última vez, aunque no hayan pasado los 30 min.
            //
            // Bug real de auditoría (2026-08-13): `{ not: save.currentLocationId }` con
            // `currentLocationId` NULO (campo nullable — posible tras `creation.ts`) se traduce en
            // Prisma como `IS NOT NULL`, cierto para CUALQUIER fuente ya recolectada antes — el
            // cooldown quedaba inservible en ese estado en vez de bloquear. Con ubicación
            // desconocida no hay "misma zona" que comprobar, así que esa rama del OR se omite del
            // todo (fallo cerrado: solo puede saltar el cooldown por tiempo, nunca por ubicación).
            const result = await tx.worldPopulation.updateMany({
              where: {
                worldId: save.worldId,
                targetType: 'RECURSO',
                targetSlug: sel.sourceSlug,
                poblacion: { gte: cantidad },
                ...(sourcesTouchedThisRequest.has(sel.sourceSlug)
                  ? {}
                  : {
                      OR: [
                        { lastHarvestedAt: null },
                        { lastHarvestedAt: { lt: cooldownCutoff } },
                        ...(save.currentLocationId ? [{ lastHarvestedLocationId: { not: save.currentLocationId } }] : []),
                      ],
                    }),
              },
              data: { poblacion: { decrement: cantidad }, lastHarvestedAt: new Date(), lastHarvestedLocationId: save.currentLocationId },
            });
            if (result.count === 0) continue;
            sourcesTouchedThisRequest.add(sel.sourceSlug);
            anyNonCaza = true;
          }
          unitsRemaining -= cantidad;

          const catalogItem = yieldRow.item;
          const alreadyTouched = touched.get(catalogItem.slug);
          if (alreadyTouched) {
            alreadyTouched.quantity += cantidad;
            continue;
          }

          // Pila ya existente de una recolección anterior (nunca una fila equipada — un objeto
          // RECURSO nunca se equipa, pero el filtro deja la intención explícita).
          const existingRow = await tx.inventoryItem.findFirst({
            where: { saveId: save.id, catalogSlug: catalogItem.slug, slot: null },
          });
          if (existingRow) {
            touched.set(catalogItem.slug, {
              id: existingRow.id,
              catalogName: catalogItem.name,
              description: catalogItem.description,
              catalogSlug: catalogItem.slug,
              wasPreexisting: true,
              quantity: quantityOf(existingRow.name) + cantidad,
            });
          } else {
            const createdRow = await tx.inventoryItem.create({
              data: { saveId: save.id, name: catalogItem.name, description: catalogItem.description, origin: 'recolección', catalogSlug: catalogItem.slug },
            });
            touched.set(catalogItem.slug, {
              id: createdRow.id,
              catalogName: catalogItem.name,
              description: catalogItem.description,
              catalogSlug: catalogItem.slug,
              wasPreexisting: false,
              quantity: cantidad,
            });
          }
        }

        // Un solo write final por pila tocada, ya con la cantidad total sumada — evita escribir el
        // nombre a medias si la misma pila se tocó más de una vez en este bucle (dos selecciones
        // del mismo objeto en una sola petición).
        for (const stack of touched.values()) {
          const finalName = stack.quantity > 1 ? `${stack.catalogName} (${stack.quantity})` : stack.catalogName;
          await tx.inventoryItem.update({ where: { id: stack.id }, data: { name: finalName } });
        }

        // Registro escrito determinista de lo recolectado (petición explícita, 2026-08-07: "un
        // texto de narración que no dependa de la AI") — mismo criterio que el resto del motor de
        // turnos: nunca inventar prosa por IA para algo que ya se sabe con certeza mecánica. Solo
        // si de verdad se consiguió algo (no todas las peticiones tienen éxito: capacidad llena,
        // cooldown, población agotada a mitad de bucle).
        let logEntry: { id: string; text: string; timeLabel: string; createdAt: string; fictionalMinutes: number } | null = null;
        if (touched.size > 0) {
          const resumen = [...touched.values()]
            .map((s) => (s.quantity > 1 ? `${s.catalogName} (${s.quantity})` : s.catalogName))
            .join(', ');
          const verbo = anyCaza && !anyNonCaza ? 'despieza una presa cercana' : 'recolecta en la zona';
          const text = `${save.characterName} ${verbo}: ${resumen}.`;
          const timeLabel = save.worldState?.fictionalDateLabel ?? 'Día 1, mañana';
          const fictionalMinutes = save.worldState?.fictionalMinutes ?? 480;
          const created = await tx.logEntry.create({
            data: { saveId: save.id, channel: 'CHARACTER', text, timeLabel, fictionalMinutes, isPlayerAction: false },
          });
          logEntry = { id: created.id, text, timeLabel, createdAt: created.createdAt.toISOString(), fictionalMinutes };
        }

        // Cierre de misión "conseguir Z" (bug real, auditoría 2026-08-11 "pruebas por API"): este
        // endpoint determinista nunca pasaba por `narrateAndPersistTurn`, así que ninguna misión
        // `targetItemName` se cerraba nunca si el objeto venía de Minar/Talar/Desollar — mismo
        // criterio que turnResolution.ts, extraído a `closeItemQuests` para no duplicar la lógica.
        await closeItemQuests({
          tx,
          saveId: save.id,
          worldId: save.worldId,
          createdItemNames: [...touched.values()].map((s) => s.catalogName),
          timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
          fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
        });

        return { touched, logEntry };
      });

      // Hecho de sesión (fuera de la transacción, igual que `appendSessionFacts` en /explorar —
      // no bloquea la transacción de DB con el embebido de Ollama) para que el propio Narrador
      // sepa más tarde que esos recursos ya se tomaron de esta fuente, si la menciona de nuevo.
      if (touched.touched.size > 0) {
        const sessionFacts = await loadSessionFacts(save.id);
        await appendSessionFacts(save.id, sessionFacts, [touched.logEntry!.text]);
      }

      // Materia prima cruda — siempre tipo RECURSO por diseño (nunca EQUIPABLE ni ESPECIAL), mismo
      // criterio que el resto de yields de despiece/recolección (turnResolution.ts). `tipo` aquí
      // (bug real jugando en vivo, 2026-08-07): sin él, el objeto recién recolectado aparecía "sin
      // categorizar" en el Inventario hasta la próxima recarga completa — mismo patrón exacto ya
      // arreglado dos veces antes para equipSlot/effectKey, olvidado para tipo en ambos arreglos.
      const items: { id: string; name: string; description: string; slot: null; catalogSlug: string; equipSlot: null; effectKey: null; tipo: 'RECURSO' }[] =
        [];
      // Pilas que YA existían antes de esta petición — el cliente las tiene en su estado local con
      // el nombre viejo, solo necesita el nombre nuevo (bug real jugando en vivo, 2026-08-07: "no
      // acumula los items" — cada recolección creaba una fila nueva en vez de sumar a la ya
      // existente, mismo patrón que `updatedInventoryItems` ya resuelve para crafteo/construcción).
      const updatedItems: { id: string; name: string }[] = [];
      for (const stack of touched.touched.values()) {
        const finalName = stack.quantity > 1 ? `${stack.catalogName} (${stack.quantity})` : stack.catalogName;
        if (stack.wasPreexisting) {
          updatedItems.push({ id: stack.id, name: finalName });
        } else {
          items.push({
            id: stack.id,
            name: finalName,
            description: stack.description,
            slot: null,
            catalogSlug: stack.catalogSlug,
            equipSlot: null,
            effectKey: null,
            tipo: 'RECURSO',
          });
        }
      }

      return { items, updatedItems, logEntry: touched.logEntry };
    },
  );
}
