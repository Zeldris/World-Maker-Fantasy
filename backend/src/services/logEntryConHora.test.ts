import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/// P87 (QA-27): el diario (`GET /saves/:id`) solo carga las entradas de las últimas 24 h del juego
/// por `LogEntry.fictionalMinutes`, que vale 0 si no se da. Una entrada creada sin esa hora
/// desaparecía del diario al recargar a partir del día 2 («TU ACCIÓN», cancelar, subir de clase…).
/// Este test recorre el código y exige `fictionalMinutes` en cada `logEntry.create(...)`.
const RAIZ = join(import.meta.dirname, '..');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return ruta.endsWith('.ts') && !ruta.includes('.test.') ? [ruta] : [];
  });
}

/// El argumento completo de la llamada que empieza en `inicio` (en el paréntesis de apertura).
function argumento(texto: string, inicio: number): string {
  let profundidad = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === '(') profundidad++;
    else if (texto[i] === ')' && --profundidad === 0) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

describe('LogEntry con hora del juego (P87, QA-27)', () => {
  it('cada logEntry.create lleva fictionalMinutes', () => {
    const sinHora: string[] = [];
    for (const archivo of archivos(RAIZ)) {
      const texto = readFileSync(archivo, 'utf8');
      for (const m of texto.matchAll(/logEntry\.create(Many)?\(/g)) {
        const arg = argumento(texto, m.index + m[0].length - 1);
        // `createMany({ data: entradas })`: el array se arma antes; lo comprueba quien lo arma.
        const datosYaConstruidos = /^\(\{\s*data:\s*[A-Za-z_$][\w$]*\s*\}\)$/.test(arg);
        if (!datosYaConstruidos && !arg.includes('fictionalMinutes')) sinHora.push(`${relative(RAIZ, archivo)}:${texto.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(sinHora).toEqual([]);
  });
});
