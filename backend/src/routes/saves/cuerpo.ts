// QA-22 (retro del 2026-10-08): lectura de listas de ids que llegan en el cuerpo de una petición.
// Solo cadenas y sin repetidos (un mismo soldado no va dos veces en la misma partida); lo que no sea
// una lista, vacío.
export function idsDelCuerpo(x: unknown): string[] {
  return Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string'))] : [];
}
