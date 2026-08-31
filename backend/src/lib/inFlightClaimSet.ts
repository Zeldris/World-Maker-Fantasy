/// Candado en memoria reutilizable (refactor de deuda técnica, 2026-08-12) — extraído de
/// `turnLock.ts` y `chapterSummary.ts`, que implementaban el mismo `Set<string>` de "reclamar si no
/// está, liberar al terminar" cada uno por su cuenta (el propio `turnLock.ts` ya documentaba que
/// era "el mismo patrón exacto"). `claim`/`release` son síncronos a propósito, sin ningún `await`
/// de por medio: es lo que cierra el hueco de carrera "comprobar-esperar-actuar" en ambos sitios —
/// dos llamadas casi simultáneas nunca pueden pasar las dos el `has()` antes de que ninguna
/// reclame.
///
/// Bug real (2026-08-31, investigado tras cuelgues reproducidos jugando): `release` solo se llama
/// desde el `finally` del caller (p. ej. `narrateAndPersistTurn` en `turn.ts`) — si esa promesa
/// nunca resuelve NI rechaza (un `await` sin ningún timeout en su cadena, p. ej. `retrieval.ts`
/// contra Postgres/Supabase sin `statement_timeout`), el `finally` nunca se ejecuta y el candado
/// queda tomado PARA SIEMPRE — todo turno futuro de esa partida recibe 409 indefinidamente, sin
/// autocurarse ni con el fix de `ollamaQueue.ts` (ese protege la cola de Ollama, no este candado
/// superior). Confirmado como la causa raíz real de turnos que "no resuelven ni fallan" incluso con
/// ese fix ya aplicado. `staleAfterMs` es la red de seguridad final: un candado más viejo que este
/// margen se trata como abandonado y `claim()` lo reemplaza en vez de bloquear — la tarea zombie de
/// origen sigue corriendo de fondo sin que nada la mate (mismo criterio que `ollamaQueue.ts`), pero
/// deja de bloquear turnos nuevos de la misma partida.
export function createInFlightClaimSet<T = string>(staleAfterMs = 300_000): {
  claim: (key: T) => boolean;
  release: (key: T) => void;
} {
  const claimedAt = new Map<T, number>();
  return {
    claim(key: T): boolean {
      const existing = claimedAt.get(key);
      if (existing !== undefined && Date.now() - existing < staleAfterMs) return false;
      claimedAt.set(key, Date.now());
      return true;
    },
    release(key: T): void {
      claimedAt.delete(key);
    },
  };
}
