import { chromium } from 'playwright';
import fs from 'node:fs';

const SAVE_URL = 'http://localhost:5173/solitario/partida/cmtrge1j60001ri8x9ryt045s';
const SHOTS_DIR = 'screenshots/probar_mapa';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(SAVE_URL);
await page.waitForTimeout(2000);

// Cerrar el modal de Recoger si sigue abierto de la ejecución anterior.
const cancelarBtn = page.getByRole('button', { name: /^cancelar$/i });
if (await cancelarBtn.count()) {
  await cancelarBtn.click();
  await page.waitForTimeout(300);
}

await page.locator('button', { hasText: 'Mapa' }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOTS_DIR}/000_mapa_zona.png` });
console.log('Mapa de zona abierto.');

await browser.close();
