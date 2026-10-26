import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPOS_CON_NOMBRE_DE_HABILIDAD, HABILIDADES_RENOMBRADAS, HABILIDADES_RENOMBRADAS_POR_CLASE, nombreActualDeHabilidad } from './habilidadesRenombradas.js';
import { allClassAbilityUnlocks } from './classAbilities.js';
import { faunaCategoriaAbilityUnlocksFor, type FaunaCategoria } from './faunaAbilities.js';
import { WEAPON_CATEGORY_ATTRIBUTE, weaponAbilitiesFor, type EquippedWeaponSlot } from './weaponAbilities.js';
import { GENERIC_COMBAT_ABILITIES } from './genericCombatAbilities.js';
import { allProfessionAbilityUnlocks } from './professionAbilities.js';
import { startingAbilitiesFor } from './startingAbilities.js';
import { harvestAbilityForMetodo } from './harvestAbilities.js';
import { fauna, npcs } from '../scripts/worldCatalog.js';
import { MetodoObtencion } from '@prisma/client';
import habilidadesConocidas from './habilidadesConocidas.json' with { type: 'json' };

const ESQUEMA = readFileSync(join(import.meta.dirname, '../../prisma/schema.prisma'), 'utf8').split('\n');

/// «Modelo.campo» de cada campo marcado con «Guarda nombres de habilidad (QA-68)».
function camposMarcados(): string[] {
  const marcados: string[] = [];
  let modelo = '';
  ESQUEMA.forEach((linea, i) => {
    const m = /^model (\w+) \{/.exec(linea);
    if (m) modelo = m[1]!;
    if (linea.includes('Guarda nombres de habilidad (QA-68)')) {
      const campo = ESQUEMA.slice(i + 1).find((l) => !l.trim().startsWith('///'));
      marcados.push(`${modelo}.${/^\s+(\w+)\s/.exec(campo ?? '')?.[1]}`);
    }
  });
  return marcados.sort();
}

/// QA-261: todos los nombres de habilidad que una partida puede guardar hoy, de cada fuente del motor.
/// Una categoría de fauna nueva no compila hasta que entra aquí.
const CATEGORIAS_DE_FAUNA: Record<FaunaCategoria, true> = {
  GUELISES: true, ACECHANTES: true, CORVENES: true, ZANCUDOS: true, BESTIONES: true, RONDINES: true, QUITINOS: true,
  ESCAMADOS: true, NADANTES: true, ORDENADOS: true, UMBRIAS: true, MUDOS_SALVAJE: true, ROKRATS_ESTALLIDO: true,
};

let catalogo: Set<string> | null = null;

function nombresDelCatalogo(): Set<string> {
  if (catalogo) return catalogo;
  const nombres = new Set<string>();
  // Clase y especialización.
  for (const u of allClassAbilityUnlocks()) nombres.add(u.ability.name);
  // Fauna: las 7-8 de cada categoría de raza y las específicas de cada animal/NPC (worldCatalog).
  for (const categoria of Object.keys(CATEGORIAS_DE_FAUNA) as FaunaCategoria[]) {
    for (const u of faunaCategoriaAbilityUnlocksFor(categoria)) nombres.add(u.ability.name);
  }
  for (const n of [...fauna, ...npcs]) for (const h of n.habilidadesRaciales ?? []) nombres.add(h.name);
  // Armas: básica, avanzada y real de cada categoría en la mano principal (la secundaria no da nombres nuevos) y desarmado.
  const sinArma: EquippedWeaponSlot[] = [];
  for (const a of weaponAbilitiesFor(sinArma, 40)) nombres.add(a.name);
  for (const tipoArma of Object.keys(WEAPON_CATEGORY_ATTRIBUTE) as (keyof typeof WEAPON_CATEGORY_ATTRIBUTE)[]) {
    // La avanzada de BACULO, BASTON, GRIMORIO y VARA sale sin nombre: WEAPON_ABILITY_AVANZADA_CONTENT solo tiene
    // fuerza y destreza (fallo de main, apuntado en la bitácora).
    for (const a of weaponAbilitiesFor([{ slot: 'ARMA_PRINCIPAL', tipoArma }], 40)) if (a.name) nombres.add(a.name);
  }
  // Genéricas, iniciales de personaje, profesiones y recolección.
  for (const a of GENERIC_COMBAT_ABILITIES) nombres.add(a.name);
  for (const a of startingAbilitiesFor('Gorhorn')) nombres.add(a.name);
  for (const u of allProfessionAbilityUnlocks()) nombres.add(u.ability.name);
  for (const metodo of Object.values(MetodoObtencion)) {
    const h = harvestAbilityForMetodo(metodo);
    if (h) nombres.add(h.ability.name);
  }
  catalogo = nombres;
  return nombres;
}

describe('habilidades renombradas (P100, QA-68)', () => {
  it('el nombre viejo pasa al nuevo y el resto se queda igual', () => {
    expect(nombreActualDeHabilidad('Analisis Salvaje')).toBe('Análisis Salvaje');
    expect(nombreActualDeHabilidad('Esquivar')).toBe('Esquivar');
  });

  it('QA-243: un nombre repetido entre clases cambia solo en la clase y la rama que lo pierden', () => {
    expect(nombreActualDeHabilidad('Golpe Certero', { clase: 'CAZADOR', especializacion: null })).toBe('Golpe Certero');
    expect(nombreActualDeHabilidad('Golpe Certero', { clase: 'ASESINO', especializacion: null })).toBe('Golpe Oportuno');
    expect(nombreActualDeHabilidad('Instinto Asesino', { clase: 'ASESINO', especializacion: 'MAESTRO_ASESINO' })).toBe('Instinto Asesino');
    expect(nombreActualDeHabilidad('Instinto Asesino', { clase: 'DRUIDA', especializacion: 'SALVAJE' })).toBe('Arrebato Salvaje');
    expect(nombreActualDeHabilidad('Postura de Tirador', { clase: 'ARQUERO', especializacion: 'MAESTRO_ARQUERO' })).toBe('Postura de Tirador');
    expect(nombreActualDeHabilidad('Golpe Certero')).toBe('Golpe Certero');
  });

  it('QA-243: el Asesino Selecto distingue sus dos «Golpe Certero» por la descripción', () => {
    const selecto = { clase: 'ASESINO', especializacion: 'ASESINO_SELECTO' };
    const deLaRama = allClassAbilityUnlocks().find((u) => u.especializacion === 'ASESINO_SELECTO' && u.level === 32)!.ability;
    expect(deLaRama.name).toBe('Golpe a la Marca');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto, deLaRama.description)).toBe('Golpe a la Marca');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto, 'Un golpe reactivo, soltado en el instante exacto en que el rival baja la guardia.')).toBe('Golpe Oportuno');
    expect(nombreActualDeHabilidad('Golpe Certero', selecto)).toBe('Golpe Oportuno');
  });

  it('QA-256: cada renombre global deja el nombre nuevo en el catálogo y ninguna habilidad con el viejo', () => {
    const actuales = nombresDelCatalogo();
    for (const [viejo, nuevo] of Object.entries(HABILIDADES_RENOMBRADAS)) {
      expect(actuales.has(nuevo), nuevo).toBe(true);
      expect(actuales.has(viejo), viejo).toBe(false);
    }
  }, 60000);

  it('QA-243: ningún nombre de habilidad de clase se repite y cada nombre nuevo existe en el catálogo', () => {
    const nombres = allClassAbilityUnlocks().map((u) => u.ability.name);
    expect(nombres.filter((n, i) => nombres.indexOf(n) !== i)).toEqual([]);
    for (const r of HABILIDADES_RENOMBRADAS_POR_CLASE) expect(nombres).toContain(r.nuevo);
  });

  it('los campos marcados en el esquema son exactamente los que se renombran', () => {
    expect(camposMarcados()).toEqual([...CAMPOS_CON_NOMBRE_DE_HABILIDAD].sort());
  });

  it('QA-261: ningún nombre de habilidad que una partida pudo guardar desaparece del catálogo sin renombre', () => {
    const actuales = nombresDelCatalogo();
    const viejos = new Set([...Object.keys(HABILIDADES_RENOMBRADAS), ...HABILIDADES_RENOMBRADAS_POR_CLASE.map((r) => r.viejo)]);
    const perdidos = (habilidadesConocidas as string[]).filter((n) => !actuales.has(n) && !viejos.has(n));
    expect(perdidos.map((n) => `añade "${n}" a HABILIDADES_RENOMBRADAS (QA-68); quitarlo de habilidadesConocidas.json es retirar la habilidad, y lo decide la usuaria`)).toEqual([]);
  }, 60000);

  it('QA-261: habilidadesConocidas.json recoge cada nombre del catálogo actual y cada nombre viejo de los renombres', () => {
    const conocidas = new Set(habilidadesConocidas as string[]);
    const faltan = [...nombresDelCatalogo(), ...Object.keys(HABILIDADES_RENOMBRADAS), ...HABILIDADES_RENOMBRADAS_POR_CLASE.map((r) => r.viejo)].filter((n) => !conocidas.has(n));
    expect([...new Set(faltan)].sort().map((n) => `añade "${n}" a habilidadesConocidas.json`)).toEqual([]);
    expect(habilidadesConocidas).toEqual([...new Set(habilidadesConocidas as string[])].sort());
  }, 60000);
});
