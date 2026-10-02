/// Fase F del hito 0.1 — lógica pura del benchmark de latencia de turno (`benchmark-turno.ts`), aparte
/// para poder testearla sin backend ni Ollama.

export interface OpcionesBenchmark {
  url: string;
  turnos: number;
  /// Partida existente; sin ella se crea una de Gorhorn nueva y se borra al acabar.
  saveId: string | null;
  conservar: boolean;
  salida: string | null;
}

export const ACCIONES_TIPICAS: readonly string[] = [
  'Miro a mi alrededor con calma.',
  'Examino el suelo buscando huellas recientes.',
  'Me siento un momento a recuperar el aliento.',
  'Escucho con atención los sonidos del lugar.',
  'Reviso el estado de mi hacha.',
  'Observo el cielo para calcular cuánto falta para que anochezca.',
  'Camino despacio hacia el borde del claro.',
  'Bebo un trago de agua del odre.',
];

export function parsearOpciones(argv: string[], env: Record<string, string | undefined> = {}): OpcionesBenchmark {
  const opciones: OpcionesBenchmark = { url: env.API_URL ?? 'http://localhost:3001', turnos: 5, saveId: null, conservar: false, salida: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const siguiente = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Falta el valor de ${a}`);
      return v;
    };
    if (a === '--url') opciones.url = siguiente().replace(/\/$/, '');
    else if (a === '--turnos') {
      const n = Number(siguiente());
      if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('--turnos debe ser un entero entre 1 y 100');
      opciones.turnos = n;
    } else if (a === '--save') opciones.saveId = siguiente();
    else if (a === '--conservar') opciones.conservar = true;
    else if (a === '--salida') opciones.salida = siguiente();
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return opciones;
}

export interface MedicionTurno {
  accion: string;
  clasificarMs: number;
  /// Desde que se pide `/turn/narrate` hasta la primera línea del stream (resolución del turno antes de narrar).
  resolverMs: number | null;
  /// Desde la primera línea hasta `done` (generación de la narración).
  narrarMs: number | null;
  totalMs: number;
  /// 'ok' | 'transito' (banda larga: se resuelve en diferido, sin narrar aquí) | 'bloqueado' | 'error: …'
  resultado: string;
}

/// Mediana, percentil 90 y máximo (redondeados a ms); null sin datos.
export function estadisticas(valores: number[]): { n: number; mediana: number; p90: number; max: number } | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const percentil = (p: number) => v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]!;
  return { n: v.length, mediana: Math.round(percentil(50)), p90: Math.round(percentil(90)), max: Math.round(v[v.length - 1]!) };
}

/// Lee un stream NDJSON y anota el instante (según `ahora`) de la primera línea y de la línea `done`.
export async function medirStreamNarracion(
  cuerpo: ReadableStream<Uint8Array>,
  ahora: () => number,
): Promise<{ primeraLinea: number | null; fin: number | null; error: string | null }> {
  const lector = cuerpo.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let primeraLinea: number | null = null;
  let fin: number | null = null;
  let error: string | null = null;
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let salto: number;
    while ((salto = buffer.indexOf('\n')) >= 0) {
      const linea = buffer.slice(0, salto).trim();
      buffer = buffer.slice(salto + 1);
      if (!linea) continue;
      if (primeraLinea === null) primeraLinea = ahora();
      try {
        const evento = JSON.parse(linea) as { type?: string; message?: string };
        if (evento.type === 'done') fin = ahora();
        if (evento.type === 'error') error = evento.message ?? 'error';
      } catch {
        // Línea que no es JSON: se ignora.
      }
    }
  }
  return { primeraLinea, fin, error };
}

export function formatearSegundos(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`;
}
