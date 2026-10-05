// Libro de Sucesos — única puerta de entrada (CR-2, hito 0.2 — roadmap-cronista.md § 6.2).
//
// `registrarSuceso` calcula la importancia y la frase de plantilla e inserta el suceso con sus
// actores y causas, dentro de la transacción del llamador, y siembra el `Conocimiento` de lo visto
// (CR-18; lo que llega después, en difusion.ts). Las reacciones (CR-10) quedan en cola
// (`Suceso.reaccionesPendientes`) y las procesa `procesarReacciones` (reacciones.ts).
import { randomUUID } from 'node:crypto';
import type { OrigenSuceso, Prisma, PrismaClient } from '@prisma/client';
import { CATALOGO_SUCESOS, importanciaDeSuceso, textoDeSuceso, type DatosSuceso, type TipoSuceso } from './catalogoSucesos.js';

export type EntidadTipo = 'PERSONAJE' | 'NPC' | 'COMPANERO' | 'FACCION' | 'REGION' | 'LOCATION' | 'TERRITORIO' | 'EDIFICIO';
export type PapelSuceso = 'AUTOR' | 'VICTIMA' | 'TESTIGO' | 'BENEFICIARIO' | 'AFECTADO' | 'LUGAR';

export interface ActorSuceso {
  entidadTipo: EntidadTipo;
  /// PERSONAJE = id de la partida; NPC = `Npc.id`; FACCION = slug de la facción; REGION = slug.
  entidadId: string;
  papel: PapelSuceso;
}

export interface NuevoSuceso<T extends TipoSuceso = TipoSuceso> {
  saveId: string;
  tipo: T;
  fictionalMinutes: number;
  regionSlug?: string | null;
  locationId?: string | null;
  actores: ActorSuceso[];
  datos: DatosSuceso[T];
  /// Ids de sucesos previos que lo causaron.
  causas?: string[];
  origen: OrigenSuceso;
  logEntryId?: string | null;
  /// +1 de importancia si abre o cierra un hilo (§ 6.3); lo pasa quien lo sabe (buscadores, CR-17).
  tocaHilo?: boolean;
  /// Para reproducir el azar; si no se da, se genera.
  semilla?: string;
  /// CR-10: reacciones que lo separan del suceso original (lo pone `procesarReacciones`).
  nivelCascada?: number;
}

type Db = PrismaClient | Prisma.TransactionClient;

/// Registra un suceso en el Libro y devuelve su id. Llamar dentro de la transacción del turno o del
/// día, para que el suceso exista si y solo si existe lo que lo causó.
export async function registrarSuceso<T extends TipoSuceso>(db: Db, s: NuevoSuceso<T>): Promise<string> {
  const jugadorAutor = s.actores.some((a) => a.entidadTipo === 'PERSONAJE' && a.papel === 'AUTOR');
  const npcIds = s.actores.filter((a) => a.entidadTipo === 'NPC').map((a) => a.entidadId);
  const afectaNucleoJugable =
    npcIds.length > 0 && (await db.npc.count({ where: { id: { in: npcIds }, nucleoJugable: true } })) > 0;

  // Mismo actor con el mismo papel dos veces = una sola fila (clave primaria compuesta).
  const actores = Array.from(new Map(s.actores.map((a) => [`${a.entidadTipo}|${a.entidadId}|${a.papel}`, a])).values());

  const suceso = await db.suceso.create({
    data: {
      saveId: s.saveId,
      tipo: s.tipo,
      familia: CATALOGO_SUCESOS[s.tipo].familia,
      fictionalMinutes: s.fictionalMinutes,
      regionSlug: s.regionSlug ?? null,
      locationId: s.locationId ?? null,
      importancia: importanciaDeSuceso(s.tipo, { jugadorAutor, afectaNucleoJugable, tocaHilo: !!s.tocaHilo }),
      origen: s.origen,
      datos: s.datos as unknown as Prisma.InputJsonValue,
      texto: textoDeSuceso(s.tipo, s.datos),
      logEntryId: s.logEntryId ?? null,
      semilla: s.semilla ?? randomUUID(),
      nivelCascada: s.nivelCascada ?? 0,
      actores: { create: actores },
      causas: s.causas?.length ? { create: [...new Set(s.causas)].map((causaId) => ({ causaId })) } : undefined,
    },
    select: { id: true },
  });
  // CR-18 (18b): lo visto. El personaje sabe lo que hace o pasa donde está (sin entrada en «El mundo»).
  let testigo = actores.some((a) => a.entidadTipo === 'PERSONAJE');
  if (!testigo && s.locationId) {
    const save = await db.save.findUnique({ where: { id: s.saveId }, select: { currentLocationId: true } });
    testigo = save?.currentLocationId === s.locationId;
  }
  if (testigo) {
    await db.conocimiento.create({
      data: { saveId: s.saveId, sucesoId: suceso.id, desde: s.fictionalMinutes, via: 'TESTIGO', confirmado: true, confirmadoEn: s.fictionalMinutes },
    });
  }
  return suceso.id;
}

/// Minuto de ficción actual de la partida, para los emisores que no lo tienen a mano.
export async function minutosDeFiccion(db: Db, saveId: string): Promise<number> {
  const ws = await db.worldState.findUnique({ where: { saveId }, select: { fictionalMinutes: true } });
  return ws?.fictionalMinutes ?? 480;
}
