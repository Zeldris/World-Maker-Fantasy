import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/// Versionado (decisión de Álvaro 2026-09-29, docs/producto/21-roadmap.md § Versionado): formato
/// `A.P.C-etapa+commit`, p. ej. `0.1.37-alpha+44f8ba3`. A.P salen de la etiqueta del hito
/// (`v0.1.0-alpha`), C son los commits desde esa etiqueta y el hash es el commit exacto.
///
/// Convierte la salida de `git describe --tags --long` (`v0.0.0-alpha-2-g67014de`) a ese formato.
/// Etiqueta sin etapa (`v1.0.0-5-gabc1234`) → sin `-etapa`. Cualquier otra cosa → null.
///
/// OJO: `frontend/src/lib/version.ts` duplica esta función (dos proyectos TS sin paquete
/// compartido) — si cambia aquí, cambiarla allí también (mismos tests en ambos lados).
export function formatearVersion(describe: string): string | null {
  const m = /^v?(\d+)\.(\d+)\.\d+(?:-([A-Za-z][A-Za-z0-9.]*))?-(\d+)-g([0-9a-f]{4,40})$/.exec(describe.trim());
  if (!m) return null;
  const [, a, p, etapa, commits, hash] = m;
  return `${a}.${p}.${commits}${etapa ? `-${etapa}` : ''}+${hash}`;
}

/// `<version de package.json>-dev` — respaldo sin git, sin etiquetas o ante cualquier error.
function versionDeRespaldo(): string {
  try {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8')) as { version?: string };
    return `${pkg.version ?? '0.0.0'}-dev`;
  } catch {
    return '0.0.0-dev';
  }
}

/// Calcula la versión ejecutando `git describe` en el repo. Nunca lanza.
export function calcularVersion(): string {
  try {
    const cwd = dirname(fileURLToPath(import.meta.url));
    const salida = execFileSync('git', ['describe', '--tags', '--long', '--match', 'v*'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return formatearVersion(salida) ?? versionDeRespaldo();
  } catch {
    return versionDeRespaldo();
  }
}

/// Se calcula una sola vez al arrancar el proceso.
export const APP_VERSION: string = calcularVersion();
