// Ambientación informada (CR-12 paso 12d, hito 0.2 — decisión de la usuaria en la ronda 2 de
// CR-12): la ambientación de «El mundo» (`routes/entorno.ts`, plantillas por región, sin IA) añade
// el rastro de lo que ha pasado hace poco en la región del personaje: humo tras un incendio, barro
// tras una crecida, animales que llegan… Así lo que se lee de ambiente también informa.
//
// Solo sucesos de los últimos `DIAS_RASTRO` días con lugar en esa región, el más reciente primero,
// como mucho `MAX_RASTROS`. Texto de plantilla por tipo; los tipos sin rastro visible no dan nada.
import type { Prisma, PrismaClient } from '@prisma/client';
import { slugify } from '../../lib/slugify.js';

export const DIAS_RASTRO = 3;
export const MAX_RASTROS = 2;

type Datos = Record<string, string | undefined>;

/// Frase del rastro que deja un suceso en su región (null = no deja nada que se vea).
export function rastroDeSuceso(tipo: string, d: Datos): string | null {
  switch (tipo) {
    case 'INCENDIO':
      return `Todavía huele a quemado: el fuego de ${d.lugar} no queda lejos.`;
    case 'CRECIDA':
      return `El barro de la crecida de ${d.lugar} aún cubre los caminos.`;
    case 'TORMENTA_EXTREMA':
      return 'Ramas arrancadas y techos hundidos recuerdan la última tormenta.';
    case 'PLAGA':
      return `Apenas se ven ${d.afecta} estos días; dicen que una plaga se los está llevando.`;
    case 'AUGE_POBLACION':
      return `Hay ${d.especie} por todas partes, más que de costumbre.`;
    case 'MIGRACION_FAUNA':
      return `Se ven ${d.especie} que antes no andaban por aquí.`;
    case 'EDIFICIO_DANADO':
      return `Alguien trabaja en reparar ${d.edificio}.`;
    default:
      return null;
  }
}

/// Rastros recientes en la región del personaje. Para una migración cuenta la región de destino.
export async function rastrosDeRegion(db: PrismaClient | Prisma.TransactionClient, saveId: string, region: string, fictionalMinutes: number): Promise<string[]> {
  const slug = slugify(region);
  const save = await db.save.findUnique({ where: { id: saveId }, select: { worldId: true } });
  if (!save) return [];
  const lugares = (await db.location.findMany({ where: { worldId: save.worldId, region }, select: { id: true } })).map((l) => l.id);
  const sucesos = await db.suceso.findMany({
    where: {
      saveId,
      fictionalMinutes: { gte: fictionalMinutes - DIAS_RASTRO * 1440, lte: fictionalMinutes },
      OR: [
        { regionSlug: slug, tipo: { not: 'MIGRACION_FAUNA' } },
        { locationId: { in: lugares } },
        { tipo: 'MIGRACION_FAUNA', actores: { some: { entidadTipo: 'REGION', entidadId: slug, papel: 'BENEFICIARIO' } } },
      ],
    },
    orderBy: { fictionalMinutes: 'desc' },
    select: { tipo: true, datos: true },
    take: 10,
  });
  const frases: string[] = [];
  for (const s of sucesos) {
    const frase = rastroDeSuceso(s.tipo, s.datos as Datos);
    if (frase && !frases.includes(frase)) frases.push(frase);
    if (frases.length >= MAX_RASTROS) break;
  }
  return frases;
}
