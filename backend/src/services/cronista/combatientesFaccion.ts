// Combatientes de una facción para un combate de fondo (CR-62 paso 62b, hito 0.3 — Q3 de la ronda de
// CR-62). Los soldados de una facción son una cifra; para pelear hacen falta personas:
// - primero sus NPC guerreros con nombre (rol de guerrero, guardia, patrulla o soldado), por nivel; si
//   caen no mueren en una pelea de fondo;
// - hasta completar, soldados genéricos de su pueblo: los atributos medios de su raza en el catálogo,
//   a nivel 3, con su arma (+1) mientras su factura de equipo (CR-58) les dé armas.
import type { Prisma } from '@prisma/client';
import type { AttributeBlock } from '../dice.js';
import { npcAttributesForLevel } from '../progression.js';
import { combatienteDeNpc } from '../factionExpeditions.js';
import { npcSinMorirEnPartida } from '../mundoPartida.js';
import type { BandoFondo, CombatienteFondo } from '../combateDeFondo.js';

type Tx = Prisma.TransactionClient;

export const NIVEL_SOLDADO_GENERICO = 3;
const ROL_GUERRERO = /guerr|guard|patrull|soldad|centinel|lanc/i;
const ATRIBUTOS: (keyof AttributeBlock)[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia'];

/// Puro: atributos medios de un grupo de bloques (redondeados); 10 en todo si no hay ninguno.
export function atributosMedios(bloques: AttributeBlock[]): AttributeBlock {
  const r = {} as AttributeBlock;
  for (const k of ATRIBUTOS) r[k] = bloques.length === 0 ? 10 : Math.round(bloques.reduce((s, b) => s + (b[k] ?? 0), 0) / bloques.length);
  return r;
}

/// Puro: un soldado genérico de un pueblo.
export function soldadoGenerico(id: string, nombre: string, bando: BandoFondo, base: AttributeBlock, armado: boolean): CombatienteFondo {
  const attributes = npcAttributesForLevel(base, NIVEL_SOLDADO_GENERICO, null);
  return {
    id, nombre, bando, attributes,
    attribute: attributes.destreza > attributes.fuerza ? 'destreza' : 'fuerza',
    attributeBonus: armado ? 1 : 0,
    nivel: NIVEL_SOLDADO_GENERICO,
    conMoral: true,
  };
}

/// Los `n` combatientes de una facción de la partida en el bando `bando`.
export async function combatientesDeFaccion(
  tx: Tx,
  ctx: { saveId: string; worldId: string },
  faccion: { slug: string; name: string; raza: string | null; soldados: number; sinArma: number },
  n: number,
  bando: BandoFondo,
): Promise<CombatienteFondo[]> {
  if (n <= 0) return [];
  const conNombre = (await tx.npc.findMany({
    where: { worldId: ctx.worldId, faction: faccion.name, faunaCategoria: null, ...npcSinMorirEnPartida(ctx.saveId) },
    orderBy: [{ level: 'desc' }, { slug: 'asc' }],
  })).filter((npc) => ROL_GUERRERO.test(npc.role));
  const elegidos: CombatienteFondo[] = conNombre.slice(0, n).map((npc, i) => {
    const c = combatienteDeNpc(npc);
    return { id: c.id, nombre: c.nombre, bando, attributes: c.attributes, attribute: c.attribute, attributeBonus: c.attributeBonus, nivel: npc.level, conMoral: true, conNombre: true, lider: i === 0 };
  });
  const faltan = n - elegidos.length;
  if (faltan > 0) {
    const deSuPueblo = faccion.raza
      ? await tx.npc.findMany({ where: { worldId: ctx.worldId, saveId: null, raza: faccion.raza, faunaCategoria: null }, select: { attributes: true } })
      : [];
    // Atributos de base de su pueblo (los del catálogo, en crudo; el nivel lo pone `npcAttributesForLevel`).
    const base = atributosMedios(deSuPueblo.map((p) => p.attributes as unknown as AttributeBlock));
    const armados = Math.max(0, faccion.soldados - faccion.sinArma);
    for (let i = 0; i < faltan; i++) {
      elegidos.push(soldadoGenerico(`${faccion.slug}-soldado-${bando}-${i + 1}`, `Soldado de ${faccion.name}`, bando, base, i < armados));
    }
  }
  return elegidos;
}
