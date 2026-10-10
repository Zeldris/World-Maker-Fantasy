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
await verEstado(page, 'recorrido_32a_skillbar.png');

const saquearBtn = page.getByText('Saquear', { exact: true });
console.log('Botón Saquear visible en skillbar:', await saquearBtn.isVisible().catch(() => false));
if (await saquearBtn.isVisible().catch(() => false)) {
  await saquearBtn.click();
  await page.waitForTimeout(1500);
  await verEstado(page, 'recorrido_32b_modal_saquear.png');
}

await browser.close();
