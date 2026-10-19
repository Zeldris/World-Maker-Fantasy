// Generación de misiones secundarias (CR-40 paso 40d, hito 0.2 — diseño en roadmap-cronista.md,
// entrada CR-40). Una vez por día de ficción y partida (`avanceDiario.ts`) se retiran los avisos
// vencidos y cada tablón de avisos de una facción se rellena hasta `MISIONES_POR_TABLON` con misiones
// que salen del mundo de la partida (Q4), nunca del azar ni de una IA:
//
// - **Cazar** una especie de la región que pasa del 80 % de su máximo (Q14).
// - **Entregar** un recurso abundante de la región (Q15) o, si la facción pasa hambre, algo de comer
//   que se pueda sacar de la región (`CR-34`).
// - **Combatir** a una facción con la que está en tensión o guerra (Q16) en un lugar de la región.
// - **Eliminar** a un guerrero con nombre de la facción con la que está en guerra.
// - **Explorar** un lugar de la región que la jugadora aún no ha visitado (ruinas, hitos…).
//
// Cada candidata se arma con su plantilla (`misiones.ts`) y se descarta si no pasa `validarHuecos`
// o repite tipo y objetivo con otra abierta (Q10). «Ayudar a un malherido» sigue siendo la
// oportunidad de `CR-12` («Ayudar»), sin aviso propio en el `0.2`.
import type { Prisma, PrismaClient } from '@prisma/client';
import { conQuienVisible } from './quienEncarga.js';
import { stripRegionArticle } from '../population.js';
import { npcSinMorirEnPartida } from '../mundoPartida.js';
import { CATEGORIAS_COMESTIBLES } from '../factionExpeditions.js';
import { situacionDeFaccion } from './situacionFaccion.js';
import { asegurarTablonesDePartida, tablonesDePartida } from './tablones.js';
import { darNoticia } from './noticias.js';
import {
  DIAS_RENOVAR_TABLON, MISIONES_POR_TABLON, PLAZO_DIAS, cantidadPorExceso, hayExceso, recompensaDe, textoDeMision, validarHuecos,
  type HuecosMision, type TipoMision,
} from './misiones.js';

type Tx = Prisma.TransactionClient;

export interface FaccionQueEncarga {
  id: string;
  slug: string;
  name: string;
  raza: string;
}

/// Clave de una misión para no repetirla: tipo, objetivo y quien la encarga.
export function claveDeMision(h: HuecosMision): string {
  const objetivo = h.especie?.slug ?? h.objeto?.slug ?? h.objetivoNpc?.id ?? (h.tipo === 'COMBATIR' ? h.enemiga?.slug : h.lugar?.id) ?? '';
  return `${h.tipo}|${objetivo}|${h.faccion.slug}`;
}

/// Lugares de la región donde puede pasar algo: ni interiores ni asentamientos.
async function lugaresAbiertos(tx: Tx, worldId: string, region: string) {
  const filas = await tx.location.findMany({ where: { worldId, region }, select: { id: true, slug: true, name: true, kind: true }, orderBy: { slug: 'asc' } });
  return filas.filter((l) => !l.slug.includes('-interior') && l.kind !== 'asentamiento' && l.kind.toLowerCase() !== 'región' && l.kind.toLowerCase() !== 'region');
}

const elegir = <T>(lista: T[], random: () => number): T | undefined => (lista.length === 0 ? undefined : lista[Math.min(lista.length - 1, Math.floor(random() * lista.length))]);

/// Candidatas que la facción podría colgar en su tablón de `region` (ya validadas). Con `npc`, son
/// misiones personales de ese NPC (Q13).
export async function candidatasDeFaccion(
  tx: Tx, saveId: string, worldId: string, faccion: FaccionQueEncarga, region: string, random: () => number, npc?: { id: string; nombre: string },
): Promise<HuecosMision[]> {
  const base = { faccion: { slug: faccion.slug, nombre: faccion.name, pueblo: faccion.raza }, region, ...(npc ? { npc } : {}) };
  const regionCorta = stripRegionArticle(region);
  const candidatas: HuecosMision[] = [];

  // Poblaciones de la partida en la región, con lo que dan al recolectarlas.
  const poblaciones = (await tx.worldPopulation.findMany({ where: { saveId, targetType: { in: ['FAUNA', 'RECURSO'] } }, orderBy: { targetSlug: 'asc' } }))
    .filter((p) => ((p.distribucion as Record<string, number> | null) ?? {})[regionCorta]);
  const rendimientos = await tx.harvestYield.findMany({
    where: { worldId, sourceSlug: { in: poblaciones.map((p) => p.targetSlug) } },
    select: { sourceSlug: true, item: { select: { slug: true, name: true, category: true } } },
    orderBy: { id: 'asc' },
  });
  const daAlgo = (slug: string) => rendimientos.some((r) => r.sourceSlug === slug);

  // Cazar (Q14): especie disparada en la región.
  for (const p of poblaciones) {
    if (p.targetType !== 'FAUNA' || !daAlgo(p.targetSlug) || !hayExceso(p.poblacion, p.poblacionMax)) continue;
    candidatas.push({ ...base, tipo: 'CAZAR', motivo: 'EXCESO_FAUNA', especie: { slug: p.targetSlug, nombre: p.label }, cantidad: cantidadPorExceso(p.poblacion, p.poblacionMax), plazoDias: PLAZO_DIAS.CAZAR });
  }

  // Entregar (Q15): un recurso abundante; o, con hambre, algo de comer de la región.
  const abundantes = poblaciones.filter((p) => p.targetType === 'RECURSO' && hayExceso(p.poblacion, p.poblacionMax));
  const recurso = elegir(abundantes.flatMap((p) => rendimientos.filter((r) => r.sourceSlug === p.targetSlug).slice(0, 1)), random);
  if (recurso) {
    const cantidad = 3 + Math.floor(random() * 6);
    candidatas.push({ ...base, tipo: 'ENTREGAR', motivo: 'EXCESO_FLORA', objeto: { slug: recurso.item.slug, nombre: recurso.item.name }, cantidad, plazoDias: PLAZO_DIAS.ENTREGAR });
  }
  const situacion = await situacionDeFaccion(tx, faccion.id);
  if (situacion?.carencias.some((c) => c.tipo === 'COMIDA')) {
    const comida = elegir(rendimientos.filter((r) => CATEGORIAS_COMESTIBLES.includes(r.item.category)), random);
    if (comida) candidatas.push({ ...base, tipo: 'ENTREGAR', motivo: 'CARENCIA', objeto: { slug: comida.item.slug, nombre: comida.item.name }, cantidad: 6, plazoDias: PLAZO_DIAS.ENTREGAR });
  }

  // Combatir y eliminar (Q16): contra quien está en tensión o guerra con ella (nunca el Reino).
  const relaciones = await tx.factionRelation.findMany({
    where: { sourceFactionId: faccion.id, type: { in: ['TENSION', 'GUERRA'] }, targetFaction: { origenSlug: { not: null }, disueltaEn: null } },
    select: { type: true, targetFaction: { select: { slug: true, name: true, liderNpcId: true } } },
    orderBy: { id: 'asc' },
  });
  const lugares = await lugaresAbiertos(tx, worldId, region);
  for (const r of relaciones) {
    const enemiga = { slug: r.targetFaction.slug, nombre: r.targetFaction.name };
    const lugar = elegir(lugares, random);
    // Combatir necesita plantillas de la enemiga para formar el grupo al aceptar (`aceptarMision`);
    // sin ellas (p. ej. una escisión con nombre nuevo) el aviso no se podría aceptar nunca.
    const tienePartida = (await tx.npc.count({ where: { worldId, kind: 'PLANTILLA', faction: r.targetFaction.name, muertoEnMundo: false } })) > 0;
    if (lugar && tienePartida) candidatas.push({ ...base, tipo: 'COMBATIR', motivo: 'CONFLICTO', enemiga, lugar: { id: lugar.id, nombre: lugar.name }, cantidad: 1, plazoDias: PLAZO_DIAS.COMBATIR });
    if (r.type !== 'GUERRA') continue;
    const guerreros = await tx.npc.findMany({
      // Solo NPC con nombre: una PLANTILLA («Guerrero serhu») no tiene un estado único que `revisarMisiones` pueda ver caer.
      where: { worldId, kind: 'PRINCIPAL', faction: r.targetFaction.name, role: { contains: 'guerr', mode: 'insensitive' }, ...npcSinMorirEnPartida(saveId), ...(r.targetFaction.liderNpcId ? { id: { not: r.targetFaction.liderNpcId } } : {}) },
      select: { id: true, name: true }, orderBy: { id: 'asc' },
    });
    const objetivo = elegir(guerreros, random);
    if (objetivo) candidatas.push({ ...base, tipo: 'ELIMINAR', motivo: 'CONFLICTO', enemiga, objetivoNpc: { id: objetivo.id, nombre: objetivo.name }, cantidad: 1, plazoDias: PLAZO_DIAS.ELIMINAR });
  }

  // Explorar (Q4, rumor): un lugar de la región que la jugadora no ha pisado.
  const visitados = new Set((await tx.locationVisit.findMany({ where: { saveId }, select: { locationId: true } })).map((v) => v.locationId));
  const porExplorar = elegir(lugares.filter((l) => !visitados.has(l.id) && /ruina|hito|cañ|refugio|cruce|mirador/i.test(l.kind)), random);
  if (porExplorar) candidatas.push({ ...base, tipo: 'EXPLORAR', motivo: 'RUMOR', lugar: { id: porExplorar.id, nombre: porExplorar.name }, cantidad: 1, plazoDias: PLAZO_DIAS.EXPLORAR });

  return candidatas.filter((h) => validarHuecos(h).length === 0);
}

/// Claves de las misiones abiertas de la partida (a la vista o aceptadas sin cerrar).
async function clavesAbiertas(tx: Tx, saveId: string): Promise<Set<string>> {
  const [ofrecidas, activas] = await Promise.all([
    tx.misionOfrecida.findMany({ where: { saveId, estado: 'DISPONIBLE' }, select: { huecos: true } }),
    tx.quest.findMany({ where: { saveId, status: 'ACTIVA', tipoMision: { not: null } }, select: { huecos: true } }),
  ]);
  return new Set([...ofrecidas, ...activas].map((m) => claveDeMision(m.huecos as unknown as HuecosMision)));
}

/// Puro: hasta `cuantas` candidatas al azar sin repetir tipo ni clave.
export function escogerParaTablon(candidatas: HuecosMision[], cuantas: number, abiertas: Set<string>, random: () => number): HuecosMision[] {
  const libres = candidatas.filter((c) => !abiertas.has(claveDeMision(c)));
  const escogidas: HuecosMision[] = [];
  const tipos = new Set<TipoMision>();
  while (escogidas.length < cuantas) {
    const opciones = libres.filter((c) => !tipos.has(c.tipo));
    const c = elegir(opciones, random);
    if (!c) break;
    escogidas.push(c);
    tipos.add(c.tipo);
  }
  return escogidas;
}

export interface ResultadoTablones {
  retiradas: number;
  colgadas: number;
}

/// Renueva los tablones de la partida el día `dia`.
export async function renovarTablones(prisma: PrismaClient, saveId: string, dia: number, random: () => number = Math.random): Promise<ResultadoTablones> {
  return prisma.$transaction(
    async (tx) => {
      const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, select: { worldId: true, worldState: { select: { fictionalMinutes: true } } } });
      const minutos = Math.min(dia * 1440 + 840, save.worldState?.fictionalMinutes ?? dia * 1440);
      await asegurarTablonesDePartida(tx, saveId);
      const { count: retiradas } = await tx.misionOfrecida.updateMany({ where: { saveId, estado: 'DISPONIBLE', retiraEn: { lte: minutos } }, data: { estado: 'RETIRADA' } });
      const abiertas = await clavesAbiertas(tx, saveId);
      let colgadas = 0;
      for (const tablon of await tablonesDePartida(tx, saveId)) {
        // El del Reino no cuelga misiones propias: muestra las de sus aliados (40g).
        if (!tablon.faction || !tablon.location) continue;
        const aLaVista = await tx.misionOfrecida.count({ where: { buildingId: tablon.id, estado: 'DISPONIBLE' } });
        if (aLaVista >= MISIONES_POR_TABLON) continue;
        const candidatas = await candidatasDeFaccion(tx, saveId, save.worldId, tablon.faction, tablon.location.region, random);
        const nuevas = escogerParaTablon(candidatas, MISIONES_POR_TABLON - aLaVista, abiertas, random);
        for (const h of nuevas) {
          const { titulo, descripcion } = textoDeMision(h, Math.floor(random() * 10));
          await tx.misionOfrecida.create({
            data: {
              saveId, buildingId: tablon.id, factionId: tablon.faction.id, tipo: h.tipo, motivo: h.motivo, huecos: h as unknown as Prisma.InputJsonValue,
              titulo, descripcion, recompensa: recompensaDe(h) as unknown as Prisma.InputJsonValue, creadaEn: minutos, retiraEn: minutos + DIAS_RENOVAR_TABLON * 1440,
            },
          });
          abiertas.add(claveDeMision(h));
        }
        colgadas += nuevas.length;
        // Q13: la noticia solo avisa; la misión se coge en el tablón.
        if (nuevas.length > 0) {
          await darNoticia(tx, { saveId, worldId: save.worldId, fictionalMinutes: minutos }, {
            texto: `${tablon.faction.name} ha colgado nuevos avisos en ${tablon.location.name}.`, facciones: [tablon.faction.name], region: tablon.location.region, categoria: 'GENTE',
          });
        }
      }
      return { retiradas, colgadas };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}


// ─────────────────────────── Misión personal de un NPC (40f) ───────────────────────────

/// Plazo que tiene la jugadora para aceptar lo que le propone un NPC en persona.
export const DIAS_OFERTA_PERSONAL = 1;

export interface OfertaPersonal {
  id: string;
  titulo: string;
  descripcion: string;
  recompensa: unknown;
}

/// «¿Tienes trabajo?» (Q13): el NPC con nombre propone UNA misión personal, armada con las mismas
/// plantillas que el tablón y la región donde está la jugadora. Null si no tiene nada que proponer
/// (o ya tiene una propuesta suya a la vista).
export async function ofrecerTrabajoDeNpc(prisma: PrismaClient, saveId: string, npcSlug: string, random: () => number = Math.random): Promise<OfertaPersonal | null> {
  return prisma.$transaction(async (tx) => {
    const save = await tx.save.findUniqueOrThrow({
      where: { id: saveId },
      select: { worldId: true, currentLocationId: true, currentLocation: { select: { region: true } }, worldState: { select: { fictionalMinutes: true } } },
    });
    const npc = await tx.npc.findFirst({ where: { worldId: save.worldId, slug: npcSlug, kind: { not: 'PLANTILLA' }, faction: { not: null }, ...npcSinMorirEnPartida(saveId) }, select: { id: true, name: true, faction: true } });
    const region = save.currentLocation?.region;
    if (!npc?.faction || !region) return null;
    const faccion = await tx.faction.findFirst({ where: { saveId, name: npc.faction, origenSlug: { not: null }, disueltaEn: null }, select: { id: true, slug: true, name: true, raza: true } });
    if (!faccion) return null;
    // Una misión abierta por facción (Q4, `aceptarMision`): no se propone lo que no se podría aceptar.
    if ((await tx.quest.count({ where: { saveId, status: 'ACTIVA', tipoMision: { not: null }, encargaFaccionId: faccion.id } })) > 0) return null;
    const minutos = save.worldState?.fictionalMinutes ?? 0;
    const vigente = await tx.misionOfrecida.findFirst({ where: { saveId, npcId: npc.id, estado: 'DISPONIBLE', retiraEn: { gt: minutos } } });
    if (vigente) return { id: vigente.id, titulo: vigente.titulo, descripcion: (await conQuienVisible(tx, saveId, vigente.huecos, vigente.descripcion)).descripcion, recompensa: vigente.recompensa };
    const abiertas = await clavesAbiertas(tx, saveId);
    const [h] = escogerParaTablon(await candidatasDeFaccion(tx, saveId, save.worldId, faccion, region, random, { id: npc.id, nombre: npc.name }), 1, abiertas, random);
    if (!h) return null;
    const { titulo, descripcion } = textoDeMision(h, Math.floor(random() * 10));
    const oferta = await tx.misionOfrecida.create({
      data: {
        saveId, npcId: npc.id, factionId: faccion.id, tipo: h.tipo, motivo: h.motivo, huecos: h as unknown as Prisma.InputJsonValue, titulo, descripcion,
        recompensa: recompensaDe(h) as unknown as Prisma.InputJsonValue, creadaEn: minutos, retiraEn: minutos + DIAS_OFERTA_PERSONAL * 1440,
      },
    });
    return { id: oferta.id, titulo, descripcion: (await conQuienVisible(tx, saveId, h, descripcion)).descripcion, recompensa: oferta.recompensa };
  });
}
