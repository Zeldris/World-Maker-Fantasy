#!/usr/bin/env node
// gw-media-content: turns the sources of an update's media into the images that get published.
//
//   node render.mjs <update-folder> [source...]
//
// Sources live in <update-folder>/medios/fuente/: .html and .svg are rendered with Playwright's Chromium at the
// size the file declares (<meta name="tamano" content="1600x900">, default 1600x900); .png and .jpg (game
// screenshots) are taken as they are. Each source becomes <update-folder>/medios/<name>.webp (1600 px wide at
// most) and <name>-mini.webp (720 px), the sizes the Portal uses. Without [source...], every source is rendered.
// Needs ImageMagick (`convert` with WebP) and the Chromium Playwright brings or that the cloud pre-installs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [carpeta, ...pedidas] = process.argv.slice(2);
if (!carpeta || carpeta === '--help' || carpeta === '-h') {
  console.log('Uso: node render.mjs <carpeta-de-la-actualización> [fuente...]');
  process.exit(carpeta ? 0 : 2);
}
const fuenteDir = resolve(carpeta, 'medios', 'fuente');
const salidaDir = resolve(carpeta, 'medios');
if (!existsSync(fuenteDir)) {
  console.error(`ERROR: no existe ${fuenteDir}; las fuentes de los medios van ahí`);
  process.exit(1);
}
const RENDERIZABLES = new Set(['.html', '.svg']);
const CAPTURAS = new Set(['.png', '.jpg', '.jpeg']);
const fuentes = (pedidas.length ? pedidas.map((p) => basename(p)) : readdirSync(fuenteDir))
  .filter((f) => RENDERIZABLES.has(extname(f).toLowerCase()) || CAPTURAS.has(extname(f).toLowerCase()))
  .sort();
if (!fuentes.length) {
  console.error(`ERROR: ninguna fuente .html, .svg, .png o .jpg en ${fuenteDir}`);
  process.exit(1);
}

function cargarPlaywright() {
  // Plain `import` resolves from this file's folder, where playwright is not installed; resolve it from the cwd,
  // then from the e2e tool, then from the global modules the cloud ships.
  const intentos = [process.cwd(), resolve('tools/playwright-e2e'), '/usr/lib/node_modules', '/usr/local/lib/node_modules'];
  for (const base of intentos) {
    try {
      return createRequire(join(base, 'noop.js'))('playwright');
    } catch {}
  }
  try {
    return createRequire(import.meta.url)('playwright');
  } catch {
    console.error('ERROR: no encuentro playwright (cd tools/playwright-e2e && npm ci)');
    process.exit(1);
  }
}

function tamano(ruta) {
  const m = readFileSync(ruta, 'utf8').match(/<meta\s+name="tamano"\s+content="(\d+)x(\d+)"/i);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1600, height: 900 };
}

function aWebp(png, nombre) {
  for (const [sufijo, ancho, calidad] of [['', 1600, 82], ['-mini', 720, 78]]) {
    const destino = join(salidaDir, `${nombre}${sufijo}.webp`);
    execFileSync('convert', [png, '-resize', `${ancho}x>`, '-strip', '-quality', String(calidad), destino]);
    console.log(`${destino} (${Math.round(statSync(destino).size / 1024)} KB)`);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'gw-media-'));
let navegador;
try {
  for (const f of fuentes) {
    const ruta = join(fuenteDir, f);
    if (!existsSync(ruta)) {
      console.error(`ERROR: no existe ${ruta}`);
      process.exitCode = 1;
      continue;
    }
    const nombre = basename(f, extname(f));
    if (CAPTURAS.has(extname(f).toLowerCase())) {
      aWebp(ruta, nombre);
      continue;
    }
    if (!navegador) {
      const { chromium } = cargarPlaywright();
      const exe = '/opt/pw-browsers/chromium';
      navegador = await chromium.launch(existsSync(exe) && statSync(exe).isFile() ? { executablePath: exe } : {});
    }
    const viewport = tamano(ruta);
    const pagina = await navegador.newPage({ viewport, deviceScaleFactor: 1 });
    await pagina.goto(pathToFileURL(ruta).href);
    await pagina.evaluate(() => document.fonts.ready);
    const png = join(tmp, `${nombre}.png`);
    await pagina.screenshot({ path: png, clip: { x: 0, y: 0, ...viewport } });
    await pagina.close();
    aWebp(png, nombre);
  }
} finally {
  await navegador?.close();
  rmSync(tmp, { recursive: true, force: true });
}
