import { describe, it, expect } from 'vitest';
import {
  puntoDeEntradaParaDireccion,
  direccionDeEntrada,
  posicionAleatoriaEnLienzo,
  minutoDeReaparicion,
  MINUTOS_AUSENCIA_TRAS_DERROTA,
  LIENZO_ANCHO,
  LIENZO_ALTO,
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
