// Combate de fondo (CR-62 paso 62a, hito 0.3 — ADR 0002 y canon de
// `docs/rpgtarkor/sistemas-combate/combate-multiple.md` § 3-4). Todo combate sin la jugadora se
// resuelve con la misma mecánica que el combate en vivo, de una sentada y sin narración:
//
// 1. Cada bando se parte en grupos (8 sin la jugadora; 4 con ella, sus grupos de combate).
// 2. Grupo 1 contra grupo 1, grupo 2 contra grupo 2…; si un bando tiene menos grupos, los suyos
//    vuelven a pelear, con sus heridas, contra los siguientes.
// 3. Cada sub-combate, por rondas: iniciativa (`rollInitiativeMultiple`), objetivo por Inteligencia
//    (`elegirObjetivo`) o el del capitán (`elegirCapitan` + `objetivoConcentrado`, CR-45), intercambio
//    (`resolveExchange`: un golpe empeora un escalón al defensor, un contragolpe al atacante), y moral
//    (CR-44): al quedar un bando a la mitad o caer alguien a GRAVE, su líder tira moral; si falla, el
//    bando se retira y cada uno intenta escapar.
// 4. Al final, de quien ha caído muere el 3 % (regla de Álvaro, `PROBABILIDAD_MUERTE_EN_INTERCEPCION`);
//    los NPC con nombre no mueren en una pelea de fondo.
//
// Puro y determinista con el `random` que se le pasa.
import type { Attribute, AttributeBlock } from './dice.js';
import type { CondicionFisica } from '@prisma/client';
import { resolveExchange, type ExchangeParticipant } from './combatExchange.js';
import { oneStepWorseThan } from './death.js';
import { elegirCapitan, elegirObjetivo, MAX_COMBATIENTES_POR_BANDO, objetivoConcentrado, rollInitiativeMultiple } from './combateMultiple.js';
import { disparadoresDeMoral, quienTiraMoral, tirarEscape, tirarMoral, vaClaramentePerdiendo } from './moralCombate.js';

/// Tamaño de los sub-combates sin la jugadora (criterio de Claude, ronda de CR-62): sin narración no
/// hay espera, y una melé de 8 es más realista que cuatro de 4.
export const TAMANO_SUBCOMBATE_FONDO = 8;
/// Con la jugadora: el de sus grupos de combate (`CMB-9` lo subirá).
export const TAMANO_SUBCOMBATE_CON_JUGADORA = MAX_COMBATIENTES_POR_BANDO;
/// Tope de rondas de un sub-combate (el de la intercepción de expediciones).
export const MAX_RONDAS_SUBCOMBATE = 60;
/// De quien cae fuera de combate muere este tanto (Álvaro, 2026-09-29: «cada muerte cuenta»).
export const PROBABILIDAD_MUERTE_FONDO = 0.03;
/// Dificultad de los intercambios de fondo (la misma que la intercepción).
const DIFICULTAD_FONDO = 10;

export type BandoFondo = 'A' | 'B';

export interface CombatienteFondo {
  id: string;
  nombre: string;
  bando: BandoFondo;
  attributes: AttributeBlock;
  /// Atributo con el que ataca.
  attribute: Attribute;
  attributeBonus: number;
  nivel: number;
  /// Persona con moral (CR-44); la fauna no tira moral.
  conMoral: boolean;
  /// NPC con nombre: si cae, no muere en una pelea de fondo.
  conNombre?: boolean;
  /// Líder del grupo (tira la moral por todos); si no, el de más Voluntad.
  lider?: boolean;
}

export interface EstadoFondo {
  id: string;
  condicion: CondicionFisica;
  huido: boolean;
  muerto: boolean;
}

export interface ResultadoFondo {
  /// El bando que se queda con el campo (null si nadie: tope de rondas o los dos fuera).
  ganador: BandoFondo | null;
  /// Bandos que se retiraron por la moral.
  retiradas: BandoFondo[];
  subcombates: number;
  rondas: number;
  estados: EstadoFondo[];
}

const enPie = (c: CondicionFisica) => c !== 'CONVALECIENTE' && c !== 'MUERTO';

/// Parte una lista en grupos de `tamano`.
export function agrupar<T>(lista: T[], tamano: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) r.push(lista.slice(i, i + tamano));
  return r;
}

interface Vivo {
  c: CombatienteFondo;
  condicion: CondicionFisica;
  huido: boolean;
}

const activo = (v: Vivo) => enPie(v.condicion) && !v.huido;

function participante(v: Vivo, rol: 'ataque' | 'defensa'): ExchangeParticipant {
  return { attributes: v.c.attributes, attribute: v.c.attribute, attributeBonus: v.c.attributeBonus, difficulty: DIFICULTAD_FONDO, condicionFisica: v.condicion, rol };
}

/// Un sub-combate entre dos grupos (modifica sus estados). Devuelve las rondas y los bandos que se
/// retiraron.
export function simularSubCombate(a: Vivo[], b: Vivo[], random: () => number): { rondas: number; retiradas: BandoFondo[] } {
  const todos = [...a, ...b];
  const lado = (bando: BandoFondo) => (bando === 'A' ? a : b);
  const retirandose = new Set<BandoFondo>();
  const moralTirada = new Set<string>(); // disparadores ya usados, para no tirar dos veces por lo mismo
  for (let ronda = 1; ronda <= MAX_RONDAS_SUBCOMBATE; ronda++) {
    const orden = rollInitiativeMultiple(
      todos.filter(activo).map((v) => ({ participantId: v.c.id, bando: v.c.bando === 'A' ? 'JUGADOR' : 'ENEMIGO', destreza: v.c.attributes.destreza, condicionFisica: v.condicion })),
      random,
    );
    for (const turno of orden) {
      const yo = todos.find((v) => v.c.id === turno.participantId)!;
      if (!activo(yo)) continue;
      const propios = lado(yo.c.bando);
      const rivales = lado(yo.c.bando === 'A' ? 'B' : 'A');
      if (!rivales.some(activo)) return { rondas: ronda, retiradas: [...retirandose] };
      // Un bando que se retira intenta escapar en vez de atacar.
      if (retirandose.has(yo.c.bando)) {
        const nivelPerseguidor = Math.max(...rivales.filter(activo).map((v) => v.c.nivel));
        if (tirarEscape(yo.c.attributes, yo.c.nivel, nivelPerseguidor, random).escapa) yo.huido = true;
        continue;
      }
      const candidatos = rivales.filter((v) => !v.huido).map((v) => ({ participantId: v.c.id, condicionFisica: v.condicion, constitucion: v.c.attributes.constitucion }));
      const capitan = elegirCapitan(propios.filter(activo), (v) => v.c.attributes.inteligencia);
      const objetivoId = capitan ? objetivoConcentrado(candidatos, random) : elegirObjetivo(yo.c.attributes.inteligencia, candidatos, random);
      const objetivo = objetivoId ? rivales.find((v) => v.c.id === objetivoId) : undefined;
      if (!objetivo) continue;
      const antes = { condicion: objetivo.condicion, enPie: rivales.filter(activo).length };
      const res = resolveExchange(participante(yo, 'ataque'), participante(objetivo, 'defensa'), random);
      let herido: Vivo | null = null;
      if (res.resultado === 'golpe_normal' || res.resultado === 'golpe_pleno') herido = objetivo;
      else if (res.resultado === 'defensor_contragolpea') herido = yo;
      if (!herido) continue;
      const suyos = lado(herido.c.bando);
      const antesHerido = herido === objetivo ? antes : { condicion: yo.condicion, enPie: propios.filter(activo).length };
      herido.condicion = oneStepWorseThan(herido.condicion);
      // Moral del bando del herido (CR-44): a la mitad o con alguien a GRAVE.
      const dispara = disparadoresDeMoral(
        { condicion: antesHerido.condicion, propiosEnPie: antesHerido.enPie, propiosTotal: suyos.length },
        { condicion: herido.condicion, propiosEnPie: suyos.filter(activo).length },
      ).filter((d) => !moralTirada.has(`${herido!.c.bando}:${d}:${d === 'GRAVE' ? herido!.c.id : ''}`));
      if (dispara.length > 0 && suyos.some((v) => v.c.conMoral) && !retirandose.has(herido.c.bando)) {
        for (const d of dispara) moralTirada.add(`${herido.c.bando}:${d}:${d === 'GRAVE' ? herido.c.id : ''}`);
        const contrarios = lado(herido.c.bando === 'A' ? 'B' : 'A');
        const tira = quienTiraMoral(
          suyos.filter((v) => v.c.conMoral).map((v) => ({ id: v.c.id, voluntad: v.c.attributes.voluntad, enPie: activo(v) })),
          suyos.find((v) => v.c.lider)?.c.id ?? null,
        );
        const quien = tira ? suyos.find((v) => v.c.id === tira.id) : undefined;
        if (quien) {
          const desventaja = vaClaramentePerdiendo(suyos.map((v) => v.condicion), contrarios.map((v) => v.condicion));
          if (!tirarMoral(quien.c.attributes, desventaja, random).aguanta) retirandose.add(herido.c.bando);
        }
      }
      if (!a.some(activo) || !b.some(activo)) return { rondas: ronda, retiradas: [...retirandose] };
    }
  }
  return { rondas: MAX_RONDAS_SUBCOMBATE, retiradas: [...retirandose] };
}

/// Un combate de fondo entero entre dos bandos.
export function simularCombateDeFondo(
  combatientes: CombatienteFondo[],
  random: () => number,
  opciones: { tamano?: number; probMuerte?: number } = {},
): ResultadoFondo {
  const tamano = opciones.tamano ?? TAMANO_SUBCOMBATE_FONDO;
  const vivos: Vivo[] = combatientes.map((c) => ({ c, condicion: 'ILESO', huido: false }));
  const gruposA = agrupar(vivos.filter((v) => v.c.bando === 'A'), tamano);
  const gruposB = agrupar(vivos.filter((v) => v.c.bando === 'B'), tamano);
  const retiradas = new Set<BandoFondo>();
  let rondas = 0;
  let subcombates = 0;
  // Siguiente grupo de un bando que aún puede pelear, empezando por el de turno.
  const grupoListo = (grupos: Vivo[][], k: number) => {
    for (let i = 0; i < grupos.length; i++) {
      const g = grupos[(k + i) % grupos.length]!;
      if (g.some(activo)) return g;
    }
    return null;
  };
  // Se pelea hasta que un bando se retira o se queda sin nadie; con tope por si los sub-combates
  // acaban en tablas una y otra vez.
  const tope = Math.max(gruposA.length, gruposB.length) * 4;
  for (let k = 0; k < tope && retiradas.size === 0; k++) {
    const ga = grupoListo(gruposA, k);
    const gb = grupoListo(gruposB, k);
    if (!ga || !gb) break;
    const r = simularSubCombate(ga, gb, random);
    rondas += r.rondas;
    subcombates++;
    for (const x of r.retiradas) retiradas.add(x);
  }
  // Un bando que se retira deja el campo: sus combatientes en pie se van con él.
  for (const v of vivos) if (retiradas.has(v.c.bando) && enPie(v.condicion)) v.huido = true;
  const quedaA = vivos.some((v) => v.c.bando === 'A' && activo(v));
  const quedaB = vivos.some((v) => v.c.bando === 'B' && activo(v));
  const ganador: BandoFondo | null = quedaA && !quedaB ? 'A' : quedaB && !quedaA ? 'B' : null;

  // Muertes: de quien ha caído, el 3 %; los NPC con nombre, nunca.
  const prob = opciones.probMuerte ?? PROBABILIDAD_MUERTE_FONDO;
  const estados: EstadoFondo[] = vivos.map((v) => {
    const cayo = !enPie(v.condicion);
    const muerto = cayo && !v.c.conNombre && random() < prob;
    return { id: v.c.id, condicion: muerto ? 'MUERTO' : v.condicion, huido: v.huido, muerto };
  });
  return { ganador, retiradas: [...retiradas], subcombates, rondas, estados };
}
