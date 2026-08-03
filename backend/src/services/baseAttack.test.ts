import { describe, it, expect } from 'vitest';
import { baseAttackFor } from './baseAttack.js';
import type { AttributeBlock } from './dice.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend").

const ATTRS: AttributeBlock = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, voluntad: 10, carisma: 10, arcano: 10 };

describe('baseAttackFor', () => {
  it('describe el arma equipada cuando hay alguna', () => {
    const result = baseAttackFor({ attributes: ATTRS, weaponNames: ['hacha rota'] });
    expect(result.description).toBe('Golpe directo con hacha rota.');
    expect(result.icon).toBe('⚔️');
  });

  it('junta los nombres de dos armas (doble empuñadura)', () => {
    const result = baseAttackFor({ attributes: ATTRS, weaponNames: ['hacha rota', 'cuchillo de hielo sílice'] });
    expect(result.description).toBe('Golpe directo con hacha rota y cuchillo de hielo sílice.');
  });

  it('sin arma pero con ataque natural, usa esa frase (fauna)', () => {
    const result = baseAttackFor({ attributes: ATTRS, weaponNames: [], ataqueNatural: 'Zarpazo con garras curvas.' });
    expect(result.description).toBe('Zarpazo con garras curvas.');
    expect(result.icon).toBe('🩸');
  });

  it('sin arma ni ataque natural, cae al golpe improvisado genérico', () => {
    const result = baseAttackFor({ attributes: ATTRS, weaponNames: [] });
    expect(result.description).toBe('Golpe improvisado, cuerpo a cuerpo, sin arma ni ventaja natural.');
    expect(result.icon).toBe('👊');
  });

  it('el arma equipada gana sobre el ataque natural si hay ambos', () => {
    const result = baseAttackFor({ attributes: ATTRS, weaponNames: ['lanza de hueso'], ataqueNatural: 'Zarpazo con garras curvas.' });
    expect(result.description).toBe('Golpe directo con lanza de hueso.');
  });

  it('preferredAttribute es el mayor entre fuerza y destreza', () => {
    const fuerte = baseAttackFor({ attributes: { ...ATTRS, fuerza: 18, destreza: 9 }, weaponNames: [] });
    expect(fuerte.preferredAttribute).toBe('fuerza');

    const agil = baseAttackFor({ attributes: { ...ATTRS, fuerza: 9, destreza: 18 }, weaponNames: [] });
    expect(agil.preferredAttribute).toBe('destreza');
  });

  it('empate entre fuerza y destreza cae a fuerza (criterio de `>`, no `>=`)', () => {
    const result = baseAttackFor({ attributes: { ...ATTRS, fuerza: 12, destreza: 12 }, weaponNames: [] });
    expect(result.preferredAttribute).toBe('fuerza');
  });
});
