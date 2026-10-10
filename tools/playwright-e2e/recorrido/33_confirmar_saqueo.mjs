import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const skillIcon = page.locator('button').filter({ hasText: '✨' }).first();
await skillIcon.click();
await page.waitForTimeout(1000);
await page.getByText('Saquear', { exact: true }).click();
await page.waitForTimeout(1000);

const checkboxes = page.locator('input[type="checkbox"]');
const count = await checkboxes.count();
console.log('Checkboxes encontrados:', count);
for (let i = 0; i < count; i++) {
  await checkboxes.nth(i).check();
}

await page.getByRole('button', { name: /SAQUEAR SELECCIONADOS/i }).click();
await page.waitForTimeout(2000);
await verEstado(page, 'recorrido_33a.png');
console.log('Saqueo confirmado');

await browser.close();
