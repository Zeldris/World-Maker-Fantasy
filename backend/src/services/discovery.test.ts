import { describe, it, expect } from 'vitest';
import { detectsSearchIntent, coreRegionOf, REGION_CORE_NAMES } from './discovery.js';

// Cobertura nueva (auditoría 2026-08-03, "análisis completo backend/frontend") — `detectsSearchIntent`
// sigue viva como red de seguridad de duración en turn.ts (2026-08-25, tras retirar el panel de
// descubrimiento de texto libre que la usaba originalmente, ver comentario de cabecera en
// discovery.ts).

describe('detectsSearchIntent', () => {
  it('detecta buscar/explorar/rebuscar/recoger/recolectar/rastrear', () => {
    expect(detectsSearchIntent('Busco algo de comer por la zona')).toBe(true);
    expect(detectsSearchIntent('Exploro los alrededores')).toBe(true);
    expect(detectsSearchIntent('Rebusco entre los escombros')).toBe(true);
    expect(detectsSearchIntent('Recogiendo lo que encuentro útil')).toBe(true);
    expect(detectsSearchIntent('Recolecto materiales de la zona')).toBe(true);
    expect(detectsSearchIntent('Rastreo huellas recientes')).toBe(true);
  });

  it('"Recojo" (yo recojo) ya no rompe el stem — cubierto por la tolerancia de erratas nueva (2026-09-06), no por la regex literal de "recog"', () => {
    expect(detectsSearchIntent('Recojo lo que encuentro útil')).toBe(true);
  });

  it('bug real jugando en vivo (2026-09-06, "Bulco de Arena" narrado atacando en vez del Orco Enfurecido): tolera un typo de una letra en "busco" vía Levenshtein ≤2, mismo mecanismo que ya usa detectsAttackIntent', () => {
    expect(detectsSearchIntent('Bsuco al perseguidor')).toBe(true);
  });

  it('tolera erratas también en explorar/rastrear', () => {
    expect(detectsSearchIntent('Exploroo la cueva con cuidado')).toBe(true);
    expect(detectsSearchIntent('Rastreoo las huellas del animal')).toBe(true);
  });

  it('no detecta intención de búsqueda en una acción no relacionada', () => {
    expect(detectsSearchIntent('Hablo con el mercader sobre el precio')).toBe(false);
  });

  it('no dispara por error con palabras comunes que no son erratas de ningún stem de búsqueda', () => {
    expect(detectsSearchIntent('Me acerco despacio hacia el fuego de la hoguera')).toBe(false);
  });
});

describe('coreRegionOf', () => {
  it('encuentra el núcleo de región sin artículo dentro de un texto libre', () => {
    expect(coreRegionOf('Clan Serhu, Llanuras del Viento Rojo.')).toBe('Llanuras del Viento Rojo');
    expect(coreRegionOf('Cristal Helado.')).toBe('Cristal Helado');
  });

  it('devuelve null sin texto', () => {
    expect(coreRegionOf(null)).toBeNull();
    expect(coreRegionOf(undefined)).toBeNull();
    expect(coreRegionOf('')).toBeNull();
  });

  it('devuelve null si el texto no menciona ninguna región reconocible', () => {
    expect(coreRegionOf('Un objeto sin procedencia clara.')).toBeNull();
  });

  it('REGION_CORE_NAMES cubre las 5 regiones de Berig', () => {
    expect(REGION_CORE_NAMES).toHaveLength(5);
  });
});
