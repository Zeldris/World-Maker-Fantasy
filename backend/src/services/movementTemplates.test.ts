import { describe, it, expect } from 'vitest';
import {
  generalMovementTemplateFor,
  siguienteCeldaPlantillaGeneral,
  siguienteCeldaDeZonePoint,
  SPECIFIC_MOVEMENT_TEMPLATES,
  type NpcMovementInferenceInput,
} from './movementTemplates.js';
import { celdaDePixel, GRID_COLS, GRID_ROWS } from './zonaPosicion.js';

const npcBase: NpcMovementInferenceInput = {
  kind: 'PLANTILLA',
  role: 'Fauna salvaje',
  temperamento: 'CAUTELOSO',
  faunaCategoria: null,
  medio: ['TERRESTRE'],
};

describe('generalMovementTemplateFor — inferencia por lore real', () => {
  it('AEREO (cualquier faunaCategoria) siempre cae en ORBITA_AEREA — "vuela alto y en círculos" (Cruzavientos, bio real)', () => {
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'ACECHANTES', medio: ['AEREO'] })).toBe('ORBITA_AEREA');
  });

  it('GUELISES/BESTIONES/ZANCUDOS → MANADA_AMPLIA — "caza en jaurías"/"se desplaza en manadas" (Aullador Rojo, Corredor de Cauce)', () => {
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'GUELISES' })).toBe('MANADA_AMPLIA');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'BESTIONES' })).toBe('MANADA_AMPLIA');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'ZANCUDOS' })).toBe('MANADA_AMPLIA');
  });

  it('ACECHANTES/QUITINOS/ESCAMADOS/RONDINES/NADANTES → TERRITORIO_CORTO — depredadores solitarios, madrigueras, fauna de charca sedentaria', () => {
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'ACECHANTES' })).toBe('TERRITORIO_CORTO');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'QUITINOS' })).toBe('TERRITORIO_CORTO');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'ESCAMADOS' })).toBe('TERRITORIO_CORTO');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'RONDINES' })).toBe('TERRITORIO_CORTO');
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'NADANTES' })).toBe('TERRITORIO_CORTO');
  });

  it('CORVENES sin medio AEREO poblado (desalineación real de catálogo) sigue cayendo en ORBITA_AEREA por lore, no por el campo medio', () => {
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'CORVENES', medio: ['TERRESTRE'] })).toBe('ORBITA_AEREA');
  });

  it('role con "guardia"/"patrulla"/"vigilan"/"centinela" (sin faunaCategoria) → PATRULLA_BREVE', () => {
    expect(generalMovementTemplateFor({ ...npcBase, role: 'Guardia de las murallas del campamento' })).toBe('PATRULLA_BREVE');
    expect(generalMovementTemplateFor({ ...npcBase, role: 'Oficial al mando de una patrulla' })).toBe('PATRULLA_BREVE');
    expect(generalMovementTemplateFor({ ...npcBase, role: 'Vigilante de la entrada norte' })).toBe('PATRULLA_BREVE');
  });

  it('role con "Maestro"/título de mando (Kort\'ikar/Terk\'ikar/Mesok\'ikar) → ESTATICO', () => {
    expect(generalMovementTemplateFor({ ...npcBase, role: 'Maestro Herrero del Clan Serhu' })).toBe('ESTATICO');
    expect(generalMovementTemplateFor({ ...npcBase, role: "Kort'ikar del Clan Serhu" })).toBe('ESTATICO');
    expect(generalMovementTemplateFor({ ...npcBase, role: "Terk'ikar del Clan Helsig" })).toBe('ESTATICO');
  });

  it('sin ninguna señal especial (fauna genérica sin categoría, NPC sin rol de guardia/maestro) → TERRITORIO_CORTO, el piso de seguridad', () => {
    expect(generalMovementTemplateFor({ ...npcBase, role: 'Comerciante ambulante' })).toBe('TERRITORIO_CORTO');
  });

  it('faunaCategoria gana sobre un role que también matchearía guardia/maestro — la señal de fauna es más específica', () => {
    expect(generalMovementTemplateFor({ ...npcBase, faunaCategoria: 'GUELISES', role: 'Guardián de la manada' })).toBe('MANADA_AMPLIA');
  });
});

describe('siguienteCeldaPlantillaGeneral — mecánica de cada plantilla', () => {
  const origen = { col: 5, row: 5 };

  it('ESTATICO siempre devuelve la celda de origen, sin importar la celda actual ni el random', () => {
    const lejos = { col: 0, row: 0 };
    const { celda, nuevoPasoRuta } = siguienteCeldaPlantillaGeneral('ESTATICO', lejos, origen, 3, GRID_COLS, GRID_ROWS, () => 0.99);
    expect(celda).toEqual(origen);
    expect(nuevoPasoRuta).toBe(3);
  });

  it('TERRITORIO_CORTO nunca se aleja más de 1 celda del origen en ningún eje', () => {
    let actual = origen;
    for (let i = 0; i < 30; i++) {
      const { celda } = siguienteCeldaPlantillaGeneral('TERRITORIO_CORTO', actual, origen, 0, GRID_COLS, GRID_ROWS, Math.random);
      expect(Math.abs(celda.col - origen.col)).toBeLessThanOrEqual(1);
      expect(Math.abs(celda.row - origen.row)).toBeLessThanOrEqual(1);
      actual = celda;
    }
  });

  it('MANADA_AMPLIA se aleja más que TERRITORIO_CORTO — al menos una vez alcanza distancia 2+ en 40 pasos con random real', () => {
    let actual = origen;
    let maxDistancia = 0;
    for (let i = 0; i < 40; i++) {
      const { celda } = siguienteCeldaPlantillaGeneral('MANADA_AMPLIA', actual, origen, 0, GRID_COLS, GRID_ROWS, Math.random);
      maxDistancia = Math.max(maxDistancia, Math.abs(celda.col - origen.col), Math.abs(celda.row - origen.row));
      actual = celda;
    }
    expect(maxDistancia).toBeGreaterThanOrEqual(2);
  });

  it('PATRULLA_BREVE es determinista (no usa random) y vuelve exactamente al origen tras completar un periodo', () => {
    let celda = origen;
    let pasoRuta = 0;
    const periodo = 8; // radio 2 → tramo 4 → periodo 8
    // periodo + 1 llamadas: la función devuelve la celda del paso YA calculado antes de avanzar
    // pasoRuta, así que hace falta una llamada extra para volver a ver el offset 0 del origen.
    for (let i = 0; i < periodo + 1; i++) {
      const resultado = siguienteCeldaPlantillaGeneral('PATRULLA_BREVE', celda, origen, pasoRuta, GRID_COLS, GRID_ROWS);
      celda = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
    }
    expect(celda).toEqual(origen);
    expect(pasoRuta).toBe(1);
  });

  it('PATRULLA_BREVE nunca se aleja más del radio configurado (2 celdas) del origen', () => {
    let celda = origen;
    let pasoRuta = 0;
    for (let i = 0; i < 16; i++) {
      const resultado = siguienteCeldaPlantillaGeneral('PATRULLA_BREVE', celda, origen, pasoRuta, GRID_COLS, GRID_ROWS);
      celda = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
      expect(Math.abs(celda.col - origen.col) <= 2 || Math.abs(celda.row - origen.row) <= 2).toBe(true);
    }
  });

  it('ORBITA_AEREA es determinista y repite la misma secuencia de 8 celdas cada vuelta completa al anillo', () => {
    let celda = origen;
    let pasoRuta = 0;
    const primeraVuelta: { col: number; row: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const resultado = siguienteCeldaPlantillaGeneral('ORBITA_AEREA', celda, origen, pasoRuta, GRID_COLS, GRID_ROWS);
      celda = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
      primeraVuelta.push(celda);
    }
    const segundaVuelta: { col: number; row: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const resultado = siguienteCeldaPlantillaGeneral('ORBITA_AEREA', celda, origen, pasoRuta, GRID_COLS, GRID_ROWS);
      celda = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
      segundaVuelta.push(celda);
    }
    expect(segundaVuelta).toEqual(primeraVuelta);
  });

  it('ORBITA_AEREA nunca coincide con la celda de origen — siempre en el anillo, nunca en el centro', () => {
    let celda = origen;
    let pasoRuta = 0;
    for (let i = 0; i < 8; i++) {
      const resultado = siguienteCeldaPlantillaGeneral('ORBITA_AEREA', celda, origen, pasoRuta, GRID_COLS, GRID_ROWS);
      celda = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
      expect(celda).not.toEqual(origen);
    }
  });
});

describe('plantilla específica real: cruzavientos-pilares-rotos', () => {
  it('sobrevuela las 3 columnas de la imagen real, en bucle, distinto del anillo genérico ORBITA_AEREA', () => {
    const origen = celdaDePixel({ x: 400, y: 140 }); // nido, misma posición que el ZonePoint real
    let actual = origen;
    let pasoRuta = 0;
    const visitadas: { col: number; row: number }[] = [];
    const ruta = SPECIFIC_MOVEMENT_TEMPLATES['cruzavientos-pilares-rotos'];
    for (let i = 0; i < ruta.length; i++) {
      const resultado = siguienteCeldaDeZonePoint({
        plantillaEspecifica: 'cruzavientos-pilares-rotos',
        npc: { ...npcBase, faunaCategoria: 'CORVENES', medio: ['AEREO'] }, // sería ORBITA_AEREA sin la específica
        actual,
        origen,
        pasoRuta,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
      });
      actual = resultado.celda;
      pasoRuta = resultado.nuevoPasoRuta;
      visitadas.push(actual);
    }
    // La ruta real tiene 8 puntos, curados a mano — confirma que se sigue tal cual, no el anillo
    // genérico de 8 vecinas alrededor de un único origen que usaría ORBITA_AEREA. La primera celda
    // visitada es el índice 1 de `ruta` (no el 0, el nido de partida) — mismo desfase que ya usa
    // `siguienteCeldaEnRuta` (zonaPosicion.ts) para cualquier ruta artesanal: `pasoRuta` empieza en
    // 0 apuntando A la posición de origen, así que el primer paso avanza a `(0+1) % length`.
    const rutaEnCeldas = ruta.map((p) => celdaDePixel(p));
    const esperado = [...rutaEnCeldas.slice(1), rutaEnCeldas[0]];
    expect(visitadas).toEqual(esperado);
  });
});

describe('siguienteCeldaDeZonePoint — resolución específica vs. general', () => {
  const actual = celdaDePixel({ x: 100, y: 100 });
  const origen = celdaDePixel({ x: 100, y: 100 });

  it('con plantillaEspecifica real en el catálogo, la usa en vez de inferir la general', () => {
    SPECIFIC_MOVEMENT_TEMPLATES['__test_ruta__'] = [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
    ];
    try {
      const { celda } = siguienteCeldaDeZonePoint({
        plantillaEspecifica: '__test_ruta__',
        npc: { ...npcBase, faunaCategoria: 'GUELISES' }, // General sería MANADA_AMPLIA, pero la específica gana
        actual,
        origen,
        pasoRuta: 0,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
      });
      expect(celda).toEqual(celdaDePixel({ x: 150, y: 100 }));
    } finally {
      delete SPECIFIC_MOVEMENT_TEMPLATES['__test_ruta__'];
    }
  });

  it('con plantillaEspecifica que NO existe en el catálogo (nombre mal escrito), cae en ESTATICO sin reventar', () => {
    const { celda, nuevoPasoRuta } = siguienteCeldaDeZonePoint({
      plantillaEspecifica: 'nombre-inexistente',
      npc: npcBase,
      actual,
      origen,
      pasoRuta: 2,
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
    });
    expect(celda).toEqual(origen);
    expect(nuevoPasoRuta).toBe(2);
  });

  it('sin plantillaEspecifica, usa la general inferida del npc', () => {
    let celda = actual;
    let maxDistancia = 0;
    for (let i = 0; i < 40; i++) {
      const resultado = siguienteCeldaDeZonePoint({
        plantillaEspecifica: null,
        npc: { ...npcBase, faunaCategoria: 'BESTIONES' },
        actual: celda,
        origen,
        pasoRuta: 0,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        random: Math.random,
      });
      celda = resultado.celda;
      maxDistancia = Math.max(maxDistancia, Math.abs(celda.col - origen.col), Math.abs(celda.row - origen.row));
    }
    expect(maxDistancia).toBeGreaterThanOrEqual(2); // MANADA_AMPLIA, no TERRITORIO_CORTO
  });

  it('sin plantillaEspecifica y sin npc conocido (targetSlug huérfano), cae en TERRITORIO_CORTO como piso de seguridad', () => {
    let celda = actual;
    for (let i = 0; i < 20; i++) {
      const resultado = siguienteCeldaDeZonePoint({
        plantillaEspecifica: null,
        npc: null,
        actual: celda,
        origen,
        pasoRuta: 0,
        gridCols: GRID_COLS,
        gridRows: GRID_ROWS,
        random: Math.random,
      });
      celda = resultado.celda;
      expect(Math.abs(celda.col - origen.col)).toBeLessThanOrEqual(1);
      expect(Math.abs(celda.row - origen.row)).toBeLessThanOrEqual(1);
    }
  });
});
