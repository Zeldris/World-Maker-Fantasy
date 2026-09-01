import { describe, it, expect } from 'vitest';
import { classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase, especializacionesConHuecosPara, resumenMecanicoEspecializacion, claseDeEspecializacion } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"). Reescrita
// 2026-08-24 (Grupo 3 § Sistema de clases, docs/rpgtarkor/clases.md): el roster pasa de listas
// planas por clase (4 Guerrero + 3 Cazador, todo tronco) a tronco común + especializaciones reales
// para GUERRERO/CAZADOR/CHAMAN — 33 huecos en total, los únicos "✅ lista" del doc verificados
// efecto a efecto contra el motor real. "Compañero cazador" (antes nivel 8 de Cazador) se reasignó
// a Domador en el doc — 2026-08-26: vuelve a sembrarse ahí (nivel 12, COMPANERO ya implementado,
// pasiva sin depender de combate multi-objetivo).

describe('classAbilityUnlocksFor', () => {
  it('Gorhorn (Cazador, sin especialización) aprende el tronco común por nivel', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 1).map((a) => a.name)).toEqual(['Analisis Salvaje']);
    expect(classAbilityUnlocksFor('Gorhorn', 4).map((a) => a.name)).toEqual(['Barrido Salvaje']);
    expect(classAbilityUnlocksFor('Gorhorn', 6).map((a) => a.name)).toEqual(['Instinto de Supervivencia']);
    expect(classAbilityUnlocksFor('Gorhorn', 8).map((a) => a.name)).toEqual(['Golpe Certero']);
  });

  it('sin especialización elegida, no aprende ningún hueco de especialización (12+)', () => {
    // Gorhorn no tiene especialización asignada in-game todavía (sin flujo de elección) —
    // `classAbilityUnlocksFor` filtra tronco puro, nunca huecos de Tirador/Instintivo/etc.
    expect(classAbilityUnlocksFor('Gorhorn', 12)).toEqual([]);
    expect(classAbilityUnlocksFor('Gorhorn', 16)).toEqual([]);
  });

  it('otro personaje sin clase asignada no aprende ninguna (fuera de alcance v1)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1)).toEqual([]);
  });

  it('a niveles sin ningún desbloqueo de tronco (2, 3, 5, 7...) no hay nada nuevo', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 2)).toEqual([]);
  });

  // Cierre del hueco "Save.clase sin ningún flujo de asignación" (2026-08-29): `clase` explícito
  // (tercer parámetro, `Save.clase` real vía `PATCH /saves/:id/clase`) tiene prioridad sobre el
  // fallback por `characterName` — un personaje CUALQUIERA con clase fijada ya aprende su tronco,
  // sin depender de ser 'Gorhorn'.
  it('con clase explícita, cualquier characterName aprende el tronco de esa clase (no solo Gorhorn)', () => {
    expect(classAbilityUnlocksFor('Sael Vhorn', 1, 'GUERRERO').length).toBeGreaterThan(0);
    expect(classAbilityUnlocksFor('Sael Vhorn', 1, null)).toEqual([]);
  });

  it('clase explícita distinta de CAZADOR anula el fallback de Gorhorn', () => {
    const conGuerrero = classAbilityUnlocksFor('Gorhorn', 1, 'GUERRERO');
    const sinClaseExplicita = classAbilityUnlocksFor('Gorhorn', 1);
    expect(conGuerrero).not.toEqual(sinClaseExplicita);
    expect(conGuerrero.length).toBeGreaterThan(0);
  });
});

describe('allClassAbilityUnlocks', () => {
  it('devuelve el roster completo (169 huecos: auditoría 2026-08-31 de Guerrero/Cazador/Chamán contra el motor real, 22 nuevas sembradas + 2 bugs de siembra corregidos)', () => {
    const all = allClassAbilityUnlocks();
    expect(all).toHaveLength(169);
    expect(all.filter((u) => u.clase === 'GUERRERO')).toHaveLength(21);
    expect(all.filter((u) => u.clase === 'CAZADOR')).toHaveLength(25);
    expect(all.filter((u) => u.clase === 'CHAMAN')).toHaveLength(20);
    expect(all.filter((u) => u.clase === 'ARQUERO')).toHaveLength(6);
    expect(all.filter((u) => u.clase === 'CABALLERO')).toHaveLength(20);
    expect(all.filter((u) => u.clase === 'SEGADOR')).toHaveLength(19);
    expect(all.filter((u) => u.clase === 'ASESINO')).toHaveLength(28);
    expect(all.filter((u) => u.clase === 'DRUIDA')).toHaveLength(30);
    expect(all.filter((u) => u.clase === 'MAGO')).toHaveLength(0);
  });
});

describe('classAbilityUnlocksForClase', () => {
  it('sin especialización, solo devuelve el tronco común de la clase', () => {
    expect(classAbilityUnlocksForClase('GUERRERO')).toHaveLength(3);
    expect(classAbilityUnlocksForClase('CAZADOR')).toHaveLength(4);
    expect(classAbilityUnlocksForClase('CHAMAN')).toHaveLength(3);
  });

  // Auditoría 2026-08-31 (docs/rpgtarkor/clases.md sincronizado contra classAbilities.ts real):
  // varias habilidades ya bloqueadas en el documento resultaron sembrables sin tocar motor —
  // DEBILIDAD/AUMENTO/CONTRA/MULTIPLE ya funcionan en ataque Y en defensa del jugador (confirmado
  // leyendo turnResolution.ts, no solo asumido). De paso, 2 bugs de siembra reales corregidos:
  // "Golpe Gemelo" vivía en Supervivencia en vez de Instintivo, "Tótem de Guerra" vivía en
  // Convocador en vez de Totémico — ambos movidos a su especialización real de clases.md.
  it('con especialización, devuelve tronco + los huecos reales de esa rama', () => {
    // Berserker: 3 tronco + 3 propios (19/24/32, antes solo 19) = 6
    expect(classAbilityUnlocksForClase('GUERRERO', 'BERSERKER')).toHaveLength(6);
    // Guardián: 3 tronco + 4 propios (12/24/28/40, antes 12/28) = 7
    expect(classAbilityUnlocksForClase('GUERRERO', 'GUARDIAN')).toHaveLength(7);
    // Lancero: 3 tronco + 6 propios (12/16/19/24/36/40, antes 16/24/40) = 9
    expect(classAbilityUnlocksForClase('GUERRERO', 'LANCERO')).toHaveLength(9);
    // Especialista: 3 tronco + 5 propios (12/16/19/24/32, antes 12/16/19/24) = 8
    expect(classAbilityUnlocksForClase('GUERRERO', 'ESPECIALISTA')).toHaveLength(8);
    // Domador: 4 tronco + 1 propio (12, Compañero cazador, COMPANERO ya implementado) = 5
    expect(classAbilityUnlocksForClase('CAZADOR', 'DOMADOR')).toHaveLength(5);
    // Supervivencia: 4 tronco + 7 propios (12/16/19/24/28/36/40, antes 12/16/19/40) = 11
    expect(classAbilityUnlocksForClase('CAZADOR', 'SUPERVIVENCIA')).toHaveLength(11);
    // Tirador: 4 tronco + 6 propios (12/16/19/28/32/36, antes 12/16/19/28/32) = 10
    expect(classAbilityUnlocksForClase('CAZADOR', 'TIRADOR')).toHaveLength(10);
    // Instintivo: 4 tronco + 7 propios (12/16/19/24/32/36/40, antes 12/16/36/40) = 11
    expect(classAbilityUnlocksForClase('CAZADOR', 'INSTINTIVO')).toHaveLength(11);
    // Totémico: 3 tronco + 1 propio (12, Tótem de Guerra — movido aquí desde Convocador) = 4
    expect(classAbilityUnlocksForClase('CHAMAN', 'TOTEMICO')).toHaveLength(4);
    // Rúnico: 3 tronco + 6 propios (12/16/24/28/36/40, antes 24/28/40) = 9
    expect(classAbilityUnlocksForClase('CHAMAN', 'RUNICO')).toHaveLength(9);
    // Convocador: 3 tronco + 6 propios (12/16/19/24/28/32, Tótem de Guerra salió, Filo Elemental
    // entró de verdad en el 12) = 9
    expect(classAbilityUnlocksForClase('CHAMAN', 'CONVOCADOR')).toHaveLength(9);
    // Opresor: 3 tronco + 4 propios (12/16/19/24, antes 12/16/24) = 7
    expect(classAbilityUnlocksForClase('CHAMAN', 'OPRESOR')).toHaveLength(7);
  });

  it('una especialización de otra clase no se cuela en el roster', () => {
    const berserker = classAbilityUnlocksForClase('GUERRERO', 'BERSERKER');
    expect(berserker.every((u) => u.clase === 'GUERRERO')).toBe(true);
    expect(berserker.some((u) => u.especializacion === 'TIRADOR')).toBe(false);
  });

  it('Tótem de Guerra (INVOCACION) vive en Totémico, no en Convocador (bug de siembra corregido 2026-08-31)', () => {
    const totemico = classAbilityUnlocksForClase('CHAMAN', 'TOTEMICO');
    expect(totemico.some((u) => u.ability.name === 'Tótem de Guerra')).toBe(true);
    const convocador = classAbilityUnlocksForClase('CHAMAN', 'CONVOCADOR');
    expect(convocador.some((u) => u.ability.name === 'Tótem de Guerra')).toBe(false);
    expect(convocador.some((u) => u.ability.name === 'Filo Elemental')).toBe(true);
  });

  it('Golpe Gemelo (ATAQUE+MULTIPLE) vive en Instintivo, no en Supervivencia (bug de siembra corregido 2026-08-31)', () => {
    const instintivo = classAbilityUnlocksForClase('CAZADOR', 'INSTINTIVO');
    expect(instintivo.some((u) => u.ability.name === 'Golpe Gemelo')).toBe(true);
    const supervivencia = classAbilityUnlocksForClase('CAZADOR', 'SUPERVIVENCIA');
    expect(supervivencia.some((u) => u.ability.name === 'Golpe Gemelo')).toBe(false);
  });
});

// Roadmap de UI de especialización (2026-09-01) — resumen mecánico derivado de datos reales, sin
// lore inventado, para las tarjetas del modal obligatorio de nivel 10.
describe('resumenMecanicoEspecializacion', () => {
  it('una especialización real con contenido devuelve una frase no vacía', () => {
    for (const clase of ['GUERRERO', 'CAZADOR', 'CHAMAN'] as const) {
      for (const especializacion of especializacionesConHuecosPara(clase)) {
        const resumen = resumenMecanicoEspecializacion(clase, especializacion);
        expect(resumen.length).toBeGreaterThan(0);
        expect(resumen).not.toBe('Sin habilidades propias construidas todavía.');
      }
    }
  });

  it('una combinación clase/especialización sin ningún hueco (la especialización no es de esa clase) devuelve el mensaje de "sin contenido"', () => {
    // TIRADOR es una especialización de CAZADOR, no de GUERRERO — 0 filas en CLASS_ABILITIES para
    // esta combinación, igual que cualquier clase sin ninguna especialización construida todavía.
    expect(resumenMecanicoEspecializacion('GUERRERO', 'TIRADOR')).toBe('Sin habilidades propias construidas todavía.');
  });

  it('menciona el atributo real de las habilidades de Berserker (fuerza/carisma, docs/rpgtarkor/clases.md)', () => {
    const resumen = resumenMecanicoEspecializacion('GUERRERO', 'BERSERKER');
    expect(resumen).toMatch(/Fuerza|Carisma/);
  });

  it('Domador (solo "Compañero cazador", category:general, sin rol/effects/preferredAttribute) cae a la description real en vez de un mensaje vacío', () => {
    const resumen = resumenMecanicoEspecializacion('CAZADOR', 'DOMADOR');
    expect(resumen).toContain('Desbloquea un slot de mascota');
  });
});

// Roadmap de banners de clase/especialización (2026-09-01) — el generador de prompts de imagen
// recibe solo el slug de la especialización, sin la clase, y necesita derivarla.
describe('claseDeEspecializacion', () => {
  it('devuelve la clase real dueña de una especialización con contenido', () => {
    expect(claseDeEspecializacion('BERSERKER')).toBe('GUERRERO');
    expect(claseDeEspecializacion('INSTINTIVO')).toBe('CAZADOR');
    expect(claseDeEspecializacion('OPRESOR')).toBe('CHAMAN');
  });

  it('devuelve undefined para una especialización sin ningún hueco construido', () => {
    expect(claseDeEspecializacion('PODER_MAGIA')).toBeUndefined();
  });
});
