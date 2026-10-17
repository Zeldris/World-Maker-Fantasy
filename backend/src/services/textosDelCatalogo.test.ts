import { describe, it, expect } from 'vitest';
import { fauna, npcs } from '../scripts/worldCatalog.js';
import { aNombre, nombreEnFrase, pluralDeEspecie } from './dynamicMode.js';

/// Retro del PR #56: las reglas que escriben nombres para el jugador (plural, artículo, «a quién»)
/// se prueban contra TODOS los nombres del catálogo, no contra unos pocos. `pluralDeEspecie` pasó sus 8
/// tests y daba «Cazadoras Serhus». Si una regla o el catálogo cambian, la instantánea enseña en el
/// diff cada nombre que cambia, para revisarlo a mano antes de aceptarla (`vitest -u`).
describe('textos generados para cada nombre del catálogo', () => {
  // P141: «a quién» con el artículo de catálogo de cada uno («a la Cazadora Serhu»; un nombre propio, sin él).
  const articulos = new Map([...fauna, ...npcs].map((n) => [n.name, n.articulo ?? null]));
  const nombres = [...articulos.keys()].sort((a, b) => a.localeCompare(b, 'es'));

  it('plural, nombre en frase y «a quién»', () => {
    const lineas = nombres.map((n) => `${n} → ${pluralDeEspecie(n)} | ${nombreEnFrase(n)} | ${aNombre(n, articulos.get(n))}`);
    expect(lineas.join('\n')).toMatchSnapshot();
  });
});
