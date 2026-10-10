import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/emular_partida';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2500);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
await combatirBtn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOTS_DIR}/002_combate_orco_abierto.png` });

const composerContainer = page.locator('div.border-t.border-red-900\\/50');
const composer = composerContainer.locator('input[placeholder="O describe tu acción..."]');
const actuarBtn = composerContainer.getByRole('button', { name: /^actuar$/i });

async function atacar(texto, label) {
  for (let tries = 0; tries < 30; tries++) {
    const disabled = await composer.isDisabled().catch(() => true);
    if (!disabled) break;
    await page.waitForTimeout(500);
  }
  const stillDisabled = await composer.isDisabled().catch(() => true);
  if (stillDisabled) {
    console.log(`Composer bloqueado antes de "${label}".`);
    await page.screenshot({ path: `${SHOTS_DIR}/${label}_bloqueado.png` });
    return false;
  }
  await composer.click();
  await composer.fill(texto);
  await page.waitForTimeout(150);
  await actuarBtn.click();
  console.log(`"${label}" enviado — esperando (hasta 40s)...`);
  for (let tries = 0; tries < 80; tries++) {
    await page.waitForTimeout(500);
    const disabled = await composer.isDisabled().catch(() => true);
    if (!disabled) break;
  }
  await page.screenshot({ path: `${SHOTS_DIR}/${label}.png` });
  return true;
}

for (let i = 1; i <= 6; i++) {
  const ok = await atacar(`Ataco al Orco enfurecido con todas mis fuerzas, intento ${i}.`, `orco_ataque${i}`);
  if (!ok) break;
}

await browser.close();
console.log('Secuencia de combate contra el Orco completada.');
