import { describe, it, expect, vi, beforeEach } from 'vitest';

const existingFiles = new Set<string>();

vi.mock('node:fs', () => ({
  existsSync: (p: string) => existingFiles.has(p.replaceAll('\\', '/').split('/').slice(-2).join('/')),
}));

// Import DESPUÉS del mock (hoisted por vitest, pero el orden del código sigue importando para
// legibilidad) — mismo patrón que el resto de tests de este proyecto que mockean un módulo.
const { zoneMapImageUrl, imageUrlsFor } = await import('./imageAssets.js');

function setExisting(entityType: string, filename: string) {
  existingFiles.add(`${entityType}/${filename}`);
}

describe('zoneMapImageUrl', () => {
  beforeEach(() => existingFiles.clear());

  it('sin ninguna imagen subida, devuelve null', () => {
    expect(zoneMapImageUrl('hondonada-del-eco')).toBeNull();
  });

  it('sin momento/estación, usa la imagen base si existe', () => {
    setExisting('zona', 'hondonada-del-eco-mapa.png');
    expect(zoneMapImageUrl('hondonada-del-eco')).toBe('/images/zona/hondonada-del-eco-mapa.png');
  });

  // Día/noche/estación (2026-08-27) — degrada en cascada de lo más específico a lo más genérico:
  // el cruce completo manda si existe, si no cae a solo estación, luego solo momento, luego base.
  it('con el cruce completo subido, lo usa por delante de cualquier alternativa más genérica', () => {
    setExisting('zona', 'hondonada-del-eco-noche-invierno-mapa.png');
    setExisting('zona', 'hondonada-del-eco-invierno-mapa.png');
    setExisting('zona', 'hondonada-del-eco-mapa.png');
    expect(zoneMapImageUrl('hondonada-del-eco', 'noche', 'invierno')).toBe('/images/zona/hondonada-del-eco-noche-invierno-mapa.png');
  });

  it('sin el cruce completo, cae a solo estación', () => {
    setExisting('zona', 'hondonada-del-eco-invierno-mapa.png');
    setExisting('zona', 'hondonada-del-eco-mapa.png');
    expect(zoneMapImageUrl('hondonada-del-eco', 'noche', 'invierno')).toBe('/images/zona/hondonada-del-eco-invierno-mapa.png');
  });

  it('sin estación subida, cae a solo momento', () => {
    setExisting('zona', 'hondonada-del-eco-noche-mapa.png');
    setExisting('zona', 'hondonada-del-eco-mapa.png');
    expect(zoneMapImageUrl('hondonada-del-eco', 'noche', 'invierno')).toBe('/images/zona/hondonada-del-eco-noche-mapa.png');
  });

  it('sin ninguna variante subida, cae a la imagen base', () => {
    setExisting('zona', 'hondonada-del-eco-mapa.png');
    expect(zoneMapImageUrl('hondonada-del-eco', 'noche', 'invierno')).toBe('/images/zona/hondonada-del-eco-mapa.png');
  });

  it('sin ninguna imagen en absoluto (ni siquiera la base), devuelve null', () => {
    expect(zoneMapImageUrl('hondonada-del-eco', 'noche', 'invierno')).toBeNull();
  });
});

describe('imageUrlsFor', () => {
  beforeEach(() => existingFiles.clear());

  it('sin ningún archivo subido, thumbnail/banner son null', () => {
    expect(imageUrlsFor('location', 'hondonada-del-eco')).toEqual({ thumbnail: null, banner: null });
  });

  it('con un slug de variante (día/noche/estación), busca ese archivo exacto, sin degradar', () => {
    setExisting('location', 'hondonada-del-eco-noche-invierno-banner.png');
    expect(imageUrlsFor('location', 'hondonada-del-eco-noche-invierno')).toEqual({
      thumbnail: null,
      banner: '/images/location/hondonada-del-eco-noche-invierno-banner.png',
    });
    // El slug base no encuentra la variante — cada combinación es un archivo propio, sin fallback
    // aquí (a diferencia de `zoneMapImageUrl`, pensado para la vista EN VIVO donde SIEMPRE hace
    // falta mostrar algo; la Enciclopedia sí puede mostrar "sin imagen" para una combinación
    // concreta todavía no subida).
    expect(imageUrlsFor('location', 'hondonada-del-eco')).toEqual({ thumbnail: null, banner: null });
  });
});
