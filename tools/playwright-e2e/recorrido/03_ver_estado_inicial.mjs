import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.setDefaultTimeout(30000);

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const overlay = page.locator('.fixed.inset-0.z-50').first();
if (await overlay.isVisible().catch(() => false)) {
  const cerrar = page.getByRole('button', { name: /cerrar|salir|ignorar|continuar/i }).first();
  if (await cerrar.isVisible().catch(() => false)) {
    await cerrar.click();
    await page.waitForTimeout(1000);
  }
}

await page.screenshot({ path: 'screenshots/recorrido_03_estado_inicial.png', fullPage: true });
console.log('Título:', await page.title());

await browser.close();
