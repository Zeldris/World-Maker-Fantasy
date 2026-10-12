import type { Prisma, PrismaClient } from '@prisma/client';
import type { CardinalDirection } from './travel.js';
import { rollD20 } from './dice.js';

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

/// Separación mínima entre dos salidas a lo largo del borde (2026-09-28) — 2 celdas (100px): con
/// menos, dos iconos de salida caen en celdas vecinas y el umbral de "alcanzable" (misma celda o
/// adyacente) ya no distingue a cuál te acercas.
export const SEPARACION_MINIMA_SALIDAS = 100;

/// Posición de cada salida de una zona en el borde del lienzo según el RUMBO REAL hacia su destino
/// (2026-09-28, bug real jugando en vivo con Playwright: en El Paso de los Pilares Rotos, La
/// Hondonada del Eco (56°), El Osario de la Manada (35°) y Los Restos de Maktor (64°) caían los tres
/// en el mismo sector "noreste" de `puntoDeEntradaParaDireccion` — tres iconos apilados en el mismo
/// píxel (760,40), dos destinos inalcanzables desde el mapa). El rumbo se proyecta sobre el
/// rectángulo interior del lienzo (margen `MARGEN_BORDE_DIAGONAL`, el que ya evita cortar el
/// marcador en las esquinas) y, si dos salidas quedan a menos de `SEPARACION_MINIMA_SALIDAS` a lo
/// largo del perímetro, se separan manteniendo su orden angular. Puro y determinista — la misma
/// entrada da siempre las mismas posiciones, así que la salida hacia X en esta zona coincide con
/// el punto por el que se ENTRA viniendo de X (ver `turnResolution.ts` § zonaEntradaCoords).
///
/// `origen`/`destinos[].x/y` en coordenadas de mundo (x=este, y=NORTE, travel.ts); el resultado en
/// coordenadas de lienzo (y=SUR creciente).
export function posicionesDeSalidas(
  origen: { x: number; y: number },
  destinos: { id: string; x: number; y: number }[],
): Map<string, { x: number; y: number }> {
  const m = MARGEN_BORDE_DIAGONAL;
  const ancho = LIENZO_ANCHO - 2 * m;
  const alto = LIENZO_ALTO - 2 * m;
  const perimetro = 2 * (ancho + alto);
  const cx = LIENZO_ANCHO / 2;
  const cy = LIENZO_ALTO / 2;

  // Perímetro recorrido en sentido horario desde la esquina superior izquierda: arriba → derecha →
  // abajo → izquierda.
  const aPerimetro = (x: number, y: number): number => {
    if (y <= m + 1e-6) return x - m;
    if (x >= LIENZO_ANCHO - m - 1e-6) return ancho + (y - m);
    if (y >= LIENZO_ALTO - m - 1e-6) return ancho + alto + (LIENZO_ANCHO - m - x);
    return 2 * ancho + alto + (LIENZO_ALTO - m - y);
  };
  const dePerimetro = (s0: number): { x: number; y: number } => {
    const s = ((s0 % perimetro) + perimetro) % perimetro;
    if (s <= ancho) return { x: m + s, y: m };
    if (s <= ancho + alto) return { x: LIENZO_ANCHO - m, y: m + (s - ancho) };
    if (s <= 2 * ancho + alto) return { x: LIENZO_ANCHO - m - (s - ancho - alto), y: LIENZO_ALTO - m };
    return { x: m, y: LIENZO_ALTO - m - (s - 2 * ancho - alto) };
  };

  const proyectadas = destinos.map((d) => {
    // Pantalla: y crece hacia el SUR, así que el norte del mundo (dy > 0) es -y en el lienzo.
    const dx = d.x - origen.x;
    const dy = -(d.y - origen.y);
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tx = ux === 0 ? Infinity : (ux > 0 ? LIENZO_ANCHO - m - cx : m - cx) / ux;
    const ty = uy === 0 ? Infinity : (uy > 0 ? LIENZO_ALTO - m - cy : m - cy) / uy;
    const t = Math.min(tx, ty);
    return { id: d.id, s: aPerimetro(cx + ux * t, cy + uy * t) };
  });

  // Separación mínima manteniendo el orden: varias pasadas empujando hacia delante y hacia atrás
  // para no amontonar todas las correcciones en un solo lado (con pocas salidas por zona, converge
  // enseguida).
  proyectadas.sort((a, b) => a.s - b.s || a.id.localeCompare(b.id));
  const separacion = Math.min(SEPARACION_MINIMA_SALIDAS, perimetro / Math.max(1, proyectadas.length));
  for (let pasada = 0; pasada < 8; pasada++) {
    let cambios = false;
    for (let i = 1; i < proyectadas.length; i++) {
      const hueco = proyectadas[i].s - proyectadas[i - 1].s;
      if (hueco < separacion - 1e-6) {
        const falta = separacion - hueco;
        proyectadas[i - 1].s -= falta / 2;
        proyectadas[i].s += falta / 2;
        cambios = true;
      }
    }
    // El perímetro es circular: la última y la primera también son vecinas.
    if (proyectadas.length > 1) {
      const ultima = proyectadas[proyectadas.length - 1];
      const hueco = proyectadas[0].s + perimetro - ultima.s;
      if (hueco < separacion - 1e-6) {
        const falta = separacion - hueco;
        ultima.s -= falta / 2;
        proyectadas[0].s += falta / 2;
        cambios = true;
      }
    }
    if (!cambios) break;
  }

  return new Map(proyectadas.map((p) => [p.id, dePerimetro(p.s)]));
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
export async function posicionDeObjetivo(tx: TxOrClient, saveId: string, locationId: string, targetSlug: string): Promise<{ x: number; y: number } | null> {
  const zonePoint = await tx.zonePoint.findFirst({ where: { saveId, locationId, targetSlug, activo: true }, select: { x: true, y: true } });
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

/// Clave estable de una celda para usarla como entrada de un `Set`/`Map` — mismo criterio en todo
/// este archivo de nunca comparar objetos por referencia.
export function claveCelda(c: Celda): string {
  return `${c.col},${c.row}`;
}

/// Orden en espiral (2026-09-28, grupos de fauna reales, Fase 1) — todas las celdas dentro de radio
/// 2 alrededor del centro, del anillo más cercano al más lejano y, dentro de cada anillo, en
/// sentido horario empezando por el norte — determinista siempre, nunca depende de `random` (a
/// diferencia de `siguienteCeldaPaseoAleatorio`, pensado para movimiento, no para colocar una fila
/// nueva). El primer elemento es el propio centro (offset 0,0): si esa celda ya está ocupada
/// (el caso normal — ahí vive la fila ancla), el resto del anillo 1 y luego el 2 dan las
/// alternativas más cercanas posibles.
const OFFSETS_ESPIRAL_RADIO_2: Celda[] = [
  { col: 0, row: 0 },
  { col: 0, row: -1 },
  { col: 1, row: -1 },
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 0, row: 1 },
  { col: -1, row: 1 },
  { col: -1, row: 0 },
  { col: -1, row: -1 },
  { col: 0, row: -2 },
  { col: 1, row: -2 },
  { col: 2, row: -2 },
  { col: 2, row: -1 },
  { col: 2, row: 0 },
  { col: 2, row: 1 },
  { col: 2, row: 2 },
  { col: 1, row: 2 },
  { col: 0, row: 2 },
  { col: -1, row: 2 },
  { col: -2, row: 2 },
  { col: -2, row: 1 },
  { col: -2, row: 0 },
  { col: -2, row: -1 },
  { col: -2, row: -2 },
  { col: -1, row: -2 },
];

/// Puro — primera celda libre en espiral alrededor de `origen` (dentro del lienzo, sin pisar
/// `ocupadas`) para colocar la fila NUEVA de un grupo de fauna repartido (`reconciliarGrupos`,
/// zonePoints.ts) — "libre" = ninguna otra fila `ZonePoint` de la Location ya vive en esa celda.
/// Nunca bloquea: si las 25 celdas del radio 2 están todas ocupadas (caso límite, no ocurre hoy con
/// el volumen real de puntos por Location), devuelve el propio `origen` — mismo criterio de "nunca
/// falla, se acepta el candidato tal cual" que `posicionAleatoriaEnLienzo`.
export function celdaLibreEnEspiral(origen: Celda, ocupadas: ReadonlySet<string>): Celda {
  for (const offset of OFFSETS_ESPIRAL_RADIO_2) {
    const candidata: Celda = { col: origen.col + offset.col, row: origen.row + offset.row };
    if (candidata.col < 0 || candidata.col >= GRID_COLS || candidata.row < 0 || candidata.row >= GRID_ROWS) continue;
    if (!ocupadas.has(claveCelda(candidata))) return candidata;
  }
  return origen;
}

/// QA-27 P50: los grupos nuevos de una especie se reparten por la zona en vez de pegarse al ancla —
/// una celda libre a como mucho `RADIO_GRUPO_NUEVO` del ancla y a `SEPARACION_ENTRE_GRUPOS` o más
/// (distancia de Chebyshev) de cualquier otro grupo de la misma especie, elegida al azar. Si no hay
/// ninguna, la espiral de siempre.
export const RADIO_GRUPO_NUEVO = 5;
export const SEPARACION_ENTRE_GRUPOS = 3;

export function celdaParaGrupoNuevo(origen: Celda, ocupadas: ReadonlySet<string>, mismaEspecie: readonly Celda[], random: () => number = Math.random): Celda {
  const candidatas: Celda[] = [];
  for (let row = origen.row - RADIO_GRUPO_NUEVO; row <= origen.row + RADIO_GRUPO_NUEVO; row++) {
    for (let col = origen.col - RADIO_GRUPO_NUEVO; col <= origen.col + RADIO_GRUPO_NUEVO; col++) {
      if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) continue;
      const c = { col, row };
      if (ocupadas.has(claveCelda(c))) continue;
      if (mismaEspecie.some((o) => Math.max(Math.abs(o.col - col), Math.abs(o.row - row)) < SEPARACION_ENTRE_GRUPOS)) continue;
      candidatas.push(c);
    }
  }
  if (candidatas.length === 0) return celdaLibreEnEspiral(origen, ocupadas);
  return candidatas[Math.min(candidatas.length - 1, Math.floor(random() * candidatas.length))];
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
/// grupos — QA-27 (2026-10-09, la usuaria tras jugar: «las zonas están súper pobladas y cuesta
/// moverse… menos grupos, más grandes… priorizar sobre todo dejar siempre 2 o 3 individuales»).
/// Sustituye al reparto en capas de 4 a 1 (2026-09-08), que con 20 individuos daba 8-14 puntos
/// por especie. Ahora: 2-3 individuos sueltos (el cazador en solitario siempre tiene presa a su
/// medida) y el resto en los menos grupos posibles de hasta `TAMANO_MAXIMO_GRUPO`, de tamaño
/// parecido entre sí. Con 20: 5-6 puntos. X4 marca el camino: el mapa enseña flotas, no naves
/// sueltas. `sueltos` fija cuántos individuos quedan sueltos (para respetar los que ya hay al
/// reconciliar); si no, se elige 2 o 3 con `random`.
export const TAMANO_MAXIMO_GRUPO = 6;

export function repartirEnGrupos(poblacionTotal: number, random: () => number = Math.random, sueltos?: number): number[] {
  if (poblacionTotal <= 0) return [];
  let solos = Math.min(poblacionTotal, sueltos ?? (random() < 0.5 ? 2 : 3));
  let resto = poblacionTotal - solos;
  // Un resto de 1 no hace grupo: o se queda suelto (si caben 3 sueltos) o se junta con uno suelto.
  if (resto === 1) {
    if (solos < 3) { solos += 1; resto = 0; }
    else { solos -= 1; resto = 2; }
  }
  const grupos: number[] = [];
  if (resto > 0) {
    const cuantos = Math.ceil(resto / TAMANO_MAXIMO_GRUPO);
    const base = Math.floor(resto / cuantos);
    const conUnoMas = resto % cuantos;
    for (let i = 0; i < cuantos; i++) grupos.push(base + (i < conUnoMas ? 1 : 0));
  }
  for (let i = 0; i < solos; i++) grupos.push(1);
  return grupos;
}

/// "¿Quién ve a quién primero?" (2026-09-17, petición explícita de Álvaro: "si lo encuentro me
/// describe lo que se ve... si me ve el a mi, el decide como interactuar conmigo... una tirada de
/// iniciativa aquí" — jugador y NPC/fauna tiran Destreza vs Destreza, mismo dado D20 y misma fórmula
/// `roll + floor(destreza/2)` que ya usa `rollAttributeCheck`/`rollInitiative` en combate
/// (combatExchange.ts), pero SIN el shape completo de `ExchangeParticipant` (difficulty/
/// condicionFisica/rollMode) — aquí no hace falta nada de eso, solo decide el FRAMING narrativo de
/// la primera vuelta de Interactuar (quién se presenta primero), nunca el resultado mecánico
/// (agresivo/enemigo sigue forzando combate igual, temperamento pacífico sigue abriendo Interactuar
/// igual — ver `detectarEncuentroEnCelda`, zona.ts). Empate favorece al jugador, mismo criterio que
/// `rollInitiative`.
export interface IniciativaEncuentroLado {
  attribute: 'destreza';
  value: number;
  roll: number;
  bono: number;
  result: number;
}

/// Fase 10 (2026-09-29, "todas las tiradas visibles") — las dos tiradas de `quienIniciaEncuentro`
/// dejan de descartarse: se devuelven para pintarlas como tirada opuesta en la tarjeta de encuentro.
export interface IniciativaEncuentroResultado {
  quienInicia: 'jugador' | 'npc';
  jugador: IniciativaEncuentroLado;
  npc: IniciativaEncuentroLado;
}

/// Forma persistida en `LogEntry.roll` para el encuentro (discriminada por `kind`).
export interface IniciativaEncuentroLogRoll {
  kind: 'iniciativa-encuentro';
  quienInicia: 'jugador' | 'npc';
  jugador: IniciativaEncuentroLado;
  npc: IniciativaEncuentroLado;
  npcName: string;
}

export function tirarQuienIniciaEncuentro(destrezaJugador: number, destrezaNpc: number, random: () => number = Math.random): IniciativaEncuentroResultado {
  const lado = (destreza: number): IniciativaEncuentroLado => {
    const roll = rollD20('normal', random).usedRoll;
    const bono = Math.floor(destreza / 2);
    return { attribute: 'destreza', value: destreza, roll, bono, result: roll + bono };
  };
  const jugador = lado(destrezaJugador);
  const npc = lado(destrezaNpc);
  return { quienInicia: jugador.result >= npc.result ? 'jugador' : 'npc', jugador, npc };
}

export function quienIniciaEncuentro(destrezaJugador: number, destrezaNpc: number, random: () => number = Math.random): 'jugador' | 'npc' {
  return tirarQuienIniciaEncuentro(destrezaJugador, destrezaNpc, random).quienInicia;
}
