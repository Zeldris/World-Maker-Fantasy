import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/probar_recolectar';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

await page.locator('button', { hasText: 'Habilidades' }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS_DIR}/000_modal_habilidades.png` });

const recogerBtn = page.getByText('Recoger', { exact: true }).first();
if (await recogerBtn.count()) {
  await recogerBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS_DIR}/001_panel_recoger.png` });
  console.log('Panel de Recoger abierto.');
} else {
  console.log('No se encontró el botón "Recoger" en el modal.');
}

await browser.close();
