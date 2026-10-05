// Carencias e Inteligencia del líder (CR-34 paso 34a, hito 0.2 — diseño en roadmap-cronista.md,
// entrada CR-34). Funciones puras: qué le falta a una facción del mundo de la partida y con qué
// juicio lo ve quien la lidera. Las decisiones de facción (34b-34f) parten de aquí.
//
// Umbrales PROVISIONALES (Q10): salen de la economía de hoy, con números aún sin decidir (pregunta 5
// a Álvaro, economía de supervivencia). Cuando lleguen, solo cambia `UMBRALES_CARENCIA`.
import { balanceDiario, type KingdomStatsBlock } from '../kingdomTick.js';

export type TipoCarencia = 'COMIDA' | 'BEBIDA' | 'GOIRNOS' | 'SOLDADOS';
export type Gravedad = 'LEVE' | 'GRAVE';

export interface Carencia {
  tipo: TipoCarencia;
  gravedad: Gravedad;
  /// Solo en SOLDADOS: la facción enemiga frente a la que se queda corta.
  enemigoId?: string;
}

/// Tramos de Inteligencia del líder (Q4), los mismos que la IA de combate (mundo-vivo-x4.md § 5-bis
/// punto 8): < 10 impulsivo, 10-19 sensato, 20+ estratega.
export type Tramo = 'IMPULSIVO' | 'SENSATO' | 'ESTRATEGA';

export const UMBRALES_CARENCIA = {
  /// Días de consumo que cubre la reserva de comida (o de bebida) por debajo de los cuales falta.
  comidaLeveDias: 10,
  comidaGraveDias: 3,
  /// Días de sueldos de soldados que paga la riqueza.
  goirnosLeveDias: 14,
  goirnosGraveDias: 3,
  /// Soldados propios frente a los de un enemigo en tensión o guerra por debajo de esta proporción.
  soldadosProporcion: 0.6,
  /// El estratega se adelanta: ve las carencias leves con este margen extra de días.
  margenEstratega: 1.5,
} as const;

/// Inteligencia que se toma para un líder sin ella sembrada (Q8), la del comentario de `liderNpcId`.
export const INTELIGENCIA_POR_DEFECTO = 10;

export function tramoDeInteligencia(inteligencia: number): Tramo {
  if (inteligencia < 10) return 'IMPULSIVO';
  if (inteligencia < 20) return 'SENSATO';
  return 'ESTRATEGA';
}

/// Inteligencia de quien lidera la facción; null si no tiene líder (sucesión pendiente, Q8).
export function inteligenciaDelLider(lider: { attributes: unknown } | null | undefined): number | null {
  if (!lider) return null;
  const valor = (lider.attributes as { inteligencia?: unknown } | null)?.inteligencia;
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : INTELIGENCIA_POR_DEFECTO;
}

/// Días que dura una reserva con un balance diario; Infinity si no baja (produce lo que gasta o más).
export function diasDeReserva(reserva: number, balance: number): number {
  if (balance >= 0) return Infinity;
  return Math.max(0, reserva) / -balance;
}

function gravedadPorDias(dias: number, leve: number, grave: number): Gravedad | null {
  if (dias < grave) return 'GRAVE';
  if (dias < leve) return 'LEVE';
  return null;
}

export interface EntradaCarencias {
  stats: KingdomStatsBlock;
  /// Producción diaria de sus edificios (`tickFactionProduction`).
  produccion?: { comida: number; riqueza: number };
  /// Facciones con las que está en tensión o guerra, con sus soldados.
  enemigos?: { factionId: string; soldados: number }[];
  /// La bebida de las facciones del mundo se rellena sola hasta la economía de supervivencia: hasta
  /// entonces no cuenta como carencia.
  bebidaReal?: boolean;
}

/// Puro: las carencias de una facción tal como las ve un líder de `tramo`. El impulsivo solo ve las
/// graves; el estratega ve las leves antes (con `margenEstratega`).
export function carenciasDe(entrada: EntradaCarencias, tramo: Tramo = 'SENSATO'): Carencia[] {
  const u = UMBRALES_CARENCIA;
  const margen = tramo === 'ESTRATEGA' ? u.margenEstratega : 1;
  const balance = balanceDiario(entrada.stats, entrada.produccion);
  const carencias: Carencia[] = [];

  const comida = gravedadPorDias(diasDeReserva(entrada.stats.comida, balance.comida), u.comidaLeveDias * margen, u.comidaGraveDias);
  if (comida) carencias.push({ tipo: 'COMIDA', gravedad: comida });
  if (entrada.bebidaReal) {
    const bebida = gravedadPorDias(diasDeReserva(entrada.stats.bebida, balance.bebida), u.comidaLeveDias * margen, u.comidaGraveDias);
    if (bebida) carencias.push({ tipo: 'BEBIDA', gravedad: bebida });
  }
  // Goirnos: solo si los sueldos no salen de lo que entra cada día.
  const goirnos = gravedadPorDias(diasDeReserva(entrada.stats.riqueza, balance.riqueza), u.goirnosLeveDias * margen, u.goirnosGraveDias);
  if (goirnos) carencias.push({ tipo: 'GOIRNOS', gravedad: goirnos });

  // Soldados: frente al enemigo más fuerte; grave si no llega ni a la mitad del umbral.
  const masFuerte = [...(entrada.enemigos ?? [])].sort((a, b) => b.soldados - a.soldados)[0];
  if (masFuerte && masFuerte.soldados > 0) {
    const proporcion = entrada.stats.soldados / masFuerte.soldados;
    const umbral = u.soldadosProporcion * margen;
    if (proporcion < umbral) {
      carencias.push({ tipo: 'SOLDADOS', gravedad: proporcion < u.soldadosProporcion / 2 ? 'GRAVE' : 'LEVE', enemigoId: masFuerte.factionId });
    }
  }

  return tramo === 'IMPULSIVO' ? carencias.filter((c) => c.gravedad === 'GRAVE') : carencias;
}

/// Días entre dos revisiones de una facción (Q6).
export const DIAS_ENTRE_REVISIONES = 7;

/// Puro (Q6): ¿revisa hoy su situación? Una vez por semana de ficción, o antes si hay una carencia
/// grave; nunca dos veces el mismo día. `ultimaRevision` null = nunca ha revisado.
export function tocaRevisar(dia: number, ultimaRevision: number | null, carencias: Carencia[]): boolean {
  if (ultimaRevision === null) return true;
  if (dia <= ultimaRevision) return false;
  if (dia - ultimaRevision >= DIAS_ENTRE_REVISIONES) return true;
  return carencias.some((c) => c.gravedad === 'GRAVE');
}
