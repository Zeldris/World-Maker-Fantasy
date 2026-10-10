import { chromium } from 'playwright';
const SAVE_ID = 'cmtl5lcj80009ritspwg26cr3';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', err => console.log('[pageerror]', err.message));
await page.goto(`http://localhost:5173/solitario/partida/${SAVE_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Mapa', { exact: true }).click();
await page.waitForTimeout(1500);

// Intenta scrollear dentro del modal para ver si hay contenido oculto (leyenda, más info).
const modal = page.locator('text=La Hondonada del Eco').locator('..').locator('..');
await page.mouse.wheel(0, 400);
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/sesion02_10_mapa_scrolleado.png', fullPage: true });

// Comprueba overflow real del contenedor del modal.
const overflow = await page.evaluate(() => {
  const dialogs = document.querySelectorAll('[class*="fixed"], [role="dialog"]');
  return Array.from(dialogs).map(el => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    hasOverflow: el.scrollHeight > el.clientHeight,
  }));
});
console.log(JSON.stringify(overflow, null, 2));

await browser.close();
console.log('OK');
