import { chromium } from 'playwright';

const SAVE_ID = 'cmtrge1j60001ri8x9ryt045s';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(20000);
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`);
await page.waitForTimeout(3000);

const combatirBtn = page.getByRole('button', { name: /combatir/i });
if (await combatirBtn.isVisible().catch(() => false)) {
  await combatirBtn.click();
  await page.waitForTimeout(2000);
}

const salirBtn = page.getByRole('button', { name: /^salir$/i });
console.log('Botón Salir visible:', await salirBtn.isVisible().catch(() => false));
if (await salirBtn.isVisible().catch(() => false)) {
  await salirBtn.click();
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: 'screenshot-mi-14-tras-salir.png', fullPage: false });

const composer = page.getByRole('textbox', { name: 'Acción de tu personaje' });
console.log('Composer aria-disabled tras salir:', await composer.getAttribute('aria-disabled').catch(() => 'N/A'));

await browser.close();
