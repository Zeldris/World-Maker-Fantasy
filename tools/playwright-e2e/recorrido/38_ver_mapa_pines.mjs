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

// Buscar los pines/marcadores clicables reales
const clicables = page.locator('.fixed.inset-0.z-50 button, .fixed.inset-0.z-50 [role="button"]');
const count = await clicables.count();
console.log('Elementos clicables en el mapa:', count);
for (let i = 0; i < Math.min(count, 20); i++) {
  const text = await clicables.nth(i).textContent().catch(() => '');
  console.log(`  [${i}]`, text?.slice(0, 60));
}

await verEstado(page, 'recorrido_38a.png');
await browser.close();
