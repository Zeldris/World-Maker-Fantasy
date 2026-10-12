// Moral de un NPC en el combate 1v1 (CR-44 paso 44b, hito 0.2). Decide con las reglas puras de
// `moralCombate.ts` tras el intercambio del turno y, si el NPC escapa, lo aplica: sale del combate y
// de la zona (ausente como tras una derrota), sigue vivo, no deja botín y queda el suceso «X huye de
// ti». Si la moral falla y no escapa, pierde su próximo golpe (el caller le quita la iniciativa).
import type { CondicionFisica, Prisma, PrismaClient } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import { disparadoresDeMoral, formaDeRetirada, tieneMoral, tirarEscape, tirarMoral, vaClaramentePerdiendo, type TiradaEscape, type TiradaMoral } from './moralCombate.js';
import { scopeFor, type NpcInScene } from './npcScene.js';
import { minutoDeReaparicion } from './zonaPosicion.js';
import { registrarSuceso } from './cronista/sucesos.js';
import { candidatosALider } from './cronista/reglasConsecuencias.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface MoralNpcResultado {
  npcId: string;
  npcSlug: string;
  npcNombre: string;
  /// Null si la huida viene de una habilidad (QA-27 P12), no de una tirada de moral.
  moral: TiradaMoral | null;
  escape: TiradaEscape | null;
  /// Escapó: sale del combate.
  huye: boolean;
  /// Falló la moral y no escapó: pierde su próximo golpe.
  pierdeTurno: boolean;
  /// Para el narrador: lo que ya está resuelto.
  pista: string;
  /// Para el registro del personaje.
  texto: string;
}

/// Un líder de facción cuya muerte acabaría con ella no huye (decisión de la Fase G), para no
/// partir historias.
async function esLiderSinSucesor(db: Db, saveId: string, worldId: string, npcId: string): Promise<boolean> {
  const faccion = await db.faction.findFirst({ where: { saveId, liderNpcId: npcId, disueltaEn: null } });
  if (!faccion) return false;
  return (await candidatosALider(db as Prisma.TransactionClient, saveId, worldId, faccion)).length === 0;
}

/// QA-27 P12 (usuaria, 2026-10-12): defensas cuyo nombre promete escapar. Si el NPC se defiende con
/// una de ellas y no le alcanzan, intenta huir de verdad con la tirada de escape de CR-44 (como
/// retirarse en Bellwright o Medieval Dynasty, o el «se retira» de X4); si no escapa, sigue en el
/// combate. Por nombre porque son tres fichas de catálogo con efecto AGUANTE.
export const HABILIDADES_DE_HUIDA: readonly string[] = ['Huida a la madriguera', 'Instinto Solitario', 'Estampida instintiva'];

/// Huida con una habilidad de `HABILIDADES_DE_HUIDA`. Null si no toca o no escapa.
export async function decidirHuidaPorHabilidad(
  db: Db,
  p: {
    saveId: string;
    worldId: string;
    npc: NpcInScene | null;
    habilidadDefensa: string | null;
    npcAttackHits: boolean;
    nivelJugador: number;
    random?: () => number;
  },
): Promise<MoralNpcResultado | null> {
  const { npc } = p;
  if (!npc || p.npcAttackHits || !p.habilidadDefensa || !HABILIDADES_DE_HUIDA.includes(p.habilidadDefensa)) return null;
  if (await esLiderSinSucesor(db, p.saveId, p.worldId, npc.id)) return null;
  if ((await db.quest.count({ where: { saveId: p.saveId, targetNpcId: npc.id, status: 'ACTIVA' } })) > 0) return null;
  const escape = tirarEscape(npc.attributes as AttributeBlock, npc.level, p.nivelJugador, p.random ?? Math.random);
  if (!escape.escapa) return null;
  const nombre = npc.name;
  return {
    npcId: npc.id, npcSlug: npc.slug, npcNombre: nombre, moral: null, escape, huye: true, pierdeTurno: false,
    pista: `HUIDA — YA RESUELTO: ${nombre} aprovecha «${p.habilidadDefensa}» para escapar del combate. Narra la huida; el combate con ${nombre} ha terminado y no deja nada atrás.`,
    texto: `${nombre} usa «${p.habilidadDefensa}» y escapa del combate.`,
  };
}

/// Texto de la tirada para el registro: moral (si la hubo) y huida.
export function textoTiradaHuida(r: MoralNpcResultado): string {
  const partes: string[] = [];
  if (r.moral) partes.push(`Moral: ${r.moral.usedRoll}${r.moral.modo === 'desventaja' ? ' con desventaja' : ''} → ${r.moral.total} contra ${r.moral.dificultad}`);
  if (r.escape) partes.push(`huida: ${r.escape.roll} → ${r.escape.total} contra ${r.escape.dificultad}`);
  const t = partes.join('; ');
  return `${r.texto} (${t.charAt(0).toUpperCase()}${t.slice(1)}.)`;
}

/// Decide la moral del NPC golpeado este turno. Null si no toca tirar.
export async function decidirMoralTrasIntercambio(
  db: Db,
  p: {
    saveId: string;
    worldId: string;
    npc: NpcInScene | null;
    npcAttackHits: boolean;
    npcTargetNewCondicion: CondicionFisica | null;
    condicionJugadorTras: CondicionFisica;
    nivelJugador: number;
    random?: () => number;
  },
): Promise<MoralNpcResultado | null> {
  const { npc } = p;
  if (!npc || !p.npcAttackHits || !p.npcTargetNewCondicion) return null;
  if (!tieneMoral({ raza: npc.raza, faunaCategoria: npc.faunaCategoria })) return null;

  // Un grupo (`groupSize`) se cuenta entero: cae un individuo y entra el siguiente.
  const total = npc.groupSize ?? 1;
  const enPieAntes = total - (npc.groupDefeated ?? 0);
  const cae = p.npcTargetNewCondicion === 'CONVALECIENTE' || p.npcTargetNewCondicion === 'MUERTO';
  const enPieDespues = cae ? enPieAntes - 1 : enPieAntes;
  if (enPieDespues <= 0) return null;
  const condicionDespues = cae ? 'ILESO' : p.npcTargetNewCondicion;
  const disparadores = disparadoresDeMoral(
    { condicion: npc.condicionFisica, propiosEnPie: enPieAntes, propiosTotal: total },
    { condicion: condicionDespues, propiosEnPie: enPieDespues },
  );
  if (disparadores.length === 0) return null;
  if (await esLiderSinSucesor(db, p.saveId, p.worldId, npc.id)) return null;
  // El objetivo de una misión activa no huye: dejaría la misión sin forma de cumplirse.
  if ((await db.quest.count({ where: { saveId: p.saveId, targetNpcId: npc.id, status: 'ACTIVA' } })) > 0) return null;

  const random = p.random ?? Math.random;
  const propios: CondicionFisica[] = [condicionDespues, ...Array<CondicionFisica>(Math.max(0, enPieDespues - 1)).fill('ILESO')];
  const desventaja = vaClaramentePerdiendo(propios, [p.condicionJugadorTras]);
  const atributos = npc.attributes as AttributeBlock;
  const moral = tirarMoral(atributos, desventaja, random);
  const nombre = npc.name;
  if (moral.aguanta) {
    return {
      npcId: npc.id, npcSlug: npc.slug, npcNombre: nombre, moral, escape: null, huye: false, pierdeTurno: false,
      pista: `MORAL — YA RESUELTO: ${nombre} se rehace y sigue peleando.`,
      texto: `${nombre} vacila, pero se rehace y sigue en pie.`,
    };
  }
  const escape = tirarEscape(atributos, npc.level, p.nivelJugador, random);
  const desbandada = formaDeRetirada(atributos.inteligencia ?? 0) === 'DESBANDADA' && total > 1;
  if (escape.escapa) {
    return {
      npcId: npc.id, npcSlug: npc.slug, npcNombre: nombre, moral, escape, huye: true, pierdeTurno: false,
      pista: `MORAL — YA RESUELTO: ${nombre} pierde el valor y huye del combate${desbandada ? ', y los suyos se desbandan cada uno por su lado' : ''}. Narra la huida; el combate con ${nombre} ha terminado y no deja nada atrás.`,
      texto: desbandada ? `${nombre} pierde el valor: los suyos se desbandan y escapan.` : `${nombre} pierde el valor y escapa del combate.`,
    };
  }
  return {
    npcId: npc.id, npcSlug: npc.slug, npcNombre: nombre, moral, escape, huye: false, pierdeTurno: true,
    pista: `MORAL — YA RESUELTO: ${nombre} pierde el valor e intenta huir, pero no lo consigue y queda al descubierto: no golpeará en el próximo intercambio.`,
    texto: `${nombre} intenta huir, pero no lo consigue y queda al descubierto.`,
  };
}

/// Aplica una huida: el NPC queda ausente de la zona como tras una derrota (vuelve a su sitio) y se
/// registra el suceso. Dentro de la transacción del turno.
export async function aplicarHuidaNpc(
  tx: Prisma.TransactionClient,
  p: { saveId: string; npc: Pick<NpcInScene, 'id' | 'name' | 'kind'>; characterName: string; currentLocationId: string | null; fictionalMinutes: number; logEntryId?: string | null },
): Promise<void> {
  const scope = scopeFor(p.npc.kind, p.currentLocationId);
  const ausencia = { zonaAusenteHastaMinutes: minutoDeReaparicion(p.fictionalMinutes), zonaLocationId: p.currentLocationId };
  await tx.npcState.upsert({
    where: { saveId_npcId_scope: { saveId: p.saveId, npcId: p.npc.id, scope } },
    create: { saveId: p.saveId, npcId: p.npc.id, scope, ...ausencia },
    update: ausencia,
  });
  await registrarSuceso(tx, {
    saveId: p.saveId, tipo: 'HUIDA_DE_NPC', fictionalMinutes: p.fictionalMinutes, locationId: p.currentLocationId, origen: 'JUGADOR', logEntryId: p.logEntryId ?? null,
    actores: [{ entidadTipo: 'PERSONAJE', entidadId: p.saveId, papel: 'AUTOR' }, { entidadTipo: 'NPC', entidadId: p.npc.id, papel: 'AFECTADO' }],
    datos: { personaje: p.characterName, huido: p.npc.name },
  });
}
