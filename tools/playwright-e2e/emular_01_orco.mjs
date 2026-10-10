import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/emular_partida';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS_DIR}/000_inicio.png` });

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
await composer.click();
await composer.fill("Ataco al 'Orco enfurecido' que persigue a Gistera Koh.");
await page.waitForTimeout(150);
await page.getByRole('button', { name: /^actuar$/i }).first().click();
console.log('Ataque al Orco enviado — esperando resolución (hasta 40s)...');
for (let tries = 0; tries < 80; tries++) {
  await page.waitForTimeout(500);
  const disabled = await composer.getAttribute('aria-disabled').catch(() => 'true');
  if (disabled !== 'true') break;
}
await page.screenshot({ path: `${SHOTS_DIR}/001_tras_atacar_orco.png` });
console.log('Captura guardada.');
await browser.close();
