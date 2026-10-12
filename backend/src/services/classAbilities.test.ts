import { describe, it, expect } from 'vitest';
import { abilityUnlocksAlSubirANivel, especializacionAbilityUnlocksFor, classAbilityUnlocksFor, allClassAbilityUnlocks, classAbilityUnlocksForClase, especializacionesConHuecosPara, resumenMecanicoEspecializacion, claseDeEspecializacion, clasesPermitidasParaRaza } from './classAbilities.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend"). Reescrita
// 2026-08-24 (Grupo 3 § Sistema de clases, docs/rpgtarkor/sistemas-combate/clases.md): el roster pasa de listas
// planas por clase (4 Guerrero + 3 Cazador, todo tronco) a tronco común + especializaciones reales
// para GUERRERO/CAZADOR/CHAMAN — 33 huecos en total, los únicos "✅ lista" del doc verificados
// efecto a efecto contra el motor real. "Compañero cazador" (antes nivel 8 de Cazador) se reasignó
// a Domador en el doc — 2026-08-26: vuelve a sembrarse ahí (nivel 12, COMPANERO ya implementado,
// pasiva sin depender de combate multi-objetivo).

describe('classAbilityUnlocksFor', () => {
  it('Gorhorn (Cazador, sin especialización) aprende el tronco común por nivel', () => {
    expect(classAbilityUnlocksFor('Gorhorn', 1).map((a) => a.name)).toEqual(['Análisis Salvaje']);
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
  it('devuelve el roster completo (232 huecos: 229 de la ronda REFLEJAR 2026-09-15 + CONVERSION-sobre-debilidad real 2026-09-15 — `bestAumentoOf`/`worstDebilidadOf`/`removeActiveEffect` (activeEffects.ts): Transmutación Menor (Transmutador 19), Transmutación Mayor (Transmutador 36), Equilibrio Roto (Transmutador 40, capstone) — 3 fichas nuevas, cierra Transmutador 8/8 y Segador al completo)', () => {
    const all = allClassAbilityUnlocks();
    expect(all).toHaveLength(232);
    expect(all.filter((u) => u.clase === 'GUERRERO')).toHaveLength(33);
    expect(all.filter((u) => u.clase === 'CAZADOR')).toHaveLength(32);
    expect(all.filter((u) => u.clase === 'CHAMAN')).toHaveLength(23);
    expect(all.filter((u) => u.clase === 'ARQUERO')).toHaveLength(18);
    expect(all.filter((u) => u.clase === 'CABALLERO')).toHaveLength(25);
    expect(all.filter((u) => u.clase === 'SEGADOR')).toHaveLength(36);
    expect(all.filter((u) => u.clase === 'ASESINO')).toHaveLength(33);
    expect(all.filter((u) => u.clase === 'DRUIDA')).toHaveLength(32);
    expect(all.filter((u) => u.clase === 'MAGO')).toHaveLength(0);
  });
});

describe('classAbilityUnlocksForClase', () => {
  it('sin especialización, solo devuelve el tronco común de la clase', () => {
    // GUERRERO sube a 4 (2026-09-15, Golpe de Control nv.8 — DEBILIDAD+ATAQUE, margen decisivo).
    expect(classAbilityUnlocksForClase('GUERRERO')).toHaveLength(4);
    expect(classAbilityUnlocksForClase('CAZADOR')).toHaveLength(4);
    expect(classAbilityUnlocksForClase('CHAMAN')).toHaveLength(3);
  });

  // Auditoría 2026-08-31 (docs/rpgtarkor/sistemas-combate/clases.md sincronizado contra classAbilities.ts real):
  // varias habilidades ya bloqueadas en el documento resultaron sembrables sin tocar motor —
  // DEBILIDAD/AUMENTO/CONTRA/MULTIPLE ya funcionan en ataque Y en defensa del jugador (confirmado
  // leyendo turnResolution.ts, no solo asumido). De paso, 2 bugs de siembra reales corregidos:
  // "Golpe Gemelo" vivía en Supervivencia en vez de Instintivo, "Tótem de Guerra" vivía en
  // Convocador en vez de Totémico — ambos movidos a su especialización real de clases.md.
  it('con especialización, devuelve tronco + los huecos reales de esa rama', () => {
    // Berserker: 4 tronco (Golpe de Control nv.8 sube el tronco, 2026-09-15) + 7 propios (12/16
    // Grito de Guerra/Grito tenebroso DEBILIDAD real, 19/24/32/36 Instinto Berserker AUMENTO a uno
    // mismo, 40 Golpe Devastador) = 11
    expect(classAbilityUnlocksForClase('GUERRERO', 'BERSERKER')).toHaveLength(11);
    // Guardián: 4 tronco + 7 propios (12/16/19/24/28/32/40) = 11
    expect(classAbilityUnlocksForClase('GUERRERO', 'GUARDIAN')).toHaveLength(11);
    // Lancero: 4 tronco + 7 propios = 11
    expect(classAbilityUnlocksForClase('GUERRERO', 'LANCERO')).toHaveLength(11);
    // Especialista: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — 40 Segunda Oportunidad CURAZION
    // real 2026-09-15 cierra la especialización) = 12
    expect(classAbilityUnlocksForClase('GUERRERO', 'ESPECIALISTA')).toHaveLength(12);
    // Domador: 4 tronco + 2 propios (12 Compañero cazador, 16 Vínculo Salvaje — AUMENTO
    // redirigido a Companion, 2026-09-09) = 6
    expect(classAbilityUnlocksForClase('CAZADOR', 'DOMADOR')).toHaveLength(9);
    // Supervivencia: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — 32 Trampa Improvisada, AREA real 2026-09-14) = 12
    expect(classAbilityUnlocksForClase('CAZADOR', 'SUPERVIVENCIA')).toHaveLength(12);
    // Tirador: 4 tronco + 7 propios (12/16/19/24/28/32/36 — 24 Tensar al Límite, CANALIZAR real 2026-09-09) = 11
    expect(classAbilityUnlocksForClase('CAZADOR', 'TIRADOR')).toHaveLength(11);
    // Instintivo: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — 28 Instinto de Reserva, AREA real 2026-09-14) = 12
    expect(classAbilityUnlocksForClase('CAZADOR', 'INSTINTIVO')).toHaveLength(12);
    // Totémico: 3 tronco + 1 propio (12, Tótem de Guerra — movido aquí desde Convocador) = 4
    expect(classAbilityUnlocksForClase('CHAMAN', 'TOTEMICO')).toHaveLength(4);
    // Rúnico: 3 tronco + 6 propios (12/16/24/28/36/40, antes 24/28/40) = 9
    expect(classAbilityUnlocksForClase('CHAMAN', 'RUNICO')).toHaveLength(9);
    // Convocador: 3 tronco + 7 propios (12/16/19/24/28/32/40 — Tótem de Guerra salió, Filo
    // Elemental entró de verdad en el 12, 40 Furia de los Elementos CANALIZAR real 2026-09-09) = 10
    expect(classAbilityUnlocksForClase('CHAMAN', 'CONVOCADOR')).toHaveLength(10);
    // Opresor: 3 tronco + 6 propios (12/16/19/24/32/36 — 32/36 Runa de Sujeción/Grieta de Voluntad, AREA real 2026-09-14) = 9
    expect(classAbilityUnlocksForClase('CHAMAN', 'OPRESOR')).toHaveLength(9);
    // Maestro Arquero: 4 tronco + 7 propios (12/16/19/24/28/32/36 — 12/19/24/28/32/36 sembradas
    // 2026-09-14 reutilizando motor ya real, 40 CANALIZAR+LETAL combinado sigue sin construir) = 11
    expect(classAbilityUnlocksForClase('ARQUERO', 'MAESTRO_ARQUERO')).toHaveLength(11);
    // Maestro Ballestero: mismo reparto que Maestro Arquero (reflavor)
    expect(classAbilityUnlocksForClase('ARQUERO', 'MAESTRO_BALLESTERO')).toHaveLength(11);
    // Parca: 4 tronco (1/4/6/8) + 8 propios (12/16/19/24/28/32/36/40 — 19/32/40 CURAZION real
    // 2026-09-15 cierra la especialización al completo) = 12
    expect(classAbilityUnlocksForClase('SEGADOR', 'PARCA')).toHaveLength(12);
    // Maldito: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — DEBILIDAD real 2026-09-15 cierra 8/8) = 12
    expect(classAbilityUnlocksForClase('SEGADOR', 'MALDITO')).toHaveLength(12);
    // Ilustrado: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — DEBILIDAD real 2026-09-15 cierra 8/8) = 12
    expect(classAbilityUnlocksForClase('SEGADOR', 'ILUSTRADO')).toHaveLength(12);
    // Transmutador: 4 tronco + 8 propios (12/16/19/24/28/32/36/40 — CONVERSION-sobre-debilidad real
    // 2026-09-15 cierra 19/36/40, junto a REFLEJAR/CURAZION ya cerrados) = 12, especialización completa
    expect(classAbilityUnlocksForClase('SEGADOR', 'TRANSMUTADOR')).toHaveLength(12);
    // Asesino Tóxico: 4 tronco (Asesino) + 8 propios (12/16/19/24/28/32/36/40 — DEBILIDAD real
    // 2026-09-15 cierra 8/8)
    expect(classAbilityUnlocksForClase('ASESINO', 'ASESINO_TOXICO')).toHaveLength(12);
    // Aullador: 3 tronco (Druida) + 5 propios (24/28/32/36 — 32/36 AUMENTO/DEBILIDAD real
    // 2026-09-15, resto sigue bloqueado por INVOCACION multi-objetivo)
    expect(classAbilityUnlocksForClase('DRUIDA', 'AULLADOR')).toHaveLength(8);
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

  it('menciona el atributo real de las habilidades de Berserker (fuerza/carisma, docs/rpgtarkor/sistemas-combate/clases.md)', () => {
    const resumen = resumenMecanicoEspecializacion('GUERRERO', 'BERSERKER');
    expect(resumen).toMatch(/Fuerza|Carisma/);
  });

  it('Domador (2026-09-09: Vínculo Salvaje ya es una habilidad de combate real) menciona su atributo, no cae a la description de la pasiva', () => {
    const resumen = resumenMecanicoEspecializacion('CAZADOR', 'DOMADOR');
    expect(resumen).toMatch(/Voluntad/);
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

// Fix de bug real (auditoría en 6 agentes, 2026-09-01): personaje custom sin raza/clase asignada
// se quedaba sin clase para siempre — esta función filtra qué clases son válidas para elegir,
// respetando las 4 exclusivas de raza y excluyendo MAGO (sin tronco real construido).
describe('clasesPermitidasParaRaza', () => {
  it('sin raza (null), ofrece las 5 clases libres, nunca las 4 exclusivas ni Mago', () => {
    const clases = clasesPermitidasParaRaza(null);
    expect(clases.sort()).toEqual(['ARQUERO', 'ASESINO', 'CAZADOR', 'GUERRERO'].sort());
  });

  it('cada raza exclusiva ve su propia clase exclusiva, además de las 5 libres', () => {
    expect(clasesPermitidasParaRaza('orcos')).toEqual(expect.arrayContaining(['CHAMAN', 'GUERRERO', 'CAZADOR']));
    expect(clasesPermitidasParaRaza('goirntes')).toEqual(expect.arrayContaining(['CABALLERO', 'GUERRERO', 'CAZADOR']));
    expect(clasesPermitidasParaRaza('nabieus')).toEqual(expect.arrayContaining(['SEGADOR', 'GUERRERO', 'CAZADOR']));
    expect(clasesPermitidasParaRaza('faerus')).toEqual(expect.arrayContaining(['DRUIDA', 'GUERRERO', 'CAZADOR']));
  });

  it('una raza sin clase exclusiva propia nunca ve la clase exclusiva de otra raza', () => {
    const clasesOrco = clasesPermitidasParaRaza('orcos');
    expect(clasesOrco).not.toContain('CABALLERO');
    expect(clasesOrco).not.toContain('SEGADOR');
    expect(clasesOrco).not.toContain('DRUIDA');
  });

  it('MAGO nunca aparece, con ninguna raza (sin tronco real construido)', () => {
    for (const raza of [null, 'orcos', 'goirntes', 'nabieus', 'faerus', 'raza-inventada']) {
      expect(clasesPermitidasParaRaza(raza)).not.toContain('MAGO');
    }
  });
});

// B19 (pruebas en la nube 2026-09-28): Domador a nivel 11 subía a 12 sin recibir "Compañero cazador".
describe('abilityUnlocksAlSubirANivel', () => {
  it('concede la habilidad de especialización del nivel exacto al que se sube', () => {
    const esperadas = especializacionAbilityUnlocksFor('CAZADOR', 'DOMADOR', 12).filter(
      (a) => !especializacionAbilityUnlocksFor('CAZADOR', 'DOMADOR', 11).some((b) => b.name === a.name),
    );
    expect(esperadas.length).toBeGreaterThan(0);
    const nombres = abilityUnlocksAlSubirANivel('Gorhorn', 12, 'CAZADOR', 'DOMADOR').map((a) => a.name);
    for (const a of esperadas) expect(nombres).toContain(a.name);
  });
  it('sin especialización elegida solo da el tronco común', () => {
    expect(abilityUnlocksAlSubirANivel('Gorhorn', 12, 'CAZADOR', null)).toEqual(classAbilityUnlocksFor('Gorhorn', 12, 'CAZADOR'));
  });
  it('un nivel sin desbloqueo de especialización no concede nada de ella', () => {
    expect(abilityUnlocksAlSubirANivel('Gorhorn', 13, 'CAZADOR', 'DOMADOR')).toEqual(classAbilityUnlocksFor('Gorhorn', 13, 'CAZADOR'));
  });
});
