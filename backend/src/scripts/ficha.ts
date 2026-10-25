/**
 * QA-245: `ficha <slug>` — todo lo que el juego sabe de un slug, en una salida de texto compacta, para no
 * tener que hacer grep/sed sobre worldCatalog.ts (12.000+ líneas). Se lanza con `tools/qa/ficha.sh <slug>`.
 *   npx tsx src/scripts/ficha.ts <slug>            # la ficha (código 1 y 5 parecidos si no existe)
 *   npx tsx src/scripts/ficha.ts <slug> --nombre   # solo el nombre visible (lo usa `ficha.sh --canon`)
 * La lógica vive en funciones exportadas con `datos` inyectable (ficha.test.ts).
 */
import { pathToFileURL } from 'node:url';

export interface FichaDatos {
  /** Exportaciones de worldCatalog.ts, por nombre. */
  catalogo: Record<string, unknown>;
  poblaciones: Array<Record<string, any>>;
  recetas: Array<Record<string, any>>;
  chunks: Array<Record<string, any>>;
}

// Exportaciones de worldCatalog.ts que ya tienen su sección propia: el barrido genérico las salta.
const EXPORTS_CON_SECCION = new Set([
  'items', 'fauna', 'npcs', 'harvestYields', 'harvestSourceRegion', 'harvestSourceDisplayName',
  'harvestSourceDescriptions', 'harvestSourceAliases',
]);

export function recortar(texto: unknown, max = 200): string {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function arr(v: unknown): Array<Record<string, any>> {
  return Array.isArray(v) ? (v as Array<Record<string, any>>) : [];
}
function dic(v: unknown): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set) ? (v as Record<string, any>) : {};
}

/** ¿Aparece el slug como valor de texto exacto (o clave) en cualquier parte de `v`? */
export function contieneSlug(v: unknown, slug: string, prof = 0): boolean {
  if (prof > 6 || v == null) return false;
  if (typeof v === 'string') return v === slug;
  if (v instanceof Set) return [...v].some((x) => contieneSlug(x, slug, prof + 1));
  if (Array.isArray(v)) return v.some((x) => contieneSlug(x, slug, prof + 1));
  if (typeof v === 'object') {
    return Object.entries(v as object).some(([k, x]) => k === slug || contieneSlug(x, slug, prof + 1));
  }
  return false;
}

function palabraEntera(texto: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}-])${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}-])`, 'iu');
}

function resumenCampos(o: Record<string, any>, campos: string[]): string {
  return campos
    .filter((c) => o[c] !== undefined && o[c] !== null && o[c] !== '' && !(Array.isArray(o[c]) && o[c].length === 0))
    .map((c) => `${c}=${Array.isArray(o[c]) ? o[c].join('|') : typeof o[c] === 'object' ? JSON.stringify(o[c]) : o[c]}`)
    .join(' · ');
}

export function nombreVisible(slug: string, d: FichaDatos): string | null {
  const c = d.catalogo;
  for (const k of ['items', 'fauna', 'npcs']) {
    const f = arr(c[k]).find((x) => x.slug === slug);
    if (f?.name) return String(f.name);
  }
  const n = dic(c.harvestSourceDisplayName)[slug];
  return typeof n === 'string' ? n : null;
}

function lineaYield(y: Record<string, any>, extra: string): string {
  const flags = ['sinTirada', 'requiereHerramienta', 'estacionRequerida'].filter((f) => y[f]).map((f) => (y[f] === true ? f : `${f}=${y[f]}`));
  return `  ${extra}  ${y.metodoObtencion} x${y.cantidad}${y.condicion ? ` — ${recortar(y.condicion, 120)}` : ''}${flags.length ? ` [${flags.join(',')}]` : ''}`;
}

/** Secciones con contenido, cada una como bloque de texto. Vacío = el slug no existe en nada. */
export function secciones(slug: string, d: FichaDatos): string[] {
  const c = d.catalogo;
  const out: string[] = [];

  const objeto = arr(c.items).find((x) => x.slug === slug);
  const fau = arr(c.fauna).find((x) => x.slug === slug);
  const npc = arr(c.npcs).find((x) => x.slug === slug);
  if (objeto) {
    out.push(`# Objeto: ${objeto.name}\n  ${resumenCampos(objeto, ['aliases', 'category', 'tipo', 'tier', 'valor', 'value', 'rareza', 'equipSlot', 'weight', 'peso'])}\n  ${recortar(objeto.description ?? objeto.descripcion)}`);
  }
  for (const [tipo, f] of [['Fauna', fau], ['NPC', npc]] as const) {
    if (!f) continue;
    out.push(`# ${tipo}: ${f.name}\n  ${resumenCampos(f, ['kind', 'aliases', 'faction', 'role', 'level', 'levelMax', 'locationSlug'])}\n  ${recortar(f.bio ?? f.description)}`);
  }

  const yields = arr(c.harvestYields);
  const comoFuente = yields.filter((y) => y.sourceSlug === slug);
  const comoResultado = yields.filter((y) => y.itemSlug === slug);
  if (comoFuente.length) {
    out.push(`# Despiece/rendimientos (fuente → ${comoFuente.length})\n${comoFuente.map((y) => lineaYield(y, y.itemSlug)).join('\n')}`);
  }
  if (comoResultado.length) {
    out.push(`# Se obtiene de (${comoResultado.length})\n${comoResultado.map((y) => lineaYield(y, y.sourceSlug)).join('\n')}`);
  }

  const region = dic(c.harvestSourceRegion)[slug];
  const nombre = dic(c.harvestSourceDisplayName)[slug];
  const desc = dic(c.harvestSourceDescriptions)[slug];
  const alias = dic(c.harvestSourceAliases)[slug];
  if (region || nombre || desc || alias) {
    out.push(`# Enciclopedia (fuente)\n  region=${region ?? '—'} · nombre=${nombre ?? '—'}${alias ? ` · alias=${(alias as string[]).join('|')}` : ''}${desc ? `\n  ${recortar(desc)}` : ''}`);
  }

  const pobs = d.poblaciones.filter((p) => p.targetSlug === slug);
  if (pobs.length) {
    out.push(`# Población\n${pobs.map((p) => `  ${p.targetType} ${p.label}: ${p.poblacion}/${p.poblacionMax} · ${Object.entries(p.distribucion ?? {}).map(([r, w]) => `${r} ${w}`).join(', ')}`).join('\n')}`);
  }

  const fabrican = d.recetas.filter((r) => r.resultCatalogSlug === slug);
  const usan = d.recetas.filter((r) => arr(r.ingredients).some((i) => [i.match, i.orMatch?.match].some((m) => m?.kind === 'exact' && m.catalogSlug === slug)));
  if (fabrican.length || usan.length) {
    const l = (r: Record<string, any>) => `  ${r.key}: ${arr(r.ingredients).map((i) => `${i.cantidad} ${i.match?.catalogSlug ?? `${i.match?.category}*`}`).join(' + ')} → ${r.resultCantidad ?? 1} ${r.resultName}${r.location ? ` @${[r.location].flat().join('|')}` : ''}`;
    if (fabrican.length) out.push(`# Recetas que lo fabrican (${fabrican.length})\n${fabrican.map(l).join('\n')}`);
    if (usan.length) out.push(`# Recetas que lo usan (${usan.length})\n${usan.map(l).join('\n')}`);
  }

  // Por etiqueta, o el slug o el nombre visible como palabra entera: «hielag» no es «Hielaga».
  const palabras = [slug, nombreVisible(slug, d)].filter((x): x is string => !!x).map(palabraEntera);
  const chunks = d.chunks.filter((ch) => arr(ch.tags).includes(slug as any) || palabras.some((re) => re.test(`${ch.title ?? ''} ${ch.text ?? ''}`)));
  if (chunks.length) {
    out.push(`# Chunks de lore (${chunks.length})\n${chunks.map((ch) => `  [${ch.type}] ${ch.title} — ${ch.sourceDoc}`).join('\n')}`);
  }

  const otros: string[] = [];
  for (const [nom, v] of Object.entries(c)) {
    if (EXPORTS_CON_SECCION.has(nom) || typeof v === 'function' || !v || typeof v !== 'object') continue;
    if (Array.isArray(v)) {
      const hits = v.filter((x) => contieneSlug(x, slug));
      if (hits.length) otros.push(`  ${nom}[${hits.length}/${v.length}]: ${recortar(JSON.stringify(hits[0]), 160)}${hits.length > 1 ? ' …' : ''}`);
    } else if (v instanceof Set) {
      if (v.has(slug)) otros.push(`  ${nom}: (Set) contiene el slug`);
    } else {
      const r = v as Record<string, unknown>;
      const directo = Object.prototype.hasOwnProperty.call(r, slug);
      const en = Object.entries(r).filter(([k, x]) => k !== slug && contieneSlug(x, slug)).map(([k]) => k);
      if (directo) otros.push(`  ${nom}[${slug}] = ${recortar(JSON.stringify(r[slug]), 160)}`);
      if (en.length) otros.push(`  ${nom}: valor en ${en.slice(0, 5).join(', ')}${en.length > 5 ? ' …' : ''}`);
    }
  }
  if (otros.length) out.push(`# Otras exportaciones de worldCatalog\n${otros.join('\n')}`);

  return out;
}

/** Slugs conocidos (items, fauna, npcs y fuentes de despiece). */
export function slugsConocidos(d: FichaDatos): string[] {
  const c = d.catalogo;
  const s = new Set<string>();
  for (const k of ['items', 'fauna', 'npcs']) for (const x of arr(c[k])) if (x.slug) s.add(x.slug);
  for (const k of ['harvestSourceRegion', 'harvestSourceDisplayName', 'harvestSourceDescriptions']) for (const x of Object.keys(dic(c[k]))) s.add(x);
  for (const y of arr(c.harvestYields)) if (y.sourceSlug) s.add(y.sourceSlug);
  return [...s];
}

function distancia(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

/** Los `n` slugs más parecidos: los que contienen el texto (o lo contiene) primero, luego por distancia de edición. */
export function parecidos(slug: string, candidatos: string[], n = 5): string[] {
  const q = slug.toLowerCase();
  const puntuado = candidatos.map((c) => {
    const l = c.toLowerCase();
    const sub = l.includes(q) || (q.length >= 3 && q.includes(l)) ? 0 : 1;
    return { c, sub, dist: distancia(q, l) };
  });
  return puntuado.sort((a, b) => a.sub - b.sub || a.dist - b.dist || a.c.localeCompare(b.c)).slice(0, n).map((p) => p.c);
}

export function ficha(slug: string, d: FichaDatos): { texto: string; encontrado: boolean } {
  const s = secciones(slug, d);
  if (s.length) return { texto: `== ${slug} ==\n${s.join('\n')}`, encontrado: true };
  return { texto: `No hay nada de «${slug}». ¿Quizá?\n${parecidos(slug, slugsConocidos(d)).map((x) => `  ${x}`).join('\n')}`, encontrado: false };
}

export async function cargarDatos(): Promise<FichaDatos> {
  const catalogo = (await import('./worldCatalog.js')) as unknown as Record<string, unknown>;
  const { worldPopulations } = await import('./worldPopulation.js');
  const { CRAFTING_RECIPES } = await import('../services/crafting.js');
  const { loreChunks } = await import('./loreChunks.js');
  return { catalogo, poblaciones: worldPopulations, recetas: CRAFTING_RECIPES as any, chunks: loreChunks };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) {
    console.error('uso: ficha.ts <slug> [--nombre]');
    process.exit(2);
  }
  const d = await cargarDatos();
  if (args.includes('--nombre')) {
    const n = nombreVisible(slug, d);
    if (n) console.log(n);
    return;
  }
  const r = ficha(slug, d);
  console.log(r.texto);
  process.exit(r.encontrado ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
