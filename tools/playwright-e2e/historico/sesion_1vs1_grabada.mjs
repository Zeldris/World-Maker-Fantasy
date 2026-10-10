import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const VIDEO_DIR = 'videos';
const SHOTS_DIR = 'screenshots/sesion_1vs1';
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();

let shotIndex = 0;
async function shot(label) {
  shotIndex += 1;
  const name = `${String(shotIndex).padStart(3, '0')}_${label}.png`;
  await page.screenshot({ path: `${SHOTS_DIR}/${name}` });
  return name;
}

console.log('1. Cargando partida...');
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);
await shot('inicio');

console.log('2. Abriendo Habilidades (barra lateral) -> Cazar...');
const habilidadesLateral = page.locator('button', { hasText: 'Habilidades' }).first();
await habilidadesLateral.click({ timeout: 10000 });
await page.waitForTimeout(500);
await shot('modal_habilidades');

const cazarBtn = page.getByText('Cazar', { exact: true }).first();
await cazarBtn.click();
await page.waitForTimeout(800);
await shot('panel_cazar');

console.log('3. Explorando (tirada de avistamiento)...');
const explorarBtn = page.getByRole('button', { name: /explorar/i });
if (await explorarBtn.count()) {
  await explorarBtn.click();
  await page.waitForTimeout(3000);
  await shot('tras_explorar');
}

console.log('Fase 1 completada — revisar capturas antes de continuar con la selección de presa.');
await context.close();
await browser.close();
