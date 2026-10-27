// 3.2 (2026-10-21): prepara estados del Reino que `darReino.ts` no alcanza, SOLO con las funciones del juego que aplican
// sus reglas (QA-151: nada de UPDATE/INSERT a mano). Pasos, en el orden dado:
//   subditos:<pueblo>:<n>[:<rol>]   n súbditos adultos (`crearSubdito`) y, si se da, su rol (`cambiarRolSubdito`: soldado, vigia, cazador…)
//                                   o su tarea de trabajador (`cambiarTareaSubdito`: ganadero, recolector, fibrero…)
//   reclutar:<npc>                  un NPC con nombre se une como compañero real (`proponer` RECLUTAR, con la tirada ganada; pide cama libre)
//   guarnicion                      cada soldado y vigía a la guarnición de la capital mientras haya plazas (`asignarGuarnicion`)
//   milicia:<n>                     compra n equipos de milicia en la Armería de la Capital (`comprarEquiposMilicia`)
//   relacion:<facción>:<EVENTO>:<n> la facción (origenSlug) presiona al Reino n veces (`recordFactionEvent`; EXPANSION_TERRITORIAL_AGRESIVA sube 15)
//   ganado:<especie>:<n>            n animales adultos al corral del Ganadero (`meterEnCorral`, como «Al corral»), alternando macho y hembra
//   convaleciente:<npc>[:combate]   el NPC queda CONVALECIENTE en el lugar actual, con los datos de `NpcState` de la derrota real (`dejarNpcConvaleciente`: condición, reloj, ausencia de zona de 6 h y grupo); con `:combate` (QA-270, P95/P320) el combate sigue sin resolver en `pendingCombatNpcSlugs` (`dejarConvalecienteEnCombate`) y sale la tarjeta Matar/Capturar/Clemente; el animal sigue ausente del mapa, como tras la derrota real
//   lider-muere:<facción>           CR-43: el líder muere de viejo por la vía del motor (`morirDeViejo`, la de `envejecerDia`) y, si hacen falta, destacan jóvenes (`crearNpc` DESTACA) hasta 2 candidatos; la cohesión queda en 20-50 tras la baja; la sucesión (y la escisión con nombre) sale al avanzar (`matarLiderDeFaccion`)
//   alianza:<A>:<B>                 P247: alianza, ruptura y alianza nueva de la facción A con la B (`recordFactionEvent` NEGOCIACION_TREGUA y EXPANSION_TERRITORIAL_AGRESIVA: `aliarTrasRuptura`)
//   vasallo-paga:<vasallo>          P314: el vasallo con una cuota de deuda (`asegurarVasallajes`) y fondos de cuota y media sin saldar la deuda (efecto `ajustarReino`): y la revisión de la semana (de mañana como mucho) corrida en el acto: `pagada-con-deuda` (`vasalloPagaConDeuda`)
//   domable:<especie>               CR-55: un animal de ganado (murgol, corretolvas…) capturado y atado en una Jaula libre apta, como lo deja la partida de captura al volver (`dejarDomableEnJaula`, `atarEnJaula`): felicidad 0, a falta de ganar su confianza (`intentar`) y llevarlo «Al corral»
//   domador:<nivel>                 CR-56: la jugadora (Cazador) sube al nivel dado (≥ 10, < 20) como al ganar XP (`subirDeNivel`: `applyXp`, puntos de atributo, habilidades de cada nivel) y elige la especialización Domador (`fijarEspecializacion`, la de `PATCH /saves/:id/especializacion`)
//   sin-aliados                     QA-266, P128: los compañeros del Grupo 1 pasan a otro grupo (`moverCompaneroDeGrupo`, la regla del arrastre del panel): un combate que se abra después solo lleva a la jugadora
//   punto-retirado:<especie>[:<n>] QA-266, P313: un punto de fauna del lugar actual retirado con n presas (3 por defecto): `activo` false y `cantidad` > 0; estado sintético (el juego no lo produce hoy) para la defensa de `opcionesDePartida`, con los efectos `crearPuntoZona` y `retirarPuntoZona`
//   combate:<npc>,<npc>…            abre un combate de la jugadora contra esos NPC, donde esté (`abrirCombateDePersonas`)
// Uso: DATABASE_URL=… npx tsx src/scripts/prepararReino.ts <saveId> subditos:orcos:3 reclutar:tirag-susig …
// Lo lanza `tools/qa/escenario.sh preparar`. Cada paso va en su transacción: si uno falla, los anteriores quedan.
import { prisma } from '../lib/prisma.js';
import { MINUTOS_POR_ANIO, cicloVital } from '../services/cronista/edades.js';
import { cambiarRolSubdito, cambiarTareaSubdito, crearSubdito } from '../services/cronista/subditos.js';
import { esTarea } from '../services/cronista/comidaOficios.js';
import { proponer } from '../services/cronista/reclutamiento.js';
import { asentamientosDelReino, asignarGuarnicion, comprarEquiposMilicia } from '../services/defensaReino.js';
import { recordFactionEvent, type FactionEventType } from '../services/factionRelations.js';
import { faccionDelReino } from '../services/guerraReino.js';
import { abrirCombateDePersonas, type MiembroDeGrupo } from '../services/combatePersonas.js';
import { scopeFor } from '../services/npcScene.js';
import { dejarNpcConvaleciente } from '../services/turnLootKill.js';
import { dejarSinAliados } from '../services/cronista/prepararSinAliados.js';
import { dejarPuntoRetirado } from '../services/cronista/prepararPuntoRetirado.js';
import { formatFictionalDate } from '../services/worldClock.js';
import type { AttributeBlock } from '../services/dice.js';
import { meterEnCorral } from '../services/cronista/ganadoReino.js';
import { aliarTrasRuptura, matarLiderDeFaccion, vasalloPagaConDeuda } from '../services/cronista/prepararSucesos.js';
import { dejarDomableEnJaula } from '../services/cronista/prepararDoma.js';
import { dejarConvalecienteEnCombate } from '../services/cronista/prepararConvaleciente.js';
import { hacerDomador } from '../services/progresionPersonaje.js';
import { parsearPasosReino } from './prepararReinoLib.js';

const [saveId, ...args] = process.argv.slice(2);
const pasos = parsearPasosReino(args);
if (!saveId || 'error' in pasos) {
  console.error(`${'error' in pasos ? pasos.error + ' ' : ''}Uso: prepararReino.ts <saveId> subditos:<pueblo>:<n>[:<rol>] reclutar:<npc> guarnicion milicia:<n> relacion:<facción>:<EVENTO>:<n> ganado:<especie>:<n> convaleciente:<npc>[:combate] lider-muere:<facción> alianza:<A>:<B> vasallo-paga:<vasallo> domable:<especie> domador:<nivel> punto-retirado:<especie>[:<n>] sin-aliados combate:<npc>,<npc>…`);
  process.exit(2);
}
const save = await prisma.save.findUnique({
  where: { id: saveId },
  select: { worldId: true, characterName: true, attributes: true, currentLocationId: true, worldState: { select: { fictionalMinutes: true } } },
});
if (!save || !save.worldState) {
  console.error(`No hay partida ${saveId} con reloj.`);
  process.exit(1);
}
const ahora = save.worldState.fictionalMinutes;
let fallo = false;
const dice = (t: string) => console.log(t);
const rechaza = (t: string) => { console.error(t); fallo = true; };

for (const paso of pasos) {
  if (fallo) break;
  if (paso.tipo === 'subditos') {
    for (let i = 0; i < paso.n; i++) {
      const edad = cicloVital(paso.pueblo).madurez + 3 + (i % 10);
      const s = await prisma.$transaction(async (tx) => {
        const nuevo = await crearSubdito(tx, { saveId, worldId: save.worldId, pueblo: paso.pueblo, nacidoEn: ahora - edad * MINUTOS_POR_ANIO, origen: 'LLEGADA', ahora, random: Math.random });
        if (paso.rol && esTarea(paso.rol)) {
          // ganadero, recolector…: son tareas del trabajador, no roles.
          const r = await cambiarTareaSubdito(tx, saveId, nuevo.id, paso.rol, ahora);
          if (!r.ok) throw new Error(`${nuevo.name}: ${r.motivo}`);
        } else if (paso.rol) {
          const r = await cambiarRolSubdito(tx, saveId, nuevo.id, paso.rol, ahora);
          if (!r.ok) throw new Error(`${nuevo.name}: ${r.motivo}`); // deshace también el súbdito recién creado
        }
        return nuevo;
      }).catch((e: unknown) => { rechaza(e instanceof Error ? e.message : String(e)); return null; });
      if (!s) break;
      dice(`Súbdito: ${s.name} (${paso.pueblo}, ${paso.rol ?? 'trabajador'})`);
    }
  } else if (paso.tipo === 'reclutar') {
    // random fijo alto: la tirada de Carisma se gana (el reclutamiento en sí lo decide la regla del juego: cama, líder, ya acompañante…).
    const r = await proponer(prisma, saveId, paso.npcSlug, 'RECLUTAR', () => 0.999);
    if (!r.ok) rechaza(`reclutar ${paso.npcSlug}: ${r.motivo}`);
    else if (!r.exito) rechaza(`reclutar ${paso.npcSlug}: ${r.texto}`);
    else dice(`Compañero: ${r.texto}`);
  } else if (paso.tipo === 'guarnicion') {
    const asignados = await prisma.$transaction(async (tx) => {
      const capital = (await asentamientosDelReino(tx, saveId)).find((a) => a.capital);
      if (!capital) return null;
      const soldados = await tx.subject.findMany({ where: { saveId, estado: 'ACTIVO' }, select: { id: true, name: true, role: true }, orderBy: { createdAt: 'asc' } });
      const hechos: string[] = [];
      for (const s of soldados) {
        const r = await asignarGuarnicion(tx, saveId, s.id, capital.id);
        if (r.ok) hechos.push(s.name);
        else if (!/^Solo se asignan/.test(r.motivo)) throw new Error(`guarnicion: ${s.name} no entra (${r.motivo})`);
      }
      return hechos;
    }).catch((e: unknown) => { rechaza(e instanceof Error ? e.message : String(e)); return 'error' as const; });
    if (asignados === 'error') continue;
    if (!asignados) rechaza('guarnicion: el Reino no tiene Ayuntamiento activo.');
    else dice(`Guarnición de la capital: ${asignados.join(', ') || 'nadie'}`);
  } else if (paso.tipo === 'milicia') {
    // La milicia sale de la Capital: solo cuenta la Armería de su asentamiento.
    const capital = (await asentamientosDelReino(prisma, saveId)).find((a) => a.capital);
    const armeria = capital?.modulos.find((m) => m.modulo === 'armeria');
    if (!armeria) { rechaza('milicia: no hay Armería activa en la Capital (dar-reino edificio:armeria).'); continue; }
    const r = await prisma.$transaction((tx) => comprarEquiposMilicia(tx, saveId, armeria.id, paso.n));
    if (!r.ok) rechaza(`milicia: ${r.motivo}`);
    else dice(`Milicia: ${r.comprados} equipos`);
  } else if (paso.tipo === 'relacion') {
    const reino = await faccionDelReino(prisma, saveId);
    const faccion = await prisma.faction.findFirst({ where: { saveId, origenSlug: paso.facSlug, disueltaEn: null }, select: { id: true, name: true } });
    if (!reino || !faccion) { rechaza(`relacion: no hay Reino o facción «${paso.facSlug}».`); continue; }
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < paso.n; i++) await recordFactionEvent(tx, save.worldId, faccion.id, reino.id, paso.evento as FactionEventType, saveId);
    });
    const rel = await prisma.factionRelation.findFirst({ where: { sourceFactionId: faccion.id, targetFactionId: reino.id }, select: { type: true, presion: true } });
    dice(`Relación ${faccion.name} → ${reino.name}: ${rel?.type} (presión ${rel?.presion})`);
  } else if (paso.tipo === 'combate') {
    const npcs = await prisma.npc.findMany({ where: { worldId: save.worldId, saveId: null, slug: { in: paso.npcSlugs } } });
    const faltan = paso.npcSlugs.filter((s) => !npcs.some((n) => n.slug === s));
    if (faltan.length) { rechaza(`combate: no hay NPC ${faltan.join(', ')}.`); continue; }
    const miembros: MiembroDeGrupo[] = paso.npcSlugs.map((slug) => {
      const n = npcs.find((x) => x.slug === slug)!;
      const a = n.attributes as AttributeBlock;
      return { npcId: n.id, nombre: n.name, scope: scopeFor(n.kind, save.currentLocationId), destreza: a.destreza, inteligencia: a.inteligencia, esGrupo: false };
    });
    const abierto = await abrirCombateDePersonas(
      prisma,
      { id: saveId, characterName: save.characterName, attributes: save.attributes as AttributeBlock, fictionalMinutes: ahora, timeLabel: formatFictionalDate(ahora) },
      miembros,
    );
    if (!abierto) rechaza('combate: ya hay un combate en curso.');
    else dice(`Combate abierto contra ${miembros.map((m) => `${m.nombre} (Int ${m.inteligencia})`).join(', ')}`);
  } else if (paso.tipo === 'convaleciente' && paso.enCombate) {
    const r = await dejarConvalecienteEnCombate(prisma, { saveId, npcSlug: paso.npcSlug });
    if ('error' in r) rechaza(r.error);
    else dice(`Convaleciente en combate: ${r.nombre} (${r.scope}); combate sin resolver con ${r.rivales.join(', ')}`);
  } else if (paso.tipo === 'convaleciente') {
    const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: paso.npcSlug }, select: { id: true, slug: true, kind: true } });
    if (!npc) { rechaza(`convaleciente: no hay NPC ${paso.npcSlug}.`); continue; }
    // Lo escribe `dejarNpcConvaleciente` (`turnLootKill.ts`), la misma función de datos que usa la derrota real en combate: condición y reloj, ausencia de zona de 6 h y grupo.
    const { scope } = await prisma.$transaction((tx) => dejarNpcConvaleciente(tx, { saveId, npc, currentLocationId: save.currentLocationId, ahora }));
    dice(`Convaleciente: ${npc.slug} (${scope})`);
  } else if (paso.tipo === 'lider-muere') {
    const r = await matarLiderDeFaccion(prisma, { saveId, faccionSlug: paso.facSlug });
    if ('error' in r) rechaza(r.error);
    else dice(`Líder muerto: ${r.lider} (${r.faccion}, cohesión ${r.cohesion}); candidatos: ${r.candidatos.join(', ')}`);
  } else if (paso.tipo === 'alianza') {
    const r = await aliarTrasRuptura(prisma, { saveId, facA: paso.facA, facB: paso.facB });
    if ('error' in r) rechaza(r.error);
    else dice(`Alianza ${paso.facA} → ${paso.facB}: sellada, rota y sellada otra vez (${r.eventos} eventos)`);
  } else if (paso.tipo === 'vasallo-paga') {
    const r = await vasalloPagaConDeuda(prisma, { saveId, vasalloSlug: paso.vasalloSlug });
    if ('error' in r) rechaza(r.error);
    else dice(`Vasallo ${paso.vasalloSlug}: cuota ${r.cuota}, deuda ${r.deuda}, riqueza ${r.riqueza}; revisión del día ${r.dia}: ${r.estado} (${r.porcentaje} % de la cuota, sigue la deuda)`);
  } else if (paso.tipo === 'domable') {
    const r = await dejarDomableEnJaula(prisma, { saveId, especie: paso.especie });
    if ('error' in r) rechaza(r.error);
    else dice(`Domable: ${r.nombre} atado en una Jaula (felicidad 0; falta ganar su confianza)`);
  } else if (paso.tipo === 'domador') {
    const r = await hacerDomador(prisma, { saveId, nivel: paso.nivel });
    if ('error' in r) rechaza(r.error);
    else dice(`Domador: nivel ${r.nivel}, ${r.especializacion}${r.puntosDeAtributo ? ` (${r.puntosDeAtributo} puntos de atributo por repartir)` : ''}`);
  } else if (paso.tipo === 'sin-aliados') {
    const r = await dejarSinAliados(prisma, { saveId });
    if ('error' in r) rechaza(r.error);
    else dice(r.yaEstaba ? 'Sin aliados: el Grupo 1 ya estaba sin compañeros' : `Sin aliados: ${r.movidos.join(', ')} fuera del Grupo 1 (grupo${r.grupos.length > 1 ? 's' : ''} ${r.grupos.map((g) => g + 1).join(', ')})`);
  } else if (paso.tipo === 'punto-retirado') {
    const r = await dejarPuntoRetirado(prisma, { saveId, especie: paso.especie, ...(paso.n != null ? { cantidad: paso.n } : {}) });
    if ('error' in r) rechaza(r.error);
    else dice(r.yaEstaba ? `Punto retirado: ya había uno de ${r.nombre} en ${r.lugar} con ${r.cantidad} presas` : `Punto retirado: ${r.nombre} en ${r.lugar}, ${r.cantidad} presas, activo false`);
  } else if (paso.tipo === 'ganado') {
    const npc = await prisma.npc.findFirst({ where: { worldId: save.worldId, saveId: null, slug: paso.especie }, select: { slug: true, faunaCategoria: true } });
    if (!npc) { rechaza(`ganado: no hay fauna ${paso.especie}.`); continue; }
    for (let i = 0; i < paso.n && !fallo; i++) {
      // meterEnCorral saca la edad con el primer random() y el sexo con el segundo: M, F, M, F…
      const sec = [0.5, i % 2 === 0 ? 0.1 : 0.9];
      const r = await prisma.$transaction((tx) => meterEnCorral(tx, saveId, npc, ahora, () => sec.shift() ?? 0.5));
      if (!r.ok) rechaza(`ganado: ${r.motivo}`);
      else dice(`Al corral: ${npc.slug} ${r.sexo} (${r.buildingId})`);
    }
  }
}
await prisma.$disconnect();
process.exit(fallo ? 1 : 0);
