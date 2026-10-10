import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);
await verEstado(page, 'recorrido_35a_antes.png');

const skillIcon = page.locator('button').filter({ hasText: '✨' }).first();
await skillIcon.click();
await page.waitForTimeout(1000);
const saquearOption = page.getByText('Saquear', { exact: true });
if (await saquearOption.isVisible().catch(() => false)) {
  await saquearOption.click();
  await page.waitForTimeout(1000);
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log('Checkboxes:', count);
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
  await page.getByRole('button', { name: /SAQUEAR SELECCIONADOS/i }).click();
  console.log('Saqueo reenviado');
} else {
  console.log('No hay opción Saquear visible — puede que el turno anterior siga bloqueando la UI');
}

await page.waitForTimeout(3000);
await verEstado(page, 'recorrido_35b.png');
await browser.close();
