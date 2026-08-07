import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldCreateChapter } from './chapterSummary.js';

describe('shouldCreateChapter', () => {
  it('no toca capítulo por debajo del umbral (15)', () => {
    expect(shouldCreateChapter(14)).toBe(false);
  });
  it('toca capítulo justo en el umbral', () => {
    expect(shouldCreateChapter(15)).toBe(true);
  });
  it('toca capítulo también por encima del umbral', () => {
    expect(shouldCreateChapter(30)).toBe(true);
  });
});

/// Cobertura nueva (auditoría 2026-08-06, bug real): `claimChapterIfDue` reclamaba el `saveId` en
/// el Set en memoria DESPUÉS de dos `await` — dos turnos casi simultáneos para la misma partida
/// podían pasar los dos el `has()` antes de que ninguno reclamara, disparando cada uno su propio
/// hito "capítulo" (500 XP) y su propio `SessionSummary` duplicado con el mismo `chapterNumber`.
const findFirstSessionSummary = vi.fn();
const countLogEntry = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    sessionSummary: { findFirst: (...args: unknown[]) => findFirstSessionSummary(...args) },
    logEntry: { count: (...args: unknown[]) => countLogEntry(...args) },
  },
}));

const { claimChapterIfDue, releaseChapterClaim } = await import('./chapterSummary.js');

describe('claimChapterIfDue — condición de carrera en memoria', () => {
  beforeEach(() => {
    findFirstSessionSummary.mockReset().mockResolvedValue(null);
    countLogEntry.mockReset().mockResolvedValue(15);
    releaseChapterClaim('save-race'); // por si un test previo se quedó a medias
  });

  it('dos llamadas casi simultáneas para la misma partida solo reclaman el capítulo una vez', async () => {
    const [a, b] = await Promise.all([claimChapterIfDue('save-race'), claimChapterIfDue('save-race')]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('si no toca capítulo de verdad, libera el reclamo (no se queda bloqueado para el siguiente intento)', async () => {
    countLogEntry.mockResolvedValue(3); // por debajo del umbral (15)

    expect(await claimChapterIfDue('save-race')).toBe(false);
    // Sin liberar el reclamo tras el "no toca todavía", una llamada posterior real se quedaría
    // bloqueada para siempre aunque sí tocara capítulo.
    countLogEntry.mockResolvedValue(15);
    expect(await claimChapterIfDue('save-race')).toBe(true);
  });

  it('partidas distintas no se bloquean entre sí', async () => {
    const [a, b] = await Promise.all([claimChapterIfDue('save-A'), claimChapterIfDue('save-B')]);

    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});
