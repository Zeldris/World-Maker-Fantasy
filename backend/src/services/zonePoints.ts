import type { Prisma, PrismaClient, ZonePointTipo } from '@prisma/client';
import { stripRegionArticle } from './population.js';
import { sourceDisplayNameFor, faunaMomentoDelDia } from '../scripts/worldCatalog.js';
import { factionRepFor } from './reputation.js';
import { celdaDePixel, pixelDeCelda, siguienteCeldaEnRuta, GRID_COLS, GRID_ROWS, type Celda } from './zonaPosicion.js';
import { ORCO_ENFURECIDO_QUEST_SLUG } from '../routes/saves/quests.js';
import { siguienteCeldaDeZonePoint, enRangoDePersecucion } from './movementTemplates.js';
import type { FaunaCategoria } from './faunaAbilities.js';
import { effectiveTemperamento } from './reputation.js';
import type { MomentoDelDia } from './worldClock.js';

export type ZonePointColor = 'ALIADO' | 'NEUTRO' | 'ENEMIGO' | 'SIN_FACCION' | 'INERTE';

/// Puro — color del punto en el mapa por reputación con SU facción (`ZonePoint.factionSlug`), mismo
/// medidor 0-5000 que `reputation.ts` (2500 = neutro). 3 bandas simplificadas de las 5 de
/// `effectiveTemperamento` (esa función es para IA de combate, aquí solo hace falta un color).
/// `factionSlug` null se reparte en DOS colores distintos (2026-09-09, corrección de diseño real —
/// hasta ahora ambos caían en `SIN_FACCION`, confundiendo dos conceptos distintos: "SIN_FACCION"
/// (naranja) es la ausencia de facción de alguien que SÍ podría tenerla — un NPC/FAUNA/EDIFICIO
/// independiente, sigue siendo un desenlace real de reputación; "INERTE" (gris) es que la facción
/// simplemente NO APLICA — un RECURSO nunca tiene dueño por diseño, mezclarlo con NEUTRO (amarillo,
/// que ya significa "neutral CON una facción real") sería igual de confuso). `tipo` decide cuál de
/// los dos: solo RECURSO cae en INERTE, el resto de tipos del enum Prisma (FAUNA/NPC/EDIFICIO) sigue
/// en SIN_FACCION como siempre — OBJETO (DroppedItem, fuera de este enum) se resuelve aparte en el
/// caller (zona.ts), nunca pasa por aquí.
export function zonePointColorFor(factionSlug: string | null, factionsStatus: Record<string, number>, tipo: ZonePointTipo): ZonePointColor {
  if (!factionSlug) return tipo === 'RECURSO' ? 'INERTE' : 'SIN_FACCION';
  const rep = factionRepFor(factionsStatus, factionSlug);
  if (rep >= 3000) return 'ALIADO';
  if (rep < 1000) return 'ENEMIGO';
  return 'NEUTRO';
}

/// Dinamismo del mundo, Pieza 3 (2026-08-27, docs/21-roadmap.md) — `ZonePoint` como instancia viva:
/// recalcula proporcionalmente al tiempo de ficción que YA pasó desde la última vez que se tocó
/// este punto, disparado por cada turno real del jugador (nunca tiempo real de pared, nunca
/// pre-cómputo — decisión explícita, ver plan de sesión). Una acción corta mueve poco (fracción de
/// paso/crecimiento), una larga mueve más — cubre el 100% de los turnos, no solo esperas largas.
///
/// Solo `FAUNA`/`RECURSO` tienen cantidad dinámica real (agrupación por población regional real,
/// `WorldPopulation`) — `NPC` (identidad única, nunca se agrupa) y `EDIFICIO` (existencia binaria,
/// gobernada por `Building`/`construction.ts`, no por población) quedan fuera de este recalculo a
/// propósito, documentado, no un descuido.

/// Fracción de la población regional agregada que un único `ZonePoint` puede llegar a representar
/// como máximo (cifra de partida, ajustable jugando, mismo criterio que el resto de números de este
/// proyecto) — evita que un solo punto intente mostrar "×400" de golpe si la población regional es
/// grande; varios puntos de la misma especie en la misma zona se reparten la población real.
const CANTIDAD_MAX_POR_PUNTO = 20;

/// Cuánto puede moverse `cantidad` hacia su objetivo por CADA DÍA completo de ficción transcurrido
/// (no de golpe) — mismo espíritu que `GROWTH_RATE_PER_DAY` de `population.ts`, pero aplicado al
/// AJUSTE del punto visual, no al crecimiento real de la especie (que ya lo calcula
/// `growAllPopulations`/`WorldPopulation` por su cuenta). Cifra de partida.
const AJUSTE_MAXIMO_POR_DIA = 3;

const MINUTOS_POR_DIA = 24 * 60;

/// Gate de aparición narrativa (2026-09-09, bug real jugando en vivo — Álvaro: "estás pintando el
/// orco enfurecido antes de hablar con gistera en el mapa... se debe añadir a la zona después de
/// hablar con gistera y aceptar su misión"). El Orco Enfurecido tiene `ZonePoint` de catálogo
/// incondicional (`activo: true` fijo, sembrado 2026-09-08 solo para que el gate de colisión de
/// Franja 3 no rompiera ese encuentro guionizado) — sin ningún filtro, aparecía en el mapa/colisión/
/// patrulla desde el turno 1, mucho antes del hito narrativo real ("justo cuando Gistera te da la
/// misión el Orco entra en la zona por primera vez", confirmado por Álvaro). Primer caso del
/// proyecto de "ZonePoint condicionado a progreso de misión" — no existe ningún precedente que
/// reutilizar, y no se generaliza a un campo de catálogo nuevo (sería sobre-ingeniería para una
/// única instancia hoy); en vez de eso, un filtro puntual por slug en los 3 consumidores reales de
/// `ZonePoint.activo` (GET /zona § render, `detectarEncuentroEnCelda` § colisión, aquí abajo §
/// patrulla), todos delegando a este único helper para no divergir entre ellos.
const ZONE_POINTS_GATEADOS_POR_QUEST: Record<string, string> = {
  'orco-enfurecido-hondonada': ORCO_ENFURECIDO_QUEST_SLUG,
};

/// Inverso del gate de arriba (2026-09-09, mismo hallazgo — conectando el guion determinista de
/// Gistera a la colisión de Zona) — Gistera Koh debe DESAPARECER del mapa/colisión/patrulla en
/// cuanto el jugador acepta su misión (`npcsRetiredForever` ya la retira de `detectNpcsInScene`
/// para el camino de texto libre, pero su `ZonePoint` de catálogo — posición fija en el mapa — no
/// pasaba por ningún filtro equivalente: el jugador podía seguir "chocando" con su fantasma en
/// Zona después de que la trama ya avanzó). Mismo `questSlug` que el gate del Orco a propósito —
/// es la misma `Quest`, un solo hito la hace aparecer a él y desaparecer a ella.
const ZONE_POINTS_OCULTOS_POR_QUEST: Record<string, string> = {
  'gistera-koh': ORCO_ENFURECIDO_QUEST_SLUG,
};

/// Puro sobre datos ya cargados — true si el `targetSlug` no tiene gate (inmensa mayoría de
/// `ZonePoint`) o si la `Quest` que lo desbloquea ya existe para la partida (aceptada, con
/// cualquier `status` — el propio hito de ACEPTAR es lo que introduce al Orco en escena, no su
/// desenlace posterior). `questSlugsActivos` se carga una vez por caller (batch, nunca N+1).
export function zonePointVisiblePara(targetSlug: string, questSlugsAceptados: ReadonlySet<string>): boolean {
  const questSlugRequerido = ZONE_POINTS_GATEADOS_POR_QUEST[targetSlug];
  if (questSlugRequerido) return questSlugsAceptados.has(questSlugRequerido);
  const questSlugOcultador = ZONE_POINTS_OCULTOS_POR_QUEST[targetSlug];
  if (questSlugOcultador) return !questSlugsAceptados.has(questSlugOcultador);
  return true;
}

/// Bug real jugando en vivo (2026-09-20, Álvaro: "al vencer al orco... no desaparecía
/// correctamente y me bloqueaba la partida") — un NPC de catálogo único (`kind: 'PRINCIPAL'`, con
/// nombre propio y `ZonePoint` fijo de posición, ej. el Orco Enfurecido) derrotado en combate solo
/// quedaba "ausente" 6h (`zonaAusenteHastaMinutes`, `MINUTOS_AUSENCIA_TRAS_DERROTA` en
/// zonaPosicion.ts) — ese campo se diseñó para fauna genérica que se dispersa y puede volver, nunca
/// para distinguir "muerto para siempre" de "huyó, puede reaparecer". Pasadas esas 6h, tanto el pin
/// del mapa (`GET /zona`) como la colisión real (`detectarEncuentroEnCelda`, zona.ts — que ni
/// siquiera aplicaba la ventana de 6h) volvían a tratarlo como si siguiera vivo, dejando al jugador
/// "chocar con su fantasma" para siempre. Solo aplica a `kind: 'PRINCIPAL'` (identidad única/nombre
/// propio) — fauna genérica (`kind` distinto) sigue usando el ciclo normal de repoblación/ausencia
/// temporal, nunca se retira por una muerte individual (la población regional sigue existiendo).
export function zonePointNpcMuertoParaSiempre(kind: string, condicionFisica: string | undefined): boolean {
  return kind === 'PRINCIPAL' && condicionFisica === 'MUERTO';
}

/// Puro — ¿esta especie está activa AHORA MISMO según `faunaMomentoDelDia` (worldCatalog.ts)?
/// `true` si no tiene ninguna entrada en ese diccionario (sin dato = sin filtrar, mismo criterio
/// documentado en el propio comentario de cabecera de `faunaMomentoDelDia`).
///
/// Bug real jugando en vivo (2026-09-17, Álvaro: "está apareciendo un kirelon todo el rato que no
/// se está representando con icono... y sin abrir combate" — el Kirelon Arenoso es nocturno
/// [`faunaMomentoDelDia['kirelon-arenoso'] = 'noche'`], invisible de día en `GET /zona` porque ESE
/// endpoint sí aplicaba el filtro — pero ni `detectarEncuentroEnCelda` [colisión/aviso] ni
/// `avanzarZonePointsUnPaso` [movimiento/persecución, incluida la persecución nueva de AGRESIVO]
/// lo conocían: el Kirelon seguía patrullando/persiguiendo y colisionando de pleno día, invisible
/// en el mapa, repitiendo el mensaje de "toca reaccionar" sin nunca abrir combate real (el turno de
/// texto libre nunca lo veía porque el jugador nunca lo mencionaba — no podía, no lo veía en
/// ningún sitio). Ahora los 3 consumidores de `ZonePoint.activo` comparten el mismo criterio.
export function zonePointActivoAhora(targetSlug: string, momento: MomentoDelDia): boolean {
  const momentoRequerido = faunaMomentoDelDia[targetSlug];
  return !momentoRequerido || momentoRequerido === momento;
}

/// Batch — todas las `Quest.questSlug` ya aceptadas por la partida entre las que este módulo puede
/// necesitar consultar (hoy el Orco Enfurecido y Gistera Koh, mismo `questSlug` para ambos — ver
/// `ZONE_POINTS_GATEADOS_POR_QUEST`/`ZONE_POINTS_OCULTOS_POR_QUEST`). Una sola query por caller,
/// nunca una por `ZonePoint`.
export async function questSlugsAceptadosPara(tx: Prisma.TransactionClient | PrismaClient, saveId: string): Promise<Set<string>> {
  const questSlugsRelevantes = [...new Set([...Object.values(ZONE_POINTS_GATEADOS_POR_QUEST), ...Object.values(ZONE_POINTS_OCULTOS_POR_QUEST)])];
  if (questSlugsRelevantes.length === 0) return new Set();
  const quests = await tx.quest.findMany({ where: { saveId, questSlug: { in: questSlugsRelevantes } }, select: { questSlug: true } });
  return new Set(quests.map((q) => q.questSlug).filter((s): s is string => s != null));
}

export interface ZonePointRow {
  id: string;
  tipo: ZonePointTipo;
  targetSlug: string;
  cantidad: number;
  activo: boolean;
  lastUpdatedAtMinutes: number | null;
}

/// Puro — decide la `cantidad`/`activo` nuevos de UN punto dado cuánta población regional real hay
/// disponible para su especie y cuántos minutos de ficción pasaron desde su último recalculo. Nunca
/// toca `x`/`y` (reposicionar puntos dentro del lienzo queda fuera de esta pasada, documentado) ni
/// decide DE DÓNDE sale un punto nuevo (eso lo resuelve el caller, que sí conoce cuántos puntos
/// existen ya para esa especie en la Location).
export function proximaCantidadPara(punto: ZonePointRow, poblacionRegional: number, fictionalMinutesActuales: number): { cantidad: number; activo: boolean } {
  const objetivo = Math.max(0, Math.min(CANTIDAD_MAX_POR_PUNTO, poblacionRegional));
  if (punto.lastUpdatedAtMinutes == null) return { cantidad: objetivo, activo: objetivo > 0 };

  const minutosTranscurridos = Math.max(0, fictionalMinutesActuales - punto.lastUpdatedAtMinutes);
  if (minutosTranscurridos === 0) return { cantidad: punto.cantidad, activo: punto.activo };

  const diasTranscurridos = minutosTranscurridos / MINUTOS_POR_DIA;
  const ajusteMaximo = Math.max(1, Math.round(AJUSTE_MAXIMO_POR_DIA * diasTranscurridos));
  const delta = objetivo - punto.cantidad;
  const ajusteReal = Math.max(-ajusteMaximo, Math.min(ajusteMaximo, delta));
  const cantidad = punto.cantidad + ajusteReal;
  return { cantidad, activo: cantidad > 0 };
}

/// Recalcula TODOS los `ZonePoint` de tipo FAUNA/RECURSO de una `Location`, proporcional al tiempo
/// de ficción transcurrido desde su último recalculo — llamado desde `narrateAndPersistTurn`
/// (turnResolution.ts), en el mismo punto donde ya se resuelve cada turno real del jugador.
export async function recalcularZonePointsDeLocation(
  tx: Prisma.TransactionClient | PrismaClient,
  worldId: string,
  locationId: string,
  region: string | null,
  fictionalMinutesActuales: number,
): Promise<void> {
  const puntos = await tx.zonePoint.findMany({
    where: { locationId, tipo: { in: ['FAUNA', 'RECURSO'] } },
  });
  if (puntos.length === 0) return;

  const targetSlugs = [...new Set(puntos.map((p) => p.targetSlug))];
  const poblaciones = await tx.worldPopulation.findMany({
    where: { worldId, targetSlug: { in: targetSlugs } },
  });
  const regionSinArticulo = region ? stripRegionArticle(region) : null;
  // Población REAL disponible para esta especie en ESTA región concreta — el peso relativo de
  // `distribucion` (mismo criterio que el resto del motor, `travelInterruption.ts`/`recolectar.ts`)
  // aplicado sobre el agregado del `World` entero, nunca la cifra global sin repartir por región.
  const poblacionRegionalPorSlug = new Map<string, number>();
  for (const fila of poblaciones) {
    const distribucion = (fila.distribucion as Record<string, number> | null) ?? {};
    const peso = (regionSinArticulo ? distribucion[regionSinArticulo] : undefined) ?? (region ? distribucion[region] : undefined) ?? 0;
    poblacionRegionalPorSlug.set(fila.targetSlug, Math.round(fila.poblacion * peso));
  }

  await Promise.all(
    puntos.map((punto) => {
      const poblacionRegional = poblacionRegionalPorSlug.get(punto.targetSlug) ?? 0;
      const { cantidad, activo } = proximaCantidadPara(punto, poblacionRegional, fictionalMinutesActuales);
      if (cantidad === punto.cantidad && activo === punto.activo && punto.lastUpdatedAtMinutes === fictionalMinutesActuales) return null;
      return tx.zonePoint.update({
        where: { id: punto.id },
        data: { cantidad, activo, lastUpdatedAtMinutes: fictionalMinutesActuales },
      });
    }),
  );
}

/// Sistema de movimiento por cuadrícula (2026-09-08, "estilo Mount & Blade") — avanza UN PASO a
/// todos los `ZonePoint` FAUNA/NPC de una `Location` (RECURSO/EDIFICIO nunca se mueven, son
/// inertes/estáticos) cada vez que el jugador se mueve una celda. Con `ruta` definida (array de
/// celdas en píxel), recorre esa ruta en bucle; sin ella, paseo aleatorio corto acotado a su
/// `origenX/Y` real de catálogo (nunca abandona su territorio). Llamado desde
/// `POST /saves/:id/zona/mover` — DISTINTO de `recalcularZonePointsDeLocation` (esa es cantidad/
/// actividad por tiempo de ficción transcurrido, cada turno de narración; esto es posición, cada
/// paso de movimiento del jugador dentro de la misma zona).
///
/// Persecución de AGRESIVO/ENEMIGO (2026-09-17) — antes de resolver ruta/plantilla normal, cada
/// punto agresivo efectivo comprueba si el jugador está a `RADIO_PERSECUCION_CELDAS` o menos; si sí,
/// avanza un paso hacia él en vez de su patrón habitual (ver `movementTemplates.ts` para el detalle
/// de prioridad completo).
/// Posiciones ya actualizadas (2026-09-09, bug real jugando en vivo — Álvaro: "los elementos se
/// mueven, pero no con animación de movimiento como yo ni a la vez que muevo yo... quería que todo
/// se moviera a la vez que yo me muevo") — antes esta función devolvía `Promise<void>`: el propio
/// endpoint (`POST /saves/:id/zona/mover`, zona.ts) la llamaba como puro efecto secundario en BD,
/// sin propagar nada a la respuesta HTTP. El frontend, durante la animación paso a paso del
/// jugador, solo actualizaba SU posición (`ZonaPanel.tsx` § `handleMoverA`) — la fauna/NPC del
/// mapa se quedaban con el snapshot del `GET /zona` inicial hasta el próximo refetch completo
/// (reabrir el panel), aunque el servidor ya los hubiera movido un paso por cada paso del jugador.
export interface ZonePointPasoResultado {
  id: string;
  x: number;
  y: number;
}

export async function avanzarZonePointsUnPaso(
  tx: Prisma.TransactionClient | PrismaClient,
  locationId: string,
  saveId: string,
  random: () => number = Math.random,
  // Persecución de AGRESIVO/ENEMIGO (2026-09-17) — posición actual del jugador y reputación de
  // facciones, ambas ya conocidas por el caller (`zona.ts`) en el momento de la llamada. Opcionales
  // (`undefined`) para no romper ningún otro caller/test existente que no necesite persecución —
  // sin jugador conocido, ningún ZonePoint persigue, se comporta exactamente como antes.
  jugador?: { x: number; y: number } | null,
  factionsStatus?: Record<string, number>,
  // Fauna diurna/nocturna (2026-09-17, bug real: un Kirelon Arenoso nocturno seguía moviéndose y
  // persiguiendo de pleno día, invisible en el mapa — ver comentario de `zonePointActivoAhora`).
  // Opcional por la misma razón que `jugador`/`factionsStatus`: sin momento conocido, ningún punto
  // se filtra por hora, se comporta exactamente como antes (comportamiento seguro por defecto).
  momento?: MomentoDelDia,
): Promise<ZonePointPasoResultado[]> {
  const puntosCrudos = await tx.zonePoint.findMany({
    where: { locationId, tipo: { in: ['FAUNA', 'NPC'] }, activo: true },
  });
  if (puntosCrudos.length === 0) return [];
  // Gate de aparición narrativa (ver comentario junto a `zonePointVisiblePara` más arriba) — un
  // punto gateado sin su misión aceptada todavía no "patrulla": narrativamente no está en la zona.
  const questSlugsAceptados = await questSlugsAceptadosPara(tx, saveId);
  const puntos = puntosCrudos.filter(
    (p) => zonePointVisiblePara(p.targetSlug, questSlugsAceptados) && (!momento || zonePointActivoAhora(p.targetSlug, momento)),
  );
  if (puntos.length === 0) return [];

  // Sistema de plantillas de movimiento (2026-09-17) — Npc cargados en batch por `targetSlug`
  // (nunca FK real, mismo criterio de siempre) para poder inferir la plantilla GENERAL de cada
  // punto sin ruta artesanal ni plantilla específica asignada. `faction` (2026-09-17, persecución)
  // se carga a la vez para resolver `effectiveTemperamento` sin una segunda query. `worldId` no
  // hace falta filtrarlo aparte: `targetSlug` ya es único dentro de un mundo y esta función solo
  // opera sobre puntos de UNA Location concreta, que ya pertenece a un único World.
  const npcsPorSlug = new Map(
    (
      await tx.npc.findMany({
        where: { slug: { in: [...new Set(puntos.map((p) => p.targetSlug))] } },
        select: { slug: true, kind: true, role: true, temperamento: true, faunaCategoria: true, medio: true, faction: true },
      })
    ).map((n) => [n.slug, n]),
  );
  const celdaJugador = jugador ? celdaDePixel(jugador) : null;

  const resultados = await Promise.all(
    puntos.map(async (punto) => {
      const actual = celdaDePixel({ x: punto.x, y: punto.y });
      const npc = npcsPorSlug.get(punto.targetSlug) ?? null;

      // Persecución (2026-09-17) — "cualquier enemigo en la zona" en el diseño de Álvaro; hoy el
      // único enemigo real detectable en Zona es el propio jugador (no hay Companions rivales ni
      // otros NPC agresivos entre sí todavía), así que el objetivo es siempre `celdaJugador` cuando
      // aplica. Rompe INCLUSO una `ruta`/`plantillaEspecifica` curada a mano — coherente con "que
      // se dirija hacia ti", no tiene sentido seguir patrullando con el enemigo real a 3 casillas.
      const esAgresivoEfectivo = npc ? ['AGRESIVO', 'ENEMIGO'].includes(effectiveTemperamento(npc.temperamento, npc.faction, factionsStatus ?? {})) : false;
      const objetivoPersecucion = esAgresivoEfectivo && celdaJugador && enRangoDePersecucion(actual, celdaJugador) ? celdaJugador : null;

      if (objetivoPersecucion) {
        const { celda: siguiente, nuevoPasoRuta } = siguienteCeldaDeZonePoint({
          plantillaEspecifica: null,
          npc: null,
          actual,
          origen: actual,
          pasoRuta: punto.pasoRuta,
          gridCols: GRID_COLS,
          gridRows: GRID_ROWS,
          objetivoPersecucion,
          random,
        });
        const pixel = pixelDeCelda(siguiente);
        if (pixel.x === punto.x && pixel.y === punto.y) return null;
        await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
        return { id: punto.id, x: pixel.x, y: pixel.y };
      }

      const ruta = (punto.ruta as { x: number; y: number }[] | null) ?? null;

      // `ZonePoint.ruta` (curada directamente en la fila) sigue siendo el nivel de prioridad más
      // alto tras persecución, sin cambios — ya existía antes de las plantillas y algún punto real
      // puede seguir usándola tal cual. `plantillaEspecifica` (nueva) es la vía preferida para rutas
      // REUTILIZABLES entre varios ZonePoint; `ruta` suelta sigue viva para un caso puntual.
      if (ruta && ruta.length > 0) {
        const rutaCeldas = ruta.map((p) => celdaDePixel(p));
        const { celda, nuevoPasoRuta } = siguienteCeldaEnRuta(rutaCeldas, punto.pasoRuta % rutaCeldas.length);
        const pixel = pixelDeCelda(celda);
        await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
        return { id: punto.id, x: pixel.x, y: pixel.y };
      }

      // `origenX/Y` null (fila sembrada antes de la Pieza 3, 2026-09-08) cae al propio `x`/`y`
      // actual como origen — comportamiento idéntico a antes: primer paso posible ya desde su
      // punto de siempre.
      const origen: Celda = celdaDePixel({ x: punto.origenX ?? punto.x, y: punto.origenY ?? punto.y });
      const { celda: siguiente, nuevoPasoRuta } = siguienteCeldaDeZonePoint({
        plantillaEspecifica: punto.plantillaEspecifica,
        npc: npc ? { kind: npc.kind, role: npc.role, temperamento: npc.temperamento, faunaCategoria: npc.faunaCategoria as FaunaCategoria | null, medio: npc.medio } : null,
        actual,
        origen,
        pasoRuta: punto.pasoRuta,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        random,
      });
      const pixel = pixelDeCelda(siguiente);
      if (pixel.x === punto.x && pixel.y === punto.y && nuevoPasoRuta === punto.pasoRuta) return null;
      await tx.zonePoint.update({ where: { id: punto.id }, data: { x: pixel.x, y: pixel.y, pasoRuta: nuevoPasoRuta } });
      return { id: punto.id, x: pixel.x, y: pixel.y };
    }),
  );
  return resultados.filter((r): r is ZonePointPasoResultado => r !== null);
}

/// `ZonePoint` alimenta al narrador (2026-08-27, Pieza 3 de "Dinamismo del mundo") — cierra el
/// hueco de auditoría "ningún panorama de población ambiental real, solo el NPC puntual detectado
/// por nombre". Solo puntos `activo` entran en el resumen; NPC/EDIFICIO resuelven nombre por
/// `Npc.name` (mismo criterio ya establecido en `zona.ts`), FAUNA/RECURSO por
/// `sourceDisplayNameFor` (catálogo de recolección/caza). `null` si no hay nada que contar —
/// el caller decide si empuja el bloque de contexto o lo omite.
///
/// Bug real (2026-09-15, jugando en vivo): la versión anterior devolvía una única lista plana sin
/// distinguir tipo (`"Colmena de Lebude, Orco Enfurecido, Veta de Yerreo"`), y el caller la
/// inyectaba bajo el encabezado "QUIÉN ESTÁ AQUÍ AHORA MISMO" — personificando fauna/recursos. El
/// modelo pequeño interpretó "Colmena de Lebude" (fauna, label de escenario) como el apellido de
/// una persona y narró "el pescador de Lebude", un NPC inventado sin respaldo. Ahora se devuelve
/// por tipo — el caller construye un bloque de contexto propio para cada uno, dejando claro que
/// solo NPC son personas con las que se puede hablar.
export interface ZonePointsSummaryPorTipo {
  npc: string | null;
  fauna: string | null;
  recurso: string | null;
  edificio: string | null;
}

export async function zonePointsSummaryFor(prisma: PrismaClient, locationId: string, saveId: string): Promise<ZonePointsSummaryPorTipo | null> {
  const puntosCrudos = await prisma.zonePoint.findMany({ where: { locationId, activo: true } });
  if (puntosCrudos.length === 0) return null;
  // Gate de aparición narrativa — un punto sin su misión de desbloqueo aceptada tampoco debe
  // filtrarse al contexto del narrador (el LLM no debe "saber" que está ahí antes de tiempo).
  const questSlugsAceptados = await questSlugsAceptadosPara(prisma, saveId);
  const puntos = puntosCrudos.filter((p) => zonePointVisiblePara(p.targetSlug, questSlugsAceptados));
  if (puntos.length === 0) return null;

  const npcSlugs = [...new Set(puntos.filter((p) => p.tipo === 'NPC').map((p) => p.targetSlug))];
  const npcRows = npcSlugs.length ? await prisma.npc.findMany({ where: { slug: { in: npcSlugs } }, select: { slug: true, name: true } }) : [];
  const npcNameBySlug = new Map(npcRows.map((n) => [n.slug, n.name]));

  const nombreDe = (p: (typeof puntos)[number]): string => {
    // EDIFICIO no resuelve contra `Npc` — no tiene fila propia ahí (gobernado por
    // `Building`/`construction.ts`, fuera del alcance de esta pieza), solo `label` o el slug crudo.
    // Para NPC, el nombre real SIEMPRE gana sobre `label` (evita que un label de escenario tipo
    // "Punto de vigilancia (Orco Enfurecido)" sustituya al nombre de la persona) — para el resto,
    // `label` sigue ganando si existe, es descripción de escenario, no de identidad.
    const nombre = p.tipo === 'NPC' ? (npcNameBySlug.get(p.targetSlug) ?? p.targetSlug) : (p.label ?? (p.tipo === 'EDIFICIO' ? p.targetSlug : sourceDisplayNameFor(p.targetSlug)));
    return p.cantidad > 1 ? `${nombre} ×${p.cantidad}` : nombre;
  };
  const listaDe = (tipo: 'NPC' | 'FAUNA' | 'RECURSO' | 'EDIFICIO'): string | null => {
    const entradas = puntos.filter((p) => p.tipo === tipo).map(nombreDe);
    return entradas.length > 0 ? entradas.join(', ') + '.' : null;
  };

  return {
    npc: listaDe('NPC'),
    fauna: listaDe('FAUNA'),
    recurso: listaDe('RECURSO'),
    edificio: listaDe('EDIFICIO'),
  };
}
