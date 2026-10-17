import { describe, it, expect } from 'vitest';
import { sinVictoriaYaContada, textoQueCorre } from './difusion.js';

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

/// P184 (QA-27): el Poste del Clan Serhu publicaba «Gorhorn da muerte al Orco enfurecido» aunque nadie del
/// clan lo viera.
describe('textoQueCorre', () => {
  const muerte = { tipo: 'MUERTE_CAUSADA', texto: 'Gorhorn da muerte al Orco enfurecido.', datos: { personaje: 'Gorhorn', victima: 'Orco enfurecido', articuloVictima: 'el' } };
  it('una muerte sin testigos se sabe, pero no quién fue', () => {
    expect(textoQueCorre({ ...muerte, actores: [{ papel: 'AUTOR' }, { papel: 'VICTIMA' }] })).toBe('El Orco enfurecido ha muerto; nadie sabe a manos de quién.');
  });
  it('con un testigo, entera', () => {
    expect(textoQueCorre({ ...muerte, actores: [{ papel: 'AUTOR' }, { papel: 'VICTIMA' }, { papel: 'TESTIGO' }] })).toBe('Gorhorn da muerte al Orco enfurecido.');
  });
  it('lo demás, como siempre', () => {
    expect(textoQueCorre({ tipo: 'COMBATE_GANADO', texto: 'Gorhorn vence al Guchapo.', actores: [] })).toBe('Gorhorn vence al Guchapo.');
  });
});
