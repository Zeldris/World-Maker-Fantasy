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

/// Sistema de movimiento por cuadrícula (2026-09-08, diseño confirmado con la usuaria, referencia
/// explícita "estilo Mount & Blade") — el lienzo 800×600 se divide en celdas de `CELL_SIZE_PX` para
/// el movimiento del jugador y de `ZonePoint` con ruta propia; `x`/`y` en píxel siguen siendo la
/// fuente de verdad persistida (mismo campo de siempre), la celda es solo una vista discreta sobre
/// esas coordenadas para decidir pasos/colisión. 16×12 celdas — calibrado para que el radio de
/// Interactuar ya existente (100px) equivalga a ~2 celdas.
export const CELL_SIZE_PX = 50;
export const GRID_COLS = LIENZO_ANCHO / CELL_SIZE_PX;
export const GRID_ROWS = LIENZO_ALTO / CELL_SIZE_PX;

export interface Celda {
  col: number;
  row: number;
}

/// Puro — píxel real → celda de la cuadrícula (clamp a los límites del lienzo, nunca fuera de rango
/// aunque `x`/`y` esté justo en el borde o ligeramente fuera por redondeo previo).
export function celdaDePixel(punto: { x: number; y: number }): Celda {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(punto.x / CELL_SIZE_PX))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(punto.y / CELL_SIZE_PX))),
  };
}

/// Puro — celda → píxel real del CENTRO de esa celda (nunca la esquina) — así un `ZonePoint`/
/// jugador posicionado por celda siempre cae en un punto visualmente centrado, coherente con
/// `x`/`y` calibrados a mano contra el PNG real de cada zona.
export function pixelDeCelda(celda: Celda): { x: number; y: number } {
  return { x: celda.col * CELL_SIZE_PX + CELL_SIZE_PX / 2, y: celda.row * CELL_SIZE_PX + CELL_SIZE_PX / 2 };
}

export function mismaCelda(a: Celda, b: Celda): boolean {
  return a.col === b.col && a.row === b.row;
}

/// Puro — ¿`b` es la misma celda que `a`, o una de sus 8 vecinas? Base del doble umbral de
/// colisión: misma celda = encuentro inevitable, adyacente = aviso previo de Interactuar.
export function celdaAdyacenteOMisma(a: Celda, b: Celda): boolean {
  return Math.abs(a.col - b.col) <= 1 && Math.abs(a.row - b.row) <= 1;
}

/// Puro — camino de celdas desde `origen` (EXCLUSIVE) hasta `destino` (INCLUSIVE), algoritmo de
/// línea de Bresenham (determinista, sin diagonales "imposibles" — cada paso avanza como mucho 1
/// celda en cada eje, nunca salta dos a la vez). Mismo criterio "el motor decide, nunca el LLM" —
/// el jugador solo dice A DÓNDE quiere ir (clic en el lienzo), el camino real siempre lo calcula
/// esta función, nunca coordenadas que el jugador teclee paso a paso.
export function calcularCamino(origen: Celda, destino: Celda): Celda[] {
  const camino: Celda[] = [];
  let { col, row } = origen;
  const dCol = Math.abs(destino.col - origen.col);
  const dRow = -Math.abs(destino.row - origen.row);
  const signoCol = origen.col < destino.col ? 1 : -1;
  const signoRow = origen.row < destino.row ? 1 : -1;
  let error = dCol + dRow;
  while (col !== destino.col || row !== destino.row) {
    const error2 = 2 * error;
    if (error2 >= dRow) {
      error += dRow;
      col += signoCol;
    }
    if (error2 <= dCol) {
      error += dCol;
      row += signoRow;
    }
    camino.push({ col, row });
  }
  return camino;
}

/// Cuánto puede alejarse el fallback de paseo aleatorio de su celda de ORIGEN (`x`/`y` de catálogo
/// del `ZonePoint`) — nunca abandona su territorio real solo por no tener ruta artesanal definida.
const RADIO_PASEO_ALEATORIO_CELDAS = 2;

/// Puro — siguiente celda de un `ZonePoint` SIN ruta artesanal definida (`ruta` null/vacía en el
/// catálogo): un paso aleatorio de las 8 vecinas o quedarse quieto, acotado a
/// `RADIO_PASEO_ALEATORIO_CELDAS` de su celda de origen — nunca completamente estático, pero sin
/// exigir diseñar una ruta a mano para las ~76 fichas reales que hoy no la tienen. `random`
/// inyectable para tests, mismo patrón que `rollGathering`/`decideOfertaModoDinamico`.
export function siguienteCeldaPaseoAleatorio(actual: Celda, origen: Celda, random: () => number = Math.random): Celda {
  const DELTAS: { col: number; row: number }[] = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
    { col: 1, row: 1 },
    { col: 1, row: -1 },
    { col: -1, row: 1 },
    { col: -1, row: -1 },
  ];
  const candidatos = DELTAS.map((d) => ({ col: actual.col + d.col, row: actual.row + d.row })).filter(
    (c) =>
      c.col >= 0 &&
      c.col < GRID_COLS &&
      c.row >= 0 &&
      c.row < GRID_ROWS &&
      Math.abs(c.col - origen.col) <= RADIO_PASEO_ALEATORIO_CELDAS &&
      Math.abs(c.row - origen.row) <= RADIO_PASEO_ALEATORIO_CELDAS,
  );
  return candidatos[Math.floor(random() * candidatos.length)] ?? actual;
}

/// Puro — siguiente celda de un `ZonePoint` CON ruta artesanal definida (`ruta`, array de celdas en
/// píxel) — un paso por cada movimiento del jugador, en bucle (al llegar al final vuelve al primer
/// punto). Devuelve también el nuevo `pasoRuta` para persistir.
export function siguienteCeldaEnRuta(ruta: Celda[], pasoRuta: number): { celda: Celda; nuevoPasoRuta: number } {
  const siguiente = (pasoRuta + 1) % ruta.length;
  return { celda: ruta[siguiente], nuevoPasoRuta: siguiente };
}

/// Reparto de una población regional (YA topada a `CANTIDAD_MAX_POR_PUNTO`, zonePoints.ts) en
/// grupos de tamaño variado — decisión explícita de la usuaria: "20 corredores... varios grupos de
/// 4, varios de 2, algunos individuales... ofreciendo todos los rangos siempre dentro de lo
/// posible", no un único tamaño típico con ruido alrededor. Capas descendentes desde
/// `TAMANO_MAXIMO_GRUPO` (4) hasta 1, con 1-2 grupos por capa mientras quede población que
/// repartir — da variedad real (parejas/tríos/sueltos/grupo grande, todos presentes a la vez) sin
/// necesitar una tabla de umbrales a mano. Validado contra números reales (2026-09-08):
/// total=20→[4,4,3,3,2,1,1,1,1]; total=12→[4,4,3,1]; total=8→[4,4]; total=5→[4,1];
/// total=1-3→un solo grupo suelto. `random` inyectable para tests.
const TAMANO_MAXIMO_GRUPO = 4;

export function repartirEnGrupos(poblacionTotal: number, random: () => number = Math.random): number[] {
  if (poblacionTotal <= 0) return [];
  const grupos: number[] = [];
  let restante = poblacionTotal;
  let tamano = Math.min(TAMANO_MAXIMO_GRUPO, restante);
  while (restante > 0 && tamano >= 1) {
    const gruposEnEstaCapa = random() < 0.5 ? 1 : 2;
    for (let i = 0; i < gruposEnEstaCapa && restante > 0; i++) {
      const tamanoGrupo = Math.min(tamano, restante);
      grupos.push(tamanoGrupo);
      restante -= tamanoGrupo;
    }
    tamano -= 1;
  }
  // Agotadas las capas de TAMANO_MAXIMO_GRUPO..1, cualquier resto (posible si `random` eligió 1
  // grupo por capa en vez de 2) se reparte en unidades sueltas — nunca se pierde población sin
  // asignar a ningún grupo.
  while (restante > 0) {
    grupos.push(1);
    restante -= 1;
  }
  return grupos;
}
