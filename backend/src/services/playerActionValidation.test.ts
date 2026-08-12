import { describe, it, expect, vi, beforeEach } from 'vitest';

const findManyNpc = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: { npc: { findMany: (...args: unknown[]) => findManyNpc(...args) } },
}));

const {
  detectsUnequippedWeaponClaim,
  wrongWeaponNarrationFor,
  detectsAbsentSceneNpcClaim,
  absentSceneNpcNarrationFor,
  detectsPlayerAnachronism,
  anachronismNarrationFor,
} = await import('./playerActionValidation.js');

describe('detectsUnequippedWeaponClaim', () => {
  it('detecta reclamar un arma de categoría distinta a la equipada', () => {
    expect(detectsUnequippedWeaponClaim("Uso mi lanza y lo apuñalo.", ['Maza orca'])).toEqual({ claimedNoun: 'lanza' });
  });

  it('no dispara si el arma reclamada SÍ coincide con una equipada (por nombre)', () => {
    expect(detectsUnequippedWeaponClaim('Ataco con mi maza.', ['Maza orca'])).toBeNull();
  });

  it('no dispara si no lleva ningún arma equipada (caso "va desarmado", fuera de alcance)', () => {
    expect(detectsUnequippedWeaponClaim('Ataco con mi lanza.', [])).toBeNull();
  });

  it('no dispara con una mención sin verbo de uso/ataque (recuerdo legítimo)', () => {
    expect(detectsUnequippedWeaponClaim('Recuerdo la vieja lanza de mi padre.', ['Maza orca'])).toBeNull();
  });

  it('no dispara si el texto no menciona ninguna categoría de arma', () => {
    expect(detectsUnequippedWeaponClaim('Exploro la zona con cuidado.', ['Maza orca'])).toBeNull();
  });

  it('reconoce el arma equipada por coincidencia de sustantivo dentro del nombre completo', () => {
    expect(detectsUnequippedWeaponClaim('Golpeo con mi hacha.', ['Hacha de guerra rota'])).toBeNull();
  });

  it('detecta con dos armas equipadas (dual-wield) si ninguna coincide', () => {
    expect(detectsUnequippedWeaponClaim('Clavo mi daga en el enemigo.', ['Hacha de guerra rota', 'Maza orca'])).toEqual({ claimedNoun: 'daga' });
  });
});

describe('wrongWeaponNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(wrongWeaponNarrationFor('Maza orca').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsAbsentSceneNpcClaim', () => {
  beforeEach(() => {
    findManyNpc.mockReset().mockResolvedValue([
      { slug: 'torgash', name: 'Torgash', aliases: ["kort'ikar torgash"] },
      { slug: 'orco-enfurecido-hondonada', name: 'Orco enfurecido', aliases: ['orco enfurecido'] },
    ]);
  });

  it('detecta interactuar con un NPC real de catálogo que no está en la escena actual', async () => {
    const result = await detectsAbsentSceneNpcClaim("Le pregunto a Torgash por su clan.", 'world1', []);
    expect(result).toEqual({ name: 'Torgash' });
  });

  it('no dispara si el NPC mencionado SÍ está en la lista de escena', async () => {
    const result = await detectsAbsentSceneNpcClaim('Le pregunto a Torgash por su clan.', 'world1', ['torgash']);
    expect(result).toBeNull();
  });

  it('no dispara sin intención real de interacción (mención de pasada)', async () => {
    const result = await detectsAbsentSceneNpcClaim('Pienso en lo que me dijo Torgash hace días.', 'world1', []);
    expect(result).toBeNull();
  });

  it('no dispara si el texto no nombra a ningún NPC real del catálogo', async () => {
    const result = await detectsAbsentSceneNpcClaim('Ataco a un desconocido cualquiera.', 'world1', []);
    expect(result).toBeNull();
  });
});

describe('absentSceneNpcNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(absentSceneNpcNarrationFor('Torgash').length).toBeGreaterThan(0);
    }
  });
});

describe('detectsPlayerAnachronism', () => {
  it('detecta un anacronismo en la propia acción del jugador', () => {
    expect(detectsPlayerAnachronism('Me monto en mi nave espacial y me voy volando.')).toBe(true);
    expect(detectsPlayerAnachronism('Busco un mechero para encender fuego rápido.')).toBe(false);
    expect(detectsPlayerAnachronism('¿Tengo pólvora en el inventario?')).toBe(true);
  });

  it('no dispara con una acción normal, coherente con el mundo', () => {
    expect(detectsPlayerAnachronism('Exploro la zona con cuidado, hacha en mano.')).toBe(false);
  });
});

describe('anachronismNarrationFor', () => {
  it('siempre devuelve una frase no vacía', () => {
    for (let i = 0; i < 20; i++) {
      expect(anachronismNarrationFor().length).toBeGreaterThan(0);
    }
  });
});
