import type { FaunaCategoria } from './faunaAbilities.js';
import type { Celda } from './zonaPosicion.js';
import { celdaDePixel } from './zonaPosicion.js';

/// Sistema de plantillas de movimiento (2026-09-17, petición explícita de Álvaro: "el movimiento
/// aleatorio actual es difícil de chocar con las cosas y todo se mueve erráticamente... quiero
/// plantillas de movimiento para asignarle a los diferentes NPC, Fauna y más... mirar en el lore
/// qué elementos deben ser estáticos y cuáles no... por ejemplo los guardias moverse por los
/// caminos, fauna en círculos, otra que no se mueve, otra que se desplaza por diferentes zonas...
/// en los interiores de los campamentos no debiese haber tanto movimiento").
///
/// Dos niveles, ambos resueltos en `siguienteCeldaDeZonePoint` (única función que expone este
/// archivo al resto del motor):
/// - GENERAL: SIEMPRE hay una asignada, inferida en tiempo real de `faunaCategoria`/`temperamento`/
///   `role`/`kind`/`medio` del Npc (`generalMovementTemplateFor`) — nunca se persiste, así que un
///   cambio de lore actualiza el movimiento solo, sin re-sembrar nada. Sustituye por completo al
///   antiguo fallback único `siguienteCeldaPaseoAleatorio` (que seguía siendo un buen comportamiento
///   por defecto para "deambular sin patrón conocido", así que sigue viviendo aquí como la
///   plantilla general TERRITORIO_CORTO, ya no como único camino posible).
/// - ESPECÍFICA: override opcional por `ZonePoint.plantillaEspecifica` (nombre), para un elemento o
///   una zona concreta que necesita un movimiento único curado a mano (p.ej. el Cruzavientos
///   sobrevolando en círculo justo los Pilares Rotos, o los guardias de Karot Veku recorriendo el
///   camino en cruz real del mapa). Si está presente, gana siempre sobre la general.
///
/// Todas las plantillas son funciones PURAS — mismo patrón que `siguienteCeldaPaseoAleatorio`/
/// `siguienteCeldaEnRuta` (zonaPosicion.ts): `random` inyectable para tests, nunca tocan Prisma.

export type GeneralMovementTemplate =
  | 'ESTATICO'
  | 'TERRITORIO_CORTO'
  | 'MANADA_AMPLIA'
  | 'PATRULLA_BREVE'
  | 'ORBITA_AEREA';

/// Radio máximo (en celdas) al que se acota cada plantilla general, medido desde la celda de
/// ORIGEN (`ZonePoint.origenX/Y` de catálogo, nunca la posición actual) — mismo principio que ya
/// regía `RADIO_PASEO_ALEATORIO_CELDAS`: "nunca abandona su territorio real".
///
/// Radios deliberadamente MÁS PEQUEÑOS que el antiguo `RADIO_PASEO_ALEATORIO_CELDAS = 2` para el
/// caso por defecto (`TERRITORIO_CORTO` baja a 1) — la queja real de Álvaro era "todo se mueve
/// erráticamente" y "es difícil de chocar con las cosas"; un radio más corto hace que quien SÍ
/// debe estar cerca de un punto (una madriguera, un puesto de guardia) lo esté de verdad, sin
/// diluirse por todo el mapa. `MANADA_AMPLIA` es la única que conserva un radio mayor, reservada a
/// pastizales abiertos con fauna de manada real (ver `generalMovementTemplateFor`).
const RADIO_CELDAS: Record<GeneralMovementTemplate, number> = {
  ESTATICO: 0,
  TERRITORIO_CORTO: 1,
  MANADA_AMPLIA: 3,
  PATRULLA_BREVE: 2, // radio del tramo de ida-vuelta autogenerado, no un paseo libre
  ORBITA_AEREA: 2, // radio del círculo alrededor del origen
};

const DELTAS_8_VECINAS: { col: number; row: number }[] = [
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

function celdaEnRango(c: Celda, gridCols: number, gridRows: number): boolean {
  return c.col >= 0 && c.col < gridCols && c.row >= 0 && c.row < gridRows;
}

/// TERRITORIO_CORTO / MANADA_AMPLIA comparten la misma mecánica que el antiguo paseo aleatorio
/// (8 vecinas + quedarse quieto, acotado al radio de origen) — solo cambia el radio según la
/// plantilla. `gridCols`/`gridRows` inyectados en vez de importados de `zonaPosicion.ts` para que
/// este archivo no dependa del lienzo concreto (facilita tests con grids pequeñas).
function pasoAleatorioAcotado(
  actual: Celda,
  origen: Celda,
  radio: number,
  gridCols: number,
  gridRows: number,
  random: () => number,
): Celda {
  const candidatos = DELTAS_8_VECINAS.map((d) => ({ col: actual.col + d.col, row: actual.row + d.row })).filter(
    (c) =>
      celdaEnRango(c, gridCols, gridRows) &&
      Math.abs(c.col - origen.col) <= radio &&
      Math.abs(c.row - origen.row) <= radio,
  );
  return candidatos[Math.floor(random() * candidatos.length)] ?? actual;
}

/// PATRULLA_BREVE — ida-vuelta autogenerada sobre un único eje (el más largo disponible dentro del
/// lienzo desde el origen), sin necesitar una `ruta` curada a mano. Determinista dado `pasoRuta`:
/// avanza en una dirección hasta `RADIO_CELDAS.PATRULLA_BREVE`, luego retrocede — un guardia sin
/// ruta específica asignada todavía igualmente "hace guardia yendo y viniendo" en vez de vagar sin
/// rumbo. Elige el eje horizontal por convención (más frecuente en los caminos reales del catálogo,
/// ver docs/22-plantillas-de-movimiento — right of way este/oeste antes que norte/sur en la mayoría
/// de mapas revisados); si el origen está pegado al borde horizontal del lienzo, usa el eje vertical.
function siguienteCeldaPatrullaBreve(origen: Celda, pasoRuta: number, gridCols: number, gridRows: number): { celda: Celda; nuevoPasoRuta: number } {
  const radio = RADIO_CELDAS.PATRULLA_BREVE;
  const ejeHorizontalDisponible = origen.col - radio >= 0 && origen.col + radio < gridCols;
  const tramo = radio * 2; // ida (radio pasos) + vuelta (radio pasos) = periodo del bucle
  const periodo = tramo * 2 || 1;
  const paso = pasoRuta % periodo;
  // 0..tramo-1 = ida (offset 0→+radio→0→-radio), tramo..periodo-1 = vuelta simétrica.
  const offsetTriangular = paso <= radio ? paso : paso <= tramo ? tramo - paso : paso <= tramo + radio ? -(paso - tramo) : -(periodo - paso);
  const celda: Celda = ejeHorizontalDisponible
    ? { col: origen.col + offsetTriangular, row: origen.row }
    : { col: origen.col, row: Math.max(0, Math.min(gridRows - 1, origen.row + offsetTriangular)) };
  return { celda, nuevoPasoRuta: (pasoRuta + 1) % periodo };
}

/// ORBITA_AEREA — círculo discreto de 8 celdas alrededor del origen (las 8 vecinas del radio de
/// `RADIO_CELDAS.ORBITA_AEREA`, recorridas en el mismo orden siempre) — "vuela alto y en círculos"
/// (Cruzavientos, Zense Ceniza, bio real del catálogo), sin necesitar una `ruta` manual por cada
/// ave. Determinista dado `pasoRuta`, en bucle.
function siguienteCeldaOrbitaAerea(origen: Celda, pasoRuta: number, gridCols: number, gridRows: number): { celda: Celda; nuevoPasoRuta: number } {
  const r = RADIO_CELDAS.ORBITA_AEREA;
  const anillo: { col: number; row: number }[] = [
    { col: 0, row: -r },
    { col: r, row: -r },
    { col: r, row: 0 },
    { col: r, row: r },
    { col: 0, row: r },
    { col: -r, row: r },
    { col: -r, row: 0 },
    { col: -r, row: -r },
  ];
  const paso = pasoRuta % anillo.length;
  const delta = anillo[paso];
  const celda: Celda = {
    col: Math.max(0, Math.min(gridCols - 1, origen.col + delta.col)),
    row: Math.max(0, Math.min(gridRows - 1, origen.row + delta.row)),
  };
  return { celda, nuevoPasoRuta: (pasoRuta + 1) % anillo.length };
}

/// Resuelve la plantilla GENERAL para una celda dada. Firma unificada con las plantillas
/// específicas (`{ celda, nuevoPasoRuta }`) aunque `ESTATICO`/`TERRITORIO_CORTO`/`MANADA_AMPLIA` no
/// usen `pasoRuta` de verdad (lo devuelven sin cambios, coherente con no tener bucle real).
export function siguienteCeldaPlantillaGeneral(
  plantilla: GeneralMovementTemplate,
  actual: Celda,
  origen: Celda,
  pasoRuta: number,
  gridCols: number,
  gridRows: number,
  random: () => number = Math.random,
): { celda: Celda; nuevoPasoRuta: number } {
  switch (plantilla) {
    case 'ESTATICO':
      return { celda: origen, nuevoPasoRuta: pasoRuta };
    case 'TERRITORIO_CORTO':
      return { celda: pasoAleatorioAcotado(actual, origen, RADIO_CELDAS.TERRITORIO_CORTO, gridCols, gridRows, random), nuevoPasoRuta: pasoRuta };
    case 'MANADA_AMPLIA':
      return { celda: pasoAleatorioAcotado(actual, origen, RADIO_CELDAS.MANADA_AMPLIA, gridCols, gridRows, random), nuevoPasoRuta: pasoRuta };
    case 'PATRULLA_BREVE':
      return siguienteCeldaPatrullaBreve(origen, pasoRuta, gridCols, gridRows);
    case 'ORBITA_AEREA':
      return siguienteCeldaOrbitaAerea(origen, pasoRuta, gridCols, gridRows);
  }
}

/// Entrada mínima de `Npc` que necesita la inferencia — subconjunto, no el modelo Prisma completo,
/// para que este archivo no dependa de `@prisma/client` más de lo necesario (mismo criterio que el
/// resto de `services/*.ts` puros).
export interface NpcMovementInferenceInput {
  kind: 'PRINCIPAL' | 'PLANTILLA';
  role: string;
  temperamento: 'AMIGABLE' | 'INOFENSIVO' | 'CAUTELOSO' | 'AGRESIVO' | 'ENEMIGO';
  faunaCategoria: FaunaCategoria | null;
  medio: ('TERRESTRE' | 'AEREO' | 'ACUATICO')[];
}

const ROLE_GUARDIA_REGEX = /guardi[aá]n?|patrull|vigilan|centinela/i;
const ROLE_MAESTRO_REGEX = /maestr[oa]|kort'?ikar|terk'?ikar|mesok'?ikar/i;

/// Puro, determinista — decide la plantilla GENERAL de un Npc/ZonePoint según su lore ya
/// estructurado en el catálogo, sin tocar ninguna bio a mano. Orden de prioridad (de más a menos
/// específico), documentado porque varias señales pueden aplicar a la vez a un mismo Npc:
///
/// 1. Solo TERRESTRE + ACUATICO nunca aplica aquí (ese gate vive en `candidateFaunaFor`/Cazar, no
///    en movimiento) — pero AEREO puro o mixto SÍ decide ORBITA_AEREA, coherente con "vuela alto y
///    en círculos" (Cruzavientos, Zense Ceniza, Celubia Pálida — todas CORVENES en la práctica).
/// 2. `faunaCategoria` — la señal más rica y ya poblada al 100% de la fauna real:
///    - GUELISES/BESTIONES (depredadores/herbívoros de MANADA real, bio explícita: "caza en
///      jaurías"/"se desplaza en manadas siguiendo las corrientes") → MANADA_AMPLIA.
///    - ACECHANTES/QUITINOS/ESCAMADOS/RONDINES (solitarios de emboscada, madrigueras fortificadas,
///      "vive encajado en las grietas", "sale a escarbar... o se le puede ver despistado antes de
///      desaparecer") → TERRITORIO_CORTO (quieto la mayor parte, corto radio de verdad).
///    - NADANTES (fauna de charca/costa, sedentaria salvo migración estacional real, que es un
///      caso de plantilla ESPECÍFICA, no general) → TERRITORIO_CORTO.
///    - ZANCUDOS (bandadas terrestres/de charca, "se mueve en bandadas entre la hierba") →
///      MANADA_AMPLIA (bandada, mismo espíritu que manada aunque sea ave).
/// 3. `role` de NPC humanoide — "guardia"/"patrulla"/"vigilan"/"centinela" → PATRULLA_BREVE (hasta
///    que se le asigne una plantilla específica curada con la ruta real del camino del campamento).
///    "Maestro"/título de mando (Kort'ikar/Terk'ikar/Mesok'ikar) → ESTATICO (un Maestro de oficio
///    o un jefe de clan se queda en su puesto de trabajo/salón, no vaga por el campamento).
/// 4. `temperamento` como último criterio genérico, para lo que no cae en ninguna regla anterior:
///    AGRESIVO/ENEMIGO (depredador activo sin categoría de manada conocida) → TERRITORIO_CORTO;
///    AMIGABLE/INOFENSIVO/CAUTELOSO sin ningún rol especial → TERRITORIO_CORTO también (el piso de
///    seguridad, sustituye 1:1 al antiguo fallback único, solo que con radio más corto).
export function generalMovementTemplateFor(npc: NpcMovementInferenceInput): GeneralMovementTemplate {
  const esAereo = npc.medio.includes('AEREO');
  if (esAereo) return 'ORBITA_AEREA';

  if (npc.faunaCategoria) {
    switch (npc.faunaCategoria) {
      case 'GUELISES':
      case 'BESTIONES':
      case 'ZANCUDOS':
        return 'MANADA_AMPLIA';
      case 'ACECHANTES':
      case 'QUITINOS':
      case 'ESCAMADOS':
      case 'RONDINES':
      case 'NADANTES':
        return 'TERRITORIO_CORTO';
      case 'CORVENES':
        // Carroñeras/aves de presa sin `medio: AEREO` poblado todavía en catálogo (desalineación
        // real encontrada auditando el catálogo, 2026-09-16) — igualmente se comportan en vuelo
        // circular por lore, así que caen aquí en vez de TERRITORIO_CORTO.
        return 'ORBITA_AEREA';
      case 'ORDENADOS':
      case 'UMBRIAS':
      case 'MUDOS_SALVAJE':
      case 'ROKRATS_ESTALLIDO':
        return 'TERRITORIO_CORTO';
    }
  }

  if (ROLE_GUARDIA_REGEX.test(npc.role)) return 'PATRULLA_BREVE';
  if (ROLE_MAESTRO_REGEX.test(npc.role)) return 'ESTATICO';

  return 'TERRITORIO_CORTO';
}

/// Catálogo de plantillas ESPECÍFICAS, keyed por nombre (`ZonePoint.plantillaEspecifica`) —
/// override curado a mano para una zona o un elemento concreto, reutilizable entre varios
/// `ZonePoint` a la vez (varios guardias del mismo campamento comparten la misma ruta, cada uno
/// con su propio `pasoRuta` inicial de catálogo como offset de fase, para que no anden todos
/// pegados en la misma celda todo el rato).
///
/// Formato: array de celdas en PÍXEL (misma convención que `ZonePoint.ruta` ya existente), recorrido
/// en bucle vía `siguienteCeldaEnRuta` (zonaPosicion.ts, sin cambios) — una plantilla específica es,
/// técnicamente, una `ruta` con nombre y reutilizable, en vez de un array suelto copiado en cada fila
/// del catálogo. Añadir aquí cuando se cure una ruta real nueva; ver `docs/22-plantillas-de-
/// movimiento.md` para el criterio de cuándo curar una específica en vez de dejar la general.
export const SPECIFIC_MOVEMENT_TEMPLATES: Record<string, { x: number; y: number }[]> = {
  // Cruzavientos sobre los Pilares Rotos (2026-09-17) — la imagen real de la zona
  // (uploads/images/zona/pilares-rotos-mapa.png) muestra 3 columnas de roca altas con puentes
  // colgantes entre ellas; la bio del catálogo ya dice "vuela alto y en círculos... anida en lo
  // alto de los Pilares Rotos". En vez del anillo genérico de `ORBITA_AEREA` (radio fijo alrededor
  // de un único origen), esta ruta sobrevuela las 3 columnas de verdad — coherente con la propia
  // imagen del mapa, no solo con el lore de texto. Nido real en (400,140); columnas laterales
  // aproximadas por la posición de los recursos minerales de catálogo (roca ~220, veta de hierro
  // ~560) que marcan la base de cada pilar lateral.
  'cruzavientos-pilares-rotos': [
    { x: 400, y: 140 }, // nido, columna central
    { x: 300, y: 200 },
    { x: 220, y: 280 }, // sobre la columna izquierda
    { x: 300, y: 360 },
    { x: 400, y: 420 },
    { x: 500, y: 360 },
    { x: 580, y: 280 }, // sobre la columna derecha
    { x: 500, y: 200 },
  ],
};

/// Único punto de entrada que el resto del motor (`zonePoints.ts`) necesita conocer — resuelve
/// específica → general, con `ESTATICO` como piso de seguridad si la específica nombrada no existe
/// en el catálogo (nunca revienta por un nombre mal escrito en worldCatalog.ts).
export function siguienteCeldaDeZonePoint(params: {
  plantillaEspecifica: string | null;
  npc: NpcMovementInferenceInput | null;
  actual: Celda;
  origen: Celda;
  pasoRuta: number;
  gridCols: number;
  gridRows: number;
  random?: () => number;
}): { celda: Celda; nuevoPasoRuta: number } {
  const { plantillaEspecifica, npc, actual, origen, pasoRuta, gridCols, gridRows } = params;
  const random = params.random ?? Math.random;

  if (plantillaEspecifica) {
    const ruta = SPECIFIC_MOVEMENT_TEMPLATES[plantillaEspecifica];
    if (ruta && ruta.length > 0) {
      const rutaCeldas = ruta.map((p) => celdaDePixel(p));
      const siguiente = (pasoRuta + 1) % rutaCeldas.length;
      return { celda: rutaCeldas[siguiente], nuevoPasoRuta: siguiente };
    }
    // Nombre sin entrada real en el catálogo — piso de seguridad determinista, nunca revienta.
    return { celda: origen, nuevoPasoRuta: pasoRuta };
  }

  const plantillaGeneral = npc ? generalMovementTemplateFor(npc) : 'TERRITORIO_CORTO';
  return siguienteCeldaPlantillaGeneral(plantillaGeneral, actual, origen, pasoRuta, gridCols, gridRows, random);
}
