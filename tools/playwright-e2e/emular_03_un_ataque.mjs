import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/emular_partida';
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const label = process.argv[2] || `ataque_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);

const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

console.log('Esperando a que el composer esté habilitado...');
for (let tries = 0; tries < 60; tries++) {
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
  await page.waitForTimeout(1000);
}
const stillDisabled = await composer.isDisabled().catch(() => true);
if (stillDisabled) {
  console.log('Composer sigue bloqueado tras 60s de espera — capturando estado actual.');
  await page.screenshot({ path: `${SHOTS_DIR}/${label}_aun_bloqueado.png` });
  await browser.close();
  process.exit(0);
}

await composer.click();
await composer.fill('Ataco al Orco enfurecido con todas mis fuerzas.');
await page.waitForTimeout(150);
await actuarBtn.click();
console.log('Ataque enviado, esperando resolución (hasta 60s)...');
for (let tries = 0; tries < 60; tries++) {
  await page.waitForTimeout(1000);
  const disabled = await composer.isDisabled().catch(() => true);
  if (!disabled) break;
}
await page.screenshot({ path: `${SHOTS_DIR}/${label}.png` });
console.log('Captura guardada:', label);
await browser.close();
