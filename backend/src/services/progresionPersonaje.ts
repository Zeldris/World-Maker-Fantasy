// Progresión del personaje que comparten la ruta `PATCH /saves/:id/especializacion` y la preparación de escenarios
// (QA-264, `prepararReino.ts domador:<nivel>`): una sola escritura para cada cosa, la del juego.
//   - `fijarEspecializacion`: lo que hace la ruta al elegir especialización, ya con la fila de `Save` bloqueada.
//   - `subirDeNivel`: sube al personaje a un nivel por `applyXp` (XP del umbral, puntos de atributo, habilidades de clase
//     de cada nivel cruzado, línea del diario), como `turnResolution.ts` al ganar XP.
//   - `hacerDomador`: sube a `nivel` (≥ `NIVEL_MINIMO_ESPECIALIZACION`) y elige la especialización Domador de un Cazador.
import { Especializacion, type Clase, type Prisma } from '@prisma/client';
import { applyXp, xpForLevel } from './progression.js';
import { WEAPON_ABILITY_LEVEL_AVANZADA } from './weaponAbilities.js';
import {
  abilityUnlocksAlSubirANivel,
  especializacionAbilityUnlocksFor,
  especializacionesConHuecosPara,
  savedActionDataFromAbility,
} from './classAbilities.js';
import { nombreActualDeHabilidad } from './habilidadesRenombradas.js';

type Tx = Prisma.TransactionClient;

/// Nivel mínimo real para elegir especialización (docs/rpgtarkor/sistemas-combate/clases.md, "cada una con 2-4
/// especializaciones elegidas a nivel 10") — mismo criterio que el resto de topes de partida del
/// proyecto (cifra citada del propio diseño, no inventada aquí).
export const NIVEL_MINIMO_ESPECIALIZACION = 10;

type PartidaConReloj = { id: string; characterName: string; clase: Clase | null; level: number; worldState: { fictionalDateLabel: string | null; fictionalMinutes: number } | null };

/// Fija la especialización y concede SOLO los huecos de su rama ya alcanzados por el nivel actual (el tronco común ya se
/// concedió al fijar `clase` o al subir de nivel). El caller ya comprobó los guards y bloqueó la fila de `Save`.
export async function fijarEspecializacion(tx: Tx, save: PartidaConReloj, especializacion: Especializacion): Promise<void> {
  // Mismo guard anti-duplicado que `/saves/:id/clase`: por si alguna habilidad de esta rama ya existiera por otro camino.
  const yaTiene = new Set((await tx.savedAction.findMany({ where: { saveId: save.id, category: 'combate' }, select: { name: true, description: true } })).map((a) => nombreActualDeHabilidad(a.name, { clase: save.clase, especializacion }, a.description)));
  const nuevasHabilidades = especializacionAbilityUnlocksFor(save.clase!, especializacion, save.level)
    .filter((ability) => !yaTiene.has(ability.name))
    .map((ability) => savedActionDataFromAbility(save.id, ability));
  await tx.save.update({ where: { id: save.id }, data: { especializacion } });
  if (nuevasHabilidades.length > 0) await tx.savedAction.createMany({ data: nuevasHabilidades });
  await tx.logEntry.create({
    data: {
      saveId: save.id,
      channel: 'CHARACTER',
      text: `${save.characterName} se especializa: ${especializacion}.`,
      timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
      isSystemMessage: true,
    },
  });
}

/// Sube al personaje hasta `nivel` con la regla del juego: el XP del umbral pasa por `applyXp` (puntos de atributo de los
/// niveles ASI cruzados) y cada nivel cruzado concede las habilidades de clase que le tocan. No baja de nivel. Por encima
/// del nivel de arma avanzada el juego resincroniza las habilidades de arma (`syncDynamicCombatAbilities`): no se hace
/// aquí, así que se niega en vez de dejar una partida a medias.
export async function subirDeNivel(tx: Tx, saveId: string, nivel: number): Promise<{ ok: true; desde: number; hasta: number; puntosDeAtributo: number } | { ok: false; motivo: string }> {
  if (!Number.isInteger(nivel) || nivel < 1) return { ok: false, motivo: `«${nivel}» no es un nivel válido.` };
  if (nivel >= WEAPON_ABILITY_LEVEL_AVANZADA) return { ok: false, motivo: `Solo se prepara hasta el nivel ${WEAPON_ABILITY_LEVEL_AVANZADA - 1}: desde el ${WEAPON_ABILITY_LEVEL_AVANZADA} cambian las habilidades de arma.` };
  const save = await tx.save.findUnique({ where: { id: saveId }, include: { worldState: true } });
  if (!save) return { ok: false, motivo: `No hay partida ${saveId}.` };
  if (nivel < save.level) return { ok: false, motivo: `La partida ya es de nivel ${save.level}: no se baja a ${nivel}.` };
  if (nivel === save.level) return { ok: true, desde: save.level, hasta: save.level, puntosDeAtributo: 0 };
  const r = applyXp(save.xp, save.level, xpForLevel(nivel) - save.xp);
  await tx.save.update({ where: { id: saveId }, data: { xp: r.newXp, level: r.newLevel, pendingAttributePoints: { increment: r.attributePointsGained } } });
  for (let lvl = save.level + 1; lvl <= r.newLevel; lvl++) {
    for (const ability of abilityUnlocksAlSubirANivel(save.characterName, lvl, save.clase, save.especializacion)) {
      await tx.savedAction.create({ data: savedActionDataFromAbility(saveId, ability) });
    }
  }
  await tx.logEntry.create({
    data: {
      saveId,
      channel: 'CHARACTER',
      text: `${save.characterName} sube a nivel ${r.newLevel}.${r.attributePointsGained > 0 ? ` Gana ${r.attributePointsGained} puntos de atributo para repartir.` : ''}`,
      timeLabel: save.worldState?.fictionalDateLabel ?? 'Día 1, mañana',
      fictionalMinutes: save.worldState?.fictionalMinutes ?? 480,
      isSystemMessage: true,
    },
  });
  return { ok: true, desde: save.level, hasta: r.newLevel, puntosDeAtributo: r.attributePointsGained };
}

/// CR-56: la jugadora es Domador de ese nivel (≥ 10): Cazador con la especialización DOMADOR. Todo en una transacción:
/// si falla algo, no queda a medias.
export async function hacerDomador(prisma: { $transaction: <T>(f: (tx: Tx) => Promise<T>) => Promise<T> }, { saveId, nivel }: { saveId: string; nivel: number }): Promise<{ nivel: number; especializacion: Especializacion; puntosDeAtributo: number } | { error: string }> {
  if (nivel < NIVEL_MINIMO_ESPECIALIZACION) return { error: `domador: la especialización se elige a partir del nivel ${NIVEL_MINIMO_ESPECIALIZACION} (pedido: ${nivel}).` };
  class Rechazo extends Error {}
  try {
    return await prisma.$transaction(async (tx) => {
      const antes = await tx.save.findUnique({ where: { id: saveId }, select: { clase: true, especializacion: true } });
      if (!antes) throw new Rechazo(`domador: no hay partida ${saveId}.`);
      if (!antes.clase) throw new Rechazo('domador: la partida no tiene clase asignada.');
      if (!especializacionesConHuecosPara(antes.clase).includes(Especializacion.DOMADOR)) throw new Rechazo(`domador: DOMADOR no es una especialización de ${antes.clase}.`);
      if (antes.especializacion && antes.especializacion !== Especializacion.DOMADOR) throw new Rechazo(`domador: la partida ya es ${antes.especializacion}.`);
      const sube = await subirDeNivel(tx, saveId, nivel);
      if (!sube.ok) throw new Rechazo(`domador: ${sube.motivo}`);
      if (!antes.especializacion) {
        const save = await tx.save.findUniqueOrThrow({ where: { id: saveId }, include: { worldState: true } });
        await fijarEspecializacion(tx, save, Especializacion.DOMADOR);
      }
      return { nivel: sube.hasta, especializacion: Especializacion.DOMADOR, puntosDeAtributo: sube.puntosDeAtributo };
    });
  } catch (e) {
    if (e instanceof Rechazo) return { error: e.message };
    throw e;
  }
}
