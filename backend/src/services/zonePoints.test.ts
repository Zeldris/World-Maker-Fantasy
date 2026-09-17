import { describe, it, expect } from 'vitest';
import { proximaCantidadPara, zonePointColorFor, zonePointActivoAhora, type ZonePointRow } from './zonePoints.js';

function puntoBase(overrides: Partial<ZonePointRow> = {}): ZonePointRow {
  return {
    id: 'punto-1',
    tipo: 'FAUNA',
    targetSlug: 'murgol',
    cantidad: 5,
    activo: true,
    lastUpdatedAtMinutes: 0,
    ...overrides,
  };
}

describe('proximaCantidadPara', () => {
  it('primera vez (lastUpdatedAtMinutes null) adopta el objetivo directamente, sin límite diario', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: null, cantidad: 1 });
    expect(proximaCantidadPara(punto, 12, 480)).toEqual({ cantidad: 12, activo: true });
  });

  it('objetivo 0 en la primera vez marca el punto inactivo', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: null });
    expect(proximaCantidadPara(punto, 0, 480)).toEqual({ cantidad: 0, activo: false });
  });

  it('sin minutos transcurridos, no cambia nada (evita recalculo redundante en el mismo turno)', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 480, cantidad: 5, activo: true });
    expect(proximaCantidadPara(punto, 20, 480)).toEqual({ cantidad: 5, activo: true });
  });

  it('un día completo transcurrido ajusta hasta AJUSTE_MAXIMO_POR_DIA (3) hacia el objetivo', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 5 });
    // 24h después, objetivo 20 -> el delta (15) supera el máximo diario (3), se limita a +3
    expect(proximaCantidadPara(punto, 20, 24 * 60)).toEqual({ cantidad: 8, activo: true });
  });

  it('ajuste hacia abajo también respeta el tope diario', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 10 });
    expect(proximaCantidadPara(punto, 0, 24 * 60)).toEqual({ cantidad: 7, activo: true });
  });

  it('una acción corta (fracción de día) mueve una fracción proporcional, redondeada al entero más cercano', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 5 });
    // 12h (medio día) -> ajusteMaximo = round(3 * 0.5) = 2 (mínimo 1 si el resultado fuera 0)
    expect(proximaCantidadPara(punto, 20, 12 * 60)).toEqual({ cantidad: 7, activo: true });
  });

  it('descender a 0 exactamente marca el punto inactivo', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 2 });
    expect(proximaCantidadPara(punto, 0, 24 * 60)).toEqual({ cantidad: 0, activo: false });
  });

  it('objetivo por encima de CANTIDAD_MAX_POR_PUNTO (20) se recorta antes de comparar', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 18 });
    expect(proximaCantidadPara(punto, 400, 24 * 60)).toEqual({ cantidad: 20, activo: true });
  });

  it('ya en el objetivo, no cambia aunque pase tiempo', () => {
    const punto = puntoBase({ lastUpdatedAtMinutes: 0, cantidad: 20 });
    expect(proximaCantidadPara(punto, 20, 24 * 60)).toEqual({ cantidad: 20, activo: true });
  });
});

// Corrección de diseño real (2026-09-09, Álvaro: "el color de sin facción solo se debe aplicar en
// npc/fauna/construcciones... sino debe utilizar [uno propio], ya que el resto de elementos no
// dependen de facción") — RECURSO nunca tiene facción por DISEÑO (INERTE, gris), distinto de un
// NPC/FAUNA/EDIFICIO que podría tenerla pero no la tiene ahora mismo (SIN_FACCION, naranja).
describe('zonePointColorFor', () => {
  it('sin facción, RECURSO cae en INERTE (nunca tiene facción por diseño)', () => {
    expect(zonePointColorFor(null, {}, 'RECURSO')).toBe('INERTE');
  });

  it('sin facción, FAUNA/NPC/EDIFICIO caen en SIN_FACCION (podrían tener facción, no la tienen ahora)', () => {
    expect(zonePointColorFor(null, {}, 'FAUNA')).toBe('SIN_FACCION');
    expect(zonePointColorFor(null, {}, 'NPC')).toBe('SIN_FACCION');
    expect(zonePointColorFor(null, {}, 'EDIFICIO')).toBe('SIN_FACCION');
  });

  it('con facción real, el tipo no importa — el color sigue siendo por reputación (ALIADO/NEUTRO/ENEMIGO)', () => {
    expect(zonePointColorFor('clan-serhu', { 'clan-serhu': 3500 }, 'RECURSO')).toBe('ALIADO');
    expect(zonePointColorFor('clan-serhu', { 'clan-serhu': 500 }, 'FAUNA')).toBe('ENEMIGO');
    expect(zonePointColorFor('clan-serhu', { 'clan-serhu': 2500 }, 'NPC')).toBe('NEUTRO');
  });
});

// Fauna diurna/nocturna (2026-09-17, bug real jugando en vivo — Álvaro: "está apareciendo un
// kirelon todo el rato que no se está representando con icono... y sin abrir combate") — antes
// `faunaMomentoDelDia` solo se aplicaba en `GET /zona` (render); `detectarEncuentroEnCelda`
// (colisión) y `avanzarZonePointsUnPaso` (movimiento/persecución) lo ignoraban, así que un Kirelon
// nocturno seguía colisionando/persiguiendo de pleno día, invisible en el mapa.
describe('zonePointActivoAhora', () => {
  it('un Kirelon Arenoso (nocturno) está activo de noche, no de día', () => {
    expect(zonePointActivoAhora('kirelon-arenoso', 'noche')).toBe(true);
    expect(zonePointActivoAhora('kirelon-arenoso', 'dia')).toBe(false);
  });

  it('una especie sin entrada en faunaMomentoDelDia nunca se filtra por hora (sin dato = sin filtrar)', () => {
    expect(zonePointActivoAhora('especie-sin-horario-conocido', 'dia')).toBe(true);
    expect(zonePointActivoAhora('especie-sin-horario-conocido', 'noche')).toBe(true);
  });
});
