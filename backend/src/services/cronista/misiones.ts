// Misiones secundarias por motor (CR-40 paso 40a, hito 0.2 — diseño en roadmap-cronista.md, entrada
// CR-40). Parte pura: tipos, plantillas cerradas con huecos, validación, textos sin IA y recompensas.
//
// Regla contra la basura (Q10): cada misión se arma con una plantilla de su tipo y unos huecos que solo
// admiten datos reales del mundo de la partida (quien la encarga, qué, cuántos, dónde, plazo y
// recompensa). Si un hueco no tiene un dato válido, `validarHuecos` lo dice y la misión no se crea.
// El texto sale de frases fijas por tipo y por pueblo de quien la encarga; nada lo inventa una IA.
// (En la Fase 7, la IA podrá reescribir el texto, pero con los mismos huecos y validado contra ellos.)

export type TipoMision = 'ENTREGAR' | 'CAZAR' | 'ELIMINAR' | 'EXPLORAR' | 'AYUDAR' | 'COMBATIR';
export const TIPOS_MISION: TipoMision[] = ['ENTREGAR', 'CAZAR', 'ELIMINAR', 'EXPLORAR', 'AYUDAR', 'COMBATIR'];

/// Por qué existe la misión (Q4): de dónde la sacó el motor.
export type MotivoMision = 'EXCESO_FAUNA' | 'EXCESO_FLORA' | 'CARENCIA' | 'VENGADOR' | 'RUMOR' | 'CONFLICTO' | 'MALHERIDO';

export type Dificultad = 1 | 2 | 3;

/// Pueblo de quien la encarga: decide el tono de la frase.
export type Pueblo = 'orcos' | 'goirntes' | 'nabieus' | 'faerus';

export interface HuecosMision {
  tipo: TipoMision;
  motivo: MotivoMision;
  /// Facción que la encarga (siempre: también la de un NPC, que habla en su nombre).
  faccion: { slug: string; nombre: string; pueblo: Pueblo | string };
  /// NPC con nombre que la encarga en persona (Q13); sin él, la encarga la facción desde su tablón.
  npc?: { id: string; nombre: string };
  /// Especie a cazar (CAZAR).
  especie?: { slug: string; nombre: string };
  /// Objeto a entregar (ENTREGAR).
  objeto?: { slug: string; nombre: string };
  /// NPC a eliminar o a ayudar (ELIMINAR, AYUDAR).
  objetivoNpc?: { id: string; nombre: string };
  /// Facción enemiga a combatir (COMBATIR) o a la que pertenece el NPC a eliminar.
  enemiga?: { slug: string; nombre: string };
  /// Lugar al que ir (EXPLORAR, AYUDAR, COMBATIR) o donde está lo que se pide.
  lugar?: { id: string; nombre: string };
  region: string;
  cantidad: number;
  plazoDias: number;
}

/// Huecos que exige cada tipo, además de facción, región, cantidad y plazo.
const EXIGE: Record<TipoMision, (keyof HuecosMision)[]> = {
  ENTREGAR: ['objeto'],
  CAZAR: ['especie'],
  ELIMINAR: ['objetivoNpc'],
  EXPLORAR: ['lugar'],
  AYUDAR: ['objetivoNpc', 'lugar'],
  COMBATIR: ['enemiga', 'lugar'],
};

/// Topes de cantidad por tipo (Q14: cazar 3-8; el resto, lo que tenga sentido para una misión).
export const CANTIDAD: Record<TipoMision, { min: number; max: number }> = {
  ENTREGAR: { min: 1, max: 12 },
  CAZAR: { min: 3, max: 8 },
  ELIMINAR: { min: 1, max: 1 },
  EXPLORAR: { min: 1, max: 1 },
  AYUDAR: { min: 1, max: 1 },
  COMBATIR: { min: 1, max: 1 },
};

/// Plazo en días de ficción por tipo (Q8): vencido, la misión falla.
export const PLAZO_DIAS: Record<TipoMision, number> = { ENTREGAR: 6, CAZAR: 5, ELIMINAR: 8, EXPLORAR: 6, AYUDAR: 2, COMBATIR: 4 };

/// Como mucho estas misiones secundarias activas a la vez (Q8).
export const MAX_SECUNDARIAS_ACTIVAS = 3;
/// Misiones a la vista en un tablón (Q13), renovadas cada semana.
export const MISIONES_POR_TABLON = 3;
export const DIAS_RENOVAR_TABLON = 7;

/// Puro (Q10): errores de una misión; vacío = se puede crear. Nunca se rellena un hueco por defecto.
export function validarHuecos(h: HuecosMision): string[] {
  const errores: string[] = [];
  if (!TIPOS_MISION.includes(h.tipo)) errores.push(`tipo desconocido: ${h.tipo}`);
  if (!h.faccion?.slug || !h.faccion.nombre) errores.push('falta quien la encarga');
  if (!h.region) errores.push('falta la región');
  for (const hueco of EXIGE[h.tipo] ?? []) {
    const v = h[hueco] as { nombre?: string } | undefined;
    if (!v || !v.nombre) errores.push(`falta ${String(hueco)}`);
  }
  const tope = CANTIDAD[h.tipo];
  if (tope && (!Number.isInteger(h.cantidad) || h.cantidad < tope.min || h.cantidad > tope.max)) errores.push(`cantidad fuera de rango: ${h.cantidad}`);
  if (!Number.isInteger(h.plazoDias) || h.plazoDias < 1) errores.push('plazo no válido');
  if (h.tipo === 'COMBATIR' && h.enemiga?.slug === h.faccion?.slug) errores.push('no se combate a la propia facción');
  if (h.objetivoNpc && h.npc && h.objetivoNpc.id === h.npc.id) errores.push('quien la encarga no puede ser el objetivo');
  return errores;
}

/// Puro: dificultad según el tipo y la cantidad.
export function dificultadDe(h: Pick<HuecosMision, 'tipo' | 'cantidad'>): Dificultad {
  switch (h.tipo) {
    case 'CAZAR':
      return h.cantidad >= 7 ? 3 : h.cantidad >= 5 ? 2 : 1;
    case 'ENTREGAR':
      return h.cantidad >= 9 ? 3 : h.cantidad >= 5 ? 2 : 1;
    case 'ELIMINAR':
    case 'COMBATIR':
      return 3;
    case 'EXPLORAR':
      return 1;
    case 'AYUDAR':
      return 1;
  }
}

export interface Recompensa {
  xp: number;
  goirnos: number;
  /// Reputación con quien la encarga al cumplirla (escala de `factionsStatus`, 0-5000).
  reputacion: number;
  /// Reputación que se pierde con quien la encarga si falla o se abandona.
  reputacionAlFallar: number;
  /// Reputación que se pierde con la facción contra la que va (COMBATIR, ELIMINAR a uno de los suyos).
  reputacionConEnemiga: number;
}

const XP_POR_DIFICULTAD: Record<Dificultad, number> = { 1: 40, 2: 80, 3: 140 };
const GOIRNOS_POR_DIFICULTAD: Record<Dificultad, number> = { 1: 15, 2: 35, 3: 60 };
const REPUTACION_POR_DIFICULTAD: Record<Dificultad, number> = { 1: 40, 2: 70, 3: 110 };
/// La misión personal de un NPC con nombre paga algo más (Q13).
export const EXTRA_PERSONAL = 1.25;

/// Puro (Q7, Q17): la recompensa sale de tablas, nunca del texto.
export function recompensaDe(h: Pick<HuecosMision, 'tipo' | 'cantidad' | 'npc' | 'enemiga'>): Recompensa {
  const d = dificultadDe(h);
  const factor = h.npc ? EXTRA_PERSONAL : 1;
  const contra = h.tipo === 'COMBATIR' || (h.tipo === 'ELIMINAR' && !!h.enemiga);
  return {
    xp: Math.round(XP_POR_DIFICULTAD[d] * factor),
    goirnos: Math.round(GOIRNOS_POR_DIFICULTAD[d] * factor),
    reputacion: Math.round(REPUTACION_POR_DIFICULTAD[d] * factor),
    reputacionAlFallar: -Math.round(REPUTACION_POR_DIFICULTAD[d] / 2),
    reputacionConEnemiga: contra ? -REPUTACION_POR_DIFICULTAD[d] : 0,
  };
}

// ─────────────────────────── Textos (Q10: plantillas, sin IA) ───────────────────────────

const PALABRA_MASCULINA = new Set(['clan', 'reino', 'consejo', 'gremio', 'pueblo', 'campamento', 'linaje']);
const PALABRA_FEMENINA = new Set(['concordia', 'tribu', 'hermandad', 'orden', 'liga', 'guardia', 'compañía', 'casa', 'manada']);

/// P180 (QA-27): un bando con su artículo y la preposición contraída («para el Clan Serhu», «al Clan
/// Serhu», «del Clan Serhu», «la Concordia de Hierro»). Los nombres propios («Feg Ger») y los que ya
/// lo llevan («Los del Obelisco») van tal cual.
export function bando(nombre: string, prep: '' | 'a' | 'de' | 'para' = '', alInicio = false): string {
  const primera = nombre.split(' ')[0]!.toLowerCase();
  const articulo = PALABRA_MASCULINA.has(primera) ? 'el' : PALABRA_FEMENINA.has(primera) ? 'la' : '';
  let texto = articulo ? `${articulo} ${nombre}` : nombre;
  if (prep) texto = `${prep} ${texto}`.replace(/^a el /, 'al ').replace(/^de el /, 'del ');
  return alInicio ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}


const TITULO: Record<TipoMision, (h: HuecosMision) => string> = {
  ENTREGAR: (h) => `${h.cantidad} × ${h.objeto!.nombre} ${bando(h.faccion.nombre, 'para')}`,
  CAZAR: (h) => `Cazar ${h.especie!.nombre} en ${h.region}`,
  ELIMINAR: (h) => `Acabar con ${h.objetivoNpc!.nombre}`,
  EXPLORAR: (h) => `Explorar ${h.lugar!.nombre}`,
  AYUDAR: (h) => `Socorrer a ${h.objetivoNpc!.nombre}`,
  COMBATIR: (h) => `Hacer frente a ${h.enemiga!.nombre} en ${h.lugar!.nombre}`,
};

/// Cuerpo de cada tipo: varias frases, todas con los mismos huecos.
const CUERPO: Record<TipoMision, ((h: HuecosMision) => string)[]> = {
  ENTREGAR: [
    (h) => `Hacen falta ${h.cantidad} de ${h.objeto!.nombre}. Quien los traiga ${bando(h.faccion.nombre, 'a')} será bien pagado.`,
    (h) => `${bando(h.faccion.nombre, 'a', true)} le falta ${h.objeto!.nombre}: pide ${h.cantidad} antes de que se acabe el plazo.`,
  ],
  CAZAR: [
    (h) => `Hay demasiados ${h.especie!.nombre} en ${h.region} y ya no dejan pasto ni presa para nadie. Hay que abatir ${h.cantidad}.`,
    (h) => `Los ${h.especie!.nombre} se han multiplicado en ${h.region}. ${bando(h.faccion.nombre, '', true)} paga por ${h.cantidad} piezas.`,
  ],
  ELIMINAR: [
    (h) => `${h.objetivoNpc!.nombre}${h.enemiga ? `, de ${h.enemiga.nombre},` : ''} es una amenaza ${bando(h.faccion.nombre, 'para')}. Quieren que deje de serlo.`,
    (h) => `Se busca a ${h.objetivoNpc!.nombre}${h.enemiga ? ` (${h.enemiga.nombre})` : ''}. ${bando(h.faccion.nombre, '', true)} recompensará a quien acabe con él.`,
  ],
  EXPLORAR: [
    (h) => `Se habla de ${h.lugar!.nombre}, en ${h.region}. ${bando(h.faccion.nombre, '', true)} quiere saber qué hay allí de verdad.`,
    (h) => `Nadie ${bando(h.faccion.nombre, 'de')} ha vuelto a ${h.lugar!.nombre} en mucho tiempo. Que alguien vaya y lo cuente.`,
  ],
  AYUDAR: [
    (h) => `${h.objetivoNpc!.nombre} está malherido en ${h.lugar!.nombre}. Hay que llegar antes de que sea tarde.`,
    (h) => `Llegan noticias de ${h.objetivoNpc!.nombre}, herido en ${h.lugar!.nombre}. ${bando(h.faccion.nombre, '', true)} pide que alguien lo socorra.`,
  ],
  COMBATIR: [
    (h) => `Una partida de ${h.enemiga!.nombre} ronda ${h.lugar!.nombre}. ${bando(h.faccion.nombre, '', true)} quiere que alguien la haga retroceder.`,
    (h) => `${h.enemiga!.nombre} se ha dejado ver en ${h.lugar!.nombre}, demasiado cerca. Hay que plantarles cara.`,
  ],
};

/// Cómo lo dice cada pueblo (cierre de la frase); para los demás, sin adorno.
const CIERRE: Record<Pueblo, string[]> = {
  orcos: ['Que la caza sea limpia.', 'El clan recuerda a quien cumple.'],
  goirntes: ['Consta por escrito: el pago se hará según lo grabado.', 'Que el orden se cumpla.'],
  nabieus: ['No hace falta que se sepa quién lo hizo.', 'Lo que se haga, se callará.'],
  faerus: ['La manada lo olerá en ti.', 'Que el rastro te sea fiel.'],
};

/// Puro: título y descripción de la misión. `variante` elige la frase (determinista con la semilla).
export function textoDeMision(h: HuecosMision, variante: number): { titulo: string; descripcion: string } {
  const cuerpos = CUERPO[h.tipo];
  const cuerpo = cuerpos[Math.abs(variante) % cuerpos.length]!(h);
  const cierres = CIERRE[h.faccion.pueblo as Pueblo];
  const cierre = cierres ? ` ${cierres[Math.abs(variante) % cierres.length]}` : '';
  const quien = h.npc ? `${h.npc.nombre}: «${cuerpo}${cierre}»` : `${cuerpo}${cierre}`;
  return { titulo: TITULO[h.tipo](h), descripcion: `${quien} Plazo: ${h.plazoDias} días.` };
}

/// Puro (Q14, Q15): ¿una población se ha disparado? Más del 80 % de su máximo.
export const UMBRAL_EXCESO = 0.8;
export function hayExceso(poblacion: number, maximo: number): boolean {
  return maximo > 0 && poblacion > maximo * UMBRAL_EXCESO;
}

/// Puro (Q14): cuántos cazar: una parte del exceso sobre el umbral, entre 3 y 8.
export function cantidadPorExceso(poblacion: number, maximo: number): number {
  const exceso = Math.max(0, poblacion - maximo * UMBRAL_EXCESO);
  return Math.max(CANTIDAD.CAZAR.min, Math.min(CANTIDAD.CAZAR.max, Math.round(exceso / 20)));
}
