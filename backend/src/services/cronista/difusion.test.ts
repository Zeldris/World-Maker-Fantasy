import { describe, it, expect } from 'vitest';
import { sinVictoriaYaContada } from './difusion.js';

/// P175 (QA-27): «Gorhorn vence al Guchapo» y «Gorhorn da muerte al Guchapo» salían los dos.
describe('sinVictoriaYaContada', () => {
  const victima = (id: string) => [{ entidadTipo: 'NPC', entidadId: id, papel: 'VICTIMA' }];
  it('quita la victoria si la misma víctima tiene su muerte', () => {
    const lista = [
      { id: 'm', tipo: 'MUERTE_CAUSADA', fictionalMinutes: 500, actores: victima('orco') },
      { id: 'v', tipo: 'COMBATE_GANADO', fictionalMinutes: 495, actores: victima('orco') },
      { id: 'v2', tipo: 'COMBATE_GANADO', fictionalMinutes: 495, actores: victima('lobo') },
    ];
    expect(sinVictoriaYaContada(lista).map((s) => s.id)).toEqual(['m', 'v2']);
  });
  it('una victoria de días antes sobre quien luego murió se cuenta aparte', () => {
    const lista = [
      { id: 'm', tipo: 'MUERTE_CAUSADA', fictionalMinutes: 5000, actores: victima('orco') },
      { id: 'v', tipo: 'COMBATE_GANADO', fictionalMinutes: 500, actores: victima('orco') },
    ];
    expect(sinVictoriaYaContada(lista).map((s) => s.id)).toEqual(['m', 'v']);
  });
});
