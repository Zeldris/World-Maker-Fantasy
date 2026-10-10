import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

await page.getByRole('button', { name: 'Mapa' }).click();
await page.waitForTimeout(1000);
await page.getByText('Mapa', { exact: true }).last().click();
await page.waitForTimeout(1000);

const viajarBtn = page.getByRole('button', { name: /Viajar/i });
console.log('Botón Viajar visible:', await viajarBtn.isVisible().catch(() => false));
if (await viajarBtn.isVisible().catch(() => false)) {
  await viajarBtn.click();
  await page.waitForTimeout(1000);
  await verEstado(page, 'recorrido_39a_modal_viajar.png');
}

await browser.close();
