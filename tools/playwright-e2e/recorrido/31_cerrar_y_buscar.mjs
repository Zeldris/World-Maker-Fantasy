import { chromium } from 'playwright';
import { SAVE_ID, verEstado } from './lib.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(15000);
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const cerrar = page.getByRole('button', { name: 'Cerrar' });
if (await cerrar.isVisible().catch(() => false)) {
  await cerrar.click();
  await page.waitForTimeout(500);
}

// Buscar botones de saqueo real
const saquear = page.locator('button', { hasText: /[Ss]aquear/ });
const count = await saquear.count();
console.log('Botones de saqueo encontrados:', count);
for (let i = 0; i < count; i++) {
  console.log('  -', await saquear.nth(i).textContent());
}

await verEstado(page, 'recorrido_31a.png');
await browser.close();
