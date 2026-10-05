// Lo que el personaje llega a saber de los sucesos (CR-18 paso 18b, hito 0.2 — roadmap-cronista.md
// § 9 y entrada CR-18). La regla pura vive en `conocimiento.ts`; aquí se aplica a la partida:
//
// - Lo visto: lo apunta `registrarSuceso` (sucesos.ts) si el personaje es actor o está en ese mismo
//   lugar (sin entrada en «El mundo»: lo ha vivido).
// - Lo que llega solo (`difundir`): lo de importancia ≥ 7, o de una facción aliada, cuando su noticia
//   alcanza la región donde está el personaje ese día, en una ventana de pocos días.
// - `conocer` es la única puerta: apunta el `Conocimiento` y escribe la noticia en «El mundo» con la
//   que guardó su emisor (`Suceso.noticia`) o con la frase del suceso, como rumor si no está confirmado.
import type { Prisma, PrismaClient } from '@prisma/client';
import { REGION_OWNING_FACTIONS } from '../reputation.js';
import { cuentaComoHecho, llegaSola, npcSabe, regionDeSlug, type SucesoConAlcance, type Via } from './conocimiento.js';
import { npcSinMorirEnPartida } from '../mundoPartida.js';
import { aliadasDelReino, categoriaDeFamilia, comoRumor, enMitadDeFrase, escribir, type MetaNoticia } from './noticias.js';

type Tx = Prisma.TransactionClient;

/// Días tras los que una noticia deja de llegar sola (ya no es novedad).
export const VENTANA_DIAS_LLEGA_SOLA = 5;
const MINUTOS_DIA = 1440;

/// Lo que guarda el emisor de una noticia con su suceso.
export interface NoticiaDeSuceso {
  texto: string;
  meta: MetaNoticia | null;
  /// Lo que el emisor sabe y el suceso puede no llevar en sus actores (región, facciones por nombre).
  region: string | null;
  facciones: string[];
}

const REGIONES_DE_FACCION = new Map<string, string[]>();
for (const [region, facciones] of Object.entries(REGION_OWNING_FACTIONS)) {
  for (const f of facciones) REGIONES_DE_FACCION.set(f, [...(REGIONES_DE_FACCION.get(f) ?? []), region]);
}

interface SucesoBase {
  id: string;
  importancia: number;
  regionSlug: string | null;
  locationId: string | null;
  noticia: Prisma.JsonValue;
  actores: { entidadTipo: string; entidadId: string }[];
}

/// Origen y facciones de cada suceso, para la regla de alcance (en lote).
export async function alcanceDeSucesos(tx: Tx, saveId: string, sucesos: SucesoBase[]): Promise<Map<string, SucesoConAlcance>> {
  const ids = (tipo: string) => [...new Set(sucesos.flatMap((s) => s.actores.filter((a) => a.entidadTipo === tipo).map((a) => a.entidadId)))];
  const locIds = [...new Set(sucesos.map((s) => s.locationId).filter((l): l is string => !!l))];
  const [lugares, facciones, npcs] = await Promise.all([
    locIds.length ? tx.location.findMany({ where: { id: { in: locIds } }, select: { id: true, region: true } }) : [],
    ids('FACCION').length ? tx.faction.findMany({ where: { saveId, slug: { in: ids('FACCION') } }, select: { slug: true, name: true } }) : [],
    ids('NPC').length ? tx.npc.findMany({ where: { id: { in: ids('NPC') } }, select: { id: true, faction: true } }) : [],
  ]);
  const regionDeLugar = new Map(lugares.map((l) => [l.id, l.region]));
  const nombreDeFaccion = new Map(facciones.map((f) => [f.slug, f.name]));
  const faccionDeNpc = new Map(npcs.map((n) => [n.id, n.faction]));

  const resultado = new Map<string, SucesoConAlcance>();
  for (const s of sucesos) {
    const emisor = s.noticia as NoticiaDeSuceso | null;
    const nombres = new Set<string>(emisor?.facciones ?? []);
    for (const a of s.actores) {
      const nombre = a.entidadTipo === 'FACCION' ? nombreDeFaccion.get(a.entidadId) : a.entidadTipo === 'NPC' ? faccionDeNpc.get(a.entidadId) : null;
      if (nombre) nombres.add(nombre);
    }
    const lugar = regionDeSlug(s.regionSlug) ?? (s.locationId ? regionDeLugar.get(s.locationId) : null) ?? emisor?.region ?? null;
    const origenes = lugar ? [lugar] : [...new Set([...nombres].flatMap((f) => REGIONES_DE_FACCION.get(f) ?? []))];
    resultado.set(s.id, { importancia: s.importancia, origenes, facciones: [...nombres] });
  }
  return resultado;
}

/// Texto y metadatos de la noticia de un suceso: la que guardó su emisor o la frase del suceso.
async function textoDeNoticia(tx: Tx, sucesoId: string): Promise<{ texto: string; meta: MetaNoticia; pasoEn: number }> {
  const s = await tx.suceso.findUniqueOrThrow({ where: { id: sucesoId }, select: { texto: true, familia: true, noticia: true, fictionalMinutes: true } });
  const emisor = s.noticia as NoticiaDeSuceso | null;
  const categoria = categoriaDeFamilia(s.familia);
  return { texto: emisor?.texto ?? s.texto, meta: { ...(categoria ? { categoria } : {}), ...(emisor?.meta ?? {}) }, pasoEn: s.fictionalMinutes };
}

/// Apunta que el personaje sabe un suceso. Devuelve NUEVO, CONFIRMADO (era rumor y ya no) o null
/// (nada cambia). `escribirNoticia`: false para lo vivido, que no necesita entrada en «El mundo».
export async function conocer(
  tx: Tx,
  args: { saveId: string; sucesoId: string; via: Via; confirmado: boolean; minutos: number; escribirNoticia: boolean; region?: string | null; fuente?: string | null },
): Promise<'NUEVO' | 'CONFIRMADO' | null> {
  const previo = await tx.conocimiento.findUnique({ where: { saveId_sucesoId: { saveId: args.saveId, sucesoId: args.sucesoId } }, select: { id: true, confirmado: true } });
  if (previo) {
    if (previo.confirmado || !args.confirmado) return null;
    // Q4: el rumor pasa a hecho sabido; «El mundo» lo dice si quien lo confirma no es lo vivido.
    let logEntryId: string | undefined;
    if (args.escribirNoticia) {
      const base = await textoDeNoticia(tx, args.sucesoId);
      logEntryId = await escribir(tx, args.saveId, `Se confirma: ${enMitadDeFrase(base.texto)}`, args.minutos, { ...base.meta, sucesoId: args.sucesoId });
    }
    await tx.conocimiento.update({ where: { id: previo.id }, data: { confirmado: true, confirmadoEn: args.minutos, ...(logEntryId ? { logEntryId } : {}) } });
    return 'CONFIRMADO';
  }
  let logEntryId: string | null = null;
  if (args.escribirNoticia) {
    const base = await textoDeNoticia(tx, args.sucesoId);
    const meta: MetaNoticia = {
      ...base.meta,
      sucesoId: args.sucesoId,
      ...(args.confirmado ? {} : { rumor: { region: args.region ?? null, pasoEn: base.pasoEn } }),
    };
    logEntryId = await escribir(tx, args.saveId, args.confirmado ? base.texto : comoRumor(base.texto), args.minutos, meta);
  }
  await tx.conocimiento.create({
    data: {
      saveId: args.saveId, sucesoId: args.sucesoId, desde: args.minutos, via: args.via, confirmado: args.confirmado,
      confirmadoEn: args.confirmado ? args.minutos : null, logEntryId, fuente: args.fuente ?? null,
    },
  });
  return 'NUEVO';
}

/// Lo que llega solo (Q10): sucesos recientes que el personaje no sabe y cuya noticia ya alcanza la
/// región donde está. Devuelve cuántos supo.
export async function difundirEn(tx: Tx, saveId: string, opciones: { sucesoIds?: string[] } = {}): Promise<number> {
  const save = await tx.save.findUnique({
    where: { id: saveId },
    select: { currentLocation: { select: { region: true } }, worldState: { select: { fictionalMinutes: true } } },
  });
  if (!save?.worldState) return 0;
  const ahora = save.worldState.fictionalMinutes;
  const sucesos = await tx.suceso.findMany({
    where: {
      saveId,
      importancia: { gte: 4 },
      fictionalMinutes: { gte: ahora - VENTANA_DIAS_LLEGA_SOLA * MINUTOS_DIA, lte: ahora },
      conocimientos: { none: {} },
      ...(opciones.sucesoIds ? { id: { in: opciones.sucesoIds } } : {}),
    },
    select: { id: true, importancia: true, regionSlug: true, locationId: true, noticia: true, fictionalMinutes: true, actores: { select: { entidadTipo: true, entidadId: true } } },
    orderBy: { fictionalMinutes: 'asc' },
  });
  if (sucesos.length === 0) return 0;
  const alcance = await alcanceDeSucesos(tx, saveId, sucesos);
  const personaje = { region: save.currentLocation?.region ?? null, aliadas: await aliadasDelReino(tx, saveId) };
  let sabidos = 0;
  for (const s of sucesos) {
    const a = alcance.get(s.id)!;
    const llega = llegaSola(a, personaje);
    if (!llega || ahora - s.fictionalMinutes < llega.dias * MINUTOS_DIA) continue;
    const r = await conocer(tx, {
      saveId, sucesoId: s.id, via: llega.via, confirmado: llega.confirmado, minutos: ahora, escribirNoticia: true, region: a.origenes[0] ?? null,
    });
    if (r) sabidos++;
  }
  return sabidos;
}

/// `difundirEn` en su propia transacción (tras cada día simulado y tras cada acción).
export async function difundir(prisma: PrismaClient, saveId: string): Promise<number> {
  return prisma.$transaction((tx) => difundirEn(tx, saveId), { maxWait: 10_000, timeout: 20_000 });
}

/// Noticia de un suceso del motor (narrador de fondo, decisiones de facción): se guarda con el suceso
/// y llega ya si toca (Q10); si no, la recibe quien se entere después, por la vía que sea.
export async function darNoticiaDeSuceso(tx: Tx, saveId: string, sucesoId: string, noticia: NoticiaDeSuceso): Promise<boolean> {
  await tx.suceso.update({ where: { id: sucesoId }, data: { noticia: noticia as unknown as Prisma.InputJsonValue } });
  return (await difundirEn(tx, saveId, { sucesoIds: [sucesoId] })) > 0;
}

// ─────────────────────────── «¿Qué se cuenta?» (18c, Q9) ───────────────────────────

/// Cuántas cosas cuenta un NPC cada vez y de cuántos días atrás.
export const MAX_CONTADAS = 2;
export const DIAS_MEMORIA_NPC = 30;

/// Lo que cuenta un NPC al preguntarle «¿Qué se cuenta?». Cuenta hasta 2 sucesos que se saben en la
/// región donde está o en su facción y la jugadora no sabe (o sabe solo de oídas y él puede
/// confirmar), primero lo más importante y reciente; una vez al día. Devuelve la frase del NPC para
/// el registro del personaje y escribe las noticias en «El mundo». null si el NPC no puede contar.
export async function preguntarNoticias(prisma: PrismaClient, saveId: string, npcSlug: string): Promise<{ frase: string; contadas: number } | null> {
  return prisma.$transaction(async (tx) => {
    const save = await tx.save.findUniqueOrThrow({
      where: { id: saveId },
      select: { worldId: true, currentLocation: { select: { region: true } }, worldState: { select: { fictionalMinutes: true } } },
    });
    const npc = await tx.npc.findFirst({
      where: { worldId: save.worldId, slug: npcSlug, kind: { not: 'PLANTILLA' }, faction: { not: null }, ...npcSinMorirEnPartida(saveId) },
      select: { name: true, faction: true },
    });
    if (!npc) return null;
    const ahora = save.worldState?.fictionalMinutes ?? 0;
    const inicioDia = Math.floor(ahora / MINUTOS_DIA) * MINUTOS_DIA;
    if ((await tx.conocimiento.count({ where: { saveId, fuente: npcSlug, desde: { gte: inicioDia } } })) > 0) {
      return { frase: `${npc.name}: «Ya te he contado todo lo que sé.»`, contadas: 0 };
    }

    const sucesos = await tx.suceso.findMany({
      where: {
        saveId,
        importancia: { gte: 4 },
        fictionalMinutes: { gte: ahora - DIAS_MEMORIA_NPC * MINUTOS_DIA, lte: ahora },
        OR: [{ conocimientos: { none: {} } }, { conocimientos: { some: { confirmado: false } } }],
      },
      select: {
        id: true, importancia: true, regionSlug: true, locationId: true, noticia: true, fictionalMinutes: true, texto: true,
        actores: { select: { entidadTipo: true, entidadId: true } }, conocimientos: { select: { id: true } },
      },
    });
    const alcance = await alcanceDeSucesos(tx, saveId, sucesos);
    const quien = { region: save.currentLocation?.region ?? null, faccion: npc.faction };
    const candidatos = sucesos
      .filter((s) => {
        const a = alcance.get(s.id)!;
        if (!npcSabe(a, quien, (ahora - s.fictionalMinutes) / MINUTOS_DIA)) return false;
        // Lo que ya sabe de oídas solo vale la pena si él puede confirmarlo.
        return s.conocimientos.length === 0 || cuentaComoHecho(a, quien);
      })
      .sort((x, y) => y.importancia - x.importancia || y.fictionalMinutes - x.fictionalMinutes)
      .slice(0, MAX_CONTADAS);

    const frases: string[] = [];
    for (const s of candidatos) {
      const a = alcance.get(s.id)!;
      const hecho = cuentaComoHecho(a, quien);
      const r = await conocer(tx, { saveId, sucesoId: s.id, via: 'NPC', confirmado: hecho, minutos: ahora, escribirNoticia: true, region: a.origenes[0] ?? null, fuente: npcSlug });
      if (!r) continue;
      const texto = (s.noticia as NoticiaDeSuceso | null)?.texto ?? s.texto;
      frases.push(hecho ? texto : comoRumor(texto));
    }
    if (frases.length === 0) return { frase: `${npc.name}: «Por aquí no se habla de otra cosa que del tiempo.»`, contadas: 0 };
    return { frase: `${npc.name} te cuenta lo que se dice: ${frases.map((f) => `«${f}»`).join(' ')}`, contadas: frases.length };
  }, { maxWait: 10_000, timeout: 20_000 });
}
