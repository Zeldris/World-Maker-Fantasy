import { execFile } from 'node:child_process';
import { prisma } from '../lib/prisma.js';
import { retrieveLore, type RetrievedLore } from './retrieval.js';
import { generateImagePrompt, type ImagePromptContexto, type ImagePromptEntityType, type ImagePromptSizeProfile } from './imagePromptGenerator.js';

// IMG-50 (usuaria, 2026-11-07): como en el generador de imágenes, los prompts se piden a una cola. Cada trabajo
// carga el modelo local, escribe su prompt y lo descarga (`keepAlive: '0'` en el generador): el modelo no se queda
// abierto. En serie, de uno en uno, y en memoria: un reinicio del backend vacía la cola, y lo ya generado está en
// `ImagePrompt`. No entra en el build empaquetado (`PROHIBIDOS` de empaquetado.test.ts).

export type EstadoTrabajo = 'en_cola' | 'generando' | 'listo' | 'error';

export interface TrabajoImagePrompt {
  worldId: string;
  entityType: ImagePromptEntityType;
  entitySlug: string;
  sizeProfile: ImagePromptSizeProfile;
  name: string;
  loreContext: string;
  region?: string | null;
  conMomento?: boolean;
  ejemplos?: string[];
}

export interface EstadoImagePrompt {
  estado: EstadoTrabajo;
  /// 1 = el siguiente en generarse (solo en `en_cola`).
  posicion?: number;
  error?: string;
  prompt?: string;
  provider?: string;
}

const claveDe = (t: Pick<TrabajoImagePrompt, 'worldId' | 'entityType' | 'entitySlug' | 'sizeProfile'>) =>
  `${t.worldId}|${t.entityType}|${t.entitySlug}|${t.sizeProfile}`;

const pendientes: TrabajoImagePrompt[] = [];
const estados = new Map<string, EstadoImagePrompt>();
let enMarcha = false;

/// El generador de imágenes (`sd-cli`) ocupa la memoria de la Deck: mientras corre, la cola espera.
let generadorOcupado = (): Promise<boolean> =>
  new Promise((resolve) => execFile('pgrep', ['-f', 'sd-cli'], (err) => resolve(!err)));
let sondeoMs = 10_000;

/// Solo para los tests.
export function configurarColaParaTests(opciones: { generadorOcupado?: () => Promise<boolean>; sondeoMs?: number; vaciar?: boolean }): void {
  if (opciones.generadorOcupado) generadorOcupado = opciones.generadorOcupado;
  if (opciones.sondeoMs !== undefined) sondeoMs = opciones.sondeoMs;
  if (opciones.vaciar) {
    pendientes.length = 0;
    estados.clear();
  }
}

/// Tope del lore relacionado: con 32k de contexto cabe mucho más que en el turno del narrador (1400).
const MAX_LORE_RELACIONADO = 6000;

export function formatearLoreRelacionado(chunks: RetrievedLore[], nombre: string): string[] {
  const out: string[] = [];
  let total = 0;
  for (const c of chunks) {
    if (c.title.trim().toLowerCase() === nombre.trim().toLowerCase()) continue;
    const linea = `${c.title}: ${c.text}`;
    if (total + linea.length > MAX_LORE_RELACIONADO) {
      if (out.length === 0) out.push(linea.slice(0, MAX_LORE_RELACIONADO));
      break;
    }
    out.push(linea);
    total += linea.length;
  }
  return out;
}

async function loreRelacionado(t: TrabajoImagePrompt): Promise<string[]> {
  try {
    const chunks = await retrieveLore(`${t.name} ${t.loreContext.slice(0, 500)}`, t.worldId, 6);
    return formatearLoreRelacionado(chunks, t.name);
  } catch {
    // Sin RAG (Postgres sin pgvector, embeddings caídos) el prompt sale igual, solo con el lore de la entidad.
    return [];
  }
}

function posiciones(): void {
  pendientes.forEach((t, i) => {
    const e = estados.get(claveDe(t));
    if (e?.estado === 'en_cola') e.posicion = i + 1;
  });
}

async function ejecutar(t: TrabajoImagePrompt): Promise<void> {
  const clave = claveDe(t);
  estados.set(clave, { estado: 'generando' });
  try {
    const contexto: ImagePromptContexto = {
      region: t.region,
      conMomento: t.conMomento,
      ejemplos: t.ejemplos,
      loreRelacionado: await loreRelacionado(t),
    };
    const { prompt, provider } = await generateImagePrompt(t.entityType, t.name, t.loreContext, t.sizeProfile, contexto);
    const where = { worldId_entityType_entitySlug_sizeProfile: { worldId: t.worldId, entityType: t.entityType, entitySlug: t.entitySlug, sizeProfile: t.sizeProfile } };
    await prisma.imagePrompt.upsert({
      where,
      create: { worldId: t.worldId, entityType: t.entityType, entitySlug: t.entitySlug, sizeProfile: t.sizeProfile, prompt, provider },
      // Solo el prompt base: el usado (CFG-38) es de la usuaria y regenerar nunca lo pisa.
      update: { prompt, provider },
    });
    estados.set(clave, { estado: 'listo', prompt, provider });
  } catch (err) {
    estados.set(clave, { estado: 'error', error: err instanceof Error ? err.message : String(err) });
  }
}

async function bucle(): Promise<void> {
  if (enMarcha) return;
  enMarcha = true;
  try {
    while (pendientes.length > 0) {
      while (await generadorOcupado()) await new Promise((r) => setTimeout(r, sondeoMs));
      const t = pendientes.shift()!;
      posiciones();
      await ejecutar(t);
    }
  } finally {
    enMarcha = false;
  }
}

/// Encola el trabajo; si esa misma entidad y perfil ya está en cola o generándose, no se duplica.
export function encolarImagePrompt(t: TrabajoImagePrompt): EstadoImagePrompt {
  const clave = claveDe(t);
  const actual = estados.get(clave);
  if (actual && (actual.estado === 'en_cola' || actual.estado === 'generando')) return actual;
  pendientes.push(t);
  estados.set(clave, { estado: 'en_cola', posicion: pendientes.length });
  void bucle();
  return estados.get(clave)!;
}

export function estadoImagePrompt(c: Pick<TrabajoImagePrompt, 'worldId' | 'entityType' | 'entitySlug' | 'sizeProfile'>): EstadoImagePrompt | undefined {
  return estados.get(claveDe(c));
}

/// Para los tests: espera a que la cola se vacíe.
export async function colaVacia(): Promise<void> {
  while (enMarcha || pendientes.length > 0) await new Promise((r) => setTimeout(r, 5));
}
