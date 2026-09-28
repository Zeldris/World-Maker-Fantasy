import { describe, it, expect } from 'vitest';
import { proximaCantidadPara, zonePointColorFor, zonePointActivoAhora, reconciliarGrupos, type ZonePointRow } from './zonePoints.js';

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

// Grupos de fauna reales en el mapa (2026-09-28, Fase 1 de `plan-mecanicas-por-zona-2026-09-28.md`,
// B26) — `reconciliarGrupos` es el cálculo puro que traduce "cuánta población hay ahora" en qué
// filas de un mismo `targetSlug` cambian/se crean/se borran. El índice 0 de `cantidadesActuales`
// es SIEMPRE la fila ancla.
describe('reconciliarGrupos', () => {
  it('primer reparto (ninguna fila con lastUpdatedAtMinutes): repartirEnGrupos(objetivo) completo — la primera cantidad va al ancla, el resto son filas nuevas', () => {
    // random() >= 0.5 → 2 grupos por capa (ver repartirEnGrupos): total=20 -> [4,4,3,3,2,2,1,1]
    const resultado = reconciliarGrupos([20], 20, true, () => 0.9);
    expect(resultado.actualizar).toEqual([{ index: 0, cantidad: 4 }]);
    expect(resultado.borrar).toEqual([]);
    expect(resultado.crear).toEqual([4, 3, 3, 2, 2, 1, 1]);
    // La suma de ancla + creadas sigue siendo el objetivo completo.
    const total = resultado.actualizar[0].cantidad + resultado.crear.reduce((a, b) => a + b, 0);
    expect(total).toBe(20);
  });

  it('primer reparto con objetivo 0: el ancla queda a cantidad 0 (el caller la marca activo:false), sin crear nada', () => {
    const resultado = reconciliarGrupos([20], 0, true);
    expect(resultado).toEqual({ actualizar: [{ index: 0, cantidad: 0 }], borrar: [], crear: [] });
  });

  it('población sube (ya repartida en grupos): añade filas nuevas con repartirEnGrupos(diferencia), nunca toca las filas existentes', () => {
    // 3 filas ya repartidas (ancla=4, +3, +2 = total 9), sube a 12 -> diferencia 3, un único grupo suelto.
    const resultado = reconciliarGrupos([4, 3, 2], 12, false, () => 0.1);
    expect(resultado.actualizar).toEqual([]);
    expect(resultado.borrar).toEqual([]);
    expect(resultado.crear).toEqual([3]);
  });

  it('población baja: resta primero de los grupos MÁS PEQUEÑOS, borrando los que llegan a 0 (el ancla nunca se borra)', () => {
    // Ancla=4 (índice 0), grupos de 3 y 2 (índices 1 y 2). Total 9 -> objetivo 3: hay que quitar 6.
    // Orden de resta (más pequeño primero): índice 2 (2) -> queda 0, se borra; índice 1 (3) -> queda
    // 0, se borra; índice 0 (4) -> quedan 4 restantes por quitar pero solo hacían falta 6-2-3=1, así
    // que queda en 3 (ancla nunca se borra, aunque fuera el más pequeño de todos habría absorbido más).
    const resultado = reconciliarGrupos([4, 3, 2], 3, false);
    expect(resultado.borrar.sort()).toEqual([1, 2]);
    // Las filas que se borran NO se actualizan además (2026-09-28: ambas operaciones corrían en
    // paralelo y el update fallaba sobre la fila ya borrada).
    expect(resultado.actualizar).toEqual([{ index: 0, cantidad: 3 }]);
    expect(resultado.crear).toEqual([]);
  });

  it('población baja hasta 0 exactamente: el ancla queda a cantidad 0 pero nunca aparece en `borrar`', () => {
    const resultado = reconciliarGrupos([4, 3, 2], 0, false);
    expect(resultado.borrar).not.toContain(0);
    expect(resultado.actualizar).toContainEqual({ index: 0, cantidad: 0 });
    const totalFinal = [4, 3, 2].reduce(
      (acc, cantidadOriginal, index) =>
        acc + (resultado.borrar.includes(index) ? 0 : (resultado.actualizar.find((a) => a.index === index)?.cantidad ?? cantidadOriginal)),
      0,
    );
    expect(totalFinal).toBe(0);
  });

  it('sin diferencia (objetivo === total actual), no cambia ni crea ni borra nada', () => {
    expect(reconciliarGrupos([4, 3, 2], 9, false)).toEqual({ actualizar: [], borrar: [], crear: [] });
  });

  it('ningún grupo creado supera 4 (lo garantiza repartirEnGrupos, reutilizado tal cual)', () => {
    const resultado = reconciliarGrupos([1], 20, true, () => 0.9);
    for (const cantidad of resultado.crear) expect(cantidad).toBeLessThanOrEqual(4);
    expect(resultado.actualizar[0].cantidad).toBeLessThanOrEqual(4);
  });
});
