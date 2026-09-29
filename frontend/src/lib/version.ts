/// Versionado (decisión de Álvaro 2026-09-29, docs/producto/21-roadmap.md § Versionado): formato
/// `A.P.C-etapa+commit`, p. ej. `0.1.37-alpha+44f8ba3`. A.P salen de la etiqueta del hito
/// (`v0.1.0-alpha`), C son los commits desde esa etiqueta y el hash es el commit exacto.
///
/// Convierte la salida de `git describe --tags --long` (`v0.0.0-alpha-2-g67014de`) a ese formato.
/// Etiqueta sin etapa (`v1.0.0-5-gabc1234`) → sin `-etapa`. Cualquier otra cosa → null.
///
/// OJO: duplicada de `backend/src/lib/version.ts` (dos proyectos TS sin paquete compartido) — si
/// cambia aquí, cambiarla allí también (mismos tests en ambos lados). Sin imports de node ni DOM
/// para que `vite.config.ts` también la use al compilar.
export function formatearVersion(describe: string): string | null {
  const m = /^v?(\d+)\.(\d+)\.\d+(?:-([A-Za-z][A-Za-z0-9.]*))?-(\d+)-g([0-9a-f]{4,40})$/.exec(describe.trim())
  if (!m) return null
  const [, a, p, etapa, commits, hash] = m
  return `${a}.${p}.${commits}${etapa ? `-${etapa}` : ''}+${hash}`
}
