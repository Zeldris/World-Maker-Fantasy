import type { Prisma, PrismaClient } from '@prisma/client';
import type { CardinalDirection } from './travel.js';

/// Punto del jugador en el mapa de Zona (2026-09-04) — mismo lienzo 800×600 que ya usa `ZonePoint`
/// (`x`/`y` locales al SVG, no confundir con `Location.x/y` globales en km que usa
/// `cardinalDirectionBetween`, travel.ts). Todo lo que mueve al jugador o a un NPC dinámico dentro
/// del mapa pasa por aquí — regla de oro del motor: solo acciones deterministas ya resueltas por
/// el backend, nunca interpretación de narración libre.
export const LIENZO_ANCHO = 800;
export const LIENZO_ALTO = 600;
const MARGEN_BORDE = 24;
/// Bug real, sesión autónoma de pruebas con Playwright (2026-09-04): el marcador del jugador
/// (`JugadorMarker`, ZonaPanel.tsx — halo circular de radio 14) quedaba cortado a la mitad en las
/// 4 esquinas diagonales, contra la esquina REDONDEADA (`rounded-lg`) del contenedor que envuelve
/// el `<svg>` — `MARGEN_BORDE` (24) es suficiente para los 4 bordes rectos (norte/sur/este/oeste,
/// donde el marcador solo toca UN borde), pero insuficiente cuando toca DOS bordes a la vez en una
/// esquina. Margen propio, mayor, solo para las 4 diagonales.
const MARGEN_BORDE_DIAGONAL = 40;

/// Punto del borde/esquina del lienzo para la dirección por la que el jugador ENTRA a la zona —
/// convención x=este creciente/y=SUR creciente en el lienzo SVG (pantalla), al revés que
/// `Location.x/y` (x=este/y=NORTE, travel.ts) que alimenta `cardinalDirectionBetween`: 'norte'
/// entra por ARRIBA del lienzo (y pequeño), 'sur' por ABAJO (y grande). Los 4 sectores diagonales
/// usan la ESQUINA correspondiente, no el punto medio de un lado — más informativo visualmente que
/// colapsar norte y noreste al mismo borde superior sin diferencia real.
export function puntoDeEntradaParaDireccion(direction: CardinalDirection): { x: number; y: number } {
  const cx = LIENZO_ANCHO / 2;
  const cy = LIENZO_ALTO / 2;
  switch (direction) {
    case 'norte':
      return { x: cx, y: MARGEN_BORDE };
    case 'sur':
      return { x: cx, y: LIENZO_ALTO - MARGEN_BORDE };
    case 'este':
      return { x: LIENZO_ANCHO - MARGEN_BORDE, y: cy };
    case 'oeste':
      return { x: MARGEN_BORDE, y: cy };
    case 'noreste':
      return { x: LIENZO_ANCHO - MARGEN_BORDE_DIAGONAL, y: MARGEN_BORDE_DIAGONAL };
    case 'noroeste':
      return { x: MARGEN_BORDE_DIAGONAL, y: MARGEN_BORDE_DIAGONAL };
    case 'sureste':
      return { x: LIENZO_ANCHO - MARGEN_BORDE_DIAGONAL, y: LIENZO_ALTO - MARGEN_BORDE_DIAGONAL };
    case 'suroeste':
      return { x: MARGEN_BORDE_DIAGONAL, y: LIENZO_ALTO - MARGEN_BORDE_DIAGONAL };
  }
}

/// Dirección opuesta a la calculada por `cardinalDirectionBetween(origen, destino)` — esa función
/// da hacia dónde VIAJA el jugador (si destino está al norte de origen, viaja "hacia el norte"),
/// pero el jugador entra a la zona DESTINO por el lado contrario (llega desde el sur, así que
/// aparece pegado al borde SUR del lienzo, mirando hacia dentro).
const DIRECCION_OPUESTA: Record<CardinalDirection, CardinalDirection> = {
  norte: 'sur',
  sur: 'norte',
  este: 'oeste',
  oeste: 'este',
  noreste: 'suroeste',
  suroeste: 'noreste',
  noroeste: 'sureste',
  sureste: 'noroeste',
};

export function direccionDeEntrada(direccionDeViaje: CardinalDirection): CardinalDirection {
  return DIRECCION_OPUESTA[direccionDeViaje];
}

/// Distancia mínima entre un punto candidato y cualquier punto ya ocupado, antes de aceptarlo como
/// posición para un NPC/fauna dinámico sin `ZonePoint` real — evita que dos pines se dibujen
/// literalmente encima (ilegible), sin exigir un algoritmo de distribución sofisticado (pocos
/// puntos por zona en la práctica, casi siempre converge al primer intento).
const DISTANCIA_MINIMA_ENTRE_PUNTOS = 60;
const INTENTOS_MAXIMOS = 8;

/// Nunca bloquea: si los 8 intentos chocan igualmente (lienzo saturado de puntos, caso límite que
/// no ocurre hoy con el volumen real de ZonePoint por Location), se acepta el último candidato tal
/// cual en vez de fallar la asignación.
export function posicionAleatoriaEnLienzo(ocupadas: { x: number; y: number }[], random: () => number = Math.random): { x: number; y: number } {
  let candidato = { x: LIENZO_ANCHO / 2, y: LIENZO_ALTO / 2 };
  for (let intento = 0; intento < INTENTOS_MAXIMOS; intento++) {
    candidato = {
      x: MARGEN_BORDE + random() * (LIENZO_ANCHO - 2 * MARGEN_BORDE),
      y: MARGEN_BORDE + random() * (LIENZO_ALTO - 2 * MARGEN_BORDE),
    };
    const chocaConAlguna = ocupadas.some((p) => Math.hypot(p.x - candidato.x, p.y - candidato.y) < DISTANCIA_MINIMA_ENTRE_PUNTOS);
    if (!chocaConAlguna) return candidato;
  }
  return candidato;
}

/// Combate ganado por el jugador (2026-09-04) — 6h de tiempo de FICCIÓN (nunca tiempo real), mismo
/// criterio que `condicionFisicaSinceMinutes`/`recalcularZonePointsDeLocation`: se compara contra
/// el minuto YA avanzado con el coste de este turno (`nuevoFictionalMinutes`), no el de antes.
export const MINUTOS_AUSENCIA_TRAS_DERROTA = 6 * 60;

export function minutoDeReaparicion(nuevoFictionalMinutes: number): number {
  return nuevoFictionalMinutes + MINUTOS_AUSENCIA_TRAS_DERROTA;
}

type TxOrClient = Prisma.TransactionClient | PrismaClient;

/// Único punto de escritura de `Save.zonaPosX/Y` — todos los enganches deterministas (cazar,
/// recolectar, combate, hablar) pasan por aquí en vez de repetir el `update` a mano.
export async function moverJugadorA(tx: TxOrClient, saveId: string, x: number, y: number): Promise<void> {
  await tx.save.update({ where: { id: saveId }, data: { zonaPosX: x, zonaPosY: y } });
}

/// Fija posición actual Y punto de entrada a la vez — solo al llegar a una Location nueva (regla
/// 1: nunca al moverse dentro de la misma zona).
export async function fijarEntradaAZona(tx: TxOrClient, saveId: string, x: number, y: number): Promise<void> {
  await tx.save.update({ where: { id: saveId }, data: { zonaPosX: x, zonaPosY: y, zonaPosEntradaX: x, zonaPosEntradaY: y } });
}

/// Huida del jugador (regla 4a) — vuelve al punto de entrada YA guardado, sin recalcular nada.
/// No-op si no hay entrada conocida (partida previa a esta pieza): nunca inventa un punto.
export async function volverAEntrada(tx: TxOrClient, saveId: string, entrada: { x: number | null; y: number | null }): Promise<void> {
  if (entrada.x == null || entrada.y == null) return;
  await moverJugadorA(tx, saveId, entrada.x, entrada.y);
}

/// Busca el `ZonePoint` activo de esta Location con ese `targetSlug` — devuelve su posición real o
/// `null` si no existe (el caller decide el fallback a `NpcState.zonaPosX/Y` para un dinámico).
export async function posicionDeObjetivo(tx: TxOrClient, locationId: string, targetSlug: string): Promise<{ x: number; y: number } | null> {
  const zonePoint = await tx.zonePoint.findFirst({ where: { locationId, targetSlug, activo: true }, select: { x: true, y: true } });
  return zonePoint ? { x: zonePoint.x, y: zonePoint.y } : null;
}

/// "Interactuar" motor unificado de eventos de escena, gate de proximidad (2026-09-08) — coherencia
/// narrativa pedida explícitamente por la usuaria: "si el interactuar habla de vetas de Yerreo en
/// lo alto de la montaña, primero habría que subir la montaña... sin que sea algo que estás
/// recogiendo cuando realmente no está en escena". Antes de esta pieza, NADA comparaba
/// `Save.zonaPosX/Y` contra `ZonePoint.x/y` — se ofrecía Interactuar/Cazar/Recolectar sobre
/// cualquier candidato de la Location entera, sin importar en qué punto exacto del lienzo estaba
/// el jugador. Umbral calibrado contra el catálogo real (2026-09-08): de 29 Locations con
/// `ZonePoint`, la distancia MÍNIMA entre dos puntos vecinos es 80px (un único caso,
/// `campamento-serhu-interior`) — el resto ya sube a 128px+, mediana 244px. 100px queda por debajo
/// de todos los casos reales salvo ese outlier, y muy por encima de `DISTANCIA_MINIMA_ENTRE_PUNTOS`
/// (60px, criterio distinto: "no dibujar dos pines encima"). Con "el más cercano gana"
/// (`zonePointMasCercano` más abajo) como desempate, el umbral no necesita cubrir el peor caso con
/// margen amplio — solo decide si el jugador está lo bastante cerca de ALGUIEN.
export const RADIO_INTERACCION_PX = 100;

export function distanciaEnLienzo(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/// Puro — de una lista de `ZonePoint` candidatos (ya filtrados por región/terreno/temperamento por
/// el caller), cuál está lo bastante cerca de la posición actual del jugador para que tenga sentido
/// ofrecer Interactuar/Cazar/Recolectar sobre él. `null` si el jugador no tiene posición conocida
/// todavía (partida previa a esta pieza, o sin Location explorable) — en ese caso el caller decide
/// el fallback (nunca bloquea por un dato ausente, mismo criterio que el resto del proyecto) o si
/// ninguno está dentro de `RADIO_INTERACCION_PX`. "El más cercano gana": nunca devuelve más de un
/// candidato empatado, aunque el jugador esté dentro del radio de varios a la vez (caso real en
/// `campamento-serhu-interior`, 6 puntos con solo 80px entre los más próximos).
export function zonePointMasCercano<T extends { x: number; y: number }>(
  jugador: { x: number; y: number } | null,
  candidatos: T[],
  radio: number = RADIO_INTERACCION_PX,
): T | null {
  if (!jugador || candidatos.length === 0) return null;
  let mejor: T | null = null;
  let mejorDistancia = Infinity;
  for (const candidato of candidatos) {
    const distancia = distanciaEnLienzo(jugador, candidato);
    if (distancia <= radio && distancia < mejorDistancia) {
      mejor = candidato;
      mejorDistancia = distancia;
    }
  }
  return mejor;
}
