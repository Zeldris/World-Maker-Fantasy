import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// QA-37: reiniciar es empezar de cero. Toda tabla con `saveId` se borra en
/// `restartSaveTransactionBody` (o en cascada), o está aquí con el motivo de que se quede.
const SE_QUEDAN: Record<string, string> = {
  WorldState: 'se reescribe (fecha, agenda, facciones), no se borra',
  SkillBar: 'preferencia de la interfaz de la jugadora',
  Location: 'lugares de la partida; los interiores de sus edificios se rehacen al construir (pendiente: limpiarlos)',
  Npc: 'NPC propios de la partida (pendiente: limpiarlos sin romper referencias)',
  FactionRelation: 'en cascada al borrar sus facciones',
  Conocimiento: 'en cascada al borrar sus sucesos',
  LinajeMiembro: 'en cascada al borrar su linaje',
  Ganado: 'en cascada al borrar sus edificios',
};

describe('reinicio de partida completo (QA-37)', () => {
  it('toda tabla con saveId se borra al reiniciar o tiene su motivo para quedarse', () => {
    const schema = readFileSync(fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url)), 'utf8');
    const shared = readFileSync(fileURLToPath(new URL('./shared.ts', import.meta.url)), 'utf8');
    const cuerpo = shared.slice(shared.indexOf('export async function restartSaveTransactionBody'));
    const borradas = new Set([...cuerpo.matchAll(/tx\.(\w+)\.deleteMany/g)].map((m) => m[1]));
    const conSave = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter((m) => /^\s+saveId\s+String/m.test(m[2])).map((m) => m[1]);
    const olvidadas = conSave.filter((m) => !borradas.has(m[0].toLowerCase() + m.slice(1)) && !(m in SE_QUEDAN));
    expect(olvidadas).toEqual([]);
  });
});
