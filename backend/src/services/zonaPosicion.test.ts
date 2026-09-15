import { describe, it, expect } from 'vitest';
import {
  puntoDeEntradaParaDireccion,
  direccionDeEntrada,
  posicionAleatoriaEnLienzo,
  minutoDeReaparicion,
  MINUTOS_AUSENCIA_TRAS_DERROTA,
  LIENZO_ANCHO,
  LIENZO_ALTO,
  distanciaEnLienzo,
  zonePointMasCercano,
  RADIO_INTERACCION_PX,
  CELL_SIZE_PX,
  GRID_COLS,
  GRID_ROWS,
  celdaDePixel,
  pixelDeCelda,
  mismaCelda,
  celdaAdyacenteOMisma,
  calcularCamino,
  siguienteCeldaPaseoAleatorio,
  siguienteCeldaEnRuta,
  repartirEnGrupos,
} from './zonaPosicion.js';

describe('puntoDeEntradaParaDireccion', () => {
  it('norte entra por arriba (y pequeño), centrado en x', () => {
    expect(puntoDeEntradaParaDireccion('norte')).toEqual({ x: 400, y: 24 });
  });

  it('sur entra por abajo (y grande), centrado en x', () => {
    expect(puntoDeEntradaParaDireccion('sur')).toEqual({ x: 400, y: 576 });
  });

  it('este entra por la derecha, centrado en y', () => {
    expect(puntoDeEntradaParaDireccion('este')).toEqual({ x: 776, y: 300 });
  });

  it('oeste entra por la izquierda, centrado en y', () => {
    expect(puntoDeEntradaParaDireccion('oeste')).toEqual({ x: 24, y: 300 });
  });

  it('las 4 diagonales usan la esquina correspondiente, no un punto medio', () => {
    expect(puntoDeEntradaParaDireccion('noreste')).toEqual({ x: 760, y: 40 });
    expect(puntoDeEntradaParaDireccion('noroeste')).toEqual({ x: 40, y: 40 });
    expect(puntoDeEntradaParaDireccion('sureste')).toEqual({ x: 760, y: 560 });
    expect(puntoDeEntradaParaDireccion('suroeste')).toEqual({ x: 40, y: 560 });
  });

  // Bug real, sesión autónoma de pruebas con Playwright (2026-09-04): el marcador del jugador
  // (halo circular de radio 14, ZonaPanel.tsx) quedaba cortado a la mitad contra la esquina
  // REDONDEADA del contenedor en las 4 diagonales — un margen igual al de los bordes rectos no
  // basta cuando el marcador toca DOS bordes a la vez. Las diagonales deben usar un margen mayor.
  it('las 4 diagonales usan un margen mayor que los 4 bordes rectos (evita el corte contra la esquina redondeada del contenedor)', () => {
    const margenRecto = puntoDeEntradaParaDireccion('norte').y;
    const margenDiagonal = puntoDeEntradaParaDireccion('noroeste').x;
    expect(margenDiagonal).toBeGreaterThan(margenRecto);
  });

  it('todos los puntos quedan dentro del lienzo 800x600', () => {
    const direcciones = ['norte', 'sur', 'este', 'oeste', 'noreste', 'noroeste', 'sureste', 'suroeste'] as const;
    for (const d of direcciones) {
      const p = puntoDeEntradaParaDireccion(d);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(LIENZO_ANCHO);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(LIENZO_ALTO);
    }
  });
});

describe('direccionDeEntrada', () => {
  it('es la opuesta de la dirección de viaje — si el destino está al norte, se entra por el sur', () => {
    expect(direccionDeEntrada('norte')).toBe('sur');
    expect(direccionDeEntrada('sur')).toBe('norte');
    expect(direccionDeEntrada('este')).toBe('oeste');
    expect(direccionDeEntrada('oeste')).toBe('este');
  });

  it('las diagonales también se invierten', () => {
    expect(direccionDeEntrada('noreste')).toBe('suroeste');
    expect(direccionDeEntrada('suroeste')).toBe('noreste');
    expect(direccionDeEntrada('noroeste')).toBe('sureste');
    expect(direccionDeEntrada('sureste')).toBe('noroeste');
  });

  it('aplicar la función dos veces devuelve la dirección original (involución)', () => {
    const direcciones = ['norte', 'sur', 'este', 'oeste', 'noreste', 'noroeste', 'sureste', 'suroeste'] as const;
    for (const d of direcciones) {
      expect(direccionDeEntrada(direccionDeEntrada(d))).toBe(d);
    }
  });
});

describe('posicionAleatoriaEnLienzo', () => {
  it('sin puntos ocupados, con random fijo, cae en el centro esperado', () => {
    expect(posicionAleatoriaEnLienzo([], () => 0.5)).toEqual({ x: 400, y: 300 });
  });

  it('evita una posición que colisiona con un punto ya ocupado', () => {
    // Primer intento (random=0.5) cae en el centro exacto (400,300), que coincide con `ocupadas`.
    // El segundo intento (random=0.9) debe usarse en su lugar.
    const secuencia = [0.5, 0.5, 0.9, 0.9];
    let i = 0;
    const random = () => secuencia[i++];
    const resultado = posicionAleatoriaEnLienzo([{ x: 400, y: 300 }], random);
    expect(resultado).not.toEqual({ x: 400, y: 300 });
    const distancia = Math.hypot(resultado.x - 400, resultado.y - 300);
    expect(distancia).toBeGreaterThanOrEqual(60);
  });

  it('con los 8 intentos agotados, no bloquea: devuelve el último candidato probado', () => {
    // random siempre devuelve el mismo valor que coincide con el punto ocupado — nunca hay hueco.
    const resultado = posicionAleatoriaEnLienzo([{ x: 400, y: 300 }], () => 0.5);
    expect(resultado).toEqual({ x: 400, y: 300 });
  });

  it('el resultado siempre queda dentro del margen del lienzo', () => {
    const resultado = posicionAleatoriaEnLienzo([], () => 0);
    expect(resultado.x).toBeGreaterThanOrEqual(24);
    expect(resultado.y).toBeGreaterThanOrEqual(24);
  });
});

describe('minutoDeReaparicion', () => {
  it('suma 6 horas de tiempo de ficción (360 minutos) al minuto actual', () => {
    expect(minutoDeReaparicion(1000)).toBe(1360);
    expect(MINUTOS_AUSENCIA_TRAS_DERROTA).toBe(360);
  });
});

describe('distanciaEnLienzo', () => {
  it('distancia euclidiana simple (triángulo 3-4-5)', () => {
    expect(distanciaEnLienzo({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('0 para el mismo punto', () => {
    expect(distanciaEnLienzo({ x: 100, y: 200 }, { x: 100, y: 200 })).toBe(0);
  });
});

describe('zonePointMasCercano (gate de proximidad de "Interactuar", 2026-09-08)', () => {
  it('null si el jugador no tiene posición conocida (partida previa a esta pieza)', () => {
    expect(zonePointMasCercano(null, [{ x: 400, y: 300, slug: 'a' }])).toBeNull();
  });

  it('null si no hay candidatos', () => {
    expect(zonePointMasCercano({ x: 400, y: 300 }, [])).toBeNull();
  });

  it('null si el candidato más cercano está fuera del radio (100px por defecto)', () => {
    const candidatos = [{ x: 400, y: 300, slug: 'lejos' }];
    // distancia real = 150px, > RADIO_INTERACCION_PX
    expect(zonePointMasCercano({ x: 400, y: 450 }, candidatos)).toBeNull();
  });

  it('devuelve el candidato dentro del radio', () => {
    const candidatos = [{ x: 400, y: 300, slug: 'cerca' }];
    // distancia real = 50px, < RADIO_INTERACCION_PX
    expect(zonePointMasCercano({ x: 400, y: 350 }, candidatos)?.slug).toBe('cerca');
  });

  it('exactamente en el borde del radio SÍ cuenta (<=, no <)', () => {
    const candidatos = [{ x: 400, y: 300, slug: 'borde' }];
    expect(zonePointMasCercano({ x: 400, y: 400 }, candidatos, 100)?.slug).toBe('borde');
  });

  it('"el más cercano gana" — caso real de campamento-serhu-interior (varios candidatos dentro del radio a la vez)', () => {
    // Réplica de la distribución real más densa del catálogo: 2 puntos a solo 80px entre sí,
    // ambos alcanzables desde la misma posición del jugador si el radio no desempatara.
    const candidatos = [
      { x: 400, y: 300, slug: 'punto-a' },
      { x: 400, y: 380, slug: 'punto-b' }, // 80px de punto-a
    ];
    // Jugador a 30px de punto-a y 50px de punto-b — ambos dentro de RADIO_INTERACCION_PX (100),
    // pero solo UNO debe devolverse, nunca ambos ni un empate ambiguo.
    const resultado = zonePointMasCercano({ x: 400, y: 330 }, candidatos);
    expect(resultado?.slug).toBe('punto-a');
  });

  it('RADIO_INTERACCION_PX es 100 — calibrado contra el catálogo real (2026-09-08)', () => {
    expect(RADIO_INTERACCION_PX).toBe(100);
  });
});

describe('Sistema de movimiento por cuadrícula (2026-09-08, diseño "estilo Mount & Blade")', () => {
  it('CELL_SIZE_PX=50 da una cuadrícula 16×12 sobre el lienzo 800×600', () => {
    expect(CELL_SIZE_PX).toBe(50);
    expect(GRID_COLS).toBe(16);
    expect(GRID_ROWS).toBe(12);
  });

  describe('celdaDePixel / pixelDeCelda', () => {
    it('convierte un píxel a su celda (esquina superior izquierda de la cuadrícula)', () => {
      expect(celdaDePixel({ x: 0, y: 0 })).toEqual({ col: 0, row: 0 });
    });

    it('convierte un píxel a su celda (centro del lienzo)', () => {
      expect(celdaDePixel({ x: 400, y: 300 })).toEqual({ col: 8, row: 6 });
    });

    it('clampa píxeles en el borde exacto/fuera de rango a la última celda válida', () => {
      expect(celdaDePixel({ x: 799, y: 599 })).toEqual({ col: 15, row: 11 });
      expect(celdaDePixel({ x: 800, y: 600 })).toEqual({ col: 15, row: 11 });
      expect(celdaDePixel({ x: -5, y: -5 })).toEqual({ col: 0, row: 0 });
    });

    it('pixelDeCelda devuelve el CENTRO de la celda, no la esquina', () => {
      expect(pixelDeCelda({ col: 0, row: 0 })).toEqual({ x: 25, y: 25 });
      expect(pixelDeCelda({ col: 8, row: 6 })).toEqual({ x: 425, y: 325 });
    });

    it('celdaDePixel(pixelDeCelda(c)) es la identidad — ida y vuelta consistente', () => {
      const celda = { col: 5, row: 3 };
      expect(celdaDePixel(pixelDeCelda(celda))).toEqual(celda);
    });
  });

  // Hallazgo de deuda técnica (2026-09-15): única de las 18 funciones puras de este archivo sin
  // cobertura directa, pese a tener 3 call-sites reales incluido el gate de colisión de combate en
  // Zona (`turnResolution.ts`, filtra `npcsInSceneVivosParaCombate` por `mismaCelda` real).
  describe('mismaCelda — umbral EXACTO (distinto de celdaAdyacenteOMisma, que también acepta vecinas)', () => {
    it('la misma celda exacta devuelve true', () => {
      expect(mismaCelda({ col: 5, row: 5 }, { col: 5, row: 5 })).toBe(true);
    });

    it('cualquier celda vecina (incluidas las 8 adyacentes) devuelve false — a diferencia de celdaAdyacenteOMisma', () => {
      expect(mismaCelda({ col: 5, row: 5 }, { col: 6, row: 5 })).toBe(false);
      expect(mismaCelda({ col: 5, row: 5 }, { col: 5, row: 6 })).toBe(false);
      expect(mismaCelda({ col: 5, row: 5 }, { col: 6, row: 6 })).toBe(false);
    });

    it('coincidir solo en col o solo en row (sin ser la misma celda) devuelve false', () => {
      expect(mismaCelda({ col: 5, row: 5 }, { col: 5, row: 9 })).toBe(false);
      expect(mismaCelda({ col: 5, row: 5 }, { col: 9, row: 5 })).toBe(false);
    });
  });

  describe('celdaAdyacenteOMisma — base del doble umbral de colisión', () => {
    it('la misma celda cuenta como adyacente (incluye el caso exacto)', () => {
      expect(celdaAdyacenteOMisma({ col: 5, row: 5 }, { col: 5, row: 5 })).toBe(true);
    });

    it('las 8 vecinas cuentan como adyacentes', () => {
      const centro = { col: 5, row: 5 };
      const vecinas = [
        { col: 4, row: 4 }, { col: 5, row: 4 }, { col: 6, row: 4 },
        { col: 4, row: 5 },                     { col: 6, row: 5 },
        { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 },
      ];
      for (const v of vecinas) expect(celdaAdyacenteOMisma(centro, v)).toBe(true);
    });

    it('una celda a distancia 2 NO es adyacente', () => {
      expect(celdaAdyacenteOMisma({ col: 5, row: 5 }, { col: 7, row: 5 })).toBe(false);
      expect(celdaAdyacenteOMisma({ col: 5, row: 5 }, { col: 5, row: 7 })).toBe(false);
    });
  });

  describe('calcularCamino (Bresenham) — el motor decide el camino, el jugador solo el destino', () => {
    it('camino horizontal simple: un paso por celda, sin saltos', () => {
      const camino = calcularCamino({ col: 0, row: 0 }, { col: 3, row: 0 });
      expect(camino).toEqual([{ col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }]);
    });

    it('camino vertical simple', () => {
      const camino = calcularCamino({ col: 0, row: 0 }, { col: 0, row: 3 });
      expect(camino).toEqual([{ col: 0, row: 1 }, { col: 0, row: 2 }, { col: 0, row: 3 }]);
    });

    it('camino diagonal exacto: cada paso avanza 1 celda en cada eje, nunca salta dos', () => {
      const camino = calcularCamino({ col: 0, row: 0 }, { col: 3, row: 3 });
      expect(camino).toEqual([{ col: 1, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 3 }]);
    });

    it('origen y destino iguales: camino vacío', () => {
      expect(calcularCamino({ col: 5, row: 5 }, { col: 5, row: 5 })).toEqual([]);
    });

    it('ningún paso del camino avanza más de 1 celda por eje respecto al anterior (invariante Bresenham)', () => {
      const origen = { col: 2, row: 1 };
      const destino = { col: 14, row: 9 };
      const camino = calcularCamino(origen, destino);
      let anterior = origen;
      for (const paso of camino) {
        expect(Math.abs(paso.col - anterior.col)).toBeLessThanOrEqual(1);
        expect(Math.abs(paso.row - anterior.row)).toBeLessThanOrEqual(1);
        anterior = paso;
      }
      expect(camino[camino.length - 1]).toEqual(destino);
    });
  });

  describe('siguienteCeldaPaseoAleatorio — fallback sin ruta artesanal', () => {
    it('nunca se aleja más de RADIO_PASEO_ALEATORIO_CELDAS (2) de la celda de origen', () => {
      const origen = { col: 8, row: 6 };
      let actual = origen;
      for (let i = 0; i < 50; i++) {
        actual = siguienteCeldaPaseoAleatorio(actual, origen, Math.random);
        expect(Math.abs(actual.col - origen.col)).toBeLessThanOrEqual(2);
        expect(Math.abs(actual.row - origen.row)).toBeLessThanOrEqual(2);
      }
    });

    it('nunca sale de los límites de la cuadrícula, aunque el origen esté en el borde', () => {
      const origen = { col: 0, row: 0 };
      let actual = origen;
      for (let i = 0; i < 50; i++) {
        actual = siguienteCeldaPaseoAleatorio(actual, origen, Math.random);
        expect(actual.col).toBeGreaterThanOrEqual(0);
        expect(actual.row).toBeGreaterThanOrEqual(0);
      }
    });

    it('con random()=0, el primer candidato es "quedarse quieto" (delta {0,0}) — determinista', () => {
      const origen = { col: 5, row: 5 };
      const resultado = siguienteCeldaPaseoAleatorio(origen, origen, () => 0);
      expect(resultado).toEqual({ col: 5, row: 5 });
    });
  });

  describe('siguienteCeldaEnRuta — ruta artesanal en bucle', () => {
    it('avanza al siguiente paso de la ruta', () => {
      const ruta = [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }];
      expect(siguienteCeldaEnRuta(ruta, 0)).toEqual({ celda: { col: 2, row: 1 }, nuevoPasoRuta: 1 });
    });

    it('vuelve al primer punto de la ruta al llegar al final (bucle)', () => {
      const ruta = [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }];
      expect(siguienteCeldaEnRuta(ruta, 2)).toEqual({ celda: { col: 1, row: 1 }, nuevoPasoRuta: 0 });
    });

    it('ruta de un solo punto se queda siempre en el mismo sitio', () => {
      const ruta = [{ col: 5, row: 5 }];
      expect(siguienteCeldaEnRuta(ruta, 0)).toEqual({ celda: { col: 5, row: 5 }, nuevoPasoRuta: 0 });
    });
  });

  describe('repartirEnGrupos — validado contra los números reales acordados con la usuaria (2026-09-08)', () => {
    it('población 0 no da ningún grupo', () => {
      expect(repartirEnGrupos(0)).toEqual([]);
    });

    it('cada reparto suma exactamente la población total, para un rango realista de valores', () => {
      for (let total = 1; total <= 20; total++) {
        const grupos = repartirEnGrupos(total);
        expect(grupos.reduce((a, b) => a + b, 0)).toBe(total);
      }
    });

    it('ningún grupo individual supera TAMANO_MAXIMO_GRUPO (4)', () => {
      for (let total = 1; total <= 20; total++) {
        const grupos = repartirEnGrupos(total);
        for (const g of grupos) expect(g).toBeLessThanOrEqual(4);
      }
    });

    it('población pequeña (1-3) da un único grupo suelto, sin fragmentar de más', () => {
      expect(repartirEnGrupos(1)).toEqual([1]);
      expect(repartirEnGrupos(2)).toEqual([2]);
      expect(repartirEnGrupos(3)).toEqual([3]);
    });

    it('con random() que siempre elige 2 grupos por capa, total=20 da la variedad completa de tamaños citada por la usuaria', () => {
      // random() < 0.5 → 1 grupo; en caso contrario → 2 grupos por capa (ver repartirEnGrupos).
      const grupos = repartirEnGrupos(20, () => 0.9);
      expect(grupos).toEqual([4, 4, 3, 3, 2, 2, 1, 1]);
    });

    it('con random() que siempre elige 1 grupo por capa, el resto tras agotar tamaños se reparte en unidades sueltas (nunca se pierde población)', () => {
      const grupos = repartirEnGrupos(20, () => 0.1);
      expect(grupos).toEqual([4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      expect(grupos.reduce((a, b) => a + b, 0)).toBe(20);
    });
  });
});
