// CR-67 (hito 0.3, Fase E): asaltos por estado — reglas puras. Principios 9 y 10 del Cronista
// (mundo de bolsillo: nada se apaga, todo se regula; nada en bucle fijo) y decisiones Q1-Q7 de la
// ronda «asaltos por estado» (`docs/producto/plan-roadmap-0.3.md`). X4 marca el camino: piratas y
// Kha'ak atacan cuando han reunido fuerza y hay un objetivo que lo merece; tras una derrota tienen
// que rehacerse antes de volver. Cifras provisionales para la fase de pruebas.

/// Q6: intensidad de los asaltos (Configuración › Partida). Nunca los quita.
export const INTENSIDADES = ['CONTENIDA', 'NORMAL', 'DURA'] as const;
export type Intensidad = (typeof INTENSIDADES)[number];
/// Q3 (usuaria): cuántos manda un atacante: «Normal» sigue la regla; «Fácil», la mitad.
export const TAMANOS = ['FACIL', 'NORMAL'] as const;
export type TamanoAsaltos = (typeof TAMANOS)[number];

export function esIntensidad(x: unknown): x is Intensidad {
  return (INTENSIDADES as readonly unknown[]).includes(x);
}
export function esTamano(x: unknown): x is TamanoAsaltos {
  return (TAMANOS as readonly unknown[]).includes(x);
}

/// Lo que el atacante cree que le espera (Q1): cuenta en «combatientes equivalentes».
export interface DefensaVista {
  guarnicion: number;
  /// Milicianos que podrían armarse (equipos de la Armería y trabajadores que haya).
  milicia: number;
  guardias: number;
  cobertura: number;
  bonoMoral: number;
}

/// Puro: la defensa estimada. Un miliciano cuenta 0,6; cada punto de cobertura, +10 %; la moral, +5 %.
export function defensaEstimada(d: DefensaVista): number {
  const gente = d.guarnicion + 0.6 * d.milicia + d.guardias;
  return gente * (1 + 0.1 * d.cobertura + 0.05 * d.bonoMoral);
}

/// Margen base que necesita el atacante sobre la defensa estimada, por intensidad (Q6).
export const MARGEN_BASE: Record<Intensidad, number> = { CONTENIDA: 1.9, NORMAL: 1.5, DURA: 1.2 };
/// Con todo el motivo (1), el margen baja esto.
export const REBAJA_POR_MOTIVO = 0.6;
export const MARGEN_MINIMO = 0.8;
/// Colchón sobre lo que cree necesitar (Q3).
export const COLCHON = 1.2;
/// Q6: días por refuerzo de un campamento según la intensidad.
export const DIAS_POR_REFUERZO_INTENSIDAD: Record<Intensidad, number> = { CONTENIDA: 4, NORMAL: 3, DURA: 2 };

/// Puro (Q2): margen que necesita, menor con más motivo (0-1).
export function margenNecesario(motivo: number, intensidad: Intensidad): number {
  const m = Math.max(0, Math.min(1, motivo));
  return Math.max(MARGEN_MINIMO, MARGEN_BASE[intensidad] - REBAJA_POR_MOTIVO * m);
}

export interface Decision {
  ataca: boolean;
  /// Cuántos salen (0 si no ataca).
  manda: number;
  /// Lo que cree que le espera y el margen con el que se ha atrevido (para el aviso, Q5).
  defensa: number;
  margen: number;
}

/// Sin un mínimo de motivo no se mueve nadie (no se asalta a quien no tiene nada que llevarse).
export const MOTIVO_MINIMO = 0.1;

/// Puro (Q1-Q3): decide si ataca y con cuántos. `fuerza` = gente que tiene; `enCasa` = los que nunca
/// salen (para no dejar su casa vacía); `maximo` = los que caben en un ataque (el tope cuenta al
/// decidir: nunca sale sabiendo que va corto). Fácil: la mitad de lo que mandaría (mínimo 2); es a
/// propósito más débil que el margen (decisión de la usuaria: «Fácil» es eso).
export function decidirAtaque(p: { fuerza: number; enCasa: number; defensa: number; motivo: number; intensidad: Intensidad; tamano: TamanoAsaltos; maximo?: number }): Decision {
  const margen = margenNecesario(p.motivo, p.intensidad);
  if (p.motivo < MOTIVO_MINIMO) return { ataca: false, manda: 0, defensa: p.defensa, margen };
  const disponibles = Math.min(p.maximo ?? Infinity, Math.max(0, p.fuerza - p.enCasa));
  const necesita = Math.max(2, Math.ceil(p.defensa * margen));
  if (disponibles < necesita) return { ataca: false, manda: 0, defensa: p.defensa, margen };
  const normal = Math.min(disponibles, Math.max(2, Math.ceil(p.defensa * margen * COLCHON)));
  const manda = p.tamano === 'FACIL' ? Math.max(2, Math.ceil(normal / 2)) : normal;
  return { ataca: true, manda, defensa: p.defensa, margen };
}

/// P253: lo mínimo que tiene que valer un Reino (riqueza + comida/2) para que unos bandidos vayan a por
/// él. Por debajo no hay nada que llevarse (el botín topa en un cuarto de lo que hay), por mucha
/// necesidad que tengan. Cifra provisional, como las demás.
export const OBJETIVO_MINIMO = 20;
/// Objetos del Almacén con los que ya se llevan uno (el botín topa en un cuarto: `BOTIN_TOPE` de asaltos.ts).
export const OBJETOS_MINIMOS = 4;

/// Puro (P253, Q1): ¿hay algo que llevarse? Sin esto, la necesidad (poco botín guardado, campamento
/// lleno) sola empujaba a asaltar un Reino vacío («no encuentran nada que llevarse»). Los objetos del
/// Almacén también son botín (`botinDe`): un Reino sin Goirnos ni comida pero con el Almacén lleno no
/// queda a salvo. Solo vale para un asentamiento: a un viajero se le asalta por el camino, lleve lo que
/// lleve (CR-50 Q4).
export function reinoTieneQueLlevarse(riqueza: number, comida: number, objetos = 0): boolean {
  return riqueza + comida / 2 >= OBJETIVO_MINIMO || objetos >= OBJETOS_MINIMOS;
}

/// Puro (Q1): motivo de unos bandidos: lo que vale el objetivo (riqueza y comida) y su necesidad
/// (poco botín guardado o campamento lleno). La intensidad pesa el botín.
export function motivoBandidos(p: { riqueza: number; comida: number; botinGuardado: number; gente: number; tope: number; intensidad: Intensidad }): number {
  const peso = { CONTENIDA: 0.7, NORMAL: 1, DURA: 1.3 }[p.intensidad];
  const valor = Math.min(1, (p.riqueza + p.comida / 2) / 1000) * 0.6 * peso;
  const necesidad = (p.botinGuardado < 100 ? 0.2 : 0) + (p.tope > 0 && p.gente >= p.tope ? 0.2 : 0);
  return Math.min(1, valor + necesidad);
}

/// Puro (Q1): motivo de una facción en guerra: 0,2 al entrar en la banda de guerra (80) y hasta 1 con
/// la presión al máximo; fuera de la guerra, 0.
export function motivoGuerra(presion: number): number {
  if (presion < 80) return 0;
  return Math.min(1, 0.2 + 0.8 * ((presion - 80) / 20));
}

/// Puro (Q5): por qué vienen unos bandidos, en una frase. Con `objetos` (los del Almacén del Reino, que
/// también son botín), un Reino sin Goirnos ni comida pero con el Almacén lleno no «se queda sin nada».
export function porQueVienenBandidos(p: { grupo: string; gente: number; riqueza: number; comida: number; botinGuardado: number; lleno: boolean; objetos?: number }): string {
  if (p.riqueza >= 100) return `${p.grupo} han reunido ${p.gente} y saben que guardas ${p.riqueza} Goirnos.`;
  if (p.comida >= 100) return `${p.grupo} han reunido ${p.gente} y vienen a por tu comida.`;
  if ((p.objetos ?? 0) >= OBJETOS_MINIMOS) return `${p.grupo} han reunido ${p.gente} y saben que guardas objetos en el Almacén.`;
  if (p.lleno) return `${p.grupo} ya no caben en su campamento y salen a buscar botín.`;
  return `${p.grupo} se han quedado sin nada y salen a buscar botín.`;
}
