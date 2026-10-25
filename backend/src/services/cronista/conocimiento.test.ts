import { describe, it, expect } from 'vitest';
import { cuentaComoHecho, diasHastaRegion, faccionSabe, llegaSola, npcSabe, radioDeAlcance, regionDeSlug, regionSabe } from './conocimiento.js';

// CR-18 (hito 0.2) — regla de alcance: la importancia dice hasta dónde, la distancia cuándo.
describe('alcance de un suceso', () => {
  const LL = 'Las Llanuras del Viento Rojo';
  const suceso = (importancia: number, origenes: string[] = [LL], facciones: string[] = []) => ({ importancia, origenes, facciones });

  it('radio por importancia: 1-3 testigos, 4-6 su región, 7-8 vecinas, 9-10 todo Berig', () => {
    expect(radioDeAlcance(3)).toBeNull();
    expect(radioDeAlcance(4)).toBe(0);
    expect(radioDeAlcance(6)).toBe(0);
    expect(radioDeAlcance(7)).toBe(1);
    expect(radioDeAlcance(8)).toBe(1);
    expect(radioDeAlcance(9)).toBe(Number.POSITIVE_INFINITY);
  });

  it('una región se entera según la distancia, dentro de su alcance', () => {
    expect(diasHastaRegion(suceso(3), LL)).toBeNull();
    expect(diasHastaRegion(suceso(5), LL)).toBe(0);
    expect(diasHastaRegion(suceso(5), 'Ciénaga Troncal')).toBeNull();
    expect(diasHastaRegion(suceso(7), 'Ciénaga Troncal')).toBe(1);
    expect(diasHastaRegion(suceso(7), 'La Meseta del Orden')).toBeNull();
    expect(diasHastaRegion(suceso(9), 'La Meseta del Orden')).toBe(2);
    expect(regionSabe(suceso(9), 'La Meseta del Orden', 1)).toBe(false);
    expect(regionSabe(suceso(9), 'La Meseta del Orden', 2)).toBe(true);
  });

  it('con varios orígenes manda el más cercano; sin lugar solo llega lo de todo Berig', () => {
    expect(diasHastaRegion(suceso(7, [LL, 'La Meseta del Orden']), 'El Margen Silencioso')).toBe(1);
    expect(diasHastaRegion(suceso(8, []), LL)).toBeNull();
    expect(diasHastaRegion(suceso(10, []), LL)).toBe(3);
  });

  it('las facciones actoras lo saben al momento si pasa de los testigos', () => {
    expect(faccionSabe(suceso(4, [], ['Clan Goshg']), 'Clan Goshg')).toBe(true);
    expect(faccionSabe(suceso(3, [], ['Clan Goshg']), 'Clan Goshg')).toBe(false);
    expect(faccionSabe(suceso(9, [], ['Clan Goshg']), 'Clan Helsig')).toBe(false);
  });

  it('un NPC sabe lo de su región o su facción; lo cuenta como hecho si es de allí', () => {
    const s = suceso(5, [LL], ['Clan Serhu']);
    expect(npcSabe(s, { region: LL, faccion: null }, 0)).toBe(true);
    expect(npcSabe(s, { region: 'Cristal Helado', faccion: 'Clan Serhu' }, 0)).toBe(true);
    expect(npcSabe(s, { region: 'Cristal Helado', faccion: 'Clan Helsig' }, 30)).toBe(false);
    expect(cuentaComoHecho(s, { region: LL, faccion: null })).toBe(true);
    expect(cuentaComoHecho(suceso(9), { region: 'Cristal Helado', faccion: null })).toBe(false);
  });

  it('al personaje le llega solo lo de ≥ 5 (P316), de cerca como hecho y de lejos como rumor, y lo de las aliadas', () => {
    const p = (region: string | null, aliadas: string[] = []) => ({ region, aliadas: new Set(aliadas) });
    expect(llegaSola(suceso(4), p(LL))).toBeNull();
    // 5-6 donde está: hecho al momento. Antes (Q10) no llegaba nunca.
    expect(llegaSola(suceso(5), p(LL))).toEqual({ dias: 0, via: 'OIDAS', confirmado: true });
    expect(llegaSola(suceso(6), p(LL))).toEqual({ dias: 0, via: 'OIDAS', confirmado: true });
    // 5-6 en otra región: rumor, 1 día por salto con tope 3 (vecina: 1; a dos saltos: 2). Sin lugar, 3.
    expect(llegaSola(suceso(6), p('Ciénaga Troncal'))).toEqual({ dias: 1, via: 'OIDAS', confirmado: false });
    expect(llegaSola(suceso(5), p('La Meseta del Orden'))).toEqual({ dias: 2, via: 'OIDAS', confirmado: false });
    expect(llegaSola(suceso(5, []), p(LL))).toEqual({ dias: 3, via: 'OIDAS', confirmado: false });
    expect(llegaSola(suceso(7), p(LL))).toEqual({ dias: 0, via: 'OIDAS', confirmado: true });
    expect(llegaSola(suceso(7), p('Ciénaga Troncal'))).toEqual({ dias: 1, via: 'OIDAS', confirmado: false });
    // 7-8 fuera de su alcance: también rumor (antes, nunca).
    expect(llegaSola(suceso(7), p('La Meseta del Orden'))).toEqual({ dias: 2, via: 'OIDAS', confirmado: false });
    expect(llegaSola(suceso(5), p(null))).toBeNull();
    expect(llegaSola(suceso(5, [], ['Clan Goshg']), p('Cristal Helado', ['Clan Goshg']))).toEqual({ dias: 0, via: 'ALIADA', confirmado: true });
    expect(llegaSola(suceso(3, [], ['Clan Goshg']), p('Cristal Helado', ['Clan Goshg']))).toBeNull();
  });

  // Revisión P316: lo del propio Reino (hambruna, rebelión) no tiene región de origen; lo sabe al momento
  // como hecho por los suyos, esté donde esté, nunca como «rumor lejano» a los 3 días.
  it('lo de su propio Reino le llega al momento como hecho, aunque no tenga región de origen', () => {
    const hambruna = suceso(6, [], ['El Reino de Prueba']);
    expect(llegaSola(hambruna, { region: 'Cristal Helado', aliadas: new Set(), reino: 'El Reino de Prueba' })).toEqual({ dias: 0, via: 'OIDAS', confirmado: true });
    expect(llegaSola(hambruna, { region: null, aliadas: new Set(), reino: 'El Reino de Prueba' })).toEqual({ dias: 0, via: 'OIDAS', confirmado: true });
    expect(llegaSola(suceso(4, [], ['El Reino de Prueba']), { region: LL, aliadas: new Set(), reino: 'El Reino de Prueba' })).toBeNull();
  });

  it('región a partir del slug del suceso', () => {
    expect(regionDeSlug('cienaga-troncal')).toBe('Ciénaga Troncal');
    expect(regionDeSlug('atlantida')).toBeNull();
    expect(regionDeSlug(null)).toBeNull();
  });
});
