// Moral en el combate de varios (CR-44 paso 44c, hito 0.2). Tras cada turno del combate, el bando
// enemigo (sus personas; la fauna sigue con su temperamento) tira moral si alguien cae a GRAVE por
// primera vez o si el bando queda a la mitad por primera vez. Como en D&D, en un grupo con líder
// tira el líder por todos: con Inteligencia 12 o más se retiran en orden (una tirada de escape, se
// van todos); por debajo, desbandada (cada uno tira lo suyo). Quien escapa queda `huido`: fuera del
// combate, sin botín; si es un NPC solitario, además ausente de la zona y con su suceso.
import type { CondicionFisica, Prisma } from '@prisma/client';
import type { AttributeBlock } from './dice.js';
import { EN_PIE, formaDeRetirada, quienTiraMoral, tieneMoral, tirarEscape, tirarMoral, vaClaramentePerdiendo } from './moralCombate.js';
import { aplicarHuidaNpc } from './huidaNpc.js';

export interface CombatienteParaMoral {
  participantId: string;
  bando: string;
  tipo: string;
  npcId: string | null;
  esGrupo: boolean;
  huido: boolean;
  moralTirada: boolean;
  condicion: CondicionFisica;
  attributes: AttributeBlock | null;
}

export interface ResultadoMoralGrupo {
  huidos: string[];
  /// Para el registro del personaje.
  textos: string[];
}

/// Revisa la moral del bando enemigo. No toca la fauna ni a quien ya huyó.
export async function revisarMoralDelCombate(
  tx: Prisma.TransactionClient,
  p: { saveId: string; encounterId: string; combatientes: CombatienteParaMoral[]; random?: () => number },
): Promise<ResultadoMoralGrupo> {
  const random = p.random ?? Math.random;
  const resultado: ResultadoMoralGrupo = { huidos: [], textos: [] };
  const npcIds = [...new Set(p.combatientes.filter((c) => c.bando === 'ENEMIGO' && c.npcId).map((c) => c.npcId!))];
  if (npcIds.length === 0) return resultado;
  const npcs = new Map(
    (await tx.npc.findMany({ where: { id: { in: npcIds } }, select: { id: true, name: true, kind: true, raza: true, faunaCategoria: true, level: true } })).map((n) => [n.id, n]),
  );
  const miembros = p.combatientes.filter((c) => {
    const npc = c.bando === 'ENEMIGO' && c.npcId ? npcs.get(c.npcId) : undefined;
    return !!npc && !c.huido && tieneMoral({ raza: npc.raza, faunaCategoria: npc.faunaCategoria });
  });
  if (miembros.length === 0) return resultado;
  const enPie = miembros.filter((m) => EN_PIE(m.condicion));
  if (enPie.length === 0) return resultado;

  const encuentro = await tx.combatEncounter.findUniqueOrThrow({ where: { id: p.encounterId }, select: { moralMitadBandos: true } });
  const recienGraves = enPie.filter((m) => m.condicion === 'GRAVE' && !m.moralTirada);
  const total = miembros.length;
  const aLaMitad = total > 1 && enPie.length <= total / 2 && !encuentro.moralMitadBandos.includes('ENEMIGO');
  if (recienGraves.length === 0 && !aLaMitad) return resultado;

  if (recienGraves.length) await tx.combatParticipant.updateMany({ where: { id: { in: recienGraves.map((m) => m.participantId) } }, data: { moralTirada: true } });
  if (aLaMitad) await tx.combatEncounter.update({ where: { id: p.encounterId }, data: { moralMitadBandos: { push: 'ENEMIGO' } } });

  const contrarios = p.combatientes.filter((c) => c.bando !== 'ENEMIGO' && !c.huido).map((c) => c.condicion);
  // Cuentan también sus caídos: perder a la mitad es ir claramente perdiendo.
  const desventaja = vaClaramentePerdiendo(miembros.map((m) => m.condicion), contrarios);
  const nivelPerseguidor = (await tx.save.findUnique({ where: { id: p.saveId }, select: { level: true } }))?.level ?? 1;
  const nombre = (m: CombatienteParaMoral) => npcs.get(m.npcId!)!.name;
  const voluntad = (m: CombatienteParaMoral) => m.attributes?.voluntad ?? 0;
  const lider = quienTiraMoral(
    enPie.map((m) => ({ ...m, id: m.participantId, voluntad: voluntad(m), enPie: true })),
    // El de más Inteligencia lleva al grupo (el capitán de CR-45, si lo hay).
    [...enPie].sort((a, b) => (b.attributes?.inteligencia ?? 0) - (a.attributes?.inteligencia ?? 0))[0]?.participantId ?? null,
  )!;
  const forma = formaDeRetirada(lider.attributes?.inteligencia ?? 0);

  const escapan = (m: CombatienteParaMoral) => tirarEscape(m.attributes ?? ({} as AttributeBlock), npcs.get(m.npcId!)!.level, nivelPerseguidor, random).escapa;
  const quienesHuyen: CombatienteParaMoral[] = [];
  if (forma === 'ORDENADA' || enPie.length === 1) {
    const moral = tirarMoral(lider.attributes ?? ({} as AttributeBlock), desventaja, random);
    if (moral.aguanta) {
      resultado.textos.push(`${nombre(lider)} sostiene a los suyos: siguen peleando.`);
    } else if (escapan(lider)) {
      quienesHuyen.push(...enPie);
      resultado.textos.push(enPie.length > 1 ? `${nombre(lider)} ordena la retirada: los suyos se repliegan y escapan.` : `${nombre(lider)} pierde el valor y escapa del combate.`);
    } else {
      resultado.textos.push(`${nombre(lider)} intenta retirarse, pero no encuentra salida.`);
    }
  } else {
    // Desbandada: cada uno por su lado.
    for (const m of enPie) {
      if (tirarMoral(m.attributes ?? ({} as AttributeBlock), desventaja, random).aguanta) continue;
      if (escapan(m)) quienesHuyen.push(m);
    }
    resultado.textos.push(quienesHuyen.length ? `Los suyos se desbandan: ${quienesHuyen.length} escapan cada uno por su lado.` : 'Vacilan, pero ninguno logra escapar.');
  }

  if (quienesHuyen.length === 0) return resultado;
  await tx.combatParticipant.updateMany({ where: { id: { in: quienesHuyen.map((m) => m.participantId) } }, data: { huido: true } });
  resultado.huidos = quienesHuyen.map((m) => m.participantId);
  // Los solitarios: ausentes de la zona y su suceso (una vez por NPC).
  const save = await tx.save.findUniqueOrThrow({ where: { id: p.saveId }, select: { characterName: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } } });
  for (const npcId of new Set(quienesHuyen.filter((m) => !m.esGrupo).map((m) => m.npcId!))) {
    const npc = npcs.get(npcId)!;
    await aplicarHuidaNpc(tx, { saveId: p.saveId, npc, characterName: save.characterName, currentLocationId: save.currentLocationId, fictionalMinutes: save.worldState?.fictionalMinutes ?? 0 });
  }
  return resultado;
}
