// Catálogo de sucesos (CR-2, hito 0.2 — roadmap-cronista.md § 6.1 y § 6.3). Cada tipo tiene su
// familia, su importancia base y la frase de plantilla: el texto que el Libro guarda SIEMPRE, con o
// sin IA. Los datos que necesita cada plantilla van tipados por tipo (`DatosSuceso`).
//
// Los nombres llegan ya resueltos en `datos` (quien registra el suceso los tiene a mano): el Libro
// se puede leer sin volver a consultar nada, y la frase no cambia si luego se renombra algo.
import type { FamiliaSuceso } from '@prisma/client';

/// Un objeto o recurso mencionado en un suceso.
interface Cosa {
  nombre: string;
  /// Categoría del catálogo (`ItemCatalog.category`), si la tiene (CR-12: encargos de materiales).
  categoria?: string;
}

/// Datos que necesita cada tipo. Campos `*Nombre` = nombre legible; el resto, lo que la regla use.
export interface DatosSuceso {
  // JUGADOR
  ACCION_RELEVANTE: { personaje: string; accion: string };
  COMBATE_GANADO: { personaje: string; rival: string; articuloRival?: string | null };
  COMBATE_PERDIDO: { personaje: string; rival: string };
  MUERTE_CAUSADA: { personaje: string; victima: string; articuloVictima?: string | null };
  PERDON_CONCEDIDO: { personaje: string; perdonado: string };
  AYUDA_PRESTADA: { personaje: string; a: string };
  /// CR-44: un NPC pierde el valor y huye del combate.
  HUIDA_DE_NPC: { personaje: string; huido: string };
  ETIQUETA_GANADA: { personaje: string; etiqueta: string };
  ETIQUETA_PERDIDA: { personaje: string; etiqueta: string };
  COMPANERO_SE_VA: { personaje: string; companero: string };
  RECLUTAMIENTO: { personaje: string; reclutado: string };
  RECLUTAMIENTO_FALLIDO: { personaje: string; npc: string };
  INFORMANTE_CAPTADO: { personaje: string; informante: string; faccion: string };
  INFORMANTE_DESCUBIERTO: { informante: string; faccion: string; destino: string };
  CAPTURA: { personaje: string; capturado: string };
  PROMESA: { personaje: string; a: string; promesa: string };
  PROMESA_CUMPLIDA: { personaje: string; a: string; promesa: string };
  PROMESA_ROTA: { personaje: string; a: string; promesa: string };
  REGALO: { personaje: string; a: string; objeto: Cosa };
  ROBO: { personaje: string; a: string; objeto: Cosa };
  MISION_COMPLETADA: { personaje: string; mision: string };
  MISION_FALLIDA: { personaje: string; mision: string };
  /// CR-40: la jugadora deja una misión del motor (no es un fracaso: lo decide ella).
  MISION_ABANDONADA: { personaje: string; mision: string };
  DESCUBRIMIENTO: { personaje: string; descubierto: string };
  OFICIO_APRENDIDO: { personaje: string; oficio: string };
  MUERTE_JUGADOR: { personaje: string; causa?: string };
  RENACER: { personaje: string; lugar: string };
  FIN_PARTIDA: { personaje: string };
  // VIDA_MUERTE
  NACIMIENTO_NOTABLE: { nacido: string; padres?: string; lugar?: string; genero?: string };
  NPC_DESTACA: { npc: string; faccion: string; genero?: string; padres?: string };
  MUERTE_NPC: { npc: string; causa?: string };
  MUERTE_LIDER: { lider: string; faccion: string; causa?: string };
  SUCESION: { nuevoLider: string; anterior: string; faccion: string };
  HEREDERO_DESIGNADO: { heredero: string; lider: string; faccion: string };
  RECUPERACION_NPC: { npc: string };
  CADAVER_DESAPARECE: { npc: string };
  // DIPLOMACIA
  CAMBIO_RELACION: { faccionA: string; faccionB: string; antes: string; despues: string };
  GUERRA_DECLARADA: { atacante: string; atacada: string };
  TREGUA: { faccionA: string; faccionB: string };
  ALIANZA: { faccionA: string; faccionB: string };
  TRATADO_COMERCIAL: { faccionA: string; faccionB: string };
  RUPTURA: { faccionA: string; faccionB: string };
  SABOTAJE: { autor: string; victima: string };
  ESPIONAJE: { autor: string; espiada: string };
  /// CR-62: `resultado`, cómo acabó la pelea (combate de fondo).
  ESCARAMUZA: { faccionA: string; faccionB: string; region?: string; resultado?: string };
  // FACCION
  FACCION_CAE: { faccion: string };
  FACCION_ESCINDIDA: { faccion: string; nueva: string };
  FACCION_FUNDADA: { faccion: string; fundador?: string };
  FACCION_ABSORBIDA: { faccion: string; absorbente: string };
  CAMBIO_LIDER: { faccion: string; nuevoLider: string };
  MALESTAR_INTERNO: { faccion: string };
  TERRITORIO_CONQUISTADO: { faccion: string; territorio: string; anteriorDueno?: string };
  TERRITORIO_PERDIDO: { faccion: string; territorio: string };
  EXPEDICION_SALE: { faccion: string; destino: string };
  EXPEDICION_INTERCEPTADA: { faccion: string; interceptora: string; destino: string };
  EXPEDICION_VUELVE: { faccion: string; destino: string; botin?: string };
  // CLIMA
  TORMENTA: { region: string };
  TORMENTA_EXTREMA: { region: string; danos?: string };
  CAMBIO_ESTACION: { estacion: string };
  SEQUIA: { region: string };
  OLA_FRIO: { region: string };
  // NATURAL
  MIGRACION_FAUNA: { especie: string; desde: string; hacia: string };
  PLAGA: { region: string; afecta: string };
  INCENDIO: { lugar: string };
  CRECIDA: { lugar: string };
  DESPRENDIMIENTO: { lugar: string };
  AUGE_POBLACION: { especie: string; region: string };
  DECLIVE_POBLACION: { especie: string; region: string };
  // ECONOMIA
  ESCASEZ: { recurso: string; donde: string };
  AUGE_COMERCIAL: { donde: string };
  CARAVANA: { desde: string; hacia: string };
  PRECIOS_DISPARADOS: { recurso: string; donde: string };
  // REINO
  REINO_FUNDADO: { reino: string; fundador: string; region: string };
  EDIFICIO_CONSTRUIDO: { edificio: string; reino?: string };
  EDIFICIO_DANADO: { edificio: string; causa?: string };
  REBELION: { reino: string };
  CONSOLIDACION: { reino: string };
  HAMBRUNA: { reino: string };
  LLEGADA_POBLADORES: { reino: string; cuantos: number };
  VISITANTE_ILUSTRE: { reino: string; visitante: string };
  /// CR-50: cae un campamento de bandidos.
  CAMPAMENTO_DESTRUIDO: { campamento: string; lugar: string; por: string };
  /// CR-50 (Q7): se asienta un campamento de bandidos (llega como rumor).
  CAMPAMENTO_NUEVO: { campamento: string; lugar: string };
  // LORE
  HALLAZGO_RUINA: { personaje: string; ruina: string };
  HALLAZGO_DOCUMENTO: { personaje: string; documento: string; historiaSlug?: string };
  LEYENDA_NACE: { protagonista: string; hazana: string };
  // SISTEMA
  SISTEMA_MUNDO_INICIADO: { mundo: string };
  CONSECUENCIA_PERDIDA: { regla: string };
  HILO_ABIERTO: { patron: string; resumen: string };
  HILO_CERRADO: { patron: string; resumen: string };
}

export type TipoSuceso = keyof DatosSuceso;

interface DefinicionSuceso<T extends TipoSuceso> {
  familia: FamiliaSuceso;
  /// 1-10 antes de modificadores (§ 6.3).
  importanciaBase: number;
  plantilla: (d: DatosSuceso[T]) => string;
}

type Catalogo = { [T in TipoSuceso]: DefinicionSuceso<T> };

const con = (causa?: string) => (causa ? ` (${causa})` : '');
// P37 (QA-27): «da muerte a Orco enfurecido» → «da muerte al Orco enfurecido». Con el artículo del
// catálogo (`Npc.articulo`), si lo tiene; un nombre propio va sin él.
const aCon = (nombre: string, articulo?: string | null) => (articulo === 'el' ? `al ${nombre}` : articulo ? `a ${articulo} ${nombre}` : `a ${nombre}`);

export const CATALOGO_SUCESOS: Catalogo = {
  // JUGADOR — la importancia sube +1 sola por ser el jugador AUTOR (§ 6.3).
  ACCION_RELEVANTE: { familia: 'JUGADOR', importanciaBase: 2, plantilla: (d) => `${d.personaje}: ${d.accion}` },
  COMBATE_GANADO: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} vence ${aCon(d.rival, d.articuloRival)}.` },
  COMBATE_PERDIDO: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} cae ante ${d.rival}.` },
  MUERTE_CAUSADA: { familia: 'JUGADOR', importanciaBase: 5, plantilla: (d) => `${d.personaje} da muerte ${aCon(d.victima, d.articuloVictima)}.` },
  PERDON_CONCEDIDO: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.personaje} perdona la vida a ${d.perdonado}.` },
  AYUDA_PRESTADA: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} atiende las heridas de ${d.a}.` },
  HUIDA_DE_NPC: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.huido} huye de ${d.personaje}.` },
  ETIQUETA_GANADA: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.personaje} es ya «${d.etiqueta}».` },
  ETIQUETA_PERDIDA: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} deja de ser «${d.etiqueta}».` },
  COMPANERO_SE_VA: { familia: 'JUGADOR', importanciaBase: 5, plantilla: (d) => `${d.companero} deja a ${d.personaje}: ya no cree en su camino.` },
  RECLUTAMIENTO: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.reclutado} se une a ${d.personaje} sin necesidad de pelear.` },
  RECLUTAMIENTO_FALLIDO: { familia: 'JUGADOR', importanciaBase: 1, plantilla: (d) => `${d.npc} no se deja convencer por ${d.personaje}.` },
  INFORMANTE_CAPTADO: { familia: 'JUGADOR', importanciaBase: 2, plantilla: (d) => `${d.informante} acepta contarle a ${d.personaje} lo que pasa en ${d.faccion}.` },
  INFORMANTE_DESCUBIERTO: { familia: 'FACCION', importanciaBase: 5, plantilla: (d) => `En ${d.faccion} descubren que ${d.informante} pasaba noticias: ${d.destino}.` },
  CAPTURA: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} captura a ${d.capturado}.` },
  PROMESA: { familia: 'JUGADOR', importanciaBase: 5, plantilla: (d) => `${d.personaje} promete a ${d.a}: ${d.promesa}.` },
  PROMESA_CUMPLIDA: { familia: 'JUGADOR', importanciaBase: 5, plantilla: (d) => `${d.personaje} cumple lo prometido a ${d.a}: ${d.promesa}.` },
  PROMESA_ROTA: { familia: 'JUGADOR', importanciaBase: 6, plantilla: (d) => `${d.personaje} rompe su promesa a ${d.a}: ${d.promesa}.` },
  REGALO: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} entrega ${d.objeto.nombre} a ${d.a}.` },
  ROBO: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.personaje} roba ${d.objeto.nombre} a ${d.a}.` },
  MISION_COMPLETADA: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.personaje} completa «${d.mision}».` },
  MISION_FALLIDA: { familia: 'JUGADOR', importanciaBase: 4, plantilla: (d) => `${d.personaje} fracasa en «${d.mision}».` },
  MISION_ABANDONADA: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} abandona «${d.mision}».` },
  DESCUBRIMIENTO: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} descubre ${d.descubierto}.` },
  OFICIO_APRENDIDO: { familia: 'JUGADOR', importanciaBase: 3, plantilla: (d) => `${d.personaje} aprende el oficio de ${d.oficio}.` },
  MUERTE_JUGADOR: { familia: 'JUGADOR', importanciaBase: 9, plantilla: (d) => `${d.personaje} muere${con(d.causa)}.` },
  RENACER: { familia: 'JUGADOR', importanciaBase: 5, plantilla: (d) => `${d.personaje} despierta de nuevo en ${d.lugar}.` },
  FIN_PARTIDA: { familia: 'JUGADOR', importanciaBase: 10, plantilla: (d) => `La historia de ${d.personaje} termina.` },
  // VIDA_MUERTE
  NACIMIENTO_NOTABLE: { familia: 'VIDA_MUERTE', importanciaBase: 4, plantilla: (d) => `Nace ${d.nacido}${d.padres ? `, ${d.genero === 'F' ? 'hija' : 'hijo'} de ${d.padres}` : ''}${d.lugar ? `, en ${d.lugar}` : ''}.` },
  NPC_DESTACA: { familia: 'VIDA_MUERTE', importanciaBase: 4, plantilla: (d) => `${d.npc} empieza a hacerse un nombre en ${d.faccion}${d.padres ? `, ${d.genero === 'F' ? 'hija' : 'hijo'} de ${d.padres}` : ''}.` },
  MUERTE_NPC: { familia: 'VIDA_MUERTE', importanciaBase: 5, plantilla: (d) => `Muere ${d.npc}${con(d.causa)}.` },
  MUERTE_LIDER: { familia: 'VIDA_MUERTE', importanciaBase: 9, plantilla: (d) => `Muere ${d.lider}, líder de ${d.faccion}${con(d.causa)}.` },
  SUCESION: { familia: 'VIDA_MUERTE', importanciaBase: 7, plantilla: (d) => `${d.nuevoLider} sucede a ${d.anterior} al frente de ${d.faccion}.` },
  HEREDERO_DESIGNADO: { familia: 'VIDA_MUERTE', importanciaBase: 5, plantilla: (d) => `${d.lider} designa a ${d.heredero} heredero de ${d.faccion}.` },
  RECUPERACION_NPC: { familia: 'VIDA_MUERTE', importanciaBase: 2, plantilla: (d) => `${d.npc} se recupera de sus heridas.` },
  CADAVER_DESAPARECE: { familia: 'VIDA_MUERTE', importanciaBase: 1, plantilla: (d) => `Del cuerpo de ${d.npc} ya no queda nada.` },
  // DIPLOMACIA
  CAMBIO_RELACION: { familia: 'DIPLOMACIA', importanciaBase: 4, plantilla: (d) => `La relación entre ${d.faccionA} y ${d.faccionB} pasa de ${d.antes} a ${d.despues}.` },
  GUERRA_DECLARADA: { familia: 'DIPLOMACIA', importanciaBase: 8, plantilla: (d) => `${d.atacante} declara la guerra a ${d.atacada}.` },
  TREGUA: { familia: 'DIPLOMACIA', importanciaBase: 6, plantilla: (d) => `${d.faccionA} y ${d.faccionB} pactan una tregua.` },
  ALIANZA: { familia: 'DIPLOMACIA', importanciaBase: 7, plantilla: (d) => `${d.faccionA} y ${d.faccionB} sellan una alianza.` },
  TRATADO_COMERCIAL: { familia: 'DIPLOMACIA', importanciaBase: 5, plantilla: (d) => `${d.faccionA} y ${d.faccionB} firman un tratado comercial.` },
  RUPTURA: { familia: 'DIPLOMACIA', importanciaBase: 6, plantilla: (d) => `${d.faccionA} y ${d.faccionB} rompen relaciones.` },
  SABOTAJE: { familia: 'DIPLOMACIA', importanciaBase: 5, plantilla: (d) => `${d.autor} sabotea a ${d.victima}.` },
  ESCARAMUZA: { familia: 'DIPLOMACIA', importanciaBase: 4, plantilla: (d) => `Gente de ${d.faccionA} y de ${d.faccionB} llega a las manos${d.region ? ` en ${d.region}` : ''}.${d.resultado ? ` ${d.resultado.charAt(0).toUpperCase()}${d.resultado.slice(1)}.` : ''}` },
  ESPIONAJE: { familia: 'DIPLOMACIA', importanciaBase: 3, plantilla: (d) => `${d.autor} espía a ${d.espiada}.` },
  // FACCION
  FACCION_CAE: { familia: 'FACCION', importanciaBase: 10, plantilla: (d) => `${d.faccion} cae.` },
  FACCION_ESCINDIDA: { familia: 'FACCION', importanciaBase: 9, plantilla: (d) => `${d.faccion} se escinde: nace ${d.nueva}.` },
  FACCION_FUNDADA: { familia: 'FACCION', importanciaBase: 9, plantilla: (d) => `Se funda ${d.faccion}${d.fundador ? `, por ${d.fundador}` : ''}.` },
  FACCION_ABSORBIDA: { familia: 'FACCION', importanciaBase: 8, plantilla: (d) => `${d.absorbente} absorbe a ${d.faccion}.` },
  MALESTAR_INTERNO: { familia: 'FACCION', importanciaBase: 3, plantilla: (d) => `Crece el descontento dentro de ${d.faccion}.` },
  CAMBIO_LIDER: { familia: 'FACCION', importanciaBase: 7, plantilla: (d) => `${d.nuevoLider} pasa a liderar ${d.faccion}.` },
  TERRITORIO_CONQUISTADO: { familia: 'FACCION', importanciaBase: 8, plantilla: (d) => `${d.faccion} conquista ${d.territorio}${d.anteriorDueno ? ` a ${d.anteriorDueno}` : ''}.` },
  TERRITORIO_PERDIDO: { familia: 'FACCION', importanciaBase: 7, plantilla: (d) => `${d.faccion} pierde ${d.territorio}.` },
  EXPEDICION_SALE: { familia: 'FACCION', importanciaBase: 2, plantilla: (d) => `Una expedición de ${d.faccion} sale hacia ${d.destino}.` },
  EXPEDICION_INTERCEPTADA: { familia: 'FACCION', importanciaBase: 4, plantilla: (d) => `${d.interceptora} intercepta una expedición de ${d.faccion} camino de ${d.destino}.` },
  EXPEDICION_VUELVE: { familia: 'FACCION', importanciaBase: 2, plantilla: (d) => `La expedición de ${d.faccion} vuelve de ${d.destino}${d.botin ? ` con ${d.botin}` : ''}.` },
  // CLIMA
  TORMENTA: { familia: 'CLIMA', importanciaBase: 2, plantilla: (d) => `Una tormenta azota ${d.region}.` },
  TORMENTA_EXTREMA: { familia: 'CLIMA', importanciaBase: 6, plantilla: (d) => `Una tormenta terrible arrasa ${d.region}${d.danos ? `: ${d.danos}` : ''}.` },
  CAMBIO_ESTACION: { familia: 'CLIMA', importanciaBase: 1, plantilla: (d) => `Llega ${d.estacion}.` },
  SEQUIA: { familia: 'CLIMA', importanciaBase: 5, plantilla: (d) => `La sequía se instala en ${d.region}.` },
  OLA_FRIO: { familia: 'CLIMA', importanciaBase: 4, plantilla: (d) => `Una ola de frío cae sobre ${d.region}.` },
  // NATURAL
  MIGRACION_FAUNA: { familia: 'NATURAL', importanciaBase: 3, plantilla: (d) => `${d.especie} migra de ${d.desde} a ${d.hacia}.` },
  PLAGA: { familia: 'NATURAL', importanciaBase: 5, plantilla: (d) => `Una plaga golpea ${d.afecta} en ${d.region}.` },
  INCENDIO: { familia: 'NATURAL', importanciaBase: 5, plantilla: (d) => `Un incendio prende en ${d.lugar}.` },
  CRECIDA: { familia: 'NATURAL', importanciaBase: 4, plantilla: (d) => `Las aguas crecen en ${d.lugar}.` },
  DESPRENDIMIENTO: { familia: 'NATURAL', importanciaBase: 4, plantilla: (d) => `Un desprendimiento sacude ${d.lugar}.` },
  AUGE_POBLACION: { familia: 'NATURAL', importanciaBase: 2, plantilla: (d) => `${d.especie} prolifera en ${d.region}.` },
  DECLIVE_POBLACION: { familia: 'NATURAL', importanciaBase: 3, plantilla: (d) => `${d.especie} escasea en ${d.region}.` },
  // ECONOMIA
  ESCASEZ: { familia: 'ECONOMIA', importanciaBase: 5, plantilla: (d) => `Escasea ${d.recurso} en ${d.donde}.` },
  AUGE_COMERCIAL: { familia: 'ECONOMIA', importanciaBase: 4, plantilla: (d) => `El comercio florece en ${d.donde}.` },
  CARAVANA: { familia: 'ECONOMIA', importanciaBase: 2, plantilla: (d) => `Una caravana viaja de ${d.desde} a ${d.hacia}.` },
  PRECIOS_DISPARADOS: { familia: 'ECONOMIA', importanciaBase: 4, plantilla: (d) => `${d.recurso} se encarece en ${d.donde}.` },
  // REINO
  REINO_FUNDADO: { familia: 'REINO', importanciaBase: 8, plantilla: (d) => `${d.fundador} funda el reino de ${d.reino} en ${d.region}.` },
  EDIFICIO_CONSTRUIDO: { familia: 'REINO', importanciaBase: 3, plantilla: (d) => `Se levanta ${d.edificio}${d.reino ? ` en ${d.reino}` : ''}.` },
  EDIFICIO_DANADO: { familia: 'REINO', importanciaBase: 4, plantilla: (d) => `${d.edificio} sufre daños${con(d.causa)}.` },
  REBELION: { familia: 'REINO', importanciaBase: 8, plantilla: (d) => `Estalla una rebelión en ${d.reino}.` },
  CONSOLIDACION: { familia: 'REINO', importanciaBase: 5, plantilla: (d) => `${d.reino} se consolida.` },
  HAMBRUNA: { familia: 'REINO', importanciaBase: 6, plantilla: (d) => `El hambre llega a ${d.reino}.` },
  LLEGADA_POBLADORES: { familia: 'REINO', importanciaBase: 4, plantilla: (d) => `${d.cuantos === 1 ? 'Llega un poblador' : `Llegan ${d.cuantos} pobladores`} a ${d.reino}.` },
  VISITANTE_ILUSTRE: { familia: 'REINO', importanciaBase: 5, plantilla: (d) => `${d.visitante}${d.visitante.includes(',') ? ',' : ''} visita ${d.reino}.` },
  CAMPAMENTO_NUEVO: { familia: 'FACCION', importanciaBase: 5, plantilla: (d) => `Se asientan ${d.campamento} en ${d.lugar}.` },
  CAMPAMENTO_DESTRUIDO: { familia: 'FACCION', importanciaBase: 5, plantilla: (d) => `${d.por} acaba con el campamento de ${d.campamento} en ${d.lugar}.` },
  // LORE
  HALLAZGO_RUINA: { familia: 'LORE', importanciaBase: 4, plantilla: (d) => `${d.personaje} encuentra ${d.ruina}.` },
  HALLAZGO_DOCUMENTO: { familia: 'LORE', importanciaBase: 4, plantilla: (d) => `${d.personaje} encuentra «${d.documento}».` },
  LEYENDA_NACE: { familia: 'LORE', importanciaBase: 7, plantilla: (d) => `Se empieza a contar la hazaña de ${d.protagonista}: ${d.hazana}.` },
  // SISTEMA
  SISTEMA_MUNDO_INICIADO: { familia: 'SISTEMA', importanciaBase: 1, plantilla: (d) => `Empieza la historia de ${d.mundo}.` },
  CONSECUENCIA_PERDIDA: { familia: 'SISTEMA', importanciaBase: 1, plantilla: (d) => `Una consecuencia pendiente (${d.regla}) se pierde sin llegar a ocurrir.` },
  HILO_ABIERTO: { familia: 'SISTEMA', importanciaBase: 3, plantilla: (d) => `Se abre una historia de ${d.patron.toLowerCase()}: ${d.resumen}` },
  HILO_CERRADO: { familia: 'SISTEMA', importanciaBase: 3, plantilla: (d) => `Se cierra una historia de ${d.patron.toLowerCase()}: ${d.resumen}` },
};

export function textoDeSuceso<T extends TipoSuceso>(tipo: T, datos: DatosSuceso[T]): string {
  const texto = (CATALOGO_SUCESOS[tipo] as DefinicionSuceso<T>).plantilla(datos);
  // P234: la frase siempre empieza en mayúscula (un edificio sin nombre propio: «una muralla sufre daños»).
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/// Importancia final (§ 6.3): base del tipo, +1 si el jugador es AUTOR, +1 si toca a un NPC del
/// núcleo jugable, +1 si abre o cierra un hilo; entre 1 y 10.
/// P175 (QA-27): vencer o matar a fauna sin bando (no a un personaje con nombre) resta esto: un Guchapo
/// muerto no es noticia para un clan de cazadores; una fiera con bando o un personaje, sí.
export const MENOS_POR_FAUNA_MENOR = 3;

export function importanciaDeSuceso(
  tipo: TipoSuceso,
  modificadores: { jugadorAutor: boolean; afectaNucleoJugable: boolean; tocaHilo: boolean; victimaFaunaMenor?: boolean },
): number {
  const base = CATALOGO_SUCESOS[tipo].importanciaBase;
  const extra =
    (modificadores.jugadorAutor ? 1 : 0) +
    (modificadores.afectaNucleoJugable ? 1 : 0) +
    (modificadores.tocaHilo ? 1 : 0) -
    (modificadores.victimaFaunaMenor && (tipo === 'MUERTE_CAUSADA' || tipo === 'COMBATE_GANADO') ? MENOS_POR_FAUNA_MENOR : 0);
  return Math.max(1, Math.min(10, base + extra));
}
