import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const saquearBtn = page.getByRole('button', { name: /SAQUEAR TODO/i });
await saquearBtn.click();
await page.waitForTimeout(1500);
await verEstado(page, 'recorrido_28a.png');
console.log('Saqueado');

const salirBtn = page.getByRole('button', { name: /^SALIR$/i });
if (await salirBtn.isVisible().catch(() => false)) {
  await salirBtn.click();
  await page.waitForTimeout(1500);
  await verEstado(page, 'recorrido_28b_tras_salir.png');
  console.log('Salido del combate');
}

await browser.close();
