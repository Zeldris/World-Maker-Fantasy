import { describe, it, expect } from 'vitest';
import { detectsUnequippedWeaponClaim, wrongWeaponNarrationFor } from './playerActionValidation.js';

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
