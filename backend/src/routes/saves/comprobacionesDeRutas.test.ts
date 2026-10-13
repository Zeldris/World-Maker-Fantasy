import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/// QA-79 (retro del PR #53): toda ruta `POST /saves/:id/...` rechaza una partida terminada y una muerte
/// pendiente (decisión de la usuaria del 2026-09-07: con una muerte pendiente solo se puede resolverla).
/// `/npc-interaction/abrir` nació sin ellas. Una ruta nueva entra aquí sola; si de verdad no las
/// necesita, va a `EXCEPCIONES` con su motivo.
const EXCEPCIONES: Record<string, string> = {
  '/saves/:id/restart': 'reiniciar es justo lo que se hace con una partida terminada',
  '/saves/:id/death/resolve': 'es la que resuelve la muerte pendiente',
  '/saves/:id/pause': 'pausar el reloj no cambia la partida',
  '/saves/:id/resume': 'reanudar el reloj no cambia la partida',
  '/saves/:id/transit/cancel': 'cancelar deshace una acción, no hace una nueva',
  '/saves/:id/combat/cerrar': 'limpia un combate ya acabado',
  '/saves/:id/suggestions': 'solo propone textos de acción, no escribe nada en la partida',
  '/saves/:id/skill-bars': 'ajuste de la interfaz',
};

function rutasPostDePartida(): { archivo: string; ruta: string; cuerpo: string }[] {
  const dir = new URL('.', import.meta.url);
  const rutas: { archivo: string; ruta: string; cuerpo: string }[] = [];
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const codigo = readFileSync(new URL(archivo, dir), 'utf-8');
    // Cada registro de ruta llega hasta el siguiente: ahí está su manejador.
    const inicios = [...codigo.matchAll(/\bapp\.(get|post|put|patch|delete)\b/g)].map((m) => m.index!);
    inicios.forEach((inicio, i) => {
      const cuerpo = codigo.slice(inicio, inicios[i + 1] ?? codigo.length);
      const ruta = /^app\.post[\s\S]*?\(\s*'(\/saves\/:id[^']*)'/.exec(cuerpo)?.[1];
      if (ruta) rutas.push({ archivo, ruta, cuerpo });
    });
  }
  return rutas;
}

describe('QA-79: comprobaciones de las rutas POST de una partida', () => {
  const rutas = rutasPostDePartida();

  it('encuentra las rutas', () => {
    expect(rutas.length).toBeGreaterThan(50);
  });

  it('cada una rechaza la partida terminada y la muerte pendiente, salvo las excepciones', () => {
    const sinComprobar = rutas
      .filter(({ ruta }) => !(ruta in EXCEPCIONES))
      .filter(({ cuerpo }) => !cuerpo.includes('rechazarSiNoAdmiteAcciones') && !(cuerpo.includes('rejectIfEnded') && cuerpo.includes('rejectIfPendingDeath')))
      .map(({ archivo, ruta }) => `${archivo}: ${ruta}`);
    expect(sinComprobar).toEqual([]);
  });

  it('las excepciones siguen existiendo', () => {
    const existentes = new Set(rutas.map((r) => r.ruta));
    expect(Object.keys(EXCEPCIONES).filter((r) => !existentes.has(r))).toEqual([]);
  });
});
