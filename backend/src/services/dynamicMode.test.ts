import { describe, it, expect } from 'vitest';
import { aNombre, decideOfertaModoDinamico, nombreOcultoPorRaza, narrarAperturaCombateForzado } from './dynamicMode.js';

describe('decideOfertaModoDinamico', () => {
  it('sin candidatos (NPC/FAUNA/RECURSO con cantidad > 0), nunca ofrece nada', () => {
    expect(decideOfertaModoDinamico([], () => 0)).toBeNull();
    expect(decideOfertaModoDinamico([{ tipo: 'EDIFICIO', targetSlug: 'x', cantidad: 1, temperamento: null }], () => 0)).toBeNull();
  });

  // RECURSO (2026-09-08, "Ver qué hay en la zona") — a diferencia del comentario histórico de
  // dynamicMode.ts ("RECURSO/EDIFICIO quedan fuera a propósito"), ahora SÍ es candidato elegible:
  // no hay diálogo real, pero sí tiene sentido ofrecer Interactuar sobre él (resuelto sin
  // conversación de vueltas, ver dynamicModeRecurso.ts). EDIFICIO sigue excluido — no inicia nada
  // por sí mismo, ni siquiera con resolución directa.
  it('RECURSO con cantidad > 0 SÍ es candidato elegible (2026-09-08)', () => {
    const candidato = decideOfertaModoDinamico([{ tipo: 'RECURSO', targetSlug: 'yerreo', cantidad: 5, temperamento: null }], () => 0);
    expect(candidato).toEqual({ tipo: 'RECURSO', targetSlug: 'yerreo' });
  });

  it('un candidato FAUNA con cantidad 0 (inactivo) no cuenta', () => {
    expect(decideOfertaModoDinamico([{ tipo: 'FAUNA', targetSlug: 'murgol', cantidad: 0, temperamento: 'CAUTELOSO' }], () => 0)).toBeNull();
  });

  it('random por encima del umbral de probabilidad, no ofrece aunque haya candidatos', () => {
    const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'maestro-kade', cantidad: 1, temperamento: 'CAUTELOSO' as const }];
    // decideOfertaModoDinamico consume random() una vez para el umbral — devolver 0.99 (>= 0.35) lo rechaza.
    expect(decideOfertaModoDinamico(zonePoints, () => 0.99)).toBeNull();
  });

  it('random por debajo del umbral, con un único candidato, lo elige', () => {
    const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'maestro-kade', cantidad: 1, temperamento: 'CAUTELOSO' as const }];
    expect(decideOfertaModoDinamico(zonePoints, () => 0)).toEqual({ tipo: 'NPC', targetSlug: 'maestro-kade' });
  });

  it('con varios candidatos, elige uno de ellos determinista según random', () => {
    const zonePoints = [
      { tipo: 'NPC' as const, targetSlug: 'maestro-kade', cantidad: 1, temperamento: 'CAUTELOSO' as const },
      { tipo: 'FAUNA' as const, targetSlug: 'murgol', cantidad: 3, temperamento: 'CAUTELOSO' as const },
    ];
    // Primera llamada a random() decide el umbral (0 pasa), segunda decide el índice.
    let call = 0;
    const secuencia = [0, 0.99];
    const random = () => secuencia[call++];
    expect(decideOfertaModoDinamico(zonePoints, random)).toEqual({ tipo: 'FAUNA', targetSlug: 'murgol' });
  });

  // Gistera Koh excluida a propósito (2026-09-09, bug real jugando en vivo — Álvaro: "ya no
  // estamos usando los mensajes deterministas... no hay conversación") — su encuentro es un
  // guion determinista propio (`narrarVueltaGistera`), nunca debe competir con el sorteo genérico.
  it('Gistera Koh nunca se ofrece por el sorteo genérico, aunque sea el único candidato válido', () => {
    const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'gistera-koh', cantidad: 1, temperamento: 'CAUTELOSO' as const }];
    expect(decideOfertaModoDinamico(zonePoints, () => 0)).toBeNull();
  });

  it('con Gistera Koh y otro candidato válido a la vez, solo el otro puede salir elegido', () => {
    const zonePoints = [
      { tipo: 'NPC' as const, targetSlug: 'gistera-koh', cantidad: 1, temperamento: 'CAUTELOSO' as const },
      { tipo: 'FAUNA' as const, targetSlug: 'murgol', cantidad: 3, temperamento: 'CAUTELOSO' as const },
    ];
    expect(decideOfertaModoDinamico(zonePoints, () => 0)).toEqual({ tipo: 'FAUNA', targetSlug: 'murgol' });
  });

  /// Bug real, investigación 2026-09-05 a raíz del hallazgo "Kirelon sobrerrepresentado": el
  /// kirelon-arenoso (temperamento AGRESIVO real de catálogo) se ofrecía como candidato de modo
  /// dinámico exactamente igual que fauna pacífica — no era un problema de peso de aparición, era
  /// que ningún candidato se filtraba por temperamento. Confirmado con Postgres real que hay otras
  /// 6 fichas de fauna AGRESIVA igual de expuestas (cruzavientos/ferike/lebude/miruina/
  /// rondador-de-brasas/towrgu) — el fix no es específico del kirelon.
  describe('exclusión de temperamento AGRESIVO', () => {
    it('un único candidato AGRESIVO (fauna) nunca se ofrece, aunque sea el único ZonePoint activo', () => {
      const zonePoints = [{ tipo: 'FAUNA' as const, targetSlug: 'kirelon-arenoso', cantidad: 1, temperamento: 'AGRESIVO' as const }];
      expect(decideOfertaModoDinamico(zonePoints, () => 0)).toBeNull();
    });

    it('un único candidato AGRESIVO (NPC) tampoco se ofrece', () => {
      const zonePoints = [{ tipo: 'NPC' as const, targetSlug: 'algun-npc-hostil', cantidad: 1, temperamento: 'AGRESIVO' as const }];
      expect(decideOfertaModoDinamico(zonePoints, () => 0)).toBeNull();
    });

    it('con un candidato AGRESIVO y otro CAUTELOSO, solo el CAUTELOSO puede salir elegido', () => {
      const zonePoints = [
        { tipo: 'FAUNA' as const, targetSlug: 'kirelon-arenoso', cantidad: 1, temperamento: 'AGRESIVO' as const },
        { tipo: 'FAUNA' as const, targetSlug: 'gesgurio', cantidad: 1, temperamento: 'CAUTELOSO' as const },
      ];
      let call = 0;
      // Aunque el índice "crudo" apuntaría al segundo elemento de la lista SIN filtrar, tras
      // excluir el AGRESIVO solo queda 1 candidato — el índice cae siempre en gesgurio.
      const secuencia = [0, 0.99];
      const random = () => secuencia[call++];
      expect(decideOfertaModoDinamico(zonePoints, random)).toEqual({ tipo: 'FAUNA', targetSlug: 'gesgurio' });
    });

    it('AMIGABLE/INOFENSIVO/CAUTELOSO sí cuentan como candidatos válidos', () => {
      for (const temperamento of ['AMIGABLE', 'INOFENSIVO', 'CAUTELOSO'] as const) {
        const zonePoints = [{ tipo: 'FAUNA' as const, targetSlug: 'algo', cantidad: 1, temperamento }];
        expect(decideOfertaModoDinamico(zonePoints, () => 0)).toEqual({ tipo: 'FAUNA', targetSlug: 'algo' });
      }
    });

    it('temperamento null (Npc no resuelto) no se descarta — se trata como "no filtrar"', () => {
      const zonePoints = [{ tipo: 'FAUNA' as const, targetSlug: 'algo', cantidad: 1, temperamento: null }];
      expect(decideOfertaModoDinamico(zonePoints, () => 0)).toEqual({ tipo: 'FAUNA', targetSlug: 'algo' });
    });
  });
});

/// P28 (QA-27): cara a cara, un NPC con nombre propio aún sin descubrir se nombra por su raza.
describe('nombreOcultoPorRaza', () => {
  it('con raza, singular y con su género', () => {
    expect(nombreOcultoPorRaza('orcos', 'M')).toBe('Orco desconocido');
    expect(nombreOcultoPorRaza('orcos', 'F')).toBe('Orca desconocida');
    expect(nombreOcultoPorRaza('goirntes', null)).toBe('Goirnte desconocido');
  });

  it('sin raza conocida, el genérico de siempre', () => {
    expect(nombreOcultoPorRaza(null, 'F')).toBe('Alguien');
    expect(nombreOcultoPorRaza('dragones', 'M')).toBe('Alguien');
  });

  it('la apertura del combate forzado no concuerda en género con el nombre', () => {
    expect(narrarAperturaCombateForzado('Orca desconocida').narration).not.toMatch(/dispuesto/);
  });
});

/// P141 (QA-27): «Responder» a un NPC sin descubrir: «Le digo al orco desconocido:».
describe('aNombre', () => {
  it('con artículo y contracción si no es un nombre propio; si lo es, tal cual', () => {
    expect(aNombre('Orco desconocido')).toBe('al orco desconocido');
    expect(aNombre('Orca desconocida')).toBe('a la orca desconocida');
    expect(aNombre('Alguien')).toBe('a alguien');
    expect(aNombre('Gistera Koh')).toBe('a Gistera Koh');
  });
});

// P124 (QA-27): plural de las especies para los grupos de fauna.
describe('pluralDeEspecie', () => {
  it('pluraliza el nombre y sus adjetivos, no lo que va tras «de» ni los colores-nombre', async () => {
    const { pluralDeEspecie } = await import('./dynamicMode.js');
    expect(pluralDeEspecie('Guchapo')).toBe('Guchapos');
    expect(pluralDeEspecie('Kirelon Arenoso')).toBe('Kirelones Arenosos');
    expect(pluralDeEspecie('Hoscón')).toBe('Hoscones');
    expect(pluralDeEspecie('Cruzavientos')).toBe('Cruzavientos');
    expect(pluralDeEspecie('Sombra de Kroj')).toBe('Sombras de Kroj');
    expect(pluralDeEspecie('Negueo Turquesa')).toBe('Negueos Turquesa');
    expect(pluralDeEspecie('Aullador Rojo')).toBe('Aulladores Rojos');
    expect(pluralDeEspecie('Manesti Azul')).toBe('Manestis Azules');
  });
});

