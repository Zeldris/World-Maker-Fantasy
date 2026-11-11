// 3.2 (2026-10-21): interpreta los pasos de `prepararReino.ts` (puro, para probarlo sin base).
import type { Attribute } from '../services/dice.js';
import { ROLES_SUBDITO } from '../services/cronista/subditos.js';
import { esTarea, TAREAS } from '../services/cronista/comidaOficios.js';

const ATRIBUTOS: readonly Attribute[] = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'voluntad', 'carisma', 'magia'];
export type PasoReino =
  | { tipo: 'subditos'; pueblo: string; n: number; rol: string | null; sexo: SexoSubditos }
  | { tipo: 'reclutar'; npcSlug: string }
  | { tipo: 'guarnicion' }
  | { tipo: 'milicia'; n: number }
  | { tipo: 'relacion'; facSlug: string; evento: string; n: number }
  | { tipo: 'combate'; npcSlugs: string[] }
  | { tipo: 'combate1v1'; npcSlug: string }
  | { tipo: 'partidaCaza'; especie: string; n: number; heridos: number; permanente: boolean }
  | { tipo: 'ganado'; especie: string; n: number }
  | { tipo: 'convaleciente'; npcSlug: string; enCombate: boolean }
  | { tipo: 'lider-muere'; facSlug: string }
  | { tipo: 'alianza'; facA: string; facB: string }
  | { tipo: 'vasallo-paga'; vasalloSlug: string }
  | { tipo: 'domable'; especie: string }
  | { tipo: 'domador'; nivel: number }
  | { tipo: 'punto-retirado'; especie: string; n: number | null }
  | { tipo: 'sin-aliados' }
  | { tipo: 'sin-guarnicion' }
  | { tipo: 'fuera'; lugarSlug: string }
  | { tipo: 'reparar' }
  | { tipo: 'danar'; receta: string }
  | { tipo: 'escasez'; facSlug: string; recurso: string | null }
  | { tipo: 'asalto'; facSlug: string }
  | { tipo: 'mochila-libre'; n: number | null }
  | { tipo: 'mochila-descartar'; n: number | null }
  | { tipo: 'nivel'; nivel: number; atributos: Attribute[] }
  | { tipo: 'herido'; npcSlug: string; condicion: 'HERIDO' | 'GRAVE' }
  | { tipo: 'huida-rival'; npcSlug: string | null };

/// P378: `m`/`f` fija el sexo de todos; `alterna` (por defecto) da macho, hembra, macho… para que haya parejas posibles.
/// P433: `pareja` alterna igual (macho, hembra…) y además los empareja de dos en dos con `parejaId` en los dos sentidos, como `revisarFamilias`.
export type SexoSubditos = 'm' | 'f' | 'alterna' | 'pareja';
const SEXOS: Record<string, SexoSubditos> = { m: 'm', f: 'f', pareja: 'pareja', alterna: 'alterna' };

/// Sexo del súbdito número `i` (desde 0) de un paso `subditos`.
export function sexoDelSubdito(sexo: SexoSubditos, i: number): 'M' | 'F' {
  return sexo === 'm' ? 'M' : sexo === 'f' ? 'F' : i % 2 === 0 ? 'M' : 'F';
}

export const EVENTOS_RELACION = ['EXPANSION_TERRITORIAL_AGRESIVA', 'BAJA_DE_GUERRA', 'SABOTAJE_DIPLOMATICO'] as const;

/// `subditos:orcos:3[:soldado][:sexo=m|f|pareja]` (P378: sin `sexo=` alterna macho y hembra; `m`/`f` los fija), `reparar` (P369: repara todos los edificios DANADO con la función del botón «Reparar»), `danar:<receta>` (P301: deja DANADO el edificio activo de esa receta, como una tormenta), `reclutar:<npc>`, `guarnicion`, `milicia:<n>`, `relacion:<faccion>:<EVENTO>:<n>`
/// (la facción presiona al Reino), `combate:<npc>,<npc>…` (combate de grupo, `CombatEncounter`), `combate1v1:<npc>` (QA-293, P373: el combate 1v1 clásico contra ese NPC, traído adonde está la jugadora como un agresor que se lanza contra ella, el efecto `forzarCombate` del Cronista; el panel de combate sale al cargar la partida; se niega con un combate en curso o un NPC que no existe), `partida-caza:<presa>:<n>[:permanente]` (QA-298, P338/P339: una partida de caza del Reino queda a punto de volver con n piezas de esa presa; al avanzar el día vuelve por el camino normal), `ganado:<especie>:<n>` (n animales adultos al corral, alternando macho y hembra), `convaleciente:<npc>[:combate]` (el NPC queda CONVALECIENTE en el lugar actual, como tras ganarle un combate; con `:combate`, además el combate sigue sin resolver y sale la tarjeta Matar/Capturar/Clemente, QA-270),
/// `lider-muere:<facción>` (QA-268, CR-43: el líder muere de viejo y la facción queda con dos candidatos), `alianza:<A>:<B>`
/// (P247: alianza, ruptura y alianza nueva de las dos facciones) y `vasallo-paga:<vasallo>` (P314: fondos para la cuota entera sin saldar la deuda).
/// `domable:<especie>` (QA-269, CR-55: un animal de ganado atado en una Jaula libre, a falta de ganar su confianza y llevarlo «Al corral») y
/// `domador:<nivel>` (CR-56: la jugadora, Cazador, sube a ese nivel, de 10 a 19, y elige la especialización Domador). `punto-retirado:<especie>[:<n>]` (QA-266, P313: un punto de fauna retirado que aún tiene n presas, 3 si no se dice; estado sintético para la defensa de `opcionesDePartida`). `fuera:<lugar>` (P427: la jugadora sale de la Capital al lugar de ese slug, con su punto de entrada; para probar un asalto con ella fuera). `sin-guarnicion` (P427: soldados y vigías a trabajador, milicia licenciada y Armerías sin equipos: un asalto toma la Capital sin nadie que la defienda, salvo guardias de corral). `sin-aliados` (QA-266, P128: los compañeros salen del Grupo 1 a otro grupo, así el combate se abre solo con la jugadora).
/// P180: `escasez:<facción>[:comida]` (la facción, por su origenSlug, queda con carencia de comida: sus cocinas se dañan con el efecto de las tormentas hasta que `situacionDeFaccion` la ve; pedir trabajo o mirar su tablón saca entonces «le falta…» / «para el Clan…»). P295: `asalto:<facción>` (un ejército de esa facción sale contra la Capital y la vigilancia del día lo avista desde la Torre; queda EN MARCHA, sin resolver, para «Llamar a la milicia»). P367: `mochila-libre[:<n>]` (deja n unidades de hueco en la mochila, 10 si no se dice: lo que sobra va al Almacén del Reino con «Depositar»). P370: `nivel:<n>[:<atributo>,<atributo>…]` (la jugadora, de cualquier clase, sube al nivel n, de 2 a 19, como al ganar XP; sin atributos, los puntos quedan por repartir; con ellos, P386, se reparten todos por turno entre esos, como el botón, también con un combate abierto). Se ejecutan en el orden dado.
export function parsearPasosReino(args: string[]): PasoReino[] | { error: string } {
  if (args.length === 0) return { error: 'No se ha pedido nada.' };
  const pasos: PasoReino[] = [];
  for (const arg of args) {
    const [clave, ...r] = arg.split(':');
    const entero = (t: string | undefined) => (t != null && /^\d+$/.test(t) && Number(t) >= 1 ? Number(t) : null);
    if (clave === 'subditos') {
      const n = entero(r[1]);
      if (!r[0] || n == null) return { error: `«${arg}»: falta subditos:<pueblo>:<n>[:<rol>].` };
      // Tras n: `[rol]` y/o `sexo=m|f|pareja` en cualquier orden (sin ambigüedad con los roles).
      const extra = r.slice(2);
      if (extra.length > 2) return { error: `«${arg}»: subditos:<pueblo>:<n>[:<rol>][:sexo=m|f|pareja].` };
      const tSexo = extra.filter((t) => t.startsWith('sexo='));
      const roles = extra.filter((t) => !t.startsWith('sexo='));
      const sexo = tSexo.length ? SEXOS[tSexo[0]!.slice(5)] : 'alterna';
      if (tSexo.length > 1 || roles.length > 1 || !sexo || (roles[0] !== undefined && roles[0] === '')) return { error: `«${arg}»: subditos:<pueblo>:<n>[:<rol>][:sexo=m|f|pareja].` };
      // P432: un rol que no existe se rechaza antes de escribir nada (y, si es un valor de `sexo=`, se sugiere esa sintaxis).
      const rol = roles[0];
      if (rol !== undefined && !(ROLES_SUBDITO as readonly string[]).includes(rol) && !esTarea(rol)) {
        const pista = SEXOS[rol] ? ` ¿Querías «sexo=${rol}»? Ej.: subditos:${r[0]}:${n}:sexo=${rol}.` : '';
        return { error: `«${arg}»: rol desconocido «${rol}» (roles: ${ROLES_SUBDITO.join(', ')}; tareas: ${TAREAS.join(', ')}).${pista}` };
      }
      pasos.push({ tipo: 'subditos', pueblo: r[0], n, rol: rol ?? null, sexo });
    } else if (clave === 'reclutar') {
      if (!r[0]) return { error: `«${arg}»: falta reclutar:<slug del NPC>.` };
      pasos.push({ tipo: 'reclutar', npcSlug: r[0] });
    } else if (clave === 'guarnicion' && r.length === 0) {
      pasos.push({ tipo: 'guarnicion' });
    } else if (clave === 'milicia') {
      const n = entero(r[0]);
      if (n == null) return { error: `«${arg}»: falta milicia:<n>.` };
      pasos.push({ tipo: 'milicia', n });
    } else if (clave === 'relacion') {
      const n = entero(r[2]);
      if (!r[0] || !(EVENTOS_RELACION as readonly string[]).includes(r[1] ?? '') || n == null) return { error: `«${arg}»: falta relacion:<facción>:<${EVENTOS_RELACION.join('|')}>:<n>.` };
      pasos.push({ tipo: 'relacion', facSlug: r[0], evento: r[1]!, n });
    } else if (clave === 'combate') {
      const npcSlugs = (r[0] ?? '').split(',').filter(Boolean);
      if (npcSlugs.length === 0) return { error: `«${arg}»: falta combate:<npc>,<npc>…` };
      pasos.push({ tipo: 'combate', npcSlugs });
    } else if (clave === 'combate1v1') {
      if (!r[0] || r.length > 1 || r[0].includes(',')) return { error: `«${arg}»: falta combate1v1:<slug del NPC> (uno solo).` };
      pasos.push({ tipo: 'combate1v1', npcSlug: r[0] });
    } else if (clave === 'partida-caza') {
      // QA-299 (P439): `partida-caza:<presa>:heridos=<h>[:permanente]` en vez de n: vuelve sin piezas y con h heridos.
      const conHeridos = r[1]?.startsWith('heridos=') ?? false;
      const n = conHeridos ? 0 : entero(r[1]);
      const h = conHeridos ? entero(r[1]!.slice('heridos='.length)) : 0;
      if (!r[0] || n == null || h == null || r.length > 3 || (r[2] != null && r[2] !== 'permanente')) return { error: `«${arg}»: falta partida-caza:<presa>:<n>[:permanente] (n entero de 1 o más) o partida-caza:<presa>:heridos=<h>[:permanente].` };
      pasos.push({ tipo: 'partidaCaza', especie: r[0], n, heridos: h, permanente: r[2] === 'permanente' });
    } else if (clave === 'ganado') {
      const n = entero(r[1]);
      if (!r[0] || n == null) return { error: `«${arg}»: falta ganado:<especie>:<n>.` };
      pasos.push({ tipo: 'ganado', especie: r[0], n });
    } else if (clave === 'convaleciente') {
      if (!r[0] || r.length > 2 || (r[1] != null && r[1] !== 'combate')) return { error: `«${arg}»: falta convaleciente:<slug del NPC>[:combate].` };
      pasos.push({ tipo: 'convaleciente', npcSlug: r[0], enCombate: r[1] === 'combate' });
    } else if (clave === 'lider-muere') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta lider-muere:<slug de la facción>.` };
      pasos.push({ tipo: 'lider-muere', facSlug: r[0] });
    } else if (clave === 'alianza') {
      if (!r[0] || !r[1] || r.length > 2) return { error: `«${arg}»: falta alianza:<facción A>:<facción B>.` };
      pasos.push({ tipo: 'alianza', facA: r[0], facB: r[1] });
    } else if (clave === 'vasallo-paga') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta vasallo-paga:<slug del vasallo>.` };
      pasos.push({ tipo: 'vasallo-paga', vasalloSlug: r[0] });
    } else if (clave === 'domable') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta domable:<especie de ganado>.` };
      pasos.push({ tipo: 'domable', especie: r[0] });
    } else if (clave === 'fuera') {
      if (!r[0] || r.length > 1 || !/^[a-z0-9-]+$/.test(r[0])) return { error: `«${arg}»: falta fuera:<slug del lugar> (p. ej. fuera:hondonada-del-eco).` };
      pasos.push({ tipo: 'fuera', lugarSlug: r[0] });
    } else if (clave === 'sin-aliados' && r.length === 0) {
      pasos.push({ tipo: 'sin-aliados' });
    } else if (clave === 'sin-guarnicion' && r.length === 0) {
      pasos.push({ tipo: 'sin-guarnicion' });
    } else if (clave === 'punto-retirado') {
      const n = r[1] === undefined ? null : entero(r[1]);
      if (!r[0] || r.length > 2 || (r[1] !== undefined && (n == null || n > 20))) return { error: `«${arg}»: falta punto-retirado:<especie>[:<n>], con n de 1 a 20.` };
      pasos.push({ tipo: 'punto-retirado', especie: r[0], n });
    } else if (clave === 'reparar' && r.length === 0) {
      pasos.push({ tipo: 'reparar' });
    } else if (clave === 'danar') {
      if (!r[0] || r.length > 1 || !/^[a-z0-9-]+$/.test(r[0])) return { error: `«${arg}»: falta danar:<receta> (p. ej. danar:cocina).` };
      pasos.push({ tipo: 'danar', receta: r[0] });
    } else if (clave === 'escasez') {
      if (!r[0] || r.length > 2 || (r[1] !== undefined && r[1] === '')) return { error: `«${arg}»: falta escasez:<facción>[:comida].` };
      pasos.push({ tipo: 'escasez', facSlug: r[0], recurso: r[1] ?? null });
    } else if (clave === 'asalto') {
      if (!r[0] || r.length > 1) return { error: `«${arg}»: falta asalto:<facción>.` };
      pasos.push({ tipo: 'asalto', facSlug: r[0] });
    } else if (clave === 'mochila-libre') {
      const n = r[0] === undefined ? null : entero(r[0]);
      if (r.length > 1 || (r[0] !== undefined && (n == null || n > 200))) return { error: `«${arg}»: falta mochila-libre[:<n>], con n de 1 a 200.` };
      pasos.push({ tipo: 'mochila-libre', n });
    } else if (clave === 'mochila-descartar') {
      // QA-299 (P336): como mochila-libre, pero descartando (sin pasar por el Almacén, que puede estar lleno).
      const n = r[0] === undefined ? null : entero(r[0]);
      if (r.length > 1 || (r[0] !== undefined && (n == null || n > 200))) return { error: `«${arg}»: falta mochila-descartar[:<n>], con n de 1 a 200.` };
      pasos.push({ tipo: 'mochila-descartar', n });
    } else if (clave === 'nivel') {
      const nivel = entero(r[0]);
      const atributos = r[1] === undefined ? [] : r[1].split(',');
      if (nivel == null || r.length > 2 || nivel < 2 || nivel > 19) return { error: `«${arg}»: falta nivel:<n>[:<atributo>,…], de 2 a 19 (desde el 20 cambian las habilidades de arma).` };
      const malo = atributos.find((a) => !(ATRIBUTOS as readonly string[]).includes(a));
      if (malo !== undefined || (r[1] !== undefined && new Set(atributos).size !== atributos.length)) return { error: `«${arg}»: nivel:<n>:<atributo>,… con atributos sin repetir de ${ATRIBUTOS.join(', ')}.` };
      pasos.push({ tipo: 'nivel', nivel, atributos: atributos as Attribute[] });
    } else if (clave === 'herido') {
      // P370: `herido:<npc>[:grave|herido]`, GRAVE por defecto (más herido que la jugadora tras la ronda 1).
      if (!r[0] || r.length > 2 || (r[1] !== undefined && r[1] !== 'grave' && r[1] !== 'herido')) return { error: `«${arg}»: falta herido:<slug del NPC>[:grave|herido].` };
      pasos.push({ tipo: 'herido', npcSlug: r[0], condicion: r[1] === 'herido' ? 'HERIDO' : 'GRAVE' });
    } else if (clave === 'huida-rival') {
      // P443: `huida-rival[:<npc>]`, un rival con moral del combate en curso queda GRAVE y sin moral tirada (el primero si no se nombra).
      if (r.length > 1 || (r.length === 1 && !r[0])) return { error: `«${arg}»: falta huida-rival[:<slug del rival>].` };
      pasos.push({ tipo: 'huida-rival', npcSlug: r[0] ?? null });
    } else if (clave === 'domador') {
      const nivel = entero(r[0]);
      if (nivel == null || r.length > 1 || nivel < 10 || nivel > 19) return { error: `«${arg}»: falta domador:<nivel>, de 10 a 19 (desde el 20 cambian las habilidades de arma).` };
      pasos.push({ tipo: 'domador', nivel });
    } else {
      return { error: `«${arg}»: paso desconocido.` };
    }
  }
  return pasos;
}
