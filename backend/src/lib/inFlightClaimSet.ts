/// Candado en memoria reutilizable (refactor de deuda técnica, 2026-08-12) — extraído de
/// `turnLock.ts` y `chapterSummary.ts`, que implementaban el mismo `Set<string>` de "reclamar si no
/// está, liberar al terminar" cada uno por su cuenta (el propio `turnLock.ts` ya documentaba que
/// era "el mismo patrón exacto"). `claim`/`release` son síncronos a propósito, sin ningún `await`
/// de por medio: es lo que cierra el hueco de carrera "comprobar-esperar-actuar" en ambos sitios —
/// dos llamadas casi simultáneas nunca pueden pasar las dos el `has()` antes de que ninguna
/// reclame.
export function createInFlightClaimSet<T = string>(): { claim: (key: T) => boolean; release: (key: T) => void } {
  const inFlight = new Set<T>();
  return {
    claim(key: T): boolean {
      if (inFlight.has(key)) return false;
      inFlight.add(key);
      return true;
    },
    release(key: T): void {
      inFlight.delete(key);
    },
  };
}
